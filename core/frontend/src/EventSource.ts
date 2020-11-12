/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module IModelConnection
 */
import { assert, dispose, IDisposable } from "@bentley/bentleyjs-core";
import { QueuedEvent, RpcPushChannel } from "@bentley/imodeljs-common";

let globalSource: EventSource | undefined;

/** A function that can respond to events originating from an [[EventSource]].
 * The type of `eventData` depends on the specific event.
 * @see [[EventSource.on]] to register a listener for a specific event.
 * @beta
 */
export type EventListener = (eventData: any) => void;

/** A function returned from [[EventSource.on]] that can be invoked to remove the [[EventListener]].
 * @beta
 */
export type RemoveEventListener = () => void;

/** Provides access to push events emitted by the backend.
 * @note Push events will only be received if `RpcPushChannel.enabled` is `true`.
 * @see [[IModelConnection.eventSource]] for an event source associated with a specific iModel.
 * @see [[EventSource.global]] for an event source not associated with a specific iModel.
 * @beta
 */
export class EventSource implements IDisposable {
  /** Identifies this event source. */
  public readonly id: string;
  private readonly _namespaces = new Map<string, Map<string, EventListener[]>>();
  private _channel?: RpcPushChannel<any>;

  protected constructor(id: string) {
    this.id = id;
    if (!RpcPushChannel.enabled || "" === id)
      return;

    this._channel = RpcPushChannel.obtain(id);
    const subscription = this._channel.subscribe();
    subscription.onMessage.addListener((events: QueuedEvent[]) => {
      for (const event of events)
        this.dispatchEvent(event);
    });
  }

  /** Create a new [[EventSource]] with the specified Id.
   * @note The caller is responsible for invoking [[EventSource.dispose]] when finished with the event sink.
   * @note Multiple event sources may exist with the same id, listening for events emitted over the same channel.
   */
  public static create(id: string): EventSource {
    return new EventSource(id);
  }

  /** Obtain the source for "global" events not associated with a more specific context, such as changes in network connectivity.
   * @note [[EventListener]]s registered with this event source are removed when [[IModelApp.shutdown]] is called.
   */
  public static get global(): EventSource {
    return globalSource ?? (globalSource = EventSource.create("__globalEvents__"));
  }

  /** Invoked on [[IModelApp.shutdown]] to clear out event listeners.
   * @internal
   */
  public static clearGlobal(): void {
    globalSource = dispose(globalSource);
  }

  /** Disposes of this EventSource, detaching it from the backend and removing all [[EventListener]]s.
   * @note It is the responsibility of the caller of [[EventSource.create]] to dispose of it when it is no longer needed.
   */
  public dispose(): void {
    this._channel = dispose(this._channel);
    this._namespaces.clear();
  }

  /** Returns true if this event source has been disconnected from the backend. */
  public get isDisposed(): boolean {
    return undefined === this._channel;
  }

  /** Add an [[EventListener]] for the specified event.
   * @returns A function that can be used to remove the event listener.
   */
  public on(namespace: string, eventName: string, listener: EventListener): RemoveEventListener {
    if (this.isDisposed)
      return () => undefined;

    const listeners = this.getListeners(namespace, eventName, true);
    assert(undefined !== listeners);
    listeners.push(listener);
    return () => { this.off(namespace, eventName, listener); };
  }

  private off(namespace: string, eventName: string, listener: EventListener): void {
    const listeners = this.getListeners(namespace, eventName, false);
    if (!listeners)
      return;

    const index = listeners.indexOf(listener);
    if (index < 0)
      return;

    if (listeners.length > 1) {
      listeners.splice(index, 1);
      return;
    }

    const ns = this._namespaces.get(namespace);
    assert(undefined !== ns);
    ns.delete(eventName);
    if (0 === ns.size)
      this._namespaces.delete(namespace);
  }

  private dispatchEvent(event: QueuedEvent): void {
    const listeners = this.getListeners(event.namespace, event.eventName, false);
    if (listeners)
      for (const listener of listeners)
        listener.apply(undefined, [event.data]);
  }

  private getListeners(namespace: string, eventName: string, create: boolean): EventListener[] | undefined {
    let ns = this._namespaces.get(namespace);
    if (!ns) {
      if (!create)
        return undefined;

      this._namespaces.set(namespace, ns = new Map<string, EventListener[]>());
    }

    let listeners = ns.get(eventName);
    if (!listeners && create)
      ns.set(eventName, listeners = []);

    return listeners;
  }
}
