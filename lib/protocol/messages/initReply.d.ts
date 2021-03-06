import { AbstractMessage } from './abstractmessage';
declare class ContinuationTokenStatus {
    readonly reissued: boolean;
    readonly reissue_reason: string;
    readonly reissue_message: string;
}
declare class InitReply extends AbstractMessage {
    readonly continuationToken: string;
    readonly continuationTokenStatus: ContinuationTokenStatus;
    readonly offlineStorage: any;
    readonly initRegistrations: any;
    readonly debugInfo: any;
    constructor(id: string, continuationToken: string, continuationTokenStatus: ContinuationTokenStatus, offlineStorage: any, initRegistrations: any, debugInfo: any);
}
export { ContinuationTokenStatus, InitReply };
