/* twilsock.js 0.5.10
The following license applies to all parts of this software except as
documented below.

    Copyright (c) 2016, Twilio, inc.
    All rights reserved.

    Redistribution and use in source and binary forms, with or without
    modification, are permitted provided that the following conditions are
    met:

      1. Redistributions of source code must retain the above copyright
         notice, this list of conditions and the following disclaimer.

      2. Redistributions in binary form must reproduce the above copyright
         notice, this list of conditions and the following disclaimer in
         the documentation and/or other materials provided with the
         distribution.

      3. Neither the name of Twilio nor the names of its contributors may
         be used to endorse or promote products derived from this software
         without specific prior written permission.

    THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
    "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
    LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
    A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
    HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
    SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
    LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
    DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
    THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
    (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
    OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

This software includes javascript-state-machine under the following license.

    Copyright (c) 2012, 2013, 2014, 2015, Jake Gordon and contributors

    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to deal
    in the Software without restriction, including without limitation the rights
    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in all
    copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE

This software includes loglevel under the following license.

    Copyright (c) 2013 Tim Perry

    Permission is hereby granted, free of charge, to any person
    obtaining a copy of this software and associated documentation
    files (the "Software"), to deal in the Software without
    restriction, including without limitation the rights to use,
    copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the
    Software is furnished to do so, subject to the following
    conditions:

    The above copyright notice and this permission notice shall be
    included in all copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
    EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
    OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
    NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
    HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
    WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
    FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
    OTHER DEALINGS IN THE SOFTWARE.

*/

(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}(g.Twilio || (g.Twilio = {})).Twilsock = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
const operation_retrier_1 = require("operation-retrier");
/**
 * Retrier with backoff override capability
*/
class BackoffRetrier extends events_1.EventEmitter {
    get inProgress() {
        return !!this.retrier;
    }
    constructor(options) {
        super();
        this.options = options ? Object.assign({}, options) : {};
    }
    /**
     * Should be called once per attempt series to start retrier.
    */
    start() {
        if (this.inProgress) {
            throw new Error('Already waiting for next attempt, call finishAttempt(success : boolean) to finish it');
        }
        this.createRetrier();
    }
    /**
     * Should be called to stop retrier entirely.
    */
    stop() {
        this.cleanRetrier();
        this.newBackoff = null;
        this.usedBackoff = null;
    }
    /**
     * Modifies backoff for next attempt.
     * Expected behavior:
     * - If there was no backoff passed previously reschedulling next attempt to given backoff
     * - If previous backoff was longer then ignoring this one.
     * - If previous backoff was shorter then reschedulling with this one.
     * With or without backoff retrier will keep growing normally.
     * @param delay delay of next attempts in ms.
     */
    modifyBackoff(delay) {
        this.newBackoff = delay;
    }
    /**
     * Mark last emmited attempt as failed, initiating either next of fail if limits were hit.
    */
    attemptFailed() {
        if (!this.inProgress) {
            throw new Error('No attempt is in progress');
        }
        if (this.newBackoff) {
            const shouldUseNewBackoff = !this.usedBackoff || this.usedBackoff < this.newBackoff;
            if (shouldUseNewBackoff) {
                this.createRetrier();
            } else {
                this.retrier.failed(new Error());
            }
        } else {
            this.retrier.failed(new Error());
        }
    }
    cancel() {
        if (this.retrier) {
            this.retrier.cancel();
        }
    }
    cleanRetrier() {
        if (this.retrier) {
            this.retrier.removeAllListeners();
            this.retrier.cancel();
            this.retrier = null;
        }
    }
    getRetryPolicy() {
        const clone = Object.assign({}, this.options);
        if (this.newBackoff) {
            clone.min = this.newBackoff;
            clone.max = this.options.max && this.options.max > this.newBackoff ? this.options.max : this.newBackoff;
        }
        // As we're always skipping first attempt we should add one extra if limit is present
        clone.maxAttemptsCount = this.options.maxAttemptsCount ? this.options.maxAttemptsCount + 1 : undefined;
        return clone;
    }
    createRetrier() {
        this.cleanRetrier();
        const retryPolicy = this.getRetryPolicy();
        this.retrier = new operation_retrier_1.Retrier(retryPolicy);
        this.retrier.once('attempt', () => {
            this.retrier.on('attempt', () => this.emit('attempt'));
            this.retrier.failed(new Error('Skipping first attempt'));
        });
        this.retrier.on('failed', err => this.emit('failed', err));
        this.usedBackoff = this.newBackoff;
        this.newBackoff = null;
        this.retrier.start().catch(err => {});
    }
}
exports.BackoffRetrier = BackoffRetrier;

},{"events":29,"operation-retrier":33}],2:[function(require,module,exports){
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
        let transport = options.transport ? options.transport : new packetinterface_1.PacketInterface(websocket, config);
        this.channel = options.channel ? options.channel : new twilsock_1.TwilsockImpl(websocket, transport, config);
        this.registrations = options.registrations ? options.registrations : new registrations_1.Registrations(transport);
        this.upstream = new upstream_1.Upstream(transport, this.channel, config);
        this.registrations.on('registered', id => this.emit('registered', id));
        this.channel.on('message', (type, message) => setTimeout(() => this.emit('message', type, message), 0));
        this.channel.on('stateChanged', state => setTimeout(() => this.emit('stateChanged', state), 0));
        this.channel.on('connectionError', connectionError => setTimeout(() => this.emit('connectionError', connectionError), 0));
        this.channel.on('tokenAboutToExpire', () => setTimeout(() => this.emit('tokenAboutToExpire'), 0));
        this.channel.on('tokenExpired', () => setTimeout(() => this.emit('tokenExpired'), 0));
        this.channel.on('connected', () => this.registrations.updateRegistrations());
        this.channel.on('connected', () => this.upstream.sendPendingMessages());
        this.channel.on('connected', () => setTimeout(() => this.emit('connected'), 0));
        this.channel.on('initialized', initReply => {
            this.handleStorageId(productId, initReply);
            tokenStorage_1.TokenStorage.storeToken(initReply.continuationToken, productId);
            setTimeout(() => this.emit('initialized', initReply), 0);
        });
        this.channel.on('disconnected', () => setTimeout(() => this.emit('disconnected'), 0));
        this.channel.on('disconnected', () => this.upstream.rejectPendingMessages());
        this.channel.on('disconnected', () => this.offlineStorageDeferred.fail(new index_1.TwilsockError('Client disconnected')));
        this.offlineStorageDeferred.promise.catch(() => {});
    }
    emit(event, ...args) {
        logger_1.log.debug(`Emitting ${event.toString()}(${args.map(a => JSON.stringify(a)).join(', ')})`);
        return super.emit(event, ...args);
    }
    handleStorageId(productId, initReply) {
        if (!initReply.offlineStorage) {
            this.offlineStorageDeferred.fail(new index_1.TwilsockError('No offline storage id'));
        } else if (initReply.offlineStorage.hasOwnProperty(productId)) {
            try {
                this.offlineStorageDeferred.set(offlinestorage_1.OfflineProductStorage.create(initReply.offlineStorage[productId]));
                logger_1.log.debug(`Offline storage for '${productId}' product: ${JSON.stringify(initReply.offlineStorage[productId])}.`);
            } catch (e) {
                this.offlineStorageDeferred.fail(new index_1.TwilsockError(`Failed to parse offline storage for ${productId} ${JSON.stringify(initReply.offlineStorage[productId])}. ${e}.`));
            }
        } else {
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

},{"./configuration":3,"./deferred":4,"./index":9,"./logger":10,"./offlinestorage":12,"./packetinterface":13,"./services/registrations":23,"./services/upstream":24,"./tokenStorage":25,"./twilsock":26,"./websocketchannel":27,"events":29}],3:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
let packageVersion = '0.5.10';
/**
 * Settings container for the Twilsock client library
 */
class Configuration {
    /**
     * @param {String} token - authentication token
     * @param {Object} options - options to override defaults
     */
    constructor(token, activeGrant, options = {}) {
        this.activeGrant = activeGrant;
        this._token = token;
        const region = options.region || 'us1';
        const defaultTwilsockUrl = `wss://tsock.${region}.twilio.com/v3/wsconnect`;
        let twilsockOptions = options.twilsock || options.Twilsock || {};
        this.url = twilsockOptions.uri || defaultTwilsockUrl;
        this._continuationToken = options.continuationToken ? options.continuationToken : null;
        this.logLevel = options.logLevel ? options.logLevel : 'error';
        this.retryPolicy = options.retryPolicy ? options.retryPolicy : {
            min: 1 * 1000,
            max: 2 * 60 * 1000,
            randomness: 0.2
        };
        this.clientMetadata = options.clientMetadata ? options.clientMetadata : {};
        this.clientMetadata.ver = packageVersion;
        this.initRegistrations = options.initRegistrations ? options.initRegistrations : null;
        this.tweaks = options.tweaks ? options.tweaks : null;
    }
    get token() {
        return this._token;
    }
    get continuationToken() {
        return this._continuationToken;
    }
    updateToken(token) {
        this._token = token;
    }
    updateContinuationToken(continuationToken) {
        this._continuationToken = continuationToken;
    }
}
exports.Configuration = Configuration;

},{}],4:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
class Deferred {
    constructor() {
        this._promise = new Promise((resolve, reject) => {
            this._resolve = resolve;
            this._reject = reject;
        });
    }
    get promise() {
        return this._promise;
    }
    update(value) {
        this._resolve(value);
    }
    set(value) {
        this.current = value;
        this._resolve(value);
    }
    fail(e) {
        this._reject(e);
    }
}
exports.Deferred = Deferred;

},{}],5:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
const twilsockerror_1 = require("./twilsockerror");
class TransportUnavailableError extends twilsockerror_1.TwilsockError {
    constructor(description) {
        super(description);
    }
}
exports.TransportUnavailableError = TransportUnavailableError;

},{"./twilsockerror":6}],6:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
class TwilsockError extends Error {
    constructor(description) {
        super(description);
    }
}
exports.TwilsockError = TwilsockError;

},{}],7:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
const twilsockerror_1 = require("./twilsockerror");
class TwilsockReplyError extends twilsockerror_1.TwilsockError {
    constructor(description, reply) {
        super(description);
        this.reply = reply;
    }
}
exports.TwilsockReplyError = TwilsockReplyError;

},{"./twilsockerror":6}],8:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
const twilsockerror_1 = require("./twilsockerror");
class TwilsockUpstreamError extends twilsockerror_1.TwilsockError {
    constructor(status, description, body) {
        super(description);
        this.status = status;
        this.description = description;
        this.body = body;
    }
}
exports.TwilsockUpstreamError = TwilsockUpstreamError;

},{"./twilsockerror":6}],9:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("./client");
exports.TwilsockClient = client_1.TwilsockClient;
exports.Twilsock = client_1.TwilsockClient;
const twilsockerror_1 = require("./error/twilsockerror");
exports.TwilsockError = twilsockerror_1.TwilsockError;
const transportunavailableerror_1 = require("./error/transportunavailableerror");
exports.TransportUnavailableError = transportunavailableerror_1.TransportUnavailableError;

},{"./client":2,"./error/transportunavailableerror":5,"./error/twilsockerror":6}],10:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
const log = require("loglevel");
function prepareLine(prefix, args) {
    return [`${new Date().toISOString()} Twilsock ${prefix}:`].concat(Array.from(args));
}
class Logger {
    constructor(prefix) {
        this.prefix = '';
        this.prefix = prefix !== null && prefix !== undefined && prefix.length > 0 ? ' ' + prefix + ':' : '';
    }
    setLevel(level) {
        log.setLevel(level);
    }
    static setLevel(level) {
        log.setLevel(level);
    }
    trace(...args) {
        log.debug.apply(null, prepareLine('T', args));
    }
    debug(...args) {
        log.debug.apply(null, prepareLine('D', args));
    }
    info(...args) {
        log.info.apply(null, prepareLine('I', args));
    }
    warn(...args) {
        log.warn.apply(null, prepareLine('W', args));
    }
    error(...args) {
        log.error.apply(null, prepareLine('E', args));
    }
    static trace(...args) {
        log.trace.apply(null, prepareLine('T', args));
    }
    static debug(...args) {
        log.debug.apply(null, prepareLine('D', args));
    }
    static info(...args) {
        log.info.apply(null, prepareLine('I', args));
    }
    static warn(...args) {
        log.warn.apply(null, prepareLine('W', args));
    }
    static error(...args) {
        log.error.apply(null, prepareLine('E', args));
    }
}
exports.Logger = Logger;
let logInstance = new Logger('');
exports.log = logInstance;

},{"loglevel":31}],11:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
const platform = require("platform");
class Metadata {
    static getMetadata(options) {
        let platformInfo = typeof navigator !== 'undefined' ? platform.parse(navigator.userAgent) : platform;
        let overrides = options && options.clientMetadata ? options.clientMetadata : {};
        const fieldNames = ['ver', 'env', 'envv', 'os', 'osv', 'osa', 'type', 'sdk', 'sdkv', 'dev', 'devv', 'devt', 'app', 'appv'];
        const defaults = {
            'env': platform.name,
            'envv': platform.version,
            'os': platform.os.family,
            'osv': platform.os.version,
            'osa': platform.os.architecture,
            'sdk': 'js-default'
        };
        let finalClientMetadata = {};
        fieldNames.filter(key => key in overrides || key in defaults).forEach(key => finalClientMetadata[key] = key in overrides ? overrides[key] : defaults[key]);
        return finalClientMetadata;
    }
}
exports.Metadata = Metadata;

},{"platform":35}],12:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("./index");
class OfflineProductStorage {
    constructor(id) {
        this.id = id;
    }
    static create(productPayload) {
        if (productPayload instanceof Object && 'storage_id' in productPayload) {
            return new OfflineProductStorage(productPayload.storage_id);
        } else {
            throw new index_1.TwilsockError('Field "storage_id" is missing');
        }
    }
}
exports.OfflineProductStorage = OfflineProductStorage;

},{"./index":9}],13:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
const logger_1 = require("./logger");
const uuid_1 = require("uuid");
const twilsockerror_1 = require("./error/twilsockerror");
const twilsockreplyerror_1 = require("./error/twilsockreplyerror");
const parser_1 = require("./parser");
const Messages = require("./protocol/messages");
const metadata_1 = require("./metadata");
const REQUEST_TIMEOUT = 30000;
function isHttpSuccess(code) {
    return code >= 200 && code < 300;
}
/**
 * Makes sure that body is properly stringified
 */
