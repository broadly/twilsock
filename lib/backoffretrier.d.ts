/// <reference types="node" />
import { EventEmitter } from 'events';
/**
 * Retrier with backoff override capability
*/
declare class BackoffRetrier extends EventEmitter {
    private readonly options;
    private newBackoff;
    private usedBackoff;
    private retrier;
    readonly inProgress: boolean;
    constructor(options: {
        min: number;
        max: number;
        initial?: number;
        maxAttemptsCount?: number;
        maxAttemptsTime?: number;
        randomness?: number;
    });
    /**
     * Should be called once per attempt series to start retrier.
    */
    start(): void;
    /**
     * Should be called to stop retrier entirely.
    */
    stop(): void;
    /**
     * Modifies backoff for next attempt.
     * Expected behavior:
     * - If there was no backoff passed previously reschedulling next attempt to given backoff
     * - If previous backoff was longer then ignoring this one.
     * - If previous backoff was shorter then reschedulling with this one.
     * With or without backoff retrier will keep growing normally.
     * @param delay delay of next attempts in ms.
     */
    modifyBackoff(delay: number): void;
    /**
     * Mark last emmited attempt as failed, initiating either next of fail if limits were hit.
    */
    attemptFailed(): void;
    cancel(): void;
    private cleanRetrier;
    private getRetryPolicy;
    private createRetrier;
}
export { BackoffRetrier };
