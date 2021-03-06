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
    return (code >= 200 && code < 300);
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
class PacketRequest {
}
class PacketResponse {
}
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
    get isConnected() { return this.channel.isConnected; }
    processReply(reply) {
        const request = this.activeRequests.get(reply.id);
        if (request) {
            clearTimeout(request.timeout);
            this.activeRequests.delete(reply.id);
            if (!isHttpSuccess(reply.status.code)) {
                request.reject(new twilsockreplyerror_1.TwilsockReplyError('Transport failure: ' + reply.status.status, reply));
                logger_1.log.trace('message rejected');
            }
            else {
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
        this.activeRequests.forEach((descriptor) => {
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
        }
        catch (e) {
            logger_1.log.debug('failed to send ', header, e);
            logger_1.log.trace(e.stack);
            throw e;
        }
    }
}
exports.PacketInterface = PacketInterface;
