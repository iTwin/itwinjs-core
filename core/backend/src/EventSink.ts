/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module RpcInterface
 */

import { dispose, IDisposable } from "@bentley/bentleyjs-core";
import { QueuedEvent, RpcPushChannel, RpcPushConnection } from "@bentley/imodeljs-common";
import { EmitOptions, EmitStrategy } from "@bentley/imodeljs-native";

const maxEventId = Number.MAX_SAFE_INTEGER - 10;
let globalSink: EventSink | undefined;

/** Maintains a queue of events to be sent to the frontend.
 * @note Events are only forwarded to the frontend if [RpcPushChannel.enabled]($common) is `true`.
 * @see [[IModelDb.eventSink]] for an event sink associated with a specific iModel.
 * @internal
 */
export class EventSink implements IDisposable {
  private _nextEventId: number = 0;
  private _queue: QueuedEvent[] = [];
  private _channel?: RpcPushChannel<any>;
  private _scheduledPush: any = undefined;

  /** Constructor.
   * @param id The name of the sink. Must be unique among all extant EventSinks.
   * @note The caller is responsible for invoking [[dispose]] when finished with the sink.
   */
  constructor(public readonly id: string) {
    if ("" !== id)
      this._channel = RpcPushChannel.create(id);
  }

  /** Dispose of this sink, disconnecting it from its [RpcPushChannel]($common).
   * Subsequent attempts to emit events from this sink will have no effect.
   * This frees up the sink's `id` for reuse by another sink.
   */
  public dispose(): void {
    this._channel = dispose(this._channel);
    this._queue.length = 0;
    this._nextEventId = 0;
    if (typeof this._scheduledPush !== "undefined")
      clearTimeout(this._scheduledPush);
  }

  /** Obtain the sink used to emit "global" events not associated with any specific context.
   * @note This sink is disposed of by [[IModelHost.shutdown]].
   */
  public static get global(): EventSink {
    return globalSink ?? (globalSink = new EventSink("__globalEvents__"));
  }

  /** Invoked on [[IModelHost.shutdown]]. */
  public static clearGlobal(): void {
    globalSink = dispose(globalSink);
  }

  /** Enqueue an event to be forwarded to the frontend. This will schedule a push to the frontend if one is not already scheduled. */
  public emit(namespace: string, eventName: string, data: any, options: EmitOptions = { strategy: EmitStrategy.None }): void {
    if (this.isDisposed)
      return;

    if (options.strategy === EmitStrategy.PurgeOlderEvents) {
      this._queue = this._queue.filter((value: QueuedEvent) => {
        return !(value.eventName === eventName && value.namespace === namespace);
      });
    }

    this._nextEventId = maxEventId < this._nextEventId ? 1 : this._nextEventId + 1;
    this._queue.push({ eventId: this._nextEventId, namespace, eventName, data });
    this.schedulePush();
  }

  /** Returns true if this sink has been disconnected from its [RpcPushChannel]($common). */
  public get isDisposed(): boolean {
    return undefined === this._channel;
  }

  private schedulePush() {
    if (typeof (this._scheduledPush) !== "undefined" || this.isDisposed)
      return;

    this._scheduledPush = setTimeout(async () => {
      this._scheduledPush = undefined;
      const events = [...this._queue];
      this._queue.length = 0;
      if (this._channel && this._channel.enabled)
        await RpcPushConnection.for(this._channel).send(events);
    });
  }
}
