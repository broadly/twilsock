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
class Request {
}
class Response {
}
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
        this.websocket.on('disconnected', (e) => this.fsm.socketClosed());
        this.websocket.on('message', (message) => this.onIncomingMessage(message));
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
            transitions: [
                { name: 'userConnect', from: ['disconnected', 'rejected'], to: 'connecting' },
                { name: 'userConnect', from: ['connecting', 'connected'] },
                { name: 'userDisconnect', from: ['connecting', 'initialising', 'connected', 'updating', 'retrying', 'rejected',
                        'waitSocketClosed', 'waitOffloadSocketClosed'], to: 'disconnecting' },
                { name: 'userRetry', from: ['retrying'], to: 'connecting' },
                { name: 'socketConnected', from: ['connecting'], to: 'initialising' },
                { name: 'socketClosed', from: ['connecting', 'initialising', 'connected', 'updating', 'error',
                        'waitOffloadSocketClosed'], to: 'retrying' },
                { name: 'socketClosed', from: ['disconnecting'], to: 'disconnected' },
                { name: 'socketClosed', from: ['waitSocketClosed'], to: 'disconnected' },
                { name: 'socketClosed', from: ['rejected'], to: 'rejected' },
                { name: 'initSuccess', from: ['initialising'], to: 'connected' },
                { name: 'initError', from: ['initialising'], to: 'error' },
                { name: 'tokenRejected', from: ['initialising', 'updating'], to: 'rejected' },
                { name: 'protocolError', from: ['initialising', 'connected', 'updating'], to: 'error' },
                { name: 'receiveClose', from: ['initialising', 'connected', 'updating'], to: 'waitSocketClosed' },
                { name: 'receiveOffload', from: ['initialising', 'connected', 'updating'], to: 'waitOffloadSocketClosed' },
                { name: 'unsupportedProtocol', from: ['initialising', 'connected', 'updating'], to: 'unsupported' },
                { name: 'receiveFatalClose', from: ['initialising', 'connected', 'updating'], to: 'unsupported' },
                { name: 'userUpdateToken', from: ['disconnected', 'rejected', 'connecting', 'retrying'], to: 'connecting' },
                { name: 'userUpdateToken', from: ['connected'], to: 'updating' },
                { name: 'updateSuccess', from: ['updating'], to: 'connected' },
                { name: 'updateError', from: ['updating'], to: 'error' },
                { name: 'userSend', from: ['connected'], to: 'connected' },
                { name: 'systemOnline', from: ['retrying'], to: 'connecting' }
            ],
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
        }
        else {
            this.retrier.start();
        }
    }
    retry() {
        if (this.fsm.state != 'connecting') {
            logger_1.log.trace('retry');
            this.websocket.close();
            this.fsm.userRetry();
        }
        else {
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
        }
        else if (header.method === 'reply') {
            this.transport.processReply({
                id: header.id,
                status: header.status,
                header: header,
                body: payload
            });
        }
        else if (header.method === 'client_update') {
            if (header.client_update_type === 'token_about_to_expire') {
                this.emit('tokenAboutToExpire');
            }
        }
        else if (header.method === 'close') {
            if (header.status.code === 308) {
                logger_1.log.debug('Connection has been offloaded');
                this.fsm.receiveOffload({ status: header.status.status, body: payload });
            }
            else if (header.status.code === 406) { // Not acceptable message
                const message = `Server closed connection because can't parse protocol: ${JSON.stringify(header.status)}`;
                this.emitReplyConnectionError(message, header, true);
                logger_1.log.error(message);
                this.fsm.receiveFatalClose();
            }
            else if (header.status.code === 417) { // Protocol error
                logger_1.log.error(`Server closed connection because can't parse client reply: ${JSON.stringify(header.status)}`);
                this.fsm.receiveFatalClose(header.status.status);
            }
            else if (header.status.code === 410) { // Expired token
                logger_1.log.warn(`Server closed connection: ${JSON.stringify(header.status)}`);
                this.fsm.receiveClose(header.status.status);
                this.emit('tokenExpired');
            }
            else if (header.status.code === 401) { // Authentication fail
                logger_1.log.error(`Server closed connection: ${JSON.stringify(header.status)}`);
                this.fsm.receiveClose(header.status.status);
            }
            else {
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
        }
        catch (ex) {
            if (ex instanceof twilsockreplyerror_1.TwilsockReplyError) {
                let isTerminalError = false;
                logger_1.log.warn(`Init rejected by server: ${JSON.stringify(ex.reply.status)}`);
                if (ex.reply.status.code === 401 || ex.reply.status.code === 403) {
                    isTerminalError = true;
                    this.fsm.tokenRejected(ex.reply.status);
                    if (ex.reply.status.errorCode === this.tokenExpiredSasCode) {
                        this.emit('tokenExpired');
                    }
                }
                else if (ex.reply.status.code === 429) {
                    this.modifyBackoff(ex.reply.body);
                    this.fsm.initError(true);
                }
                else if (ex.reply.status.code === 500) {
                    this.fsm.initError(false);
                }
                else {
                    this.fsm.initError(true);
                }
                this.emitReplyConnectionError(ex.message, ex.reply, isTerminalError);
            }
            else {
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
        }
        catch (ex) {
            if (ex instanceof twilsockreplyerror_1.TwilsockReplyError) {
                let isTerminalError = false;
                logger_1.log.warn(`Token update rejected by server: ${JSON.stringify(ex.reply.status)}`);
                if (ex.reply.status.code === 401 || ex.reply.status.code === 403) {
                    isTerminalError = true;
                    this.fsm.tokenRejected(ex.reply.status);
                    if (ex.reply.status.errorCode === this.tokenExpiredSasCode) {
                        this.emit('tokenExpired');
                    }
                }
                else if (ex.reply.status.code === 429) {
                    this.modifyBackoff(ex.reply.body);
                    this.fsm.updateError(ex.reply.status);
                }
                else {
                    this.fsm.updateError(ex.reply.status);
                }
                this.emitReplyConnectionError(ex.message, ex.reply, isTerminalError);
            }
            else {
                this.emit('error', false, ex.message, null, null);
                this.fsm.updateError(ex);
            }
            this.emit('tokenUpdated', ex);
        }
    }
    emitReplyConnectionError(message, header, terminal) {
        const description = header.status && header.status.description
            ? header.status.description
            : message;
        const httpStatusCode = header.status.code;
        const errorCode = header.status && header.status.errorCode
            ? header.status.errorCode
            : null;
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
        }
        catch (e) {
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
        return new Promise((resolve) => {
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
                }
                else {
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
