/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Events
 */

import { UnexpectedErrors } from "./UnexpectedErrors";

/** A function invoked when a BeEvent is raised.
 * @public
 */
export type Listener = (...arg: any[]) => void;

interface EventContext {
  listener: Listener | undefined;
  scope: any;
  once: boolean;
}

/**
 * Manages a set of *listeners* for a particular event and notifies them when the event is raised.
 * This class is usually instantiated inside of a container class and
 * exposed as a property for others to *subscribe* via [[BeEvent.addListener]].
 * @public
 */
export class BeEvent<T extends Listener> {
  private _listeners: EventContext[] = [];
  private _emitDepth: number = 0;

  /** The number of listeners currently subscribed to the event. */
  public get numberOfListeners() { return this._listeners.length; }

  /**
   * Registers a Listener to be executed whenever this event is raised.
   * @param listener The function to be executed when the event is raised.
   * @param scope An optional object scope to serve as the 'this' pointer when listener is invoked.
   * @returns A function that will remove this event listener.
   * @see [[BeEvent.raiseEvent]], [[BeEvent.removeListener]]
   */
  public addListener(listener: T, scope?: any): () => void {
    this._listeners.push({ listener, scope, once: false });
    return () => this.removeListener(listener, scope);
  }

  /**
   * Registers a callback function to be executed *only once* when the event is raised.
   * @param listener The function to be executed once when the event is raised.
   * @param scope An optional object scope to serve as the `this` pointer in which the listener function will execute.
   * @returns A function that will remove this event listener.
   * @see [[BeEvent.raiseEvent]], [[BeEvent.removeListener]]
   */
  public addOnce(listener: T, scope?: any): () => void {
    this._listeners.push({ listener, scope, once: true });
    return () => this.removeListener(listener, scope);
  }

  /**
   * Un-register a previously registered listener.
   * @param listener The listener to be unregistered.
   * @param  scope The scope that was originally passed to addListener.
   * @returns 'true' if the listener was removed; 'false' if the listener and scope are not registered with the event.
   * @see [[BeEvent.raiseEvent]], [[BeEvent.addListener]]
   */
  public removeListener(listener: T, scope?: any): boolean {
    const listeners = this._listeners;

    for (let i = 0; i < listeners.length; ++i) {
      const context = listeners[i];
      if (context.listener === listener && context.scope === scope) {
        if (this._emitDepth > 0) {
          context.listener = undefined;
        } else {
          listeners.splice(i, 1);
        }
        return true;
      }
    }
    return false;
  }

  /**
   * Raises the event by calling each registered listener with the supplied arguments.
   * @param args This method takes any number of parameters and passes them through to the listeners.
   * @see [[BeEvent.removeListener]], [[BeEvent.addListener]]
   */
  public raiseEvent(...args: Parameters<T>) {
    this._emitDepth++;

    const listeners = this._listeners;
    const length = listeners.length;
    let dropped = false;

    for (let i = 0; i < length; ++i) {
      const context = listeners[i];
      if (!context.listener) {
        dropped = true;
      } else {
        try {
          context.listener.apply(context.scope, args);
        } catch (e) {
          UnexpectedErrors.handle(e);
        }
        if (!context.listener) {
          // listener was removed during its own callback
          dropped = true;
        } else if (context.once) {
          context.listener = undefined;
          dropped = true;
        }
      }
    }

    this._emitDepth--;

    // Only sweep tombstoned entries when the outermost emit completes,
    // so nested raiseEvent calls never mutate the array mid-iteration.
    if (dropped && this._emitDepth === 0)
      this._listeners = this._listeners.filter((ctx) => ctx.listener !== undefined);
  }

  /** Determine whether this BeEvent has a specified listener registered.
   * @param listener The listener to check.
   * @param scope optional scope argument to match call to addListener
   */
  public has(listener: T, scope?: any): boolean {
    for (const ctx of this._listeners) {
      if (ctx.listener === listener && ctx.scope === scope) {
        return true;
      }
    }
    return false;
  }

  /** Clear all Listeners from this BeEvent. */
  public clear(): void { this._listeners.length = 0; }
}

/** Specialization of BeEvent for events that take a single strongly typed argument, primarily used for UI events.
 * @public
 */
export class BeUiEvent<TEventArgs> extends BeEvent<(args: TEventArgs) => void> {
  /** Raises event with single strongly typed argument. */
  public emit(args: TEventArgs): void { this.raiseEvent(args); }
}

interface UnorderedEventContext {
  listener: Listener | undefined;
  scope: any;
  once: boolean;
}

/**
 * Manages a set of *listeners* for a particular event and notifies them when the event is raised.
 * Unlike [[BeEvent]], this class uses a `Set` internally to support safe concurrent modification
 * during emit. When a listener is removed during emit, it is marked for deferred removal instead
 * of mutating the set immediately.
 *
 * Listeners are managed exclusively through the disposal closure returned by [[addListener]] and
 * [[addOnce]]. There is no `removeListener` or `has` method — callers must capture the returned
 * closure to unsubscribe.
 * @beta
 */
