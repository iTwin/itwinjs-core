/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/**
 * Helper class for queuing async tasks and running them concurrently.
 */
export class ConcurrencyQueue<T> {
  private _pending = new Array<Promise<T>>(); // Array of pending Promises for already started tasks
  private _queue = new Array<() => void>(); // Array of callbacks representing tasks that have not yet started

  /** The maximum number of tasks that may be started/pending at any given time. */
  public readonly maxParallel: number;

  /**
   * Constructs a new ConcurrencyQueue
   * @param maxParallel The maximum number of tasks that may be started/pending at any given time.
   */
  constructor(maxParallel: number) {
    this.maxParallel = maxParallel;
  }

  // Starts the next task waiting in the queue, and moves it into the _pending array.
  private startNextInQueue() {
    const startFn = this._queue.shift();
    if (startFn)
      startFn(); // This will append a Promise to the _pending array
  }

  // Wraps a Promise to advance the queue as soon as it's resolved, and appends to the `_pending` array.
  private async pushPending(pending: Promise<T>): Promise<T> {
    const wrapped = pending.then((resolvedValue) => {
      // Remove this promise from the _pending array, and replace it with the next task in the queue.
      this._pending = this._pending.filter((p) => p !== wrapped);
      this.startNextInQueue();

      // Need to pass through the task's original return value.
      return resolvedValue;
    });

    this._pending.push(wrapped);
    return wrapped;
  }

  /** The number of currently started tasks that are still pending completion. */
  public get pendingCount() { return this._pending.length; }

  /** The number of queued tasks that have not yet started. */
  public get queuedCount() { return this._queue.length; }

  /** True if there are no tasks currently pending or queued. */
  public get isEmpty() { return (this.pendingCount === 0 && this.queuedCount === 0); }

  /**
   * Adds a task to the queue. Tasks are automatically started on a FIFO basis whenever there are less than `maxParallel` currently started/pending.
   * @param callback A callback used to start the task.
   * @returns The return value of `callback`, resolved once the task completes.
   */
  public async push(callback: () => Promise<T>): Promise<T> {
    if (this._pending.length < this.maxParallel)
      return this.pushPending(callback());

    // There are already enough tasks running, so this will have to go into the queue and wait for a future "pending" promise to start it.
    return new Promise((resolve) => {
      this._queue.push(() => {
        resolve(this.pushPending(callback()));
      });
    });
  }

  /** Returns a Promise that is resolved when any of the currently pending Promises are resolved. */
  public async next(): Promise<T | undefined> {
    return (this.isEmpty) ? undefined : Promise.race(this._pending);
  }

  /** Returns a Promise that is resolved when all pending and queued tasks have been completed. */
  public async drain(): Promise<void> {
    while (!this.isEmpty) {
      await Promise.all(this._pending);
    }
  }
}
