"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const abstractmessage_1 = require("./abstractmessage");
class Init extends abstractmessage_1.AbstractMessage {
    constructor(token, continuationToken, metadata, registrations = null, tweaks = null) {
        super();
        this.method = 'init';
        this.token = token;
        this.continuation_token = continuationToken;
        this.metadata = metadata;
        this.registrations = registrations;
        this.tweaks = tweaks;
        this.capabilities = ['client_update', 'offline_storage'];
    }
}
exports.Init = Init;