export class BeUnorderedEvent<T extends Listener> {
  private _listeners: Set<UnorderedEventContext> = new Set();
  private _emitDepth: number = 0;
  private _hasTombstones: boolean = false;

  /** The number of listeners currently subscribed to the event.
   * @note During `raiseEvent()`, this may include listeners that have been removed or are one-shot
   * but are awaiting deferred cleanup. The count is accurate outside of `raiseEvent()`.
   */
  public get numberOfListeners() { return this._listeners.size; }

  /**
   * Registers a Listener to be executed whenever this event is raised.
   * @param listener The function to be executed when the event is raised.
   * @param scope An optional object scope to serve as the 'this' pointer when listener is invoked.
   * @returns A function that will remove this event listener in O(1).
   */
  public addListener(listener: T, scope?: any): () => void {
    const ctx: UnorderedEventContext = { listener, scope, once: false };
    this._listeners.add(ctx);
    return () => this._removeCtx(ctx);
  }

  /**
   * Registers a callback function to be executed *only once* when the event is raised.
   * @param listener The function to be executed once when the event is raised.
   * @param scope An optional object scope to serve as the `this` pointer in which the listener function will execute.
   * @returns A function that will remove this event listener in O(1).
   */
  public addOnce(listener: T, scope?: any): () => void {
    const ctx: UnorderedEventContext = { listener, scope, once: true };
    this._listeners.add(ctx);
    return () => this._removeCtx(ctx);
  }

  /** Remove a specific context entry, deferring during emit. */
  private _removeCtx(ctx: UnorderedEventContext): void {
    if (this._emitDepth > 0) {
      ctx.listener = undefined; // tombstone for deferred cleanup
      this._hasTombstones = true;
    } else {
      this._listeners.delete(ctx);
    }
  }

  /**
   * Raises the event by calling each registered listener with the supplied arguments.
   * @param args This method takes any number of parameters and passes them through to the listeners.
   */
  public raiseEvent(...args: Parameters<T>) {
    this._emitDepth++;

    for (const ctx of this._listeners) {
      if (!ctx.listener) {
        continue;
      }
      try {
        ctx.listener.apply(ctx.scope, args);
      } catch (e) {
        UnexpectedErrors.handle(e);
      }
      if (ctx.listener && ctx.once) {
        ctx.listener = undefined;
        this._hasTombstones = true;
      }
    }

    this._emitDepth--;

    // Only clean up tombstoned entries when we're back at the outermost emit
    if (this._hasTombstones && this._emitDepth === 0) {
      this._hasTombstones = false;
      for (const ctx of this._listeners) {
        if (ctx.listener === undefined)
          this._listeners.delete(ctx);
      }
    }
  }

  /** Clear all listeners from this BeUnorderedEvent.
   * @note If called during `raiseEvent`, remaining listeners in the current iteration are skipped
   * immediately rather than being tombstoned.
   */
  public clear(): void { this._listeners.clear(); }
}

/** Specialization of BeUnorderedEvent for events that take a single strongly typed argument, primarily used for UI events.
 * @beta
 */
export class BeUnorderedUiEvent<TEventArgs> extends BeUnorderedEvent<(args: TEventArgs) => void> {
  /** Raises event with single strongly typed argument. */
  public emit(args: TEventArgs): void { this.raiseEvent(args); }
}

/**
 * A list of BeEvent objects, accessible by an event name.
 * This class may be used instead of explicitly declaring each BeEvent as a member of a containing class.
 * @public
 */
export class BeEventList<T extends Listener> {
  private _events: { [name: string]: BeEvent<T> | undefined } = {};

  /**
   * Gets the event associated with the specified name, creating the event if it does not already exist.
   * @param name The name of the event.
   */
  public get(name: string): BeEvent<T> {
    let event = this._events[name];
    if (event)
      return event;

    event = new BeEvent();
    this._events[name] = event;
    return event;
  }

  /**
   * Removes the event associated with a name.
   * @param name The name of the event.
   */
  public remove(name: string): void {
    this._events[name] = undefined;
  }
}

/**
 * Retrieves the type of the callback function for an event type like [[BeEvent]].
 * For example:
 * ```ts
 * const event = new BeEvent<(x: number, y: string) => void>();
 * const callback: ListenerType<typeof event> = (x, y) => {
 *   console.log(`${x}, ${y}`);
 * };
 * ```
 *
 * @public
 */
export type ListenerType<TEvent extends {
  addListener(listener: Listener): () => void;
}> =
  TEvent extends {
    addListener(listener: infer TListener): () => void;
  } ? TListener : never;