function preparePayload(payload) {
    switch (typeof payload) {
        case 'undefined':
            return '';
        case 'object':
            return JSON.stringify(payload);
        default:
            return payload;
    }
}
class PacketRequest {}
class PacketResponse {}
exports.PacketResponse = PacketResponse;
class PacketInterface {
    constructor(channel, config) {
        this.config = config;
        this.activeRequests = new Map();
        this.channel = channel;
        this.channel.on('reply', reply => this.processReply(reply));
        this.channel.on('disconnected', () => {
            this.activeRequests.forEach(descriptor => {
                clearTimeout(descriptor.timeout);
                descriptor.reject(new twilsockerror_1.TwilsockError('disconnected'));
            });
            this.activeRequests.clear();
        });
    }
    get isConnected() {
        return this.channel.isConnected;
    }
    processReply(reply) {
        const request = this.activeRequests.get(reply.id);
        if (request) {
            clearTimeout(request.timeout);
            this.activeRequests.delete(reply.id);
            if (!isHttpSuccess(reply.status.code)) {
                request.reject(new twilsockreplyerror_1.TwilsockReplyError('Transport failure: ' + reply.status.status, reply));
                logger_1.log.trace('message rejected');
            } else {
                request.resolve(reply);
            }
        }
    }
    storeRequest(id, resolve, reject) {
        let requestDescriptor = {
            resolve: resolve,
            reject: reject,
            timeout: setTimeout(() => {
                logger_1.log.trace('request', id, 'is timed out');
                reject(new twilsockerror_1.TwilsockError('Twilsock: request timeout: ' + id));
            }, REQUEST_TIMEOUT)
        };
        this.activeRequests.set(id, requestDescriptor);
    }
    shutdown() {
        this.activeRequests.forEach(descriptor => {
            clearTimeout(descriptor.timeout);
            descriptor.reject(new twilsockerror_1.TwilsockError('Twilsock: request cancelled by user'));
        });
        this.activeRequests.clear();
    }
    async sendInit() {
        logger_1.log.trace('sendInit');
        let metadata = metadata_1.Metadata.getMetadata(this.config);
        let message = new Messages.Init(this.config.token, this.config.continuationToken, metadata, this.config.initRegistrations, this.config.tweaks);
        let response = await this.sendWithReply(message);
        return new Messages.InitReply(response.id, response.header.continuation_token, response.header.continuation_token_status, response.header.offline_storage, response.header.init_registrations, response.header.debug_info);
    }
    sendClose() {
        let message = new Messages.Close();
        this.send(message);
    }
    sendWithReply(header, payload) {
        return new Promise((resolve, reject) => {
            let id = this.send(header, payload);
            this.storeRequest(id, resolve, reject);
        });
    }
    send(header, payload) {
        header.id = header.id || `TM${uuid_1.v4()}`;
        let message = parser_1.Parser.createPacket(header, preparePayload(payload));
        try {
            this.channel.send(message);
            return header.id;
        } catch (e) {
            logger_1.log.debug('failed to send ', header, e);
            logger_1.log.trace(e.stack);
            throw e;
        }
    }
}
exports.PacketInterface = PacketInterface;

},{"./error/twilsockerror":6,"./error/twilsockreplyerror":7,"./logger":10,"./metadata":11,"./parser":14,"./protocol/messages":17,"uuid":36}],14:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
const logger_1 = require("./logger");
function byteLength(s) {
    let escstr = encodeURIComponent(s);
    let binstr = escstr.replace(/%([0-9A-F]{2})/g, (match, p1) => String.fromCharCode('0x' + p1));
    return binstr.length;
}
function stringToUint8Array(s) {
    let escstr = encodeURIComponent(s);
    let binstr = escstr.replace(/%([0-9A-F]{2})/g, (match, p1) => String.fromCharCode('0x' + p1));
    let ua = new Uint8Array(binstr.length);
    Array.prototype.forEach.call(binstr, (ch, i) => {
        ua[i] = ch.charCodeAt(0);
    });
    return ua;
}
function uint8ArrayToString(ua) {
    let binstr = Array.prototype.map.call(ua, ch => String.fromCharCode(ch)).join('');
    let escstr = binstr.replace(/(.)/g, (m, p) => {
        let code = p.charCodeAt(0).toString(16).toUpperCase();
        if (code.length < 2) {
            code = '0' + code;
        }
        return '%' + code;
    });
    return decodeURIComponent(escstr);
}
function getJsonObject(array) {
    return JSON.parse(uint8ArrayToString(array));
}
function getMagic(buffer) {
    let strMagic = '';
    let idx = 0;
    for (; idx < buffer.length; ++idx) {
        const chr = String.fromCharCode(buffer[idx]);
        strMagic += chr;
        if (chr === '\r') {
            idx += 2;
            break;
        }
    }
    const magics = strMagic.split(' ');
    return {
        size: idx,
        protocol: magics[0],
        version: magics[1],
        headerSize: Number(magics[2])
    };
}
class Parser {
    constructor() {}
    static parse(message) {
        const fieldMargin = 2;
        const dataView = new Uint8Array(message);
        const magic = getMagic(dataView);
        if (magic.protocol !== 'TWILSOCK' || magic.version !== 'V3.0') {
            logger_1.log.error(`unsupported protocol: ${magic.protocol} ver ${magic.version}`);
            //throw new Error('Unsupported protocol');
            //this.fsm.unsupportedProtocol();
            return;
        }
        let header = null;
        try {
            header = getJsonObject(dataView.subarray(magic.size, magic.size + magic.headerSize));
        } catch (e) {
            logger_1.log.error('failed to parse message header', e, message);
            //throw new Error('Failed to parse message');
            //this.fsm.protocolError();
            return;
        }
        logger_1.log.debug('message received: ', header.method);
        logger_1.log.trace('message received: ', header);
        let payload = null;
        if (header.payload_size > 0) {
            const payloadOffset = fieldMargin + magic.size + magic.headerSize;
            const payloadSize = header.payload_size;
            if (!header.hasOwnProperty('payload_type') || header.payload_type.indexOf('application/json') === 0) {
                try {
                    payload = getJsonObject(dataView.subarray(payloadOffset, payloadOffset + payloadSize));
                } catch (e) {
                    logger_1.log.error('failed to parse message body', e, message);
                    //this.fsm.protocolError();
                    return;
                }
            } else if (header.payload_type.indexOf('text/plain') === 0) {
                payload = uint8ArrayToString(dataView.subarray(payloadOffset, payloadOffset + payloadSize));
            }
        }
        return { method: header.method, header, payload };
    }
    static createPacket(header, payloadString = '') {
        header.payload_size = byteLength(payloadString); // eslint-disable-line camelcase
        let headerString = JSON.stringify(header) + '\r\n';
        let magicString = 'TWILSOCK V3.0 ' + (byteLength(headerString) - 2) + '\r\n';
        logger_1.log.debug('send request:', magicString + headerString + payloadString);
        let message = stringToUint8Array(magicString + headerString + payloadString);
        return message.buffer;
    }
}
exports.Parser = Parser;

},{"./logger":10}],15:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
const uuid_1 = require("uuid");
class AbstractMessage {
    constructor(id) {
        this.id = id || `TM${uuid_1.v4()}`;
    }
}
exports.AbstractMessage = AbstractMessage;

},{"uuid":36}],16:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
const abstractmessage_1 = require("./abstractmessage");
class Close extends abstractmessage_1.AbstractMessage {
    constructor() {
        super();
        this.method = 'close';
    }
}
exports.Close = Close;

},{"./abstractmessage":15}],17:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
const init_1 = require("./init");
exports.Init = init_1.Init;
const initReply_1 = require("./initReply");
exports.InitReply = initReply_1.InitReply;
const update_1 = require("./update");
exports.Update = update_1.Update;
const message_1 = require("./message");
exports.Message = message_1.Message;
const reply_1 = require("./reply");
exports.Reply = reply_1.Reply;
const close_1 = require("./close");
exports.Close = close_1.Close;

},{"./close":16,"./init":18,"./initReply":19,"./message":20,"./reply":21,"./update":22}],18:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
const abstractmessage_1 = require("./abstractmessage");
class Init extends abstractmessage_1.AbstractMessage {
    constructor(token, continuationToken, metadata, registrations = null, tweaks = null) {
        super();
        this.method = 'init';
        this.token = token;
        this.continuation_token = continuationToken;
        this.metadata = metadata;
        this.registrations = registrations;
        this.tweaks = tweaks;
        this.capabilities = ['client_update', 'offline_storage'];
    }
}
exports.Init = Init;

},{"./abstractmessage":15}],19:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
const abstractmessage_1 = require("./abstractmessage");
class ContinuationTokenStatus {}
exports.ContinuationTokenStatus = ContinuationTokenStatus;
class InitReply extends abstractmessage_1.AbstractMessage {
    constructor(id, continuationToken, continuationTokenStatus, offlineStorage, initRegistrations, debugInfo) {
        super(id);
        this.continuationToken = continuationToken;
        this.continuationTokenStatus = continuationTokenStatus;
        this.offlineStorage = offlineStorage;
        this.initRegistrations = initRegistrations;
        this.debugInfo = debugInfo;
    }
}
exports.InitReply = InitReply;

},{"./abstractmessage":15}],20:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
const abstractmessage_1 = require("./abstractmessage");
class Message extends abstractmessage_1.AbstractMessage {
    constructor(grant, contentType, request) {
        super();
        this.method = 'message';
        this.active_grant = grant;
        this.payload_type = contentType;
        this.http_request = request;
    }
}
exports.Message = Message;

},{"./abstractmessage":15}],21:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
const abstractmessage_1 = require("./abstractmessage");
class Reply extends abstractmessage_1.AbstractMessage {
    constructor(id) {
        super(id);
        this.method = 'reply';
        this.payload_type = 'application/json';
        this.status = { code: 200, status: 'OK' };
    }
}
exports.Reply = Reply;

},{"./abstractmessage":15}],22:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
const abstractmessage_1 = require("./abstractmessage");
class Update extends abstractmessage_1.AbstractMessage {
    constructor(token) {
        super();
        this.method = 'update';
        this.token = token;
    }
}
exports.Update = Update;

},{"./abstractmessage":15}],23:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
const logger_1 = require("../logger");
const events_1 = require("events");
const uuid_1 = require("uuid");
const twilsockerror_1 = require("../error/twilsockerror");
/**
 * Registrations module handles all operations with registration contexts through twilsock
 * Main role: it automatically refreshes all registrations after reconnect.
 */
