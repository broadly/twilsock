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
        this.retryPolicy = options.retryPolicy
            ? options.retryPolicy
            : {
                min: 1 * 1000,
                max: 2 * 60 * 1000,
                randomness: 0.2
            };
        this.clientMetadata = options.clientMetadata
            ? options.clientMetadata
            : {};
        this.clientMetadata.ver = packageVersion;
        this.initRegistrations = options.initRegistrations
            ? options.initRegistrations
            : null;
        this.tweaks = options.tweaks
            ? options.tweaks
            : null;
    }
    get token() { return this._token; }
    get continuationToken() { return this._continuationToken; }
    updateToken(token) {
        this._token = token;
    }
    updateContinuationToken(continuationToken) {
        this._continuationToken = continuationToken;
    }
}
exports.Configuration = Configuration;
