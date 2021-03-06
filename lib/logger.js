"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const log = require("loglevel");
function prepareLine(prefix, args) {
    return [`${new Date().toISOString()} Twilsock ${prefix}:`].concat(Array.from(args));
}
class Logger {
    constructor(prefix) {
        this.prefix = '';
        this.prefix = prefix !== null && prefix !== undefined && prefix.length > 0
            ? ' ' + prefix + ':'
            : '';
    }
    setLevel(level) {
        log.setLevel(level);
    }
    static setLevel(level) {
        log.setLevel(level);
    }
    trace(...args) { log.debug.apply(null, prepareLine('T', args)); }
    debug(...args) { log.debug.apply(null, prepareLine('D', args)); }
    info(...args) { log.info.apply(null, prepareLine('I', args)); }
    warn(...args) { log.warn.apply(null, prepareLine('W', args)); }
    error(...args) { log.error.apply(null, prepareLine('E', args)); }
    static trace(...args) { log.trace.apply(null, prepareLine('T', args)); }
    static debug(...args) { log.debug.apply(null, prepareLine('D', args)); }
    static info(...args) { log.info.apply(null, prepareLine('I', args)); }
    static warn(...args) { log.warn.apply(null, prepareLine('W', args)); }
    static error(...args) { log.error.apply(null, prepareLine('E', args)); }
}
exports.Logger = Logger;
let logInstance = new Logger('');
exports.log = logInstance;