class Registrations extends events_1.EventEmitter {
    constructor(transport) {
        super();
        this.transport = transport;
        this.registrations = new Map();
        this.registrationsInProgress = new Map();
    }
    async putNotificationContext(contextId, context) {
        const header = { method: 'put_notification_ctx', notification_ctx_id: contextId };
        let reply = await this.transport.sendWithReply(header, context);
    }
    async deleteNotificationContext(contextId) {
        let message = { method: 'delete_notification_ctx',
            notification_ctx_id: contextId };
        let reply = await this.transport.sendWithReply(message);
    }
    async updateRegistration(contextId, context) {
        logger_1.log.debug('update registration for context', contextId);
        let registrationAttempts = this.registrationsInProgress.get(contextId);
        if (!registrationAttempts) {
            registrationAttempts = new Set();
            this.registrationsInProgress.set(contextId, registrationAttempts);
        }
        const attemptId = uuid_1.v4();
        registrationAttempts.add(attemptId);
        try {
            await this.putNotificationContext(contextId, context);
            logger_1.log.debug('registration attempt succeeded for context', context);
            registrationAttempts.delete(attemptId);
            if (registrationAttempts.size === 0) {
                this.registrationsInProgress.delete(contextId);
                this.emit('registered', contextId);
            }
        } catch (err) {
            logger_1.log.warn('registration attempt failed for context', context);
            logger_1.log.debug(err);
            registrationAttempts.delete(attemptId);
            if (registrationAttempts.size === 0) {
                this.registrationsInProgress.delete(contextId);
                this.emit('registrationFailed', contextId, err);
            }
        }
    }
    updateRegistrations() {
        logger_1.log.trace(`refreshing ${this.registrations.size} registrations`);
        this.registrations.forEach((context, id) => {
            this.updateRegistration(id, context);
        });
    }
    setNotificationsContext(contextId, context) {
        if (!contextId || !context) {
            throw new twilsockerror_1.TwilsockError('Invalid arguments provided');
        }
        this.registrations.set(contextId, context);
        if (this.transport.isConnected) {
            this.updateRegistration(contextId, context);
        }
    }
    async removeNotificationsContext(contextId) {
        if (!this.registrations.has(contextId)) {
            return;
        }
        await this.deleteNotificationContext(contextId);
        if (this.transport.isConnected) {
            this.registrations.delete(contextId);
        }
    }
}
exports.Registrations = Registrations;

},{"../error/twilsockerror":6,"../logger":10,"events":29,"uuid":36}],24:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
const logger_1 = require("../logger");
const twilsockerror_1 = require("../error/twilsockerror");
const twilsockupstreamerror_1 = require("../error/twilsockupstreamerror");
const Messages = require("../protocol/messages");
const index_1 = require("../index");
const REQUEST_TIMEOUT = 20000;
function isHttpSuccess(code) {
    return code >= 200 && code < 300;
}
function isHttpReply(packet) {
    return packet && packet.header && packet.header.http_status;
}
class Request {}
function parseUri(uri) {
    const match = uri.match(/^(https?\:)\/\/(([^:\/?#]*)(?:\:([0-9]+))?)(\/[^?#]*)(\?[^#]*|)(#.*|)$/);
    if (match) {
        let uriStruct = {
            protocol: match[1],
            host: match[2],
            hostname: match[3],
            port: match[4],
            pathname: match[5],
            search: match[6],
            hash: match[7],
            params: null
        };
        if (uriStruct.search.length > 0) {
            let paramsString = uriStruct.search.substring(1);
            uriStruct.params = paramsString.split('&').map(el => el.split('=')).reduce((prev, curr) => {
                if (!prev.hasOwnProperty(curr[0])) {
                    prev[curr[0]] = curr[1];
                } else if (Array.isArray(prev[curr[0]])) {
                    prev[curr[0]].push(curr[1]);
                } else {
                    prev[curr[0]] = [prev[curr[0]], curr[1]];
                }
                return prev;
            }, {});
        }
        return uriStruct;
    }
    throw new twilsockerror_1.TwilsockError('Incorrect URI: ' + uri);
}
function twilsockAddress(method, uri) {
    const parsedUri = parseUri(uri);
    let to = {
        method: method,
        host: parsedUri.host,
        path: parsedUri.pathname
    };
    if (parsedUri.params) {
        to.params = parsedUri.params;
    }
    return to;
}
function twilsockParams(method, uri, headers, body) {
    return {
        to: twilsockAddress(method, uri),
        headers: headers,
        body: body
    };
}
class Upstream {
    constructor(transport, twilsock, config) {
        this.config = config;
        this.transport = transport;
        this.pendingMessages = [];
        this.twilsock = twilsock;
    }
    saveMessage(message) {
        return new Promise((resolve, reject) => {
            let requestDescriptor = {
                message,
                resolve: resolve,
                reject: reject,
                alreadyRejected: false,
                timeout: setTimeout(() => {
                    logger_1.log.debug('request is timed out');
                    reject(new twilsockerror_1.TwilsockError('Twilsock: request timeout'));
                    requestDescriptor.alreadyRejected = true;
                }, REQUEST_TIMEOUT)
            };
            this.pendingMessages.push(requestDescriptor);
        });
    }
    sendPendingMessages() {
        while (this.pendingMessages.length) {
            let request = this.pendingMessages[0];
            // Do not send message if we've rejected its promise already
            if (!request.alreadyRejected) {
                try {
                    let message = request.message;
                    this.actualSend(message).then(response => request.resolve(response)).catch(e => request.reject(e));
                    clearTimeout(request.timeout);
                } catch (e) {
                    logger_1.log.debug('Failed to send pending message', e);
                    break;
                }
            }
            this.pendingMessages.splice(0, 1);
        }
    }
    rejectPendingMessages() {
        this.pendingMessages.forEach(message => {
            message.reject(new index_1.TransportUnavailableError("Can't connect to twilsock"));
            clearTimeout(message.timeout);
        });
        this.pendingMessages.splice(0, this.pendingMessages.length);
    }
    async actualSend(message) {
        let address = message.to;
        let headers = message.headers;
        let body = message.body;
        let httpRequest = {
            host: address.host,
            path: address.path,
            method: address.method,
            params: address.params,
            headers: headers
        };
        let upstreamMessage = new Messages.Message(this.config.activeGrant, headers['Content-Type'] || 'application/json', httpRequest);
        let reply = await this.transport.sendWithReply(upstreamMessage, body);
        if (isHttpReply(reply) && !isHttpSuccess(reply.header.http_status.code)) {
            throw new twilsockupstreamerror_1.TwilsockUpstreamError(reply.header.http_status.code, reply.header.http_status.status, reply.body);
        }
        return {
            status: reply.header.http_status,
            headers: reply.header.http_headers,
            body: reply.body
        };
    }
    /**
     * Send an upstream message
     * @param {Twilsock#Message} message Message structure with header, body and remote address
     * @returns {Promise<Result>} Result from remote side
     */
    send(method, url, headers = {}, body) {
        if (this.twilsock.isTerminalState) {
            return Promise.reject(new index_1.TransportUnavailableError("Can't connect to twilsock"));
        }
        let twilsockMessage = twilsockParams(method, url, headers, body);
        if (!this.twilsock.isConnected) {
            return this.saveMessage(twilsockMessage);
        }
        return this.actualSend(twilsockMessage);
    }
}
exports.Upstream = Upstream;

},{"../error/twilsockerror":6,"../error/twilsockupstreamerror":8,"../index":9,"../logger":10,"../protocol/messages":17}],25:[function(require,module,exports){
(function (global){
"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
class TokenStorage {
    static storeToken(continuationToken, productId) {
        if (TokenStorage.canStore) {
            TokenStorage.sessionStorage.setItem(TokenStorage.getKeyName(productId), continuationToken);
        }
    }
    static getStoredToken(productId) {
        if (!TokenStorage.canStore) {
            return null;
        }
        return TokenStorage.sessionStorage.getItem(TokenStorage.getKeyName(productId));
    }
    static initialize() {
        if (TokenStorage.canStore) {
            const flag = TokenStorage.sessionStorage.getItem(TokenStorage.initializedFlag);
            // Duplicated tab, cleaning up all stored keys
            if (flag) {
                this.clear();
            }
            TokenStorage.sessionStorage.setItem(TokenStorage.initializedFlag, 'true');
            // When leaving page or refreshing
            TokenStorage.window.addEventListener('unload', () => {
                TokenStorage.sessionStorage.removeItem(TokenStorage.initializedFlag);
            });
        }
    }
    static clear() {
        if (TokenStorage.canStore) {
            let keyToDelete = [];
            for (let i = 0; i < TokenStorage.sessionStorage.length; i++) {
                const key = TokenStorage.sessionStorage.key(i);
                if (key.startsWith(TokenStorage.tokenStoragePrefix)) {
                    keyToDelete.push(key);
                }
            }
            keyToDelete.forEach(key => TokenStorage.sessionStorage.removeItem(key));
            TokenStorage.sessionStorage.removeItem(TokenStorage.initializedFlag);
        }
    }
    static getKeyName(productId) {
        return `${TokenStorage.tokenStoragePrefix}${productId}`;
    }
    static get canStore() {
        return TokenStorage.sessionStorage && TokenStorage.window;
    }
}
TokenStorage.initializedFlag = 'twilio_twilsock_token_storage';
TokenStorage.tokenStoragePrefix = 'twilio_continuation_token_';
TokenStorage.sessionStorage = global['sessionStorage'];
TokenStorage.window = global['window'];
exports.TokenStorage = TokenStorage;
TokenStorage.initialize();

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],26:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
const StateMachine = require("javascript-state-machine");
const logger_1 = require("./logger");
const Messages = require("./protocol/messages");
const parser_1 = require("./parser");
const twilsockreplyerror_1 = require("./error/twilsockreplyerror");
const backoffretrier_1 = require("./backoffretrier");
const DISCONNECTING_TIMEOUT = 3000;
// Wraps asynchronous rescheduling
// Just makes it simpler to find these hacks over the code
function trampoline(f) {
    setTimeout(f, 0);
}
/**
 * Makes sure that body is properly stringified
 */
function preparePayload(payload) {
    switch (typeof payload) {
        case 'undefined':
            return '';
        case 'object':
            return JSON.stringify(payload);
        default:
            return payload;
    }
}
class Request {}
class Response {}
exports.Response = Response;
/**
 * Twilsock channel level protocol implementation
 */
class TwilsockChannel extends events_1.EventEmitter {
    constructor(websocket, transport, config) {
        super();
        this.terminalStates = ['disconnected', 'rejected'];
        this.lastEmittedState = undefined;
        this.tokenExpiredSasCode = 20104;
        this.websocket = websocket;
        this.websocket.on('connected', () => this.fsm.socketConnected());
        this.websocket.on('disconnected', e => this.fsm.socketClosed());
        this.websocket.on('message', message => this.onIncomingMessage(message));
        this.websocket.on('socketError', e => this.emit('connectionError', { terminal: false, message: e.message, httpStatusCode: null, errorCode: null }));
        this.transport = transport;
        this.config = config;
        this.retrier = new backoffretrier_1.BackoffRetrier(config.retryPolicy);
        this.retrier.on('attempt', () => this.retry());
        this.retrier.on('failed', err => {
            logger_1.log.warn(`Retrying failed: ${err.message}`);
            this.disconnect();
        });
        if (typeof window !== 'undefined' && typeof window.addEventListener !== 'undefined') {
            window.addEventListener('online', () => {
                logger_1.log.debug('Browser reported connectivity state: online');
                this.fsm.systemOnline();
            });
            window.addEventListener('offline', () => {
                logger_1.log.debug('Browser reported connectivity state: online');
                this.websocket.close();
                this.fsm.socketClosed();
            });
        }
        this.fsm = new StateMachine({
            init: 'disconnected',
            transitions: [{ name: 'userConnect', from: ['disconnected', 'rejected'], to: 'connecting' }, { name: 'userConnect', from: ['connecting', 'connected'] }, { name: 'userDisconnect', from: ['connecting', 'initialising', 'connected', 'updating', 'retrying', 'rejected', 'waitSocketClosed', 'waitOffloadSocketClosed'], to: 'disconnecting' }, { name: 'userRetry', from: ['retrying'], to: 'connecting' }, { name: 'socketConnected', from: ['connecting'], to: 'initialising' }, { name: 'socketClosed', from: ['connecting', 'initialising', 'connected', 'updating', 'error', 'waitOffloadSocketClosed'], to: 'retrying' }, { name: 'socketClosed', from: ['disconnecting'], to: 'disconnected' }, { name: 'socketClosed', from: ['waitSocketClosed'], to: 'disconnected' }, { name: 'socketClosed', from: ['rejected'], to: 'rejected' }, { name: 'initSuccess', from: ['initialising'], to: 'connected' }, { name: 'initError', from: ['initialising'], to: 'error' }, { name: 'tokenRejected', from: ['initialising', 'updating'], to: 'rejected' }, { name: 'protocolError', from: ['initialising', 'connected', 'updating'], to: 'error' }, { name: 'receiveClose', from: ['initialising', 'connected', 'updating'], to: 'waitSocketClosed' }, { name: 'receiveOffload', from: ['initialising', 'connected', 'updating'], to: 'waitOffloadSocketClosed' }, { name: 'unsupportedProtocol', from: ['initialising', 'connected', 'updating'], to: 'unsupported' }, { name: 'receiveFatalClose', from: ['initialising', 'connected', 'updating'], to: 'unsupported' }, { name: 'userUpdateToken', from: ['disconnected', 'rejected', 'connecting', 'retrying'], to: 'connecting' }, { name: 'userUpdateToken', from: ['connected'], to: 'updating' }, { name: 'updateSuccess', from: ['updating'], to: 'connected' }, { name: 'updateError', from: ['updating'], to: 'error' }, { name: 'userSend', from: ['connected'], to: 'connected' }, { name: 'systemOnline', from: ['retrying'], to: 'connecting' }],
            methods: {
                onConnecting: () => {
                    this.setupSocket();
                    this.emit('connecting');
                },
                onEnterInitialising: () => {
                    this.sendInit();
                },
                onLeaveInitialising: () => {
                    this.cancelInit();
                },
                onEnterUpdating: () => {
                    this.sendUpdate();
                },
                onLeaveUpdating: () => {
                    this.cancelUpdate();
                },
                onEnterRetrying: () => {
                    this.initRetry();
                    this.emit('connecting');
                },
                onEnterConnected: () => {
                    this.resetBackoff();
                    this.onConnected();
                },
                onUserUpdateToken: () => {
                    this.resetBackoff();
                },
                onTokenRejected: () => {
                    this.resetBackoff();
                    this.closeSocket(true);
                    this.finalizeSocket();
                },
                onUserDisconnect: () => {
                    this.closeSocket(true);
                },
                onEnterDisconnecting: () => {
                    this.startDisconnectTimer();
                },
                onLeaveDisconnecting: () => {
                    this.cancelDisconnectTimer();
                },
                onEnterWaitSocketClosed: () => {
                    this.startDisconnectTimer();
                },
                onLeaveWaitSocketClosed: () => {
                    this.cancelDisconnectTimer();
                },
                onEnterWaitOffloadSocketClosed: () => {
                    this.startDisconnectTimer();
                },
                onLeaveWaitOffloadSocketClosed: () => {
                    this.cancelDisconnectTimer();
                },
                onDisconnected: () => {
                    this.resetBackoff();
                    this.finalizeSocket();
                },
                onReceiveClose: (event, args) => {
                    this.onCloseReceived(args);
                },
                onReceiveOffload: (event, args) => {
                    logger_1.log.debug('onreceiveoffload: ', args);
                    this.modifyBackoff(args.body);
                    this.onCloseReceived(args.status);
                },
                onUnsupported: () => {
                    this.closeSocket(true);
                    this.finalizeSocket();
                },
                onError: (lifecycle, graceful) => {
                    this.closeSocket(graceful);
                    this.finalizeSocket();
                },
                onEnterState: event => {
                    if (event.from !== 'none') {
                        this.changeState(event);
                    }
                },
                onInvalidTransition: (transition, from, to) => {
                    logger_1.log.warn('FSM: unexpected transition', from, to);
                }
            }
        });
    }
    changeState(event) {
        logger_1.log.debug(`FSM: ${event.transition}: ${event.from} --> ${event.to}`);
        if (this.lastEmittedState !== this.state) {
            this.lastEmittedState = this.state;
            this.emit('stateChanged', this.state);
        }
    }
    resetBackoff() {
        logger_1.log.trace('resetBackoff');
        this.retrier.stop();
    }
    modifyBackoff(body) {
        logger_1.log.trace('modifyBackoff', body);
        let backoffPolicy = body ? body.backoff_policy : null;
        if (backoffPolicy && typeof backoffPolicy.reconnect_min_ms === 'number') {
            this.retrier.modifyBackoff(backoffPolicy.reconnect_min_ms);
        }
    }
    startDisconnectTimer() {
        logger_1.log.trace('startDisconnectTimer');
        if (this.disconnectingTimer) {
            clearTimeout(this.disconnectingTimer);
            this.disconnectingTimer = null;
        }
        this.disconnectingTimer = setTimeout(() => {
            logger_1.log.debug('disconnecting is timed out');
            this.closeSocket(true);
        }, DISCONNECTING_TIMEOUT);
    }
    cancelDisconnectTimer() {
        logger_1.log.trace('cancelDisconnectTimer');
        if (this.disconnectingTimer) {
            clearTimeout(this.disconnectingTimer);
            this.disconnectingTimer = null;
        }
    }
    get isConnected() {
        return this.state === 'connected' && this.websocket.isConnected;
    }
    get state() {
        switch (this.fsm.state) {
            case 'connecting':
            case 'initialising':
            case 'retrying':
            case 'error':
                return 'connecting';
            case 'updating':
            case 'connected':
                return 'connected';
            case 'rejected':
                return 'rejected';
            case 'disconnecting':
            case 'waitSocketClosed':
            case 'waitOffloadSocketClosed':
                return 'disconnecting';
            case 'disconnected':
            default:
                return 'disconnected';
        }
    }
    initRetry() {
        logger_1.log.debug('initRetry');
        if (this.retrier.inProgress) {
            this.retrier.attemptFailed();
        } else {
            this.retrier.start();
        }
    }
    retry() {
        if (this.fsm.state != 'connecting') {
            logger_1.log.trace('retry');
            this.websocket.close();
            this.fsm.userRetry();
        } else {
            logger_1.log.trace('can\t retry as already connecting');
        }
    }
    onConnected() {
        this.emit('connected');
    }
    finalizeSocket() {
        logger_1.log.trace('finalizeSocket');
        this.websocket.close();
        this.emit('disconnected');
        if (this.disconnectedPromiseResolve) {
            this.disconnectedPromiseResolve();
            this.disconnectedPromiseResolve = null;
        }
    }
    setupSocket() {
        logger_1.log.trace('setupSocket:', this.config.token);
        this.websocket.connect();
    }
    onIncomingMessage(message) {
        let { method, header, payload } = parser_1.Parser.parse(message);
        if (method !== 'reply') {
            this.confirmReceiving(header);
        }
        if (method === 'notification') {
            this.emit('message', header.message_type, payload);
        } else if (header.method === 'reply') {
            this.transport.processReply({
                id: header.id,
                status: header.status,
                header: header,
                body: payload
            });
        } else if (header.method === 'client_update') {
            if (header.client_update_type === 'token_about_to_expire') {
                this.emit('tokenAboutToExpire');
            }
        } else if (header.method === 'close') {
            if (header.status.code === 308) {
                logger_1.log.debug('Connection has been offloaded');
                this.fsm.receiveOffload({ status: header.status.status, body: payload });
            } else if (header.status.code === 406) {
                // Not acceptable message
                const message = `Server closed connection because can't parse protocol: ${JSON.stringify(header.status)}`;
                this.emitReplyConnectionError(message, header, true);
                logger_1.log.error(message);
                this.fsm.receiveFatalClose();
            } else if (header.status.code === 417) {
                // Protocol error
                logger_1.log.error(`Server closed connection because can't parse client reply: ${JSON.stringify(header.status)}`);
                this.fsm.receiveFatalClose(header.status.status);
            } else if (header.status.code === 410) {
                // Expired token
                logger_1.log.warn(`Server closed connection: ${JSON.stringify(header.status)}`);
                this.fsm.receiveClose(header.status.status);
                this.emit('tokenExpired');
            } else if (header.status.code === 401) {
                // Authentication fail
                logger_1.log.error(`Server closed connection: ${JSON.stringify(header.status)}`);
                this.fsm.receiveClose(header.status.status);
            } else {
                logger_1.log.warn('unexpected message: ', header.status);
                // Try to reconnect
                this.fsm.receiveOffload({ status: header.status.status, body: null });
            }
        }
    }
    async sendInit() {
        logger_1.log.trace('sendInit');
        try {
            let reply = await this.transport.sendInit();
            this.config.updateContinuationToken(reply.continuationToken);
            this.fsm.initSuccess(reply);
            this.emit('initialized', reply);
            this.emit('tokenUpdated');
        } catch (ex) {
            if (ex instanceof twilsockreplyerror_1.TwilsockReplyError) {
                let isTerminalError = false;
                logger_1.log.warn(`Init rejected by server: ${JSON.stringify(ex.reply.status)}`);
                if (ex.reply.status.code === 401 || ex.reply.status.code === 403) {
                    isTerminalError = true;
                    this.fsm.tokenRejected(ex.reply.status);
                    if (ex.reply.status.errorCode === this.tokenExpiredSasCode) {
                        this.emit('tokenExpired');
                    }
                } else if (ex.reply.status.code === 429) {
                    this.modifyBackoff(ex.reply.body);
                    this.fsm.initError(true);
                } else if (ex.reply.status.code === 500) {
                    this.fsm.initError(false);
                } else {
                    this.fsm.initError(true);
                }
                this.emitReplyConnectionError(ex.message, ex.reply, isTerminalError);
            } else {
                this.emit('connectionError', { terminal: true, message: ex.message, httpStatusCode: null, errorCode: null });
                this.fsm.initError(true);
            }
            this.emit('tokenUpdated', ex);
        }
    }
    async sendUpdate() {
        logger_1.log.trace('sendUpdate');
        let message = new Messages.Update(this.config.token);
        try {
            let reply = await this.transport.sendWithReply(message);
            this.fsm.updateSuccess(reply.body);
            this.emit('tokenUpdated');
        } catch (ex) {
            if (ex instanceof twilsockreplyerror_1.TwilsockReplyError) {
                let isTerminalError = false;
                logger_1.log.warn(`Token update rejected by server: ${JSON.stringify(ex.reply.status)}`);
                if (ex.reply.status.code === 401 || ex.reply.status.code === 403) {
                    isTerminalError = true;
                    this.fsm.tokenRejected(ex.reply.status);
                    if (ex.reply.status.errorCode === this.tokenExpiredSasCode) {
                        this.emit('tokenExpired');
                    }
                } else if (ex.reply.status.code === 429) {
                    this.modifyBackoff(ex.reply.body);
                    this.fsm.updateError(ex.reply.status);
                } else {
                    this.fsm.updateError(ex.reply.status);
                }
                this.emitReplyConnectionError(ex.message, ex.reply, isTerminalError);
            } else {
                this.emit('error', false, ex.message, null, null);
                this.fsm.updateError(ex);
            }
            this.emit('tokenUpdated', ex);
        }
    }
    emitReplyConnectionError(message, header, terminal) {
        const description = header.status && header.status.description ? header.status.description : message;
        const httpStatusCode = header.status.code;
        const errorCode = header.status && header.status.errorCode ? header.status.errorCode : null;
        this.emit('connectionError', { terminal: terminal, message: description, httpStatusCode: httpStatusCode, errorCode: errorCode });
    }
    cancelInit() {
        logger_1.log.trace('cancelInit');
        // TODO: implement
    }
    cancelUpdate() {
        logger_1.log.trace('cancelUpdate');
        // TODO: implement
    }
    /**
     * Should be called for each message to confirm it received
     */
    confirmReceiving(messageHeader) {
        logger_1.log.trace('confirmReceiving');
        try {
            this.transport.send(new Messages.Reply(messageHeader.id));
        } catch (e) {
            logger_1.log.debug('failed to confirm packet receiving', e);
        }
    }
    /**
     * Shutdown connection
     */
    closeSocket(graceful) {
        logger_1.log.trace(`closeSocket (graceful: ${graceful})`);
        if (graceful && this.transport.isConnected) {
            this.transport.sendClose();
        }
        this.websocket.close();
        trampoline(() => this.fsm.socketClosed());
    }
    /**
     * Initiate the twilsock connection
     * If already connected, it does nothing
     */
    connect() {
        logger_1.log.trace('connect');
        this.fsm.userConnect();
    }
    /**
     * Close twilsock connection
     * If already disconnected, it does nothing
     */
    disconnect() {
        logger_1.log.trace('disconnect');
        if (this.fsm.is('disconnected')) {
            return Promise.resolve();
        }
        return new Promise(resolve => {
            this.disconnectedPromiseResolve = resolve;
            this.fsm.userDisconnect();
        });
    }
    /**
     * Update fpa token for twilsock connection
     */
    updateToken(token) {
        logger_1.log.trace('updateToken:', token);
        return new Promise((resolve, reject) => {
            this.once('tokenUpdated', e => {
                if (e) {
                    reject(e);
                } else {
                    resolve();
                }
            });
            this.fsm.userUpdateToken();
        });
    }
    get isTerminalState() {
        return this.terminalStates.indexOf(this.fsm.state) !== -1;
    }
    onCloseReceived(reason) {
        this.websocket.close();
    }
}
exports.TwilsockChannel = TwilsockChannel;
exports.TwilsockImpl = TwilsockChannel;

},{"./backoffretrier":1,"./error/twilsockreplyerror":7,"./logger":10,"./parser":14,"./protocol/messages":17,"events":29,"javascript-state-machine":30}],27:[function(require,module,exports){
(function (global){
"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
const logger_1 = require("./logger");
class WebSocketChannel extends events_1.EventEmitter {
    constructor(url) {
        super();
        this.url = url;
        this.WebSocket = global['WebSocket'] || global['MozWebSocket'] || require('ws');
    }
    get isConnected() {
        return this.socket && this.socket.readyState === 1;
    }
    connect() {
        logger_1.log.trace('connecting to socket');
        let socket = new this.WebSocket(this.url);
        socket.binaryType = 'arraybuffer';
        socket.onopen = () => {
            logger_1.log.debug(`socket opened ${this.url}`);
            this.emit('connected');
        };
        socket.onclose = e => {
            logger_1.log.debug('socket closed', e);
            this.emit('disconnected', e);
        };
        socket.onerror = e => {
            logger_1.log.debug('error:', e);
            this.emit('socketError', e);
        };
        socket.onmessage = message => {
            this.emit('message', message.data);
        };
        this.socket = socket;
    }
    send(message) {
        this.socket.send(message);
    }
    close() {
        logger_1.log.trace('closing socket');
        if (this.socket) {
            this.socket.onopen = null;
            this.socket.onclose = null;
            this.socket.onerror = null;
            this.socket.onmessage = null;
            try {
                this.socket.close();
            } finally {}
        }
    }
}
exports.WebSocketChannel = WebSocketChannel;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./logger":10,"events":29,"ws":28}],28:[function(require,module,exports){

},{}],29:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var objectCreate = Object.create || objectCreatePolyfill
var objectKeys = Object.keys || objectKeysPolyfill
var bind = Function.prototype.bind || functionBindPolyfill

function EventEmitter() {
  if (!this._events || !Object.prototype.hasOwnProperty.call(this, '_events')) {
    this._events = objectCreate(null);
    this._eventsCount = 0;
  }

  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
var defaultMaxListeners = 10;

var hasDefineProperty;
try {
  var o = {};
  if (Object.defineProperty) Object.defineProperty(o, 'x', { value: 0 });
  hasDefineProperty = o.x === 0;
} catch (err) { hasDefineProperty = false }
if (hasDefineProperty) {
  Object.defineProperty(EventEmitter, 'defaultMaxListeners', {
    enumerable: true,
    get: function() {
      return defaultMaxListeners;
    },
    set: function(arg) {
      // check whether the input is a positive number (whose value is zero or
      // greater and not a NaN).
      if (typeof arg !== 'number' || arg < 0 || arg !== arg)
        throw new TypeError('"defaultMaxListeners" must be a positive number');
      defaultMaxListeners = arg;
    }
  });
} else {
  EventEmitter.defaultMaxListeners = defaultMaxListeners;
}

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function setMaxListeners(n) {
  if (typeof n !== 'number' || n < 0 || isNaN(n))
    throw new TypeError('"n" argument must be a positive number');
  this._maxListeners = n;
  return this;
};

function $getMaxListeners(that) {
  if (that._maxListeners === undefined)
    return EventEmitter.defaultMaxListeners;
  return that._maxListeners;
}

EventEmitter.prototype.getMaxListeners = function getMaxListeners() {
  return $getMaxListeners(this);
};

// These standalone emit* functions are used to optimize calling of event
// handlers for fast cases because emit() itself often has a variable number of
// arguments and can be deoptimized because of that. These functions always have
// the same number of arguments and thus do not get deoptimized, so the code
// inside them can execute faster.
function emitNone(handler, isFn, self) {
  if (isFn)
    handler.call(self);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self);
  }
}
function emitOne(handler, isFn, self, arg1) {
  if (isFn)
    handler.call(self, arg1);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self, arg1);
  }
}
function emitTwo(handler, isFn, self, arg1, arg2) {
  if (isFn)
    handler.call(self, arg1, arg2);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self, arg1, arg2);
  }
}
function emitThree(handler, isFn, self, arg1, arg2, arg3) {
  if (isFn)
    handler.call(self, arg1, arg2, arg3);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self, arg1, arg2, arg3);
  }
}

