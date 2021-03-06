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
        socket.onclose = (e) => {
            logger_1.log.debug('socket closed', e);
            this.emit('disconnected', e);
        };
        socket.onerror = (e) => {
            logger_1.log.debug('error:', e);
            this.emit('socketError', e);
        };
        socket.onmessage = (message) => {
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
            }
            finally {
            }
        }
    }
}
exports.WebSocketChannel = WebSocketChannel;
