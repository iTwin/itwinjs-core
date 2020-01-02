/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module RpcInterface */
import { RpcInterface, RpcManager, EventSourceRpcInterface, IModelTokenProps, QueuedEvent, RpcRegistry } from "@bentley/imodeljs-common";
import { Logger } from "@bentley/bentleyjs-core";
import { BackendLoggerCategory } from "../BackendLoggerCategory";
import { IModelHost } from "../IModelHost";

const loggingCategory: string = BackendLoggerCategory.EventSink;

/** EventSink queue event that would be sent over to frontend
 * @internal
 */
export class EventSink {
  private _eventId: number = 0;
  private _eventQueues: QueuedEvent[] = [];
  private readonly _namespaces: Set<string> = new Set<string>();
  private readonly _maxEventId = Number.MAX_SAFE_INTEGER - 10;
  constructor(public readonly id: string) { }
  private add(namespace: string): void {
    const namespaces = this._namespaces;
    if (!namespaces.has(namespace)) {
      const maxNamespaces = IModelHost.configuration!.eventSinkOptions.maxNamespace;
      if (this._namespaces.size >= maxNamespaces) {
        const errorMessage = "EventQueue have reached maximum number of namespaces allowed";
        Logger.logInfo(loggingCategory, errorMessage);
        throw new Error(errorMessage);
      }
      namespaces.add(namespace);
    }
  }
  public purge(namespace: string): void {
    const namespaces = this._namespaces;
    if (!namespaces.has(namespace)) {
      throw new Error(`purge() Namespace' ${namespace}' is not registered`);
    }
    namespaces.delete(namespace);
    const purgedEventList: QueuedEvent[] = [];
    this._eventQueues.forEach((queuedEvent: QueuedEvent) => {
      if (namespaces.has(queuedEvent.namespace)) {
        purgedEventList.push(queuedEvent);
      }
    });
    this._eventQueues = purgedEventList;
  }
  public emit(namespace: string, eventName: string, data: any): void {
    if (!RpcRegistry.instance.isRpcInterfaceInitialized(EventSourceRpcInterface)) {
      Logger.logError(loggingCategory, "EventSource is disabled. Interface 'EventSourceRpcInterface' is not registered");
      return;
    }
    const maxQueueSize = IModelHost.configuration!.eventSinkOptions.maxQueueSize;
    if (this._eventQueues.length > maxQueueSize) {
      Logger.logInfo(loggingCategory, "EventQueue have reached its maximum allowed size. Oldest event will be removed from the queue");
      while (this._eventQueues.length >= maxQueueSize)
        this._eventQueues.pop();
    }
    const namespaces = this._namespaces;
    if (!namespaces.has(namespace)) {
      this.add(namespace);
    }
    if (this._maxEventId < this._eventId) {
      this._eventId = 0;
    }
    ++this._eventId;
    this._eventQueues.unshift({ eventId: this._eventId, namespace, eventName, data });
  }
  // we assume only on frontend ever talk and the queue is exclusive to a client.
  public fetch(limit: number): QueuedEvent[] {
    const resovledLimit = limit <= 0 || limit > this._eventQueues.length ? this._eventQueues.length : limit;
    const result = this._eventQueues.splice(0, resovledLimit);
    return result;
  }
}
/** Keep list of all event sinks
 * @internal
 */
export class EventSinkManager {
  private static _sinks: Map<string, EventSink> = new Map<string, EventSink>();
  private static _global?: EventSink;
  public static readonly GLOBAL = "__globalEvents__";
  private constructor() { }
  public static get global() {
    if (!this._global) {
      this._global = new EventSink(this.GLOBAL);
      this._sinks.set(this.GLOBAL, this._global);
    }
    return this._global;
  }
  public static has(id: string): boolean {
    return this._sinks.has(id);
  }
  public static delete(id: string): void {
    if (this.has(id)) {
      this._sinks.delete(id);
    }
  }
  public static get(id: string): EventSink {
    if (this._sinks.has(id)) {
      return this._sinks.get(id)!;
    }
    if (id === this.GLOBAL) {
      return this.global;
    }
    const eventSink = new EventSink(id);
    this._sinks.set(id, eventSink);
    return eventSink;
  }
  public static clear() {
    this._sinks.clear();
  }
}
/** The backend implementation of WipRpcInterface.
 * @internal
 */
export class EventSourceRpcImpl extends RpcInterface implements EventSourceRpcInterface {
  public static register() {
    RpcManager.registerImpl(EventSourceRpcInterface, EventSourceRpcImpl);
  }
  public async fetch(tokenProps: IModelTokenProps, limit: number): Promise<QueuedEvent[]> {
    let key: string = EventSinkManager.GLOBAL;
    if (tokenProps.key && tokenProps.key !== EventSinkManager.GLOBAL) {
      key = tokenProps.key;
    }
    return EventSinkManager.get(key).fetch(limit);
  }
}
