"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
const logger_1 = require("./logger");
const configuration_1 = require("./configuration");
const twilsock_1 = require("./twilsock");
const packetinterface_1 = require("./packetinterface");
const websocketchannel_1 = require("./websocketchannel");
const registrations_1 = require("./services/registrations");
const upstream_1 = require("./services/upstream");
const deferred_1 = require("./deferred");
const index_1 = require("./index");
const offlinestorage_1 = require("./offlinestorage");
const tokenStorage_1 = require("./tokenStorage");
/**
 * @alias Twilsock
 * @classdesc Client library for the Twilsock service
 * It allows to recevie service-generated updates as well as bi-directional transport
 * @fires Twilsock#message
 * @fires Twilsock#connected
 * @fires Twilsock#disconnected
 * @fires Twilsock#tokenAboutToExpire
 * @fires Twilsock#stateChanged
 * @fires Twilsock#connectionError
 */
class TwilsockClient extends events_1.EventEmitter {
    /**
     * @param {string} token Twilio access token
     * @param {string} productId Product identifier. Should be the same as a grant name in token
     */
    constructor(token, productId, options = {}) {
        super();
        this.offlineStorageDeferred = new deferred_1.Deferred();
        options.continuationToken = options.continuationToken ? options.continuationToken : tokenStorage_1.TokenStorage.getStoredToken(productId);
        let config = this.config = new configuration_1.Configuration(token, productId, options);
        logger_1.log.setLevel(config.logLevel);
        let websocket = new websocketchannel_1.WebSocketChannel(config.url);
        let transport = options.transport
            ? options.transport
            : new packetinterface_1.PacketInterface(websocket, config);
        this.channel = options.channel
            ? options.channel
            : new twilsock_1.TwilsockImpl(websocket, transport, config);
        this.registrations = options.registrations
            ? options.registrations
            : new registrations_1.Registrations(transport);
        this.upstream = new upstream_1.Upstream(transport, this.channel, config);
        this.registrations.on('registered', (id) => this.emit('registered', id));
        this.channel.on('message', (type, message) => setTimeout(() => this.emit('message', type, message), 0));
        this.channel.on('stateChanged', state => setTimeout(() => this.emit('stateChanged', state), 0));
        this.channel.on('connectionError', (connectionError) => setTimeout(() => this.emit('connectionError', connectionError), 0));
        this.channel.on('tokenAboutToExpire', () => setTimeout(() => this.emit('tokenAboutToExpire'), 0));
        this.channel.on('tokenExpired', () => setTimeout(() => this.emit('tokenExpired'), 0));
        this.channel.on('connected', () => this.registrations.updateRegistrations());
        this.channel.on('connected', () => this.upstream.sendPendingMessages());
        this.channel.on('connected', () => setTimeout(() => this.emit('connected'), 0));
        this.channel.on('initialized', (initReply) => {
            this.handleStorageId(productId, initReply);
            tokenStorage_1.TokenStorage.storeToken(initReply.continuationToken, productId);
            setTimeout(() => this.emit('initialized', initReply), 0);
        });
        this.channel.on('disconnected', () => setTimeout(() => this.emit('disconnected'), 0));
        this.channel.on('disconnected', () => this.upstream.rejectPendingMessages());
        this.channel.on('disconnected', () => this.offlineStorageDeferred.fail(new index_1.TwilsockError('Client disconnected')));
        this.offlineStorageDeferred.promise.catch(() => { });
    }
    emit(event, ...args) {
        logger_1.log.debug(`Emitting ${event.toString()}(${args.map(a => JSON.stringify(a)).join(', ')})`);
        return super.emit(event, ...args);
    }
    handleStorageId(productId, initReply) {
        if (!initReply.offlineStorage) {
            this.offlineStorageDeferred.fail(new index_1.TwilsockError('No offline storage id'));
        }
        else if (initReply.offlineStorage.hasOwnProperty(productId)) {
            try {
                this.offlineStorageDeferred.set(offlinestorage_1.OfflineProductStorage.create(initReply.offlineStorage[productId]));
                logger_1.log.debug(`Offline storage for '${productId}' product: ${JSON.stringify(initReply.offlineStorage[productId])}.`);
            }
            catch (e) {
                this.offlineStorageDeferred.fail(new index_1.TwilsockError(`Failed to parse offline storage for ${productId} ${JSON.stringify(initReply.offlineStorage[productId])}. ${e}.`));
            }
        }
        else {
            this.offlineStorageDeferred.fail(new index_1.TwilsockError(`No offline storage id for '${productId}' product: ${JSON.stringify(initReply.offlineStorage)}`));
        }
    }
    /**
     * Get offline storage ID
     * @returns {Promise<OfflineProductStorage>}
     */
    storageId() {
        return this.offlineStorageDeferred.promise;
    }
    /**
     * Indicates if twilsock is connected now
     * @returns {Boolean}
     */
    get isConnected() {
        return this.channel.isConnected;
    }
    /**
     * Current state
     * @returns {String}
     */
    get state() {
        return this.channel.state;
    }
    /**
     * Update token
     * @param {String} token
     * @returns {Promise<void>}
     */
    async updateToken(token) {
        logger_1.log.trace(`updating token '${token}'`);
        if (this.config.token === token) {
            return;
        }
        this.config.updateToken(token);
        return this.channel.updateToken(token);
    }
    /**
     * Updates notification context.
     * This method shouldn't be used anyone except twilio notifications library
     * @param contextId id of notification context
     * @param context value of notification context
     * @private
     */
    setNotificationsContext(contextId, context) {
        this.registrations.setNotificationsContext(contextId, context);
    }
    /**
     * Remove notification context.
     * This method shouldn't be used anyone except twilio notifications library
     * @param contextId id of notification context
     * @private
     */
    removeNotificationsContext(contextId) {
        this.registrations.removeNotificationsContext(contextId);
    }
    /**
     * Connect to the server
     * @fires Twilsock#connected
     * @public
     * @returns {Promise<void>}
     */
    connect() {
        return this.channel.connect();
    }
    /**
     * Disconnect from the server
     * @fires Twilsock#disconnected
     * @public
     * @returns {Promise<void>}
     */
    disconnect() {
        return this.channel.disconnect();
    }
    /**
     * Get HTTP request to upstream service
     * @param {string} url Upstream service url
     * @param {headers} headers Set of custom headers
     * @returns {Promise}
     */
    get(url, headers) {
        return this.upstream.send('GET', url, headers);
    }
    /**
     * Post HTTP request to upstream service
     * @param {string} url Upstream service url
     * @param {headers} headers Set of custom headers
     * @param {body} body Body to send
     * @returns {Promise}
     */
    post(url, headers, body) {
        return this.upstream.send('POST', url, headers, body);
    }
    /**
     * Put HTTP request to upstream service
     * @param {string} url Upstream service url
     * @param {headers} headers Set of custom headers
     * @param {body} body Body to send
     * @returns {Promise}
     */
    put(url, headers, body) {
        return this.upstream.send('PUT', url, headers, body);
    }
    /**
     * Delete HTTP request to upstream service
     * @param {string} url Upstream service url
     * @param {headers} headers Set of custom headers
     * @returns {Promise}
     */
    delete(url, headers) {
        return this.upstream.send('DELETE', url, headers);
    }
}
exports.TwilsockClient = TwilsockClient;
exports.Twilsock = TwilsockClient;
/**
 * Twilsock destination address descriptor
 * @typedef {Object} Twilsock#Address
 * @property {String} method - HTTP method. (POST, PUT, etc)
 * @property {String} host - host name without path. (e.g. my.company.com)
 * @property {String} path - path on the host (e.g. /my/app/to/call.php)
 */
/**
 * Twilsock upstream message
 * @typedef {Object} Twilsock#Message
 * @property {Twilsock#Address} to - destination address
 * @property {Object} headers - HTTP headers
 * @property {Object} body - Body
 */
/**
 * Fired when new message received
 * @param {Twilsock#Message} message
 * @event Twilsock#message
 */
/**
 * Fired when socket connected
 * @param {String} URI of endpoint
 * @event Twilsock#connected
 */
/**
 * Fired when socket disconnected
 * @event Twilsock#disconnected
 */
/**
 * Fired when token is about to expire and should be updated
 * @event Twilsock#tokenAboutToExpire
 */
/**
* Fired when socket connected
* @param {('connecting'|'connected'|'rejected'|'disconnecting'|'disconnected')} state - general twilsock state
* @event Twilsock#stateChanged
*/
/**
 * Fired when connection is interrupted by unexpected reason
 * @type {Object}
 * @property {Boolean} terminal - twilsock will stop connection attempts
 * @property {String} message - root cause
 * @property {Number} [httpStatusCode] - http status code if available
 * @property {Number} [errorCode] - Twilio public error code if available
 * @event Twilsock#connectionError
 */