function emitMany(handler, isFn, self, args) {
  if (isFn)
    handler.apply(self, args);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].apply(self, args);
  }
}

EventEmitter.prototype.emit = function emit(type) {
  var er, handler, len, args, i, events;
  var doError = (type === 'error');

  events = this._events;
  if (events)
    doError = (doError && events.error == null);
  else if (!doError)
    return false;

  // If there is no 'error' event listener then throw.
  if (doError) {
    if (arguments.length > 1)
      er = arguments[1];
    if (er instanceof Error) {
      throw er; // Unhandled 'error' event
    } else {
      // At least give some kind of context to the user
      var err = new Error('Unhandled "error" event. (' + er + ')');
      err.context = er;
      throw err;
    }
    return false;
  }

  handler = events[type];

  if (!handler)
    return false;

  var isFn = typeof handler === 'function';
  len = arguments.length;
  switch (len) {
      // fast cases
    case 1:
      emitNone(handler, isFn, this);
      break;
    case 2:
      emitOne(handler, isFn, this, arguments[1]);
      break;
    case 3:
      emitTwo(handler, isFn, this, arguments[1], arguments[2]);
      break;
    case 4:
      emitThree(handler, isFn, this, arguments[1], arguments[2], arguments[3]);
      break;
      // slower
    default:
      args = new Array(len - 1);
      for (i = 1; i < len; i++)
        args[i - 1] = arguments[i];
      emitMany(handler, isFn, this, args);
  }

  return true;
};

function _addListener(target, type, listener, prepend) {
  var m;
  var events;
  var existing;

  if (typeof listener !== 'function')
    throw new TypeError('"listener" argument must be a function');

  events = target._events;
  if (!events) {
    events = target._events = objectCreate(null);
    target._eventsCount = 0;
  } else {
    // To avoid recursion in the case that type === "newListener"! Before
    // adding it to the listeners, first emit "newListener".
    if (events.newListener) {
      target.emit('newListener', type,
          listener.listener ? listener.listener : listener);

      // Re-assign `events` because a newListener handler could have caused the
      // this._events to be assigned to a new object
      events = target._events;
    }
    existing = events[type];
  }

  if (!existing) {
    // Optimize the case of one listener. Don't need the extra array object.
    existing = events[type] = listener;
    ++target._eventsCount;
  } else {
    if (typeof existing === 'function') {
      // Adding the second element, need to change to array.
      existing = events[type] =
          prepend ? [listener, existing] : [existing, listener];
    } else {
      // If we've already got an array, just append.
      if (prepend) {
        existing.unshift(listener);
      } else {
        existing.push(listener);
      }
    }

    // Check for listener leak
    if (!existing.warned) {
      m = $getMaxListeners(target);
      if (m && m > 0 && existing.length > m) {
        existing.warned = true;
        var w = new Error('Possible EventEmitter memory leak detected. ' +
            existing.length + ' "' + String(type) + '" listeners ' +
            'added. Use emitter.setMaxListeners() to ' +
            'increase limit.');
        w.name = 'MaxListenersExceededWarning';
        w.emitter = target;
        w.type = type;
        w.count = existing.length;
        if (typeof console === 'object' && console.warn) {
          console.warn('%s: %s', w.name, w.message);
        }
      }
    }
  }

  return target;
}

EventEmitter.prototype.addListener = function addListener(type, listener) {
  return _addListener(this, type, listener, false);
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.prependListener =
    function prependListener(type, listener) {
      return _addListener(this, type, listener, true);
    };

function onceWrapper() {
  if (!this.fired) {
    this.target.removeListener(this.type, this.wrapFn);
    this.fired = true;
    switch (arguments.length) {
      case 0:
        return this.listener.call(this.target);
      case 1:
        return this.listener.call(this.target, arguments[0]);
      case 2:
        return this.listener.call(this.target, arguments[0], arguments[1]);
      case 3:
        return this.listener.call(this.target, arguments[0], arguments[1],
            arguments[2]);
      default:
        var args = new Array(arguments.length);
        for (var i = 0; i < args.length; ++i)
          args[i] = arguments[i];
        this.listener.apply(this.target, args);
    }
  }
}

function _onceWrap(target, type, listener) {
  var state = { fired: false, wrapFn: undefined, target: target, type: type, listener: listener };
  var wrapped = bind.call(onceWrapper, state);
  wrapped.listener = listener;
  state.wrapFn = wrapped;
  return wrapped;
}

EventEmitter.prototype.once = function once(type, listener) {
  if (typeof listener !== 'function')
    throw new TypeError('"listener" argument must be a function');
  this.on(type, _onceWrap(this, type, listener));
  return this;
};

EventEmitter.prototype.prependOnceListener =
    function prependOnceListener(type, listener) {
      if (typeof listener !== 'function')
        throw new TypeError('"listener" argument must be a function');
      this.prependListener(type, _onceWrap(this, type, listener));
      return this;
    };

// Emits a 'removeListener' event if and only if the listener was removed.
EventEmitter.prototype.removeListener =
    function removeListener(type, listener) {
      var list, events, position, i, originalListener;

      if (typeof listener !== 'function')
        throw new TypeError('"listener" argument must be a function');

      events = this._events;
      if (!events)
        return this;

      list = events[type];
      if (!list)
        return this;

      if (list === listener || list.listener === listener) {
        if (--this._eventsCount === 0)
          this._events = objectCreate(null);
        else {
          delete events[type];
          if (events.removeListener)
            this.emit('removeListener', type, list.listener || listener);
        }
      } else if (typeof list !== 'function') {
        position = -1;

        for (i = list.length - 1; i >= 0; i--) {
          if (list[i] === listener || list[i].listener === listener) {
            originalListener = list[i].listener;
            position = i;
            break;
          }
        }

        if (position < 0)
          return this;

        if (position === 0)
          list.shift();
        else
          spliceOne(list, position);

        if (list.length === 1)
          events[type] = list[0];

        if (events.removeListener)
          this.emit('removeListener', type, originalListener || listener);
      }

      return this;
    };

EventEmitter.prototype.removeAllListeners =
    function removeAllListeners(type) {
      var listeners, events, i;

      events = this._events;
      if (!events)
        return this;

      // not listening for removeListener, no need to emit
      if (!events.removeListener) {
        if (arguments.length === 0) {
          this._events = objectCreate(null);
          this._eventsCount = 0;
        } else if (events[type]) {
          if (--this._eventsCount === 0)
            this._events = objectCreate(null);
          else
            delete events[type];
        }
        return this;
      }

      // emit removeListener for all listeners on all events
      if (arguments.length === 0) {
        var keys = objectKeys(events);
        var key;
        for (i = 0; i < keys.length; ++i) {
          key = keys[i];
          if (key === 'removeListener') continue;
          this.removeAllListeners(key);
        }
        this.removeAllListeners('removeListener');
        this._events = objectCreate(null);
        this._eventsCount = 0;
        return this;
      }

      listeners = events[type];

      if (typeof listeners === 'function') {
        this.removeListener(type, listeners);
      } else if (listeners) {
        // LIFO order
        for (i = listeners.length - 1; i >= 0; i--) {
          this.removeListener(type, listeners[i]);
        }
      }

      return this;
    };

function _listeners(target, type, unwrap) {
  var events = target._events;

  if (!events)
    return [];

  var evlistener = events[type];
  if (!evlistener)
    return [];

  if (typeof evlistener === 'function')
    return unwrap ? [evlistener.listener || evlistener] : [evlistener];

  return unwrap ? unwrapListeners(evlistener) : arrayClone(evlistener, evlistener.length);
}

EventEmitter.prototype.listeners = function listeners(type) {
  return _listeners(this, type, true);
};

EventEmitter.prototype.rawListeners = function rawListeners(type) {
  return _listeners(this, type, false);
};

EventEmitter.listenerCount = function(emitter, type) {
  if (typeof emitter.listenerCount === 'function') {
    return emitter.listenerCount(type);
  } else {
    return listenerCount.call(emitter, type);
  }
};

EventEmitter.prototype.listenerCount = listenerCount;
function listenerCount(type) {
  var events = this._events;

  if (events) {
    var evlistener = events[type];

    if (typeof evlistener === 'function') {
      return 1;
    } else if (evlistener) {
      return evlistener.length;
    }
  }

  return 0;
}

EventEmitter.prototype.eventNames = function eventNames() {
  return this._eventsCount > 0 ? Reflect.ownKeys(this._events) : [];
};

// About 1.5x faster than the two-arg version of Array#splice().
function spliceOne(list, index) {
  for (var i = index, k = i + 1, n = list.length; k < n; i += 1, k += 1)
    list[i] = list[k];
  list.pop();
}

function arrayClone(arr, n) {
  var copy = new Array(n);
  for (var i = 0; i < n; ++i)
    copy[i] = arr[i];
  return copy;
}

function unwrapListeners(arr) {
  var ret = new Array(arr.length);
  for (var i = 0; i < ret.length; ++i) {
    ret[i] = arr[i].listener || arr[i];
  }
  return ret;
}

function objectCreatePolyfill(proto) {
  var F = function() {};
  F.prototype = proto;
  return new F;
}
function objectKeysPolyfill(obj) {
  var keys = [];
  for (var k in obj) if (Object.prototype.hasOwnProperty.call(obj, k)) {
    keys.push(k);
  }
  return k;
}
function functionBindPolyfill(context) {
  var fn = this;
  return function () {
    return fn.apply(context, arguments);
  };
}

},{}],30:[function(require,module,exports){
(function webpackUniversalModuleDefinition(root, factory) {
	if(typeof exports === 'object' && typeof module === 'object')
		module.exports = factory();
	else if(typeof define === 'function' && define.amd)
		define("StateMachine", [], factory);
	else if(typeof exports === 'object')
		exports["StateMachine"] = factory();
	else
		root["StateMachine"] = factory();
})(this, function() {
return /******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// identity function for calling harmony imports with the correct context
/******/ 	__webpack_require__.i = function(value) { return value; };
/******/
/******/ 	// define getter function for harmony exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		if(!__webpack_require__.o(exports, name)) {
/******/ 			Object.defineProperty(exports, name, {
/******/ 				configurable: false,
/******/ 				enumerable: true,
/******/ 				get: getter
/******/ 			});
/******/ 		}
/******/ 	};
/******/
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};
/******/
/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = 5);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


module.exports = function(target, sources) {
  var n, source, key;
  for(n = 1 ; n < arguments.length ; n++) {
    source = arguments[n];
    for(key in source) {
      if (source.hasOwnProperty(key))
        target[key] = source[key];
    }
  }
  return target;
}


