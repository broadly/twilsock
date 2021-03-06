"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
const operation_retrier_1 = require("operation-retrier");
/**
 * Retrier with backoff override capability
*/
class BackoffRetrier extends events_1.EventEmitter {
    get inProgress() { return !!this.retrier; }
    constructor(options) {
        super();
        this.options = options ? Object.assign({}, options) : {};
    }
    /**
     * Should be called once per attempt series to start retrier.
    */
    start() {
        if (this.inProgress) {
            throw new Error('Already waiting for next attempt, call finishAttempt(success : boolean) to finish it');
        }
        this.createRetrier();
    }
    /**
     * Should be called to stop retrier entirely.
    */
    stop() {
        this.cleanRetrier();
        this.newBackoff = null;
        this.usedBackoff = null;
    }
    /**
     * Modifies backoff for next attempt.
     * Expected behavior:
     * - If there was no backoff passed previously reschedulling next attempt to given backoff
     * - If previous backoff was longer then ignoring this one.
     * - If previous backoff was shorter then reschedulling with this one.
     * With or without backoff retrier will keep growing normally.
     * @param delay delay of next attempts in ms.
     */
    modifyBackoff(delay) {
        this.newBackoff = delay;
    }
    /**
     * Mark last emmited attempt as failed, initiating either next of fail if limits were hit.
    */
    attemptFailed() {
        if (!this.inProgress) {
            throw new Error('No attempt is in progress');
        }
        if (this.newBackoff) {
            const shouldUseNewBackoff = !this.usedBackoff || this.usedBackoff < this.newBackoff;
            if (shouldUseNewBackoff) {
                this.createRetrier();
            }
            else {
                this.retrier.failed(new Error());
            }
        }
        else {
            this.retrier.failed(new Error());
        }
    }
    cancel() {
        if (this.retrier) {
            this.retrier.cancel();
        }
    }
    cleanRetrier() {
        if (this.retrier) {
            this.retrier.removeAllListeners();
            this.retrier.cancel();
            this.retrier = null;
        }
    }
    getRetryPolicy() {
        const clone = Object.assign({}, this.options);
        if (this.newBackoff) {
            clone.min = this.newBackoff;
            clone.max = this.options.max && this.options.max > this.newBackoff
                ? this.options.max
                : this.newBackoff;
        }
        // As we're always skipping first attempt we should add one extra if limit is present
        clone.maxAttemptsCount = this.options.maxAttemptsCount
            ? this.options.maxAttemptsCount + 1
            : undefined;
        return clone;
    }
    createRetrier() {
        this.cleanRetrier();
        const retryPolicy = this.getRetryPolicy();
        this.retrier = new operation_retrier_1.Retrier(retryPolicy);
        this.retrier.once('attempt', () => {
            this.retrier.on('attempt', () => this.emit('attempt'));
            this.retrier.failed(new Error('Skipping first attempt'));
        });
        this.retrier.on('failed', err => this.emit('failed', err));
        this.usedBackoff = this.newBackoff;
        this.newBackoff = null;
        this.retrier.start()
            .catch(err => { });
    }
}
exports.BackoffRetrier = BackoffRetrier;
