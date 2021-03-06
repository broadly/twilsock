import { Configuration } from './configuration';
import * as Messages from './protocol/messages';
declare class PacketResponse {
    readonly id: string;
    readonly header: any;
    readonly body?: any;
}
import { Protocol } from './protocol/protocol';
import { Channel } from './interfaces/channel';
declare class PacketInterface {
    private readonly config;
    private readonly activeRequests;
    private readonly channel;
    constructor(channel: Channel, config: Configuration);
    readonly isConnected: boolean;
    processReply(reply: any): void;
    private storeRequest;
    shutdown(): void;
    sendInit(): Promise<Messages.InitReply>;
    sendClose(): void;
    sendWithReply(header: Protocol.Header, payload?: any): Promise<PacketResponse>;
    send(header: Protocol.Header, payload?: any): string;
}
export { Protocol, Channel, PacketResponse, PacketInterface };
