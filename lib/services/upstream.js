"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const logger_1 = require("../logger");
const twilsockerror_1 = require("../error/twilsockerror");
const twilsockupstreamerror_1 = require("../error/twilsockupstreamerror");
const Messages = require("../protocol/messages");
const index_1 = require("../index");
const REQUEST_TIMEOUT = 20000;
function isHttpSuccess(code) {
    return (code >= 200 && code < 300);
}
function isHttpReply(packet) {
    return packet && packet.header && packet.header.http_status;
}
class Request {
}
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
            uriStruct.params = paramsString.split('&')
                .map(el => el.split('='))
                .reduce((prev, curr) => {
                if (!prev.hasOwnProperty(curr[0])) {
                    prev[curr[0]] = curr[1];
                }
                else if (Array.isArray(prev[curr[0]])) {
                    prev[curr[0]].push(curr[1]);
                }
                else {
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
                    this.actualSend(message)
                        .then(response => request.resolve(response))
                        .catch(e => request.reject(e));
                    clearTimeout(request.timeout);
                }
                catch (e) {
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
