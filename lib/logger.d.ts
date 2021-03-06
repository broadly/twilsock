declare class Logger {
    private prefix;
    constructor(prefix: string);
    setLevel(level: any): void;
    static setLevel(level: any): void;
    trace(...args: any[]): void;
    debug(...args: any[]): void;
    info(...args: any[]): void;
    warn(...args: any[]): void;
    error(...args: any[]): void;
    static trace(...args: any[]): void;
    static debug(...args: any[]): void;
    static info(...args: any[]): void;
    static warn(...args: any[]): void;
    static error(...args: any[]): void;
}
declare let logInstance: Logger;
export { Logger, logInstance as log };
