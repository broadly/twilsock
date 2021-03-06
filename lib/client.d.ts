/// <reference types="node" />
import { EventEmitter } from 'events';
import { Protocol } from './protocol/protocol';
import { Result } from './services/upstream';
import { OfflineProductStorage } from './offlinestorage';
declare type Context = Protocol.Context;
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
declare class TwilsockClient extends EventEmitter {
    private readonly config;
    private readonly channel;
    private readonly registrations;
    private readonly upstream;
    private offlineStorageDeferred;
    /**
     * @param {string} token Twilio access token
     * @param {string} productId Product identifier. Should be the same as a grant name in token
     */
    constructor(token: string, productId: string, options?: any);
    emit(event: string | symbol, ...args: any[]): boolean;
    private handleStorageId;
    /**
     * Get offline storage ID
     * @returns {Promise<OfflineProductStorage>}
     */
    storageId(): Promise<OfflineProductStorage>;
    /**
     * Indicates if twilsock is connected now
     * @returns {Boolean}
     */
    readonly isConnected: boolean;
    /**
     * Current state
     * @returns {String}
     */
    readonly state: string;
    /**
     * Update token
     * @param {String} token
     * @returns {Promise<void>}
     */
    updateToken(token: string): Promise<void>;
    /**
     * Updates notification context.
     * This method shouldn't be used anyone except twilio notifications library
     * @param contextId id of notification context
     * @param context value of notification context
     * @private
     */
    setNotificationsContext(contextId: string, context: Context): void;
    /**
     * Remove notification context.
     * This method shouldn't be used anyone except twilio notifications library
     * @param contextId id of notification context
     * @private
     */
    removeNotificationsContext(contextId: string): void;
    /**
     * Connect to the server
     * @fires Twilsock#connected
     * @public
     * @returns {Promise<void>}
     */
    connect(): void;
    /**
     * Disconnect from the server
     * @fires Twilsock#disconnected
     * @public
     * @returns {Promise<void>}
     */
    disconnect(): Promise<void>;
    /**
     * Get HTTP request to upstream service
     * @param {string} url Upstream service url
     * @param {headers} headers Set of custom headers
     * @returns {Promise}
     */
    get(url: string, headers: any): Promise<Result>;
    /**
     * Post HTTP request to upstream service
     * @param {string} url Upstream service url
     * @param {headers} headers Set of custom headers
     * @param {body} body Body to send
     * @returns {Promise}
     */
    post(url: string, headers: any, body: any): Promise<Result>;
    /**
     * Put HTTP request to upstream service
     * @param {string} url Upstream service url
     * @param {headers} headers Set of custom headers
     * @param {body} body Body to send
     * @returns {Promise}
     */
    put(url: string, headers: any, body: any): Promise<Result>;
    /**
     * Delete HTTP request to upstream service
     * @param {string} url Upstream service url
     * @param {headers} headers Set of custom headers
     * @returns {Promise}
     */
    delete(url: string, headers: any): Promise<Result>;
}
export { Context, Result, TwilsockClient, TwilsockClient as Twilsock };
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
