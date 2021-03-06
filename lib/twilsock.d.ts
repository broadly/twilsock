/// <reference types="node" />
import { EventEmitter } from 'events';
import { Configuration } from './configuration';
import { PacketInterface } from './packetinterface';
import { WebSocketChannel } from './websocketchannel';
/**
 * Enum for connection state values.
 * @readonly
 * @enum {number}
 */
declare namespace TwilsockChannel {
    type State = 'unknown' | 'disconnecting' | 'disconnected' | 'connecting' | 'connected' | 'error' | 'rejected';
}
declare class Response {
}
/**
 * Twilsock channel level protocol implementation
 */
declare class TwilsockChannel extends EventEmitter {
    private readonly config;
    private transportReady;
    private readonly fsm;
    private disconnectingTimer;
    private disconnectedPromiseResolve;
    private retrier;
    private websocket;
    private transport;
    private readonly terminalStates;
    private lastEmittedState;
    private readonly tokenExpiredSasCode;
    constructor(websocket: WebSocketChannel, transport: PacketInterface, config: Configuration);
    private changeState;
    private resetBackoff;
    private modifyBackoff;
    private startDisconnectTimer;
    private cancelDisconnectTimer;
    readonly isConnected: boolean;
    readonly state: TwilsockChannel.State;
    private initRetry;
    private retry;
    private onConnected;
    private finalizeSocket;
    private setupSocket;
    private onIncomingMessage;
    private sendInit;
    private sendUpdate;
    private emitReplyConnectionError;
    private cancelInit;
    private cancelUpdate;
    /**
     * Should be called for each message to confirm it received
     */
    private confirmReceiving;
    /**
     * Shutdown connection
     */
    private closeSocket;
    /**
     * Initiate the twilsock connection
     * If already connected, it does nothing
     */
    connect(): void;
    /**
     * Close twilsock connection
     * If already disconnected, it does nothing
     */
    disconnect(): Promise<void>;
    /**
     * Update fpa token for twilsock connection
     */
    updateToken(token: string): Promise<void>;
    readonly isTerminalState: boolean;
    private onCloseReceived;
}
export { Response, TwilsockChannel, TwilsockChannel as TwilsockImpl };