/***/ }),
/* 1 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


//-------------------------------------------------------------------------------------------------

var mixin = __webpack_require__(0);

//-------------------------------------------------------------------------------------------------

module.exports = {

  build: function(target, config) {
    var n, max, plugin, plugins = config.plugins;
    for(n = 0, max = plugins.length ; n < max ; n++) {
      plugin = plugins[n];
      if (plugin.methods)
        mixin(target, plugin.methods);
      if (plugin.properties)
        Object.defineProperties(target, plugin.properties);
    }
  },

  hook: function(fsm, name, additional) {
    var n, max, method, plugin,
        plugins = fsm.config.plugins,
        args    = [fsm.context];

    if (additional)
      args = args.concat(additional)

    for(n = 0, max = plugins.length ; n < max ; n++) {
      plugin = plugins[n]
      method = plugins[n][name]
      if (method)
        method.apply(plugin, args);
    }
  }

}

//-------------------------------------------------------------------------------------------------


/***/ }),
/* 2 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


//-------------------------------------------------------------------------------------------------

function camelize(label) {

  if (label.length === 0)
    return label;

  var n, result, word, words = label.split(/[_-]/);

  // single word with first character already lowercase, return untouched
  if ((words.length === 1) && (words[0][0].toLowerCase() === words[0][0]))
    return label;

  result = words[0].toLowerCase();
  for(n = 1 ; n < words.length ; n++) {
    result = result + words[n].charAt(0).toUpperCase() + words[n].substring(1).toLowerCase();
  }

  return result;
}

//-------------------------------------------------------------------------------------------------

camelize.prepended = function(prepend, label) {
  label = camelize(label);
  return prepend + label[0].toUpperCase() + label.substring(1);
}

//-------------------------------------------------------------------------------------------------

module.exports = camelize;


/***/ }),
/* 3 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


//-------------------------------------------------------------------------------------------------

var mixin    = __webpack_require__(0),
    camelize = __webpack_require__(2);

//-------------------------------------------------------------------------------------------------

function Config(options, StateMachine) {

  options = options || {};

  this.options     = options; // preserving original options can be useful (e.g visualize plugin)
  this.defaults    = StateMachine.defaults;
  this.states      = [];
  this.transitions = [];
  this.map         = {};
  this.lifecycle   = this.configureLifecycle();
  this.init        = this.configureInitTransition(options.init);
  this.data        = this.configureData(options.data);
  this.methods     = this.configureMethods(options.methods);

  this.map[this.defaults.wildcard] = {};

  this.configureTransitions(options.transitions || []);

  this.plugins = this.configurePlugins(options.plugins, StateMachine.plugin);

}

//-------------------------------------------------------------------------------------------------

mixin(Config.prototype, {

  addState: function(name) {
    if (!this.map[name]) {
      this.states.push(name);
      this.addStateLifecycleNames(name);
      this.map[name] = {};
    }
  },

  addStateLifecycleNames: function(name) {
    this.lifecycle.onEnter[name] = camelize.prepended('onEnter', name);
    this.lifecycle.onLeave[name] = camelize.prepended('onLeave', name);
    this.lifecycle.on[name]      = camelize.prepended('on',      name);
  },

  addTransition: function(name) {
    if (this.transitions.indexOf(name) < 0) {
      this.transitions.push(name);
      this.addTransitionLifecycleNames(name);
    }
  },

  addTransitionLifecycleNames: function(name) {
    this.lifecycle.onBefore[name] = camelize.prepended('onBefore', name);
    this.lifecycle.onAfter[name]  = camelize.prepended('onAfter',  name);
    this.lifecycle.on[name]       = camelize.prepended('on',       name);
  },

  mapTransition: function(transition) {
    var name = transition.name,
        from = transition.from,
        to   = transition.to;
    this.addState(from);
    if (typeof to !== 'function')
      this.addState(to);
    this.addTransition(name);
    this.map[from][name] = transition;
    return transition;
  },

  configureLifecycle: function() {
    return {
      onBefore: { transition: 'onBeforeTransition' },
      onAfter:  { transition: 'onAfterTransition'  },
      onEnter:  { state:      'onEnterState'       },
      onLeave:  { state:      'onLeaveState'       },
      on:       { transition: 'onTransition'       }
    };
  },

  configureInitTransition: function(init) {
    if (typeof init === 'string') {
      return this.mapTransition(mixin({}, this.defaults.init, { to: init, active: true }));
    }
    else if (typeof init === 'object') {
      return this.mapTransition(mixin({}, this.defaults.init, init, { active: true }));
    }
    else {
      this.addState(this.defaults.init.from);
      return this.defaults.init;
    }
  },

  configureData: function(data) {
    if (typeof data === 'function')
      return data;
    else if (typeof data === 'object')
      return function() { return data; }
    else
      return function() { return {};  }
  },

  configureMethods: function(methods) {
    return methods || {};
  },

  configurePlugins: function(plugins, builtin) {
    plugins = plugins || [];
    var n, max, plugin;
    for(n = 0, max = plugins.length ; n < max ; n++) {
      plugin = plugins[n];
      if (typeof plugin === 'function')
        plugins[n] = plugin = plugin()
      if (plugin.configure)
        plugin.configure(this);
    }
    return plugins
  },

  configureTransitions: function(transitions) {
    var i, n, transition, from, to, wildcard = this.defaults.wildcard;
    for(n = 0 ; n < transitions.length ; n++) {
      transition = transitions[n];
      from  = Array.isArray(transition.from) ? transition.from : [transition.from || wildcard]
      to    = transition.to || wildcard;
      for(i = 0 ; i < from.length ; i++) {
        this.mapTransition({ name: transition.name, from: from[i], to: to });
      }
    }
  },

  transitionFor: function(state, transition) {
    var wildcard = this.defaults.wildcard;
    return this.map[state][transition] ||
           this.map[wildcard][transition];
  },

  transitionsFor: function(state) {
    var wildcard = this.defaults.wildcard;
    return Object.keys(this.map[state]).concat(Object.keys(this.map[wildcard]));
  },

  allStates: function() {
    return this.states;
  },

  allTransitions: function() {
    return this.transitions;
  }

});

//-------------------------------------------------------------------------------------------------

module.exports = Config;

//-------------------------------------------------------------------------------------------------


/***/ }),
/* 4 */
/***/ (function(module, exports, __webpack_require__) {


var mixin      = __webpack_require__(0),
    Exception  = __webpack_require__(6),
    plugin     = __webpack_require__(1),
    UNOBSERVED = [ null, [] ];

//-------------------------------------------------------------------------------------------------

function JSM(context, config) {
  this.context   = context;
  this.config    = config;
  this.state     = config.init.from;
  this.observers = [context];
}

//-------------------------------------------------------------------------------------------------

mixin(JSM.prototype, {

  init: function(args) {
    mixin(this.context, this.config.data.apply(this.context, args));
    plugin.hook(this, 'init');
    if (this.config.init.active)
      return this.fire(this.config.init.name, []);
  },

  is: function(state) {
    return Array.isArray(state) ? (state.indexOf(this.state) >= 0) : (this.state === state);
  },

  isPending: function() {
    return this.pending;
  },

  can: function(transition) {
    return !this.isPending() && !!this.seek(transition);
  },

  cannot: function(transition) {
    return !this.can(transition);
  },

  allStates: function() {
    return this.config.allStates();
  },

  allTransitions: function() {
    return this.config.allTransitions();
  },

  transitions: function() {
    return this.config.transitionsFor(this.state);
  },

  seek: function(transition, args) {
    var wildcard = this.config.defaults.wildcard,
        entry    = this.config.transitionFor(this.state, transition),
        to       = entry && entry.to;
    if (typeof to === 'function')
      return to.apply(this.context, args);
    else if (to === wildcard)
      return this.state
    else
      return to
  },

  fire: function(transition, args) {
    return this.transit(transition, this.state, this.seek(transition, args), args);
  },

  transit: function(transition, from, to, args) {

    var lifecycle = this.config.lifecycle,
        changed   = this.config.options.observeUnchangedState || (from !== to);

    if (!to)
      return this.context.onInvalidTransition(transition, from, to);

    if (this.isPending())
      return this.context.onPendingTransition(transition, from, to);

    this.config.addState(to);  // might need to add this state if it's unknown (e.g. conditional transition or goto)

    this.beginTransit();

    args.unshift({             // this context will be passed to each lifecycle event observer
      transition: transition,
      from:       from,
      to:         to,
      fsm:        this.context
    });

    return this.observeEvents([
                this.observersForEvent(lifecycle.onBefore.transition),
                this.observersForEvent(lifecycle.onBefore[transition]),
      changed ? this.observersForEvent(lifecycle.onLeave.state) : UNOBSERVED,
      changed ? this.observersForEvent(lifecycle.onLeave[from]) : UNOBSERVED,
                this.observersForEvent(lifecycle.on.transition),
      changed ? [ 'doTransit', [ this ] ]                       : UNOBSERVED,
      changed ? this.observersForEvent(lifecycle.onEnter.state) : UNOBSERVED,
      changed ? this.observersForEvent(lifecycle.onEnter[to])   : UNOBSERVED,
      changed ? this.observersForEvent(lifecycle.on[to])        : UNOBSERVED,
                this.observersForEvent(lifecycle.onAfter.transition),
                this.observersForEvent(lifecycle.onAfter[transition]),
                this.observersForEvent(lifecycle.on[transition])
    ], args);
  },

  beginTransit: function()          { this.pending = true;                 },
  endTransit:   function(result)    { this.pending = false; return result; },
  failTransit:  function(result)    { this.pending = false; throw result;  },
  doTransit:    function(lifecycle) { this.state = lifecycle.to;           },

  observe: function(args) {
    if (args.length === 2) {
      var observer = {};
      observer[args[0]] = args[1];
      this.observers.push(observer);
    }
    else {
      this.observers.push(args[0]);
    }
  },

  observersForEvent: function(event) { // TODO: this could be cached
    var n = 0, max = this.observers.length, observer, result = [];
    for( ; n < max ; n++) {
      observer = this.observers[n];
      if (observer[event])
        result.push(observer);
    }
    return [ event, result, true ]
  },

  observeEvents: function(events, args, previousEvent, previousResult) {
    if (events.length === 0) {
      return this.endTransit(previousResult === undefined ? true : previousResult);
    }

    var event     = events[0][0],
        observers = events[0][1],
        pluggable = events[0][2];

    args[0].event = event;
    if (event && pluggable && event !== previousEvent)
      plugin.hook(this, 'lifecycle', args);

    if (observers.length === 0) {
      events.shift();
      return this.observeEvents(events, args, event, previousResult);
    }
    else {
      var observer = observers.shift(),
          result = observer[event].apply(observer, args);
      if (result && typeof result.then === 'function') {
        return result.then(this.observeEvents.bind(this, events, args, event))
                     .catch(this.failTransit.bind(this))
      }
      else if (result === false) {
        return this.endTransit(false);
      }
      else {
        return this.observeEvents(events, args, event, result);
      }
    }
  },

  onInvalidTransition: function(transition, from, to) {
    throw new Exception("transition is invalid in current state", transition, from, to, this.state);
  },

  onPendingTransition: function(transition, from, to) {
    throw new Exception("transition is invalid while previous transition is still in progress", transition, from, to, this.state);
  }

});

//-------------------------------------------------------------------------------------------------

module.exports = JSM;

//-------------------------------------------------------------------------------------------------


/***/ }),
/* 5 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


//-----------------------------------------------------------------------------------------------

var mixin    = __webpack_require__(0),
    camelize = __webpack_require__(2),
    plugin   = __webpack_require__(1),
    Config   = __webpack_require__(3),
    JSM      = __webpack_require__(4);

//-----------------------------------------------------------------------------------------------

var PublicMethods = {
  is:                  function(state)       { return this._fsm.is(state)                                     },
  can:                 function(transition)  { return this._fsm.can(transition)                               },
  cannot:              function(transition)  { return this._fsm.cannot(transition)                            },
  observe:             function()            { return this._fsm.observe(arguments)                            },
  transitions:         function()            { return this._fsm.transitions()                                 },
  allTransitions:      function()            { return this._fsm.allTransitions()                              },
  allStates:           function()            { return this._fsm.allStates()                                   },
  onInvalidTransition: function(t, from, to) { return this._fsm.onInvalidTransition(t, from, to)              },
  onPendingTransition: function(t, from, to) { return this._fsm.onPendingTransition(t, from, to)              },
}

var PublicProperties = {
  state: {
    configurable: false,
    enumerable:   true,
    get: function() {
      return this._fsm.state;
    },
    set: function(state) {
      throw Error('use transitions to change state')
    }
  }
}

//-----------------------------------------------------------------------------------------------

function StateMachine(options) {
  return apply(this || {}, options);
}

function factory() {
  var cstor, options;
  if (typeof arguments[0] === 'function') {
    cstor   = arguments[0];
    options = arguments[1] || {};
  }
  else {
    cstor   = function() { this._fsm.apply(this, arguments) };
    options = arguments[0] || {};
  }
  var config = new Config(options, StateMachine);
  build(cstor.prototype, config);
  cstor.prototype._fsm.config = config; // convenience access to shared config without needing an instance
  return cstor;
}

//-------------------------------------------------------------------------------------------------

function apply(instance, options) {
  var config = new Config(options, StateMachine);
  build(instance, config);
  instance._fsm();
  return instance;
}

function build(target, config) {
  if ((typeof target !== 'object') || Array.isArray(target))
    throw Error('StateMachine can only be applied to objects');
  plugin.build(target, config);
  Object.defineProperties(target, PublicProperties);
  mixin(target, PublicMethods);
  mixin(target, config.methods);
  config.allTransitions().forEach(function(transition) {
    target[camelize(transition)] = function() {
      return this._fsm.fire(transition, [].slice.call(arguments))
    }
  });
  target._fsm = function() {
    this._fsm = new JSM(this, config);
    this._fsm.init(arguments);
  }
}

//-----------------------------------------------------------------------------------------------

StateMachine.version  = '3.0.1';
StateMachine.factory  = factory;
StateMachine.apply    = apply;
StateMachine.defaults = {
  wildcard: '*',
  init: {
    name: 'init',
    from: 'none'
  }
}

//===============================================================================================

module.exports = StateMachine;


/***/ }),
/* 6 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


module.exports = function(message, transition, from, to, current) {
  this.message    = message;
  this.transition = transition;
  this.from       = from;
  this.to         = to;
  this.current    = current;
}


/***/ })
/******/ ]);
});
},{}],31:[function(require,module,exports){
/*
* loglevel - https://github.com/pimterry/loglevel
*
* Copyright (c) 2013 Tim Perry
* Licensed under the MIT license.
*/
(function (root, definition) {
    "use strict";
    if (typeof define === 'function' && define.amd) {
        define(definition);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = definition();
    } else {
        root.log = definition();
    }
}(this, function () {
    "use strict";

    // Slightly dubious tricks to cut down minimized file size
    var noop = function() {};
    var undefinedType = "undefined";

    var logMethods = [
        "trace",
        "debug",
        "info",
        "warn",
        "error"
    ];

    // Cross-browser bind equivalent that works at least back to IE6
    function bindMethod(obj, methodName) {
        var method = obj[methodName];
        if (typeof method.bind === 'function') {
            return method.bind(obj);
        } else {
            try {
                return Function.prototype.bind.call(method, obj);
            } catch (e) {
                // Missing bind shim or IE8 + Modernizr, fallback to wrapping
                return function() {
                    return Function.prototype.apply.apply(method, [obj, arguments]);
                };
            }
        }
    }

    // Build the best logging method possible for this env
    // Wherever possible we want to bind, not wrap, to preserve stack traces
    function realMethod(methodName) {
        if (methodName === 'debug') {
            methodName = 'log';
        }

        if (typeof console === undefinedType) {
            return false; // No method possible, for now - fixed later by enableLoggingWhenConsoleArrives
        } else if (console[methodName] !== undefined) {
            return bindMethod(console, methodName);
        } else if (console.log !== undefined) {
            return bindMethod(console, 'log');
        } else {
            return noop;
        }
    }

    // These private functions always need `this` to be set properly

    function replaceLoggingMethods(level, loggerName) {
        /*jshint validthis:true */
        for (var i = 0; i < logMethods.length; i++) {
            var methodName = logMethods[i];
            this[methodName] = (i < level) ?
                noop :
                this.methodFactory(methodName, level, loggerName);
        }

        // Define log.log as an alias for log.debug
        this.log = this.debug;
    }

    // In old IE versions, the console isn't present until you first open it.
    // We build realMethod() replacements here that regenerate logging methods
    function enableLoggingWhenConsoleArrives(methodName, level, loggerName) {
        return function () {
            if (typeof console !== undefinedType) {
                replaceLoggingMethods.call(this, level, loggerName);
                this[methodName].apply(this, arguments);
            }
        };
    }

    // By default, we use closely bound real methods wherever possible, and
    // otherwise we wait for a console to appear, and then try again.
    function defaultMethodFactory(methodName, level, loggerName) {
        /*jshint validthis:true */
        return realMethod(methodName) ||
               enableLoggingWhenConsoleArrives.apply(this, arguments);
    }

    function Logger(name, defaultLevel, factory) {
      var self = this;
      var currentLevel;
      var storageKey = "loglevel";
      if (name) {
        storageKey += ":" + name;
      }

      function persistLevelIfPossible(levelNum) {
          var levelName = (logMethods[levelNum] || 'silent').toUpperCase();

          if (typeof window === undefinedType) return;

          // Use localStorage if available
          try {
              window.localStorage[storageKey] = levelName;
              return;
          } catch (ignore) {}

          // Use session cookie as fallback
          try {
              window.document.cookie =
                encodeURIComponent(storageKey) + "=" + levelName + ";";
          } catch (ignore) {}
      }

      function getPersistedLevel() {
          var storedLevel;

          if (typeof window === undefinedType) return;

          try {
              storedLevel = window.localStorage[storageKey];
          } catch (ignore) {}

          // Fallback to cookies if local storage gives us nothing
          if (typeof storedLevel === undefinedType) {
              try {
                  var cookie = window.document.cookie;
                  var location = cookie.indexOf(
                      encodeURIComponent(storageKey) + "=");
                  if (location !== -1) {
                      storedLevel = /^([^;]+)/.exec(cookie.slice(location))[1];
                  }
              } catch (ignore) {}
          }

          // If the stored level is not valid, treat it as if nothing was stored.
          if (self.levels[storedLevel] === undefined) {
              storedLevel = undefined;
          }

          return storedLevel;
      }

      /*
       *
       * Public logger API - see https://github.com/pimterry/loglevel for details
       *
       */

      self.name = name;

      self.levels = { "TRACE": 0, "DEBUG": 1, "INFO": 2, "WARN": 3,
          "ERROR": 4, "SILENT": 5};

      self.methodFactory = factory || defaultMethodFactory;

      self.getLevel = function () {
          return currentLevel;
      };

      self.setLevel = function (level, persist) {
          if (typeof level === "string" && self.levels[level.toUpperCase()] !== undefined) {
              level = self.levels[level.toUpperCase()];
          }
          if (typeof level === "number" && level >= 0 && level <= self.levels.SILENT) {
              currentLevel = level;
              if (persist !== false) {  // defaults to true
                  persistLevelIfPossible(level);
              }
              replaceLoggingMethods.call(self, level, name);
              if (typeof console === undefinedType && level < self.levels.SILENT) {
                  return "No console available for logging";
              }
          } else {
              throw "log.setLevel() called with invalid level: " + level;
          }
      };

      self.setDefaultLevel = function (level) {
          if (!getPersistedLevel()) {
              self.setLevel(level, false);
          }
      };

      self.enableAll = function(persist) {
          self.setLevel(self.levels.TRACE, persist);
      };

      self.disableAll = function(persist) {
          self.setLevel(self.levels.SILENT, persist);
      };

      // Initialize with the right level
      var initialLevel = getPersistedLevel();
      if (initialLevel == null) {
          initialLevel = defaultLevel == null ? "WARN" : defaultLevel;
      }
      self.setLevel(initialLevel, false);
    }

    /*
     *
     * Top-level API
     *
     */

    var defaultLogger = new Logger();

    var _loggersByName = {};
    defaultLogger.getLogger = function getLogger(name) {
        if (typeof name !== "string" || name === "") {
          throw new TypeError("You must supply a name when creating a logger.");
        }

        var logger = _loggersByName[name];
        if (!logger) {
          logger = _loggersByName[name] = new Logger(
            name, defaultLogger.getLevel(), defaultLogger.methodFactory);
        }
        return logger;
    };

    // Grab the current global log variable in case of overwrite
    var _log = (typeof window !== undefinedType) ? window.log : undefined;
    defaultLogger.noConflict = function() {
        if (typeof window !== undefinedType &&
               window.log === defaultLogger) {
            window.log = _log;
        }

        return defaultLogger;
    };

    defaultLogger.getLoggers = function getLoggers() {
        return _loggersByName;
    };

    return defaultLogger;
}));

},{}],32:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
function isDef(value) {
    return value !== undefined && value !== null;
}
class Backoff extends events_1.EventEmitter {
    constructor(options) {
        super();
        options = options || {};
        if (isDef(options.initialDelay) && options.initialDelay < 1) {
            throw new Error('The initial timeout must be equal to or greater than 1.');
        } else if (isDef(options.maxDelay) && options.maxDelay <= 1) {
            throw new Error('The maximal timeout must be greater than 1.');
        } else if (isDef(options.randomisationFactor) && (options.randomisationFactor < 0 || options.randomisationFactor > 1)) {
            throw new Error('The randomisation factor must be between 0 and 1.');
        } else if (isDef(options.factor) && options.factor <= 1) {
            throw new Error(`Exponential factor should be greater than 1.`);
        }
        this.initialDelay = options.initialDelay || 100;
        this.maxDelay = options.maxDelay || 10000;
        if (this.maxDelay <= this.initialDelay) {
            throw new Error('The maximal backoff delay must be greater than the initial backoff delay.');
        }
        this.randomisationFactor = options.randomisationFactor || 0;
        this.factor = options.factor || 2;
        this.maxNumberOfRetry = -1;
        this.reset();
    }
    static exponential(options) {
        return new Backoff(options);
    }
    backoff(err) {
        if (this.timeoutID == null) {
            if (this.backoffNumber === this.maxNumberOfRetry) {
                this.emit('fail', err);
                this.reset();
            } else {
                this.backoffDelay = this.next();
                this.timeoutID = setTimeout(this.onBackoff.bind(this), this.backoffDelay);
                this.emit('backoff', this.backoffNumber, this.backoffDelay, err);
            }
        }
    }
    reset() {
        this.backoffDelay = 0;
        this.nextBackoffDelay = this.initialDelay;
        this.backoffNumber = 0;
        clearTimeout(this.timeoutID);
        this.timeoutID = null;
    }
    failAfter(maxNumberOfRetry) {
        if (maxNumberOfRetry <= 0) {
            throw new Error(`Expected a maximum number of retry greater than 0 but got ${maxNumberOfRetry}`);
        }
        this.maxNumberOfRetry = maxNumberOfRetry;
    }
    next() {
        this.backoffDelay = Math.min(this.nextBackoffDelay, this.maxDelay);
        this.nextBackoffDelay = this.backoffDelay * this.factor;
        let randomisationMultiple = 1 + Math.random() * this.randomisationFactor;
        return Math.min(this.maxDelay, Math.round(this.backoffDelay * randomisationMultiple));
    }
    onBackoff() {
        this.timeoutID = null;
        this.emit('ready', this.backoffNumber, this.backoffDelay);
        this.backoffNumber++;
    }
}
exports.Backoff = Backoff;
exports.default = Backoff;


},{"events":29}],33:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
const retrier_1 = require("./retrier");
exports.Retrier = retrier_1.Retrier;
const backoff_1 = require("./backoff");
exports.Backoff = backoff_1.Backoff;


},{"./backoff":32,"./retrier":34}],34:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
/**
 * Provides retrier service
 */
