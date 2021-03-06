import { LogLevelDesc } from 'loglevel';
import { InitRegistration } from './protocol/initregistration';
/**
 * Settings container for the Twilsock client library
 */
declare class Configuration {
    private _token;
    private _continuationToken;
    readonly retryPolicy: any;
    readonly url: string;
    readonly activeGrant: string;
    readonly logLevel: LogLevelDesc;
    readonly clientMetadata: any;
    readonly initRegistrations: InitRegistration[];
    readonly tweaks: any;
    /**
     * @param {String} token - authentication token
     * @param {Object} options - options to override defaults
     */
    constructor(token: string, activeGrant: string, options?: any);
    readonly token: string;
    readonly continuationToken: string;
    updateToken(token: string): void;
    updateContinuationToken(continuationToken: string): void;
}
export { Configuration };
