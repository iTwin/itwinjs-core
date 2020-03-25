/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module EventSource
 */
import { Logger } from "@bentley/bentleyjs-core";
import { IModelTokenProps, NativeAppRpcInterface, QueuedEvent, RpcRegistry } from "@bentley/imodeljs-common";
import { FrontendLoggerCategory } from "./FrontendLoggerCategory";
import { IModelApp } from "./IModelApp";

const loggingCategory = FrontendLoggerCategory.EventSource;
/** Describe the event listener
 * @internal
 */
export type EventListener = (data: any) => void;
/** Event source class that allow listen to server side events
 * @internal
 */
export class EventSource {
  private _timeoutHandle: any;
  private _namespaces = new Map<string, Map<string, EventListener[]>>();
  constructor(public readonly tokenProps: IModelTokenProps) {
  }
  private scheduleNextPoll() {
    const onPoll = async () => {
      try {
        const queuedEvents = await NativeAppRpcInterface.getClient().fetchEvents(this.tokenProps, IModelApp.eventSourceOptions.prefetchLimit);
        // dispatch events
        queuedEvents.forEach((event: QueuedEvent) => {
          this.dispatchEvent(event);
        });
      } finally {
        if (this._timeoutHandle) {
          this._timeoutHandle = setTimeout(onPoll, IModelApp.eventSourceOptions.pollInterval);
        }
      }
    };
    this._timeoutHandle = setTimeout(onPoll, IModelApp.eventSourceOptions.pollInterval);
  }
  public get fetching() { return !this._timeoutHandle; }
  private onListenerChanged() {
    // if there is nothing to listen for, stop polling;
    if (this._namespaces.size === 0) {
      if (this._timeoutHandle) {
        clearTimeout(this._timeoutHandle);
        this._timeoutHandle = undefined;
      }
    } else if (!this._timeoutHandle) {
      if (RpcRegistry.instance.isRpcInterfaceInitialized(NativeAppRpcInterface)) {
        this.scheduleNextPoll();
      } else {
        Logger.logError(loggingCategory, "EventSource is disabled. Interface 'NativeAppRpcInterface' is not registered");
      }
    }
  }
  private dispatchEvent(event: QueuedEvent) {
    const listeners = this.getListeners(event.namespace, event.eventName, false);
    if (listeners) {
      listeners.forEach((listener: EventListener) => {
        listener.apply(undefined, [event.data]);
      });
    }
  }
  private getListeners(namespace: string, eventName: string, create: boolean): EventListener[] | undefined {
    const namespaces = this._namespaces;
    let nsCol = namespaces.get(namespace);
    if (!nsCol) {
      if (create) {
        nsCol = new Map<string, EventListener[]>();
        namespaces.set(namespace, nsCol);
      } else {
        return undefined;
      }
    }
    let evtCol = nsCol.get(eventName);
    if (!evtCol) {
      if (create) {
        evtCol = [];
        nsCol.set(eventName, evtCol);
      } else {
        return undefined;
      }
    }
    this.onListenerChanged();
    return evtCol;
  }
  /** Hook a listener to a event in a given namespace
   * @param namespace event namespace which allow you to group event
   * @param eventName name of the event. It should be unique per namespace
   * @param listener callback for the event.
   * @returns callback that allow  you to remove event by calling off()
   * @internal
   */
  public on(namespace: string, eventName: string, listener: EventListener) {
    const listeners = this.getListeners(namespace, eventName, true)!;
    listeners.push(listener);
    return { off: () => { this.off(namespace, eventName, listener); } };
  }
  /** Remove a listener for a event from a given namespace
   * @param namespace event namespace which allow you to group event
   * @param eventName name of the event. It should be unique per namespace
   * @param listener callback for the event.
   * @internal
   */
  public off(namespace: string, eventName: string, listener: EventListener) {
    const namespaces = this._namespaces;
    const listeners = this.getListeners(namespace, eventName, false);
    if (listeners) {
      listeners.some((value: EventListener, index: number) => {
        if (value === listener) {
          listeners.splice(index, 1);
          return true;
        }
        return false;
      });
      if (listeners.length === 0) {
        const nsCol = namespaces.get(namespace)!;
        nsCol.delete(eventName);
        if (nsCol.size === 0) {
          namespaces.delete(namespace);
        }
      }
    }
    this.onListenerChanged();
  }
  /** remove all events and event listeners
   * @internal
   */
  public clear() {
    this._namespaces.clear();
    this.onListenerChanged();
  }
}

/** Registry for event sources
 * @internal
 */
export abstract class EventSourceManager {
  private static _sources: Map<string, EventSource> = new Map<string, EventSource>();
  private static _global?: EventSource;
  public static readonly GLOBAL = "__globalEvents__";
  private constructor() {
  }
  public static get global() {
    if (!EventSourceManager._global) {
      EventSourceManager._global = this.create(EventSourceManager.GLOBAL, {
        key: EventSourceManager.GLOBAL,
      });
    }
    return EventSourceManager._global;
  }
  public static get(id: string, tokenProps?: IModelTokenProps): EventSource {
    if (EventSourceManager._sources.has(id)) {
      return EventSourceManager._sources.get(id)!;
    }
    if (id === EventSourceManager.GLOBAL) {
      return this.global;
    }
    if (tokenProps) {
      if (!EventSourceManager._sources.has(id)) {
        return this.create(id, tokenProps);
      } else {
        if (tokenProps.key !== EventSourceManager.get(id).tokenProps.key) {
          throw new Error(`EventSource with id='${id}' has different iModelToken`);
        }
        // WIP: not sure why the above checks exists since it will fall through and throw anyway...
      }
    }
    throw new Error(`EventSource with id='${id}' not found`);
  }
  public static delete(id: string): void {
    if (EventSourceManager.has(id)) {
      EventSourceManager._sources.delete(id);
    }
  }
  public static has(id: string): boolean {
    return EventSourceManager._sources.has(id);
  }
  public static create(id: string, tokenProps: IModelTokenProps): EventSource {
    if (EventSourceManager._sources.has(id)) {
      throw new Error(`EventSource with key='${id}' already exist`);
    }
    const eventSource = new EventSource(tokenProps);
    EventSourceManager._sources.set(id, eventSource);
    return eventSource;
  }
}