class Retrier extends events_1.EventEmitter {
    /**
     * Creates a new Retrier instance
     */
    constructor(options) {
        super();
        this.minDelay = options.min;
        this.maxDelay = options.max;
        this.initialDelay = options.initial || 0;
        this.maxAttemptsCount = options.maxAttemptsCount || 0;
        this.maxAttemptsTime = options.maxAttemptsTime || 0;
        this.randomness = options.randomness || 0;
        this.inProgress = false;
        this.attemptNum = 0;
        this.prevDelay = 0;
        this.currDelay = 0;
    }
    attempt() {
        clearTimeout(this.timeout);
        this.attemptNum++;
        this.timeout = null;
        this.emit('attempt', this);
    }
    nextDelay(delayOverride) {
        if (typeof delayOverride === 'number') {
            this.prevDelay = 0;
            this.currDelay = delayOverride;
            return delayOverride;
        }
        if (this.attemptNum == 0) {
            return this.initialDelay;
        }
        if (this.attemptNum == 1) {
            this.currDelay = this.minDelay;
            return this.currDelay;
        }
        this.prevDelay = this.currDelay;
        let delay = this.currDelay + this.prevDelay;
        if (this.maxDelay && delay > this.maxDelay) {
            this.currDelay = this.maxDelay;
            delay = this.maxDelay;
        }
        this.currDelay = delay;
        return delay;
    }
    randomize(delay) {
        let area = delay * this.randomness;
        let corr = Math.round(Math.random() * area * 2 - area);
        return Math.max(0, delay + corr);
    }
    scheduleAttempt(delayOverride) {
        if (this.maxAttemptsCount && this.attemptNum >= this.maxAttemptsCount) {
            this.cleanup();
            this.emit('failed', new Error('Maximum attempt count limit reached'));
            this.reject(new Error('Maximum attempt count reached'));
            return;
        }
        let delay = this.nextDelay(delayOverride);
        delay = this.randomize(delay);
        if (this.maxAttemptsTime && this.startTimestamp + this.maxAttemptsTime < Date.now() + delay) {
            this.cleanup();
            this.emit('failed', new Error('Maximum attempt time limit reached'));
            this.reject(new Error('Maximum attempt time limit reached'));
            return;
        }
        this.timeout = setTimeout(() => this.attempt(), delay);
    }
    cleanup() {
        clearTimeout(this.timeout);
        this.timeout = null;
        this.inProgress = false;
        this.attemptNum = 0;
        this.prevDelay = 0;
        this.currDelay = 0;
    }
    start() {
        if (this.inProgress) {
            throw new Error('Retrier is already in progress');
        }
        this.inProgress = true;
        return new Promise((resolve, reject) => {
            this.resolve = resolve;
            this.reject = reject;
            this.startTimestamp = Date.now();
            this.scheduleAttempt(this.initialDelay);
        });
    }
    cancel() {
        if (this.timeout) {
            clearTimeout(this.timeout);
            this.timeout = null;
            this.inProgress = false;
            this.emit('cancelled');
            this.reject(new Error('Cancelled'));
        }
    }
    succeeded(arg) {
        this.emit('succeeded', arg);
        this.resolve(arg);
    }
    failed(err, nextAttemptDelayOverride) {
        if (this.timeout) {
            throw new Error('Retrier attempt is already in progress');
        }
        this.scheduleAttempt(nextAttemptDelayOverride);
    }
    run(handler) {
        this.on('attempt', () => {
            handler().then(v => this.succeeded(v)).catch(e => this.failed(e));
        });
        return this.start();
    }
}
exports.Retrier = Retrier;
exports.default = Retrier;


},{"events":29}],35:[function(require,module,exports){
(function (global){
/*!
 * Platform.js <https://mths.be/platform>
 * Copyright 2014-2018 Benjamin Tan <https://bnjmnt4n.now.sh/>
 * Copyright 2011-2013 John-David Dalton <http://allyoucanleet.com/>
 * Available under MIT license <https://mths.be/mit>
 */
;(function() {
  'use strict';

  /** Used to determine if values are of the language type `Object`. */
  var objectTypes = {
    'function': true,
    'object': true
  };

  /** Used as a reference to the global object. */
  var root = (objectTypes[typeof window] && window) || this;

  /** Backup possible global object. */
  var oldRoot = root;

  /** Detect free variable `exports`. */
  var freeExports = objectTypes[typeof exports] && exports;

  /** Detect free variable `module`. */
  var freeModule = objectTypes[typeof module] && module && !module.nodeType && module;

  /** Detect free variable `global` from Node.js or Browserified code and use it as `root`. */
  var freeGlobal = freeExports && freeModule && typeof global == 'object' && global;
  if (freeGlobal && (freeGlobal.global === freeGlobal || freeGlobal.window === freeGlobal || freeGlobal.self === freeGlobal)) {
    root = freeGlobal;
  }

  /**
   * Used as the maximum length of an array-like object.
   * See the [ES6 spec](http://people.mozilla.org/~jorendorff/es6-draft.html#sec-tolength)
   * for more details.
   */
  var maxSafeInteger = Math.pow(2, 53) - 1;

  /** Regular expression to detect Opera. */
  var reOpera = /\bOpera/;

  /** Possible global object. */
  var thisBinding = this;

  /** Used for native method references. */
  var objectProto = Object.prototype;

  /** Used to check for own properties of an object. */
  var hasOwnProperty = objectProto.hasOwnProperty;

  /** Used to resolve the internal `[[Class]]` of values. */
  var toString = objectProto.toString;

  /*--------------------------------------------------------------------------*/

  /**
   * Capitalizes a string value.
   *
   * @private
   * @param {string} string The string to capitalize.
   * @returns {string} The capitalized string.
   */
  function capitalize(string) {
    string = String(string);
    return string.charAt(0).toUpperCase() + string.slice(1);
  }

  /**
   * A utility function to clean up the OS name.
   *
   * @private
   * @param {string} os The OS name to clean up.
   * @param {string} [pattern] A `RegExp` pattern matching the OS name.
   * @param {string} [label] A label for the OS.
   */
  function cleanupOS(os, pattern, label) {
    // Platform tokens are defined at:
    // http://msdn.microsoft.com/en-us/library/ms537503(VS.85).aspx
    // http://web.archive.org/web/20081122053950/http://msdn.microsoft.com/en-us/library/ms537503(VS.85).aspx
    var data = {
      '10.0': '10',
      '6.4':  '10 Technical Preview',
      '6.3':  '8.1',
      '6.2':  '8',
      '6.1':  'Server 2008 R2 / 7',
      '6.0':  'Server 2008 / Vista',
      '5.2':  'Server 2003 / XP 64-bit',
      '5.1':  'XP',
      '5.01': '2000 SP1',
      '5.0':  '2000',
      '4.0':  'NT',
      '4.90': 'ME'
    };
    // Detect Windows version from platform tokens.
    if (pattern && label && /^Win/i.test(os) && !/^Windows Phone /i.test(os) &&
        (data = data[/[\d.]+$/.exec(os)])) {
      os = 'Windows ' + data;
    }
    // Correct character case and cleanup string.
    os = String(os);

    if (pattern && label) {
      os = os.replace(RegExp(pattern, 'i'), label);
    }

    os = format(
      os.replace(/ ce$/i, ' CE')
        .replace(/\bhpw/i, 'web')
        .replace(/\bMacintosh\b/, 'Mac OS')
        .replace(/_PowerPC\b/i, ' OS')
        .replace(/\b(OS X) [^ \d]+/i, '$1')
        .replace(/\bMac (OS X)\b/, '$1')
        .replace(/\/(\d)/, ' $1')
        .replace(/_/g, '.')
        .replace(/(?: BePC|[ .]*fc[ \d.]+)$/i, '')
        .replace(/\bx86\.64\b/gi, 'x86_64')
        .replace(/\b(Windows Phone) OS\b/, '$1')
        .replace(/\b(Chrome OS \w+) [\d.]+\b/, '$1')
        .split(' on ')[0]
    );

    return os;
  }

  /**
   * An iteration utility for arrays and objects.
   *
   * @private
   * @param {Array|Object} object The object to iterate over.
   * @param {Function} callback The function called per iteration.
   */
  function each(object, callback) {
    var index = -1,
        length = object ? object.length : 0;

    if (typeof length == 'number' && length > -1 && length <= maxSafeInteger) {
      while (++index < length) {
        callback(object[index], index, object);
      }
    } else {
      forOwn(object, callback);
    }
  }

  /**
   * Trim and conditionally capitalize string values.
   *
   * @private
   * @param {string} string The string to format.
   * @returns {string} The formatted string.
   */
  function format(string) {
    string = trim(string);
    return /^(?:webOS|i(?:OS|P))/.test(string)
      ? string
      : capitalize(string);
  }

  /**
   * Iterates over an object's own properties, executing the `callback` for each.
   *
   * @private
   * @param {Object} object The object to iterate over.
   * @param {Function} callback The function executed per own property.
   */
  function forOwn(object, callback) {
    for (var key in object) {
      if (hasOwnProperty.call(object, key)) {
        callback(object[key], key, object);
      }
    }
  }

  /**
   * Gets the internal `[[Class]]` of a value.
   *
   * @private
   * @param {*} value The value.
   * @returns {string} The `[[Class]]`.
   */
  function getClassOf(value) {
    return value == null
      ? capitalize(value)
      : toString.call(value).slice(8, -1);
  }

  /**
   * Host objects can return type values that are different from their actual
   * data type. The objects we are concerned with usually return non-primitive
   * types of "object", "function", or "unknown".
   *
   * @private
   * @param {*} object The owner of the property.
   * @param {string} property The property to check.
   * @returns {boolean} Returns `true` if the property value is a non-primitive, else `false`.
   */
  function isHostType(object, property) {
    var type = object != null ? typeof object[property] : 'number';
    return !/^(?:boolean|number|string|undefined)$/.test(type) &&
      (type == 'object' ? !!object[property] : true);
  }

  /**
   * Prepares a string for use in a `RegExp` by making hyphens and spaces optional.
   *
   * @private
   * @param {string} string The string to qualify.
   * @returns {string} The qualified string.
   */
  function qualify(string) {
    return String(string).replace(/([ -])(?!$)/g, '$1?');
  }

  /**
   * A bare-bones `Array#reduce` like utility function.
   *
   * @private
   * @param {Array} array The array to iterate over.
   * @param {Function} callback The function called per iteration.
   * @returns {*} The accumulated result.
   */
  function reduce(array, callback) {
    var accumulator = null;
    each(array, function(value, index) {
      accumulator = callback(accumulator, value, index, array);
    });
    return accumulator;
  }

  /**
   * Removes leading and trailing whitespace from a string.
   *
   * @private
   * @param {string} string The string to trim.
   * @returns {string} The trimmed string.
   */
  function trim(string) {
    return String(string).replace(/^ +| +$/g, '');
  }

  /*--------------------------------------------------------------------------*/

  /**
   * Creates a new platform object.
   *
   * @memberOf platform
   * @param {Object|string} [ua=navigator.userAgent] The user agent string or
   *  context object.
   * @returns {Object} A platform object.
   */
  function parse(ua) {

    /** The environment context object. */
    var context = root;

    /** Used to flag when a custom context is provided. */
    var isCustomContext = ua && typeof ua == 'object' && getClassOf(ua) != 'String';

    // Juggle arguments.
    if (isCustomContext) {
      context = ua;
      ua = null;
    }

    /** Browser navigator object. */
    var nav = context.navigator || {};

    /** Browser user agent string. */
    var userAgent = nav.userAgent || '';

    ua || (ua = userAgent);

    /** Used to flag when `thisBinding` is the [ModuleScope]. */
    var isModuleScope = isCustomContext || thisBinding == oldRoot;

    /** Used to detect if browser is like Chrome. */
    var likeChrome = isCustomContext
      ? !!nav.likeChrome
      : /\bChrome\b/.test(ua) && !/internal|\n/i.test(toString.toString());

    /** Internal `[[Class]]` value shortcuts. */
    var objectClass = 'Object',
        airRuntimeClass = isCustomContext ? objectClass : 'ScriptBridgingProxyObject',
        enviroClass = isCustomContext ? objectClass : 'Environment',
        javaClass = (isCustomContext && context.java) ? 'JavaPackage' : getClassOf(context.java),
        phantomClass = isCustomContext ? objectClass : 'RuntimeObject';

    /** Detect Java environments. */
    var java = /\bJava/.test(javaClass) && context.java;

    /** Detect Rhino. */
    var rhino = java && getClassOf(context.environment) == enviroClass;

    /** A character to represent alpha. */
    var alpha = java ? 'a' : '\u03b1';

    /** A character to represent beta. */
    var beta = java ? 'b' : '\u03b2';

    /** Browser document object. */
    var doc = context.document || {};

    /**
     * Detect Opera browser (Presto-based).
     * http://www.howtocreate.co.uk/operaStuff/operaObject.html
     * http://dev.opera.com/articles/view/opera-mini-web-content-authoring-guidelines/#operamini
     */
    var opera = context.operamini || context.opera;

    /** Opera `[[Class]]`. */
    var operaClass = reOpera.test(operaClass = (isCustomContext && opera) ? opera['[[Class]]'] : getClassOf(opera))
      ? operaClass
      : (opera = null);

    /*------------------------------------------------------------------------*/

    /** Temporary variable used over the script's lifetime. */
    var data;

    /** The CPU architecture. */
    var arch = ua;

    /** Platform description array. */
    var description = [];

    /** Platform alpha/beta indicator. */
    var prerelease = null;

    /** A flag to indicate that environment features should be used to resolve the platform. */
    var useFeatures = ua == userAgent;

    /** The browser/environment version. */
    var version = useFeatures && opera && typeof opera.version == 'function' && opera.version();

    /** A flag to indicate if the OS ends with "/ Version" */
    var isSpecialCasedOS;

    /* Detectable layout engines (order is important). */
    var layout = getLayout([
      { 'label': 'EdgeHTML', 'pattern': 'Edge' },
      'Trident',
      { 'label': 'WebKit', 'pattern': 'AppleWebKit' },
      'iCab',
      'Presto',
      'NetFront',
      'Tasman',
      'KHTML',
      'Gecko'
    ]);

    /* Detectable browser names (order is important). */
    var name = getName([
      'Adobe AIR',
      'Arora',
      'Avant Browser',
      'Breach',
      'Camino',
      'Electron',
      'Epiphany',
      'Fennec',
      'Flock',
      'Galeon',
      'GreenBrowser',
      'iCab',
      'Iceweasel',
      'K-Meleon',
      'Konqueror',
      'Lunascape',
      'Maxthon',
      { 'label': 'Microsoft Edge', 'pattern': 'Edge' },
      'Midori',
      'Nook Browser',
      'PaleMoon',
      'PhantomJS',
      'Raven',
      'Rekonq',
      'RockMelt',
      { 'label': 'Samsung Internet', 'pattern': 'SamsungBrowser' },
      'SeaMonkey',
      { 'label': 'Silk', 'pattern': '(?:Cloud9|Silk-Accelerated)' },
      'Sleipnir',
      'SlimBrowser',
      { 'label': 'SRWare Iron', 'pattern': 'Iron' },
      'Sunrise',
      'Swiftfox',
      'Waterfox',
      'WebPositive',
      'Opera Mini',
      { 'label': 'Opera Mini', 'pattern': 'OPiOS' },
      'Opera',
      { 'label': 'Opera', 'pattern': 'OPR' },
      'Chrome',
      { 'label': 'Chrome Mobile', 'pattern': '(?:CriOS|CrMo)' },
      { 'label': 'Firefox', 'pattern': '(?:Firefox|Minefield)' },
      { 'label': 'Firefox for iOS', 'pattern': 'FxiOS' },
      { 'label': 'IE', 'pattern': 'IEMobile' },
      { 'label': 'IE', 'pattern': 'MSIE' },
      'Safari'
    ]);

    /* Detectable products (order is important). */
    var product = getProduct([
      { 'label': 'BlackBerry', 'pattern': 'BB10' },
      'BlackBerry',
      { 'label': 'Galaxy S', 'pattern': 'GT-I9000' },
      { 'label': 'Galaxy S2', 'pattern': 'GT-I9100' },
      { 'label': 'Galaxy S3', 'pattern': 'GT-I9300' },
      { 'label': 'Galaxy S4', 'pattern': 'GT-I9500' },
      { 'label': 'Galaxy S5', 'pattern': 'SM-G900' },
      { 'label': 'Galaxy S6', 'pattern': 'SM-G920' },
      { 'label': 'Galaxy S6 Edge', 'pattern': 'SM-G925' },
      { 'label': 'Galaxy S7', 'pattern': 'SM-G930' },
      { 'label': 'Galaxy S7 Edge', 'pattern': 'SM-G935' },
      'Google TV',
      'Lumia',
      'iPad',
      'iPod',
      'iPhone',
      'Kindle',
      { 'label': 'Kindle Fire', 'pattern': '(?:Cloud9|Silk-Accelerated)' },
      'Nexus',
      'Nook',
      'PlayBook',
      'PlayStation Vita',
      'PlayStation',
      'TouchPad',
      'Transformer',
      { 'label': 'Wii U', 'pattern': 'WiiU' },
      'Wii',
      'Xbox One',
      { 'label': 'Xbox 360', 'pattern': 'Xbox' },
      'Xoom'
    ]);

    /* Detectable manufacturers. */
    var manufacturer = getManufacturer({
      'Apple': { 'iPad': 1, 'iPhone': 1, 'iPod': 1 },
      'Archos': {},
      'Amazon': { 'Kindle': 1, 'Kindle Fire': 1 },
      'Asus': { 'Transformer': 1 },
      'Barnes & Noble': { 'Nook': 1 },
      'BlackBerry': { 'PlayBook': 1 },
      'Google': { 'Google TV': 1, 'Nexus': 1 },
      'HP': { 'TouchPad': 1 },
      'HTC': {},
      'LG': {},
      'Microsoft': { 'Xbox': 1, 'Xbox One': 1 },
      'Motorola': { 'Xoom': 1 },
      'Nintendo': { 'Wii U': 1,  'Wii': 1 },
      'Nokia': { 'Lumia': 1 },
      'Samsung': { 'Galaxy S': 1, 'Galaxy S2': 1, 'Galaxy S3': 1, 'Galaxy S4': 1 },
      'Sony': { 'PlayStation': 1, 'PlayStation Vita': 1 }
    });

    /* Detectable operating systems (order is important). */
    var os = getOS([
      'Windows Phone',
      'Android',
      'CentOS',
      { 'label': 'Chrome OS', 'pattern': 'CrOS' },
      'Debian',
      'Fedora',
      'FreeBSD',
      'Gentoo',
      'Haiku',
      'Kubuntu',
      'Linux Mint',
      'OpenBSD',
      'Red Hat',
      'SuSE',
      'Ubuntu',
      'Xubuntu',
      'Cygwin',
      'Symbian OS',
      'hpwOS',
      'webOS ',
      'webOS',
      'Tablet OS',
      'Tizen',
      'Linux',
      'Mac OS X',
      'Macintosh',
      'Mac',
      'Windows 98;',
      'Windows '
    ]);

    /*------------------------------------------------------------------------*/

    /**
     * Picks the layout engine from an array of guesses.
     *
     * @private
     * @param {Array} guesses An array of guesses.
     * @returns {null|string} The detected layout engine.
     */
    function getLayout(guesses) {
      return reduce(guesses, function(result, guess) {
        return result || RegExp('\\b' + (
          guess.pattern || qualify(guess)
        ) + '\\b', 'i').exec(ua) && (guess.label || guess);
      });
    }

    /**
     * Picks the manufacturer from an array of guesses.
     *
     * @private
     * @param {Array} guesses An object of guesses.
     * @returns {null|string} The detected manufacturer.
     */
    function getManufacturer(guesses) {
      return reduce(guesses, function(result, value, key) {
        // Lookup the manufacturer by product or scan the UA for the manufacturer.
        return result || (
          value[product] ||
          value[/^[a-z]+(?: +[a-z]+\b)*/i.exec(product)] ||
          RegExp('\\b' + qualify(key) + '(?:\\b|\\w*\\d)', 'i').exec(ua)
        ) && key;
      });
    }

    /**
     * Picks the browser name from an array of guesses.
     *
     * @private
     * @param {Array} guesses An array of guesses.
     * @returns {null|string} The detected browser name.
     */
    function getName(guesses) {
      return reduce(guesses, function(result, guess) {
        return result || RegExp('\\b' + (
          guess.pattern || qualify(guess)
        ) + '\\b', 'i').exec(ua) && (guess.label || guess);
      });
    }

    /**
     * Picks the OS name from an array of guesses.
     *
     * @private
     * @param {Array} guesses An array of guesses.
     * @returns {null|string} The detected OS name.
     */
    function getOS(guesses) {
      return reduce(guesses, function(result, guess) {
        var pattern = guess.pattern || qualify(guess);
        if (!result && (result =
              RegExp('\\b' + pattern + '(?:/[\\d.]+|[ \\w.]*)', 'i').exec(ua)
            )) {
          result = cleanupOS(result, pattern, guess.label || guess);
        }
        return result;
      });
    }

    /**
     * Picks the product name from an array of guesses.
     *
     * @private
     * @param {Array} guesses An array of guesses.
     * @returns {null|string} The detected product name.
     */
    function getProduct(guesses) {
      return reduce(guesses, function(result, guess) {
        var pattern = guess.pattern || qualify(guess);
        if (!result && (result =
              RegExp('\\b' + pattern + ' *\\d+[.\\w_]*', 'i').exec(ua) ||
              RegExp('\\b' + pattern + ' *\\w+-[\\w]*', 'i').exec(ua) ||
              RegExp('\\b' + pattern + '(?:; *(?:[a-z]+[_-])?[a-z]+\\d+|[^ ();-]*)', 'i').exec(ua)
            )) {
          // Split by forward slash and append product version if needed.
          if ((result = String((guess.label && !RegExp(pattern, 'i').test(guess.label)) ? guess.label : result).split('/'))[1] && !/[\d.]+/.test(result[0])) {
            result[0] += ' ' + result[1];
          }
          // Correct character case and cleanup string.
          guess = guess.label || guess;
          result = format(result[0]
            .replace(RegExp(pattern, 'i'), guess)
            .replace(RegExp('; *(?:' + guess + '[_-])?', 'i'), ' ')
            .replace(RegExp('(' + guess + ')[-_.]?(\\w)', 'i'), '$1 $2'));
        }
        return result;
      });
    }

    /**
     * Resolves the version using an array of UA patterns.
     *
     * @private
     * @param {Array} patterns An array of UA patterns.
     * @returns {null|string} The detected version.
     */
    function getVersion(patterns) {
      return reduce(patterns, function(result, pattern) {
        return result || (RegExp(pattern +
          '(?:-[\\d.]+/|(?: for [\\w-]+)?[ /-])([\\d.]+[^ ();/_-]*)', 'i').exec(ua) || 0)[1] || null;
      });
    }

    /**
     * Returns `platform.description` when the platform object is coerced to a string.
     *
     * @name toString
     * @memberOf platform
     * @returns {string} Returns `platform.description` if available, else an empty string.
     */
    function toStringPlatform() {
      return this.description || '';
    }

    /*------------------------------------------------------------------------*/

    // Convert layout to an array so we can add extra details.
    layout && (layout = [layout]);

    // Detect product names that contain their manufacturer's name.
    if (manufacturer && !product) {
      product = getProduct([manufacturer]);
    }
    // Clean up Google TV.
    if ((data = /\bGoogle TV\b/.exec(product))) {
      product = data[0];
    }
    // Detect simulators.
    if (/\bSimulator\b/i.test(ua)) {
      product = (product ? product + ' ' : '') + 'Simulator';
    }
    // Detect Opera Mini 8+ running in Turbo/Uncompressed mode on iOS.
    if (name == 'Opera Mini' && /\bOPiOS\b/.test(ua)) {
      description.push('running in Turbo/Uncompressed mode');
    }
    // Detect IE Mobile 11.
    if (name == 'IE' && /\blike iPhone OS\b/.test(ua)) {
      data = parse(ua.replace(/like iPhone OS/, ''));
      manufacturer = data.manufacturer;
      product = data.product;
    }
    // Detect iOS.
    else if (/^iP/.test(product)) {
      name || (name = 'Safari');
      os = 'iOS' + ((data = / OS ([\d_]+)/i.exec(ua))
        ? ' ' + data[1].replace(/_/g, '.')
        : '');
    }
    // Detect Kubuntu.
    else if (name == 'Konqueror' && !/buntu/i.test(os)) {
      os = 'Kubuntu';
    }
    // Detect Android browsers.
    else if ((manufacturer && manufacturer != 'Google' &&
        ((/Chrome/.test(name) && !/\bMobile Safari\b/i.test(ua)) || /\bVita\b/.test(product))) ||
        (/\bAndroid\b/.test(os) && /^Chrome/.test(name) && /\bVersion\//i.test(ua))) {
      name = 'Android Browser';
      os = /\bAndroid\b/.test(os) ? os : 'Android';
    }
    // Detect Silk desktop/accelerated modes.
    else if (name == 'Silk') {
      if (!/\bMobi/i.test(ua)) {
        os = 'Android';
        description.unshift('desktop mode');
      }
      if (/Accelerated *= *true/i.test(ua)) {
        description.unshift('accelerated');
      }
    }
    // Detect PaleMoon identifying as Firefox.
    else if (name == 'PaleMoon' && (data = /\bFirefox\/([\d.]+)\b/.exec(ua))) {
      description.push('identifying as Firefox ' + data[1]);
    }
    // Detect Firefox OS and products running Firefox.
    else if (name == 'Firefox' && (data = /\b(Mobile|Tablet|TV)\b/i.exec(ua))) {
      os || (os = 'Firefox OS');
      product || (product = data[1]);
    }
    // Detect false positives for Firefox/Safari.
    else if (!name || (data = !/\bMinefield\b/i.test(ua) && /\b(?:Firefox|Safari)\b/.exec(name))) {
      // Escape the `/` for Firefox 1.
      if (name && !product && /[\/,]|^[^(]+?\)/.test(ua.slice(ua.indexOf(data + '/') + 8))) {
        // Clear name of false positives.
        name = null;
      }
      // Reassign a generic name.
      if ((data = product || manufacturer || os) &&
          (product || manufacturer || /\b(?:Android|Symbian OS|Tablet OS|webOS)\b/.test(os))) {
        name = /[a-z]+(?: Hat)?/i.exec(/\bAndroid\b/.test(os) ? os : data) + ' Browser';
      }
    }
    // Add Chrome version to description for Electron.
    else if (name == 'Electron' && (data = (/\bChrome\/([\d.]+)\b/.exec(ua) || 0)[1])) {
      description.push('Chromium ' + data);
    }
    // Detect non-Opera (Presto-based) versions (order is important).
    if (!version) {
      version = getVersion([
        '(?:Cloud9|CriOS|CrMo|Edge|FxiOS|IEMobile|Iron|Opera ?Mini|OPiOS|OPR|Raven|SamsungBrowser|Silk(?!/[\\d.]+$))',
        'Version',
        qualify(name),
        '(?:Firefox|Minefield|NetFront)'
      ]);
    }
    // Detect stubborn layout engines.
    if ((data =
          layout == 'iCab' && parseFloat(version) > 3 && 'WebKit' ||
          /\bOpera\b/.test(name) && (/\bOPR\b/.test(ua) ? 'Blink' : 'Presto') ||
          /\b(?:Midori|Nook|Safari)\b/i.test(ua) && !/^(?:Trident|EdgeHTML)$/.test(layout) && 'WebKit' ||
          !layout && /\bMSIE\b/i.test(ua) && (os == 'Mac OS' ? 'Tasman' : 'Trident') ||
          layout == 'WebKit' && /\bPlayStation\b(?! Vita\b)/i.test(name) && 'NetFront'
        )) {
      layout = [data];
    }
    // Detect Windows Phone 7 desktop mode.
    if (name == 'IE' && (data = (/; *(?:XBLWP|ZuneWP)(\d+)/i.exec(ua) || 0)[1])) {
      name += ' Mobile';
      os = 'Windows Phone ' + (/\+$/.test(data) ? data : data + '.x');
      description.unshift('desktop mode');
    }
    // Detect Windows Phone 8.x desktop mode.
    else if (/\bWPDesktop\b/i.test(ua)) {
      name = 'IE Mobile';
      os = 'Windows Phone 8.x';
      description.unshift('desktop mode');
      version || (version = (/\brv:([\d.]+)/.exec(ua) || 0)[1]);
    }
    // Detect IE 11 identifying as other browsers.
    else if (name != 'IE' && layout == 'Trident' && (data = /\brv:([\d.]+)/.exec(ua))) {
      if (name) {
        description.push('identifying as ' + name + (version ? ' ' + version : ''));
      }
      name = 'IE';
      version = data[1];
    }
    // Leverage environment features.
    if (useFeatures) {
      // Detect server-side environments.
      // Rhino has a global function while others have a global object.
      if (isHostType(context, 'global')) {
        if (java) {
          data = java.lang.System;
          arch = data.getProperty('os.arch');
          os = os || data.getProperty('os.name') + ' ' + data.getProperty('os.version');
        }
        if (rhino) {
          try {
            version = context.require('ringo/engine').version.join('.');
            name = 'RingoJS';
          } catch(e) {
            if ((data = context.system) && data.global.system == context.system) {
              name = 'Narwhal';
              os || (os = data[0].os || null);
            }
          }
          if (!name) {
            name = 'Rhino';
          }
        }
        else if (
          typeof context.process == 'object' && !context.process.browser &&
          (data = context.process)
        ) {
          if (typeof data.versions == 'object') {
            if (typeof data.versions.electron == 'string') {
              description.push('Node ' + data.versions.node);
              name = 'Electron';
              version = data.versions.electron;
            } else if (typeof data.versions.nw == 'string') {
              description.push('Chromium ' + version, 'Node ' + data.versions.node);
              name = 'NW.js';
              version = data.versions.nw;
            }
          }
          if (!name) {
            name = 'Node.js';
            arch = data.arch;
            os = data.platform;
            version = /[\d.]+/.exec(data.version);
            version = version ? version[0] : null;
          }
        }
      }
      // Detect Adobe AIR.
      else if (getClassOf((data = context.runtime)) == airRuntimeClass) {
        name = 'Adobe AIR';
        os = data.flash.system.Capabilities.os;
      }
      // Detect PhantomJS.
      else if (getClassOf((data = context.phantom)) == phantomClass) {
        name = 'PhantomJS';
        version = (data = data.version || null) && (data.major + '.' + data.minor + '.' + data.patch);
      }
      // Detect IE compatibility modes.
      else if (typeof doc.documentMode == 'number' && (data = /\bTrident\/(\d+)/i.exec(ua))) {
        // We're in compatibility mode when the Trident version + 4 doesn't
        // equal the document mode.
        version = [version, doc.documentMode];
        if ((data = +data[1] + 4) != version[1]) {
          description.push('IE ' + version[1] + ' mode');
          layout && (layout[1] = '');
          version[1] = data;
        }
        version = name == 'IE' ? String(version[1].toFixed(1)) : version[0];
      }
      // Detect IE 11 masking as other browsers.
      else if (typeof doc.documentMode == 'number' && /^(?:Chrome|Firefox)\b/.test(name)) {
        description.push('masking as ' + name + ' ' + version);
        name = 'IE';
        version = '11.0';
        layout = ['Trident'];
        os = 'Windows';
      }
      os = os && format(os);
    }
    // Detect prerelease phases.
    if (version && (data =
          /(?:[ab]|dp|pre|[ab]\d+pre)(?:\d+\+?)?$/i.exec(version) ||
          /(?:alpha|beta)(?: ?\d)?/i.exec(ua + ';' + (useFeatures && nav.appMinorVersion)) ||
          /\bMinefield\b/i.test(ua) && 'a'
        )) {
      prerelease = /b/i.test(data) ? 'beta' : 'alpha';
      version = version.replace(RegExp(data + '\\+?$'), '') +
        (prerelease == 'beta' ? beta : alpha) + (/\d+\+?/.exec(data) || '');
    }
    // Detect Firefox Mobile.
    if (name == 'Fennec' || name == 'Firefox' && /\b(?:Android|Firefox OS)\b/.test(os)) {
      name = 'Firefox Mobile';
    }
    // Obscure Maxthon's unreliable version.
    else if (name == 'Maxthon' && version) {
      version = version.replace(/\.[\d.]+/, '.x');
    }
    // Detect Xbox 360 and Xbox One.
    else if (/\bXbox\b/i.test(product)) {
      if (product == 'Xbox 360') {
        os = null;
      }
      if (product == 'Xbox 360' && /\bIEMobile\b/.test(ua)) {
        description.unshift('mobile mode');
      }
    }
    // Add mobile postfix.
    else if ((/^(?:Chrome|IE|Opera)$/.test(name) || name && !product && !/Browser|Mobi/.test(name)) &&
        (os == 'Windows CE' || /Mobi/i.test(ua))) {
      name += ' Mobile';
    }
    // Detect IE platform preview.
    else if (name == 'IE' && useFeatures) {
      try {
        if (context.external === null) {
          description.unshift('platform preview');
        }
      } catch(e) {
        description.unshift('embedded');
      }
    }
    // Detect BlackBerry OS version.
    // http://docs.blackberry.com/en/developers/deliverables/18169/HTTP_headers_sent_by_BB_Browser_1234911_11.jsp
    else if ((/\bBlackBerry\b/.test(product) || /\bBB10\b/.test(ua)) && (data =
          (RegExp(product.replace(/ +/g, ' *') + '/([.\\d]+)', 'i').exec(ua) || 0)[1] ||
          version
        )) {
      data = [data, /BB10/.test(ua)];
      os = (data[1] ? (product = null, manufacturer = 'BlackBerry') : 'Device Software') + ' ' + data[0];
      version = null;
    }
    // Detect Opera identifying/masking itself as another browser.
    // http://www.opera.com/support/kb/view/843/
    else if (this != forOwn && product != 'Wii' && (
          (useFeatures && opera) ||
          (/Opera/.test(name) && /\b(?:MSIE|Firefox)\b/i.test(ua)) ||
          (name == 'Firefox' && /\bOS X (?:\d+\.){2,}/.test(os)) ||
          (name == 'IE' && (
            (os && !/^Win/.test(os) && version > 5.5) ||
            /\bWindows XP\b/.test(os) && version > 8 ||
            version == 8 && !/\bTrident\b/.test(ua)
          ))
        ) && !reOpera.test((data = parse.call(forOwn, ua.replace(reOpera, '') + ';'))) && data.name) {
      // When "identifying", the UA contains both Opera and the other browser's name.
      data = 'ing as ' + data.name + ((data = data.version) ? ' ' + data : '');
      if (reOpera.test(name)) {
        if (/\bIE\b/.test(data) && os == 'Mac OS') {
          os = null;
        }
        data = 'identify' + data;
      }
      // When "masking", the UA contains only the other browser's name.
      else {
        data = 'mask' + data;
        if (operaClass) {
          name = format(operaClass.replace(/([a-z])([A-Z])/g, '$1 $2'));
        } else {
          name = 'Opera';
        }
        if (/\bIE\b/.test(data)) {
          os = null;
        }
        if (!useFeatures) {
          version = null;
        }
      }
      layout = ['Presto'];
      description.push(data);
    }
    // Detect WebKit Nightly and approximate Chrome/Safari versions.
    if ((data = (/\bAppleWebKit\/([\d.]+\+?)/i.exec(ua) || 0)[1])) {
      // Correct build number for numeric comparison.
      // (e.g. "532.5" becomes "532.05")
      data = [parseFloat(data.replace(/\.(\d)$/, '.0$1')), data];
      // Nightly builds are postfixed with a "+".
      if (name == 'Safari' && data[1].slice(-1) == '+') {
        name = 'WebKit Nightly';
        prerelease = 'alpha';
        version = data[1].slice(0, -1);
      }
      // Clear incorrect browser versions.
      else if (version == data[1] ||
          version == (data[2] = (/\bSafari\/([\d.]+\+?)/i.exec(ua) || 0)[1])) {
        version = null;
      }
      // Use the full Chrome version when available.
      data[1] = (/\bChrome\/([\d.]+)/i.exec(ua) || 0)[1];
      // Detect Blink layout engine.
      if (data[0] == 537.36 && data[2] == 537.36 && parseFloat(data[1]) >= 28 && layout == 'WebKit') {
        layout = ['Blink'];
      }
      // Detect JavaScriptCore.
      // http://stackoverflow.com/questions/6768474/how-can-i-detect-which-javascript-engine-v8-or-jsc-is-used-at-runtime-in-androi
      if (!useFeatures || (!likeChrome && !data[1])) {
        layout && (layout[1] = 'like Safari');
        data = (data = data[0], data < 400 ? 1 : data < 500 ? 2 : data < 526 ? 3 : data < 533 ? 4 : data < 534 ? '4+' : data < 535 ? 5 : data < 537 ? 6 : data < 538 ? 7 : data < 601 ? 8 : '8');
      } else {
        layout && (layout[1] = 'like Chrome');
        data = data[1] || (data = data[0], data < 530 ? 1 : data < 532 ? 2 : data < 532.05 ? 3 : data < 533 ? 4 : data < 534.03 ? 5 : data < 534.07 ? 6 : data < 534.10 ? 7 : data < 534.13 ? 8 : data < 534.16 ? 9 : data < 534.24 ? 10 : data < 534.30 ? 11 : data < 535.01 ? 12 : data < 535.02 ? '13+' : data < 535.07 ? 15 : data < 535.11 ? 16 : data < 535.19 ? 17 : data < 536.05 ? 18 : data < 536.10 ? 19 : data < 537.01 ? 20 : data < 537.11 ? '21+' : data < 537.13 ? 23 : data < 537.18 ? 24 : data < 537.24 ? 25 : data < 537.36 ? 26 : layout != 'Blink' ? '27' : '28');
      }
      // Add the postfix of ".x" or "+" for approximate versions.
      layout && (layout[1] += ' ' + (data += typeof data == 'number' ? '.x' : /[.+]/.test(data) ? '' : '+'));
      // Obscure version for some Safari 1-2 releases.
      if (name == 'Safari' && (!version || parseInt(version) > 45)) {
        version = data;
      }
    }
    // Detect Opera desktop modes.
    if (name == 'Opera' &&  (data = /\bzbov|zvav$/.exec(os))) {
      name += ' ';
      description.unshift('desktop mode');
      if (data == 'zvav') {
        name += 'Mini';
        version = null;
      } else {
        name += 'Mobile';
      }
      os = os.replace(RegExp(' *' + data + '$'), '');
    }
    // Detect Chrome desktop mode.
    else if (name == 'Safari' && /\bChrome\b/.exec(layout && layout[1])) {
      description.unshift('desktop mode');
      name = 'Chrome Mobile';
      version = null;

      if (/\bOS X\b/.test(os)) {
        manufacturer = 'Apple';
        os = 'iOS 4.3+';
      } else {
        os = null;
      }
    }
    // Strip incorrect OS versions.
    if (version && version.indexOf((data = /[\d.]+$/.exec(os))) == 0 &&
        ua.indexOf('/' + data + '-') > -1) {
      os = trim(os.replace(data, ''));
    }
    // Add layout engine.
    if (layout && !/\b(?:Avant|Nook)\b/.test(name) && (
        /Browser|Lunascape|Maxthon/.test(name) ||
        name != 'Safari' && /^iOS/.test(os) && /\bSafari\b/.test(layout[1]) ||
        /^(?:Adobe|Arora|Breach|Midori|Opera|Phantom|Rekonq|Rock|Samsung Internet|Sleipnir|Web)/.test(name) && layout[1])) {
      // Don't add layout details to description if they are falsey.
      (data = layout[layout.length - 1]) && description.push(data);
    }
    // Combine contextual information.
    if (description.length) {
      description = ['(' + description.join('; ') + ')'];
    }
    // Append manufacturer to description.
    if (manufacturer && product && product.indexOf(manufacturer) < 0) {
      description.push('on ' + manufacturer);
    }
    // Append product to description.
    if (product) {
      description.push((/^on /.test(description[description.length - 1]) ? '' : 'on ') + product);
    }
    // Parse the OS into an object.
    if (os) {
      data = / ([\d.+]+)$/.exec(os);
      isSpecialCasedOS = data && os.charAt(os.length - data[0].length - 1) == '/';
      os = {
        'architecture': 32,
        'family': (data && !isSpecialCasedOS) ? os.replace(data[0], '') : os,
        'version': data ? data[1] : null,
        'toString': function() {
          var version = this.version;
          return this.family + ((version && !isSpecialCasedOS) ? ' ' + version : '') + (this.architecture == 64 ? ' 64-bit' : '');
        }
      };
    }
    // Add browser/OS architecture.
    if ((data = /\b(?:AMD|IA|Win|WOW|x86_|x)64\b/i.exec(arch)) && !/\bi686\b/i.test(arch)) {
      if (os) {
        os.architecture = 64;
        os.family = os.family.replace(RegExp(' *' + data), '');
      }
      if (
          name && (/\bWOW64\b/i.test(ua) ||
          (useFeatures && /\w(?:86|32)$/.test(nav.cpuClass || nav.platform) && !/\bWin64; x64\b/i.test(ua)))
      ) {
        description.unshift('32-bit');
      }
    }
    // Chrome 39 and above on OS X is always 64-bit.
    else if (
        os && /^OS X/.test(os.family) &&
        name == 'Chrome' && parseFloat(version) >= 39
    ) {
      os.architecture = 64;
    }

    ua || (ua = null);

    /*------------------------------------------------------------------------*/

    /**
     * The platform object.
     *
     * @name platform
     * @type Object
     */
    var platform = {};

    /**
     * The platform description.
     *
     * @memberOf platform
     * @type string|null
     */
    platform.description = ua;

    /**
     * The name of the browser's layout engine.
     *
     * The list of common layout engines include:
     * "Blink", "EdgeHTML", "Gecko", "Trident" and "WebKit"
     *
     * @memberOf platform
     * @type string|null
     */
    platform.layout = layout && layout[0];

    /**
     * The name of the product's manufacturer.
     *
     * The list of manufacturers include:
     * "Apple", "Archos", "Amazon", "Asus", "Barnes & Noble", "BlackBerry",
     * "Google", "HP", "HTC", "LG", "Microsoft", "Motorola", "Nintendo",
     * "Nokia", "Samsung" and "Sony"
     *
     * @memberOf platform
     * @type string|null
     */
    platform.manufacturer = manufacturer;

    /**
     * The name of the browser/environment.
     *
     * The list of common browser names include:
     * "Chrome", "Electron", "Firefox", "Firefox for iOS", "IE",
     * "Microsoft Edge", "PhantomJS", "Safari", "SeaMonkey", "Silk",
     * "Opera Mini" and "Opera"
     *
     * Mobile versions of some browsers have "Mobile" appended to their name:
     * eg. "Chrome Mobile", "Firefox Mobile", "IE Mobile" and "Opera Mobile"
     *
     * @memberOf platform
     * @type string|null
     */
    platform.name = name;

    /**
     * The alpha/beta release indicator.
     *
     * @memberOf platform
     * @type string|null
     */
    platform.prerelease = prerelease;

    /**
     * The name of the product hosting the browser.
     *
     * The list of common products include:
     *
     * "BlackBerry", "Galaxy S4", "Lumia", "iPad", "iPod", "iPhone", "Kindle",
     * "Kindle Fire", "Nexus", "Nook", "PlayBook", "TouchPad" and "Transformer"
     *
     * @memberOf platform
     * @type string|null
     */
    platform.product = product;

    /**
     * The browser's user agent string.
     *
     * @memberOf platform
     * @type string|null
     */
    platform.ua = ua;

    /**
     * The browser/environment version.
     *
     * @memberOf platform
     * @type string|null
     */
    platform.version = name && version;

    /**
     * The name of the operating system.
     *
     * @memberOf platform
     * @type Object
     */
    platform.os = os || {

      /**
       * The CPU architecture the OS is built for.
       *
       * @memberOf platform.os
       * @type number|null
       */
      'architecture': null,

      /**
       * The family of the OS.
       *
       * Common values include:
       * "Windows", "Windows Server 2008 R2 / 7", "Windows Server 2008 / Vista",
       * "Windows XP", "OS X", "Ubuntu", "Debian", "Fedora", "Red Hat", "SuSE",
       * "Android", "iOS" and "Windows Phone"
       *
       * @memberOf platform.os
       * @type string|null
       */
      'family': null,

      /**
       * The version of the OS.
       *
       * @memberOf platform.os
       * @type string|null
       */
      'version': null,

      /**
       * Returns the OS string.
       *
       * @memberOf platform.os
       * @returns {string} The OS string.
       */
      'toString': function() { return 'null'; }
    };

    platform.parse = parse;
    platform.toString = toStringPlatform;

    if (platform.version) {
      description.unshift(version);
    }
    if (platform.name) {
      description.unshift(name);
    }
    if (os && name && !(os == String(os).split(' ')[0] && (os == name.split(' ')[0] || product))) {
      description.push(product ? '(' + os + ')' : 'on ' + os);
    }
    if (description.length) {
      platform.description = description.join(' ');
    }
    return platform;
  }

  /*--------------------------------------------------------------------------*/

  // Export platform.
  var platform = parse();

  // Some AMD build optimizers, like r.js, check for condition patterns like the following:
  if (typeof define == 'function' && typeof define.amd == 'object' && define.amd) {
    // Expose platform on the global object to prevent errors when platform is
    // loaded by a script tag in the presence of an AMD loader.
    // See http://requirejs.org/docs/errors.html#mismatch for more details.
    root.platform = platform;

    // Define as an anonymous module so platform can be aliased through path mapping.
    define(function() {
      return platform;
    });
  }
  // Check for `exports` after `define` in case a build optimizer adds an `exports` object.
  else if (freeExports && freeModule) {
    // Export for CommonJS support.
    forOwn(platform, function(value, key) {
      freeExports[key] = value;
    });
  }
  else {
    // Export to the global object.
    root.platform = platform;
  }
}.call(this));

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],36:[function(require,module,exports){
var v1 = require('./v1');
var v4 = require('./v4');

var uuid = v4;
uuid.v1 = v1;
uuid.v4 = v4;

module.exports = uuid;

},{"./v1":39,"./v4":40}],37:[function(require,module,exports){
/**
 * Convert array of 16 byte values to UUID string format of the form:
 * XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX
 */
var byteToHex = [];
for (var i = 0; i < 256; ++i) {
  byteToHex[i] = (i + 0x100).toString(16).substr(1);
}

function bytesToUuid(buf, offset) {
  var i = offset || 0;
  var bth = byteToHex;
  // join used to fix memory issue caused by concatenation: https://bugs.chromium.org/p/v8/issues/detail?id=3175#c4
  return ([bth[buf[i++]], bth[buf[i++]], 
	bth[buf[i++]], bth[buf[i++]], '-',
	bth[buf[i++]], bth[buf[i++]], '-',
	bth[buf[i++]], bth[buf[i++]], '-',
	bth[buf[i++]], bth[buf[i++]], '-',
	bth[buf[i++]], bth[buf[i++]],
	bth[buf[i++]], bth[buf[i++]],
	bth[buf[i++]], bth[buf[i++]]]).join('');
}

module.exports = bytesToUuid;

},{}],38:[function(require,module,exports){
// Unique ID creation requires a high quality random # generator.  In the
// browser this is a little complicated due to unknown quality of Math.random()
// and inconsistent support for the `crypto` API.  We do the best we can via
// feature-detection

// getRandomValues needs to be invoked in a context where "this" is a Crypto
// implementation. Also, find the complete implementation of crypto on IE11.
var getRandomValues = (typeof(crypto) != 'undefined' && crypto.getRandomValues && crypto.getRandomValues.bind(crypto)) ||
                      (typeof(msCrypto) != 'undefined' && typeof window.msCrypto.getRandomValues == 'function' && msCrypto.getRandomValues.bind(msCrypto));

if (getRandomValues) {
  // WHATWG crypto RNG - http://wiki.whatwg.org/wiki/Crypto
  var rnds8 = new Uint8Array(16); // eslint-disable-line no-undef

  module.exports = function whatwgRNG() {
    getRandomValues(rnds8);
    return rnds8;
  };
} else {
  // Math.random()-based (RNG)
  //
  // If all else fails, use Math.random().  It's fast, but is of unspecified
  // quality.
  var rnds = new Array(16);

  module.exports = function mathRNG() {
    for (var i = 0, r; i < 16; i++) {
      if ((i & 0x03) === 0) r = Math.random() * 0x100000000;
      rnds[i] = r >>> ((i & 0x03) << 3) & 0xff;
    }

    return rnds;
  };
}

},{}],39:[function(require,module,exports){
var rng = require('./lib/rng');
var bytesToUuid = require('./lib/bytesToUuid');

// **`v1()` - Generate time-based UUID**
//
// Inspired by https://github.com/LiosK/UUID.js
// and http://docs.python.org/library/uuid.html

var _nodeId;
var _clockseq;

// Previous uuid creation time
var _lastMSecs = 0;
var _lastNSecs = 0;

// See https://github.com/broofa/node-uuid for API details
function v1(options, buf, offset) {
  var i = buf && offset || 0;
  var b = buf || [];

  options = options || {};
  var node = options.node || _nodeId;
  var clockseq = options.clockseq !== undefined ? options.clockseq : _clockseq;

  // node and clockseq need to be initialized to random values if they're not
  // specified.  We do this lazily to minimize issues related to insufficient
  // system entropy.  See #189
  if (node == null || clockseq == null) {
    var seedBytes = rng();
    if (node == null) {
      // Per 4.5, create and 48-bit node id, (47 random bits + multicast bit = 1)
      node = _nodeId = [
        seedBytes[0] | 0x01,
        seedBytes[1], seedBytes[2], seedBytes[3], seedBytes[4], seedBytes[5]
      ];
    }
    if (clockseq == null) {
      // Per 4.2.2, randomize (14 bit) clockseq
      clockseq = _clockseq = (seedBytes[6] << 8 | seedBytes[7]) & 0x3fff;
    }
  }

  // UUID timestamps are 100 nano-second units since the Gregorian epoch,
  // (1582-10-15 00:00).  JSNumbers aren't precise enough for this, so
  // time is handled internally as 'msecs' (integer milliseconds) and 'nsecs'
  // (100-nanoseconds offset from msecs) since unix epoch, 1970-01-01 00:00.
  var msecs = options.msecs !== undefined ? options.msecs : new Date().getTime();

  // Per 4.2.1.2, use count of uuid's generated during the current clock
  // cycle to simulate higher resolution clock
  var nsecs = options.nsecs !== undefined ? options.nsecs : _lastNSecs + 1;

  // Time since last uuid creation (in msecs)
  var dt = (msecs - _lastMSecs) + (nsecs - _lastNSecs)/10000;

  // Per 4.2.1.2, Bump clockseq on clock regression
  if (dt < 0 && options.clockseq === undefined) {
    clockseq = clockseq + 1 & 0x3fff;
  }

  // Reset nsecs if clock regresses (new clockseq) or we've moved onto a new
  // time interval
  if ((dt < 0 || msecs > _lastMSecs) && options.nsecs === undefined) {
    nsecs = 0;
  }

  // Per 4.2.1.2 Throw error if too many uuids are requested
  if (nsecs >= 10000) {
    throw new Error('uuid.v1(): Can\'t create more than 10M uuids/sec');
  }

  _lastMSecs = msecs;
  _lastNSecs = nsecs;
  _clockseq = clockseq;

  // Per 4.1.4 - Convert from unix epoch to Gregorian epoch
  msecs += 12219292800000;

  // `time_low`
  var tl = ((msecs & 0xfffffff) * 10000 + nsecs) % 0x100000000;
  b[i++] = tl >>> 24 & 0xff;
  b[i++] = tl >>> 16 & 0xff;
  b[i++] = tl >>> 8 & 0xff;
  b[i++] = tl & 0xff;

  // `time_mid`
  var tmh = (msecs / 0x100000000 * 10000) & 0xfffffff;
  b[i++] = tmh >>> 8 & 0xff;
  b[i++] = tmh & 0xff;

  // `time_high_and_version`
  b[i++] = tmh >>> 24 & 0xf | 0x10; // include version
  b[i++] = tmh >>> 16 & 0xff;

  // `clock_seq_hi_and_reserved` (Per 4.2.2 - include variant)
  b[i++] = clockseq >>> 8 | 0x80;

  // `clock_seq_low`
  b[i++] = clockseq & 0xff;

  // `node`
  for (var n = 0; n < 6; ++n) {
    b[i + n] = node[n];
  }

  return buf ? buf : bytesToUuid(b);
}

module.exports = v1;

},{"./lib/bytesToUuid":37,"./lib/rng":38}],40:[function(require,module,exports){
var rng = require('./lib/rng');
var bytesToUuid = require('./lib/bytesToUuid');

function v4(options, buf, offset) {
  var i = buf && offset || 0;

  if (typeof(options) == 'string') {
    buf = options === 'binary' ? new Array(16) : null;
    options = null;
  }
  options = options || {};

  var rnds = options.random || (options.rng || rng)();

  // Per 4.4, set bits for version and `clock_seq_hi_and_reserved`
  rnds[6] = (rnds[6] & 0x0f) | 0x40;
  rnds[8] = (rnds[8] & 0x3f) | 0x80;

  // Copy bytes to buffer, if provided
  if (buf) {
    for (var ii = 0; ii < 16; ++ii) {
      buf[i + ii] = rnds[ii];
    }
  }

  return buf || bytesToUuid(rnds);
}

module.exports = v4;

},{"./lib/bytesToUuid":37,"./lib/rng":38}]},{},[9])(9)
});
