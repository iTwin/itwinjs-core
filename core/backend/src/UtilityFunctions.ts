/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Id64String } from "@itwin/core-bentley";

export interface EditCommandIds {
  scopeId: Id64String;
  commandId: string;
}

/**
 * DeQueue implementation.
 * @alpha
 */
export class DeQueue<T> {
  private _queue: T[] = [];

  public enqueue(value: T): void {
    this._queue.push(value);
  }

  public enqueueFront(value: T): void {
    this._queue.unshift(value);
  }

  public dequeue(): T | undefined {
    return this._queue.shift();
  }

  public peek(): T | undefined {
    return this._queue[0];
  }

  public isEmpty(): boolean {
    return this._queue.length === 0;
  }

  public clear(): void {
    this._queue = [];
  }

  public printDeQueue(): Promise<void> {
    return new Promise((resolve) => {
      this._queue.forEach((item, index) => {
        console.log(`Queue[${index}]: ${JSON.stringify(item)}`);
      });
      resolve();
    });
  }
}