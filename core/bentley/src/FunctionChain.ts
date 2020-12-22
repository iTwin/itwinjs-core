/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utils
 */

function prepend(first: () => void, second?: () => void): () => void {
  if (!second)
    return first;

  return () => {
    first();
    second();
  };
}

/** Accumulates a series of functions to be executed in sequence at a later time.
 * As an example, an object may want to register listeners for various [[BeEvent]]s, and unregister all of those listeners at some point in the future.
 * The following code illustrates this usage:
 * ```ts
 * class Source {
 *   public readonly onStringEvent = new BeEvent<string>();
 *   public readonly onNumberEvent = new BeEvent<number>();
 * }
 *
 * class Listener {
 *   private readonly _unregisterListeners = new FunctionChain();
 *
 *   public constructor(source: Source) {
 *     this._unregisterListeners.append(source.onStringEvent.addListener((str) => this.handleStringEvent(str)));
 *     this._unregisterListeners.append(source.onNumberEvent.addListener((num) => this.handleNumberEvent(num)));
 *   }
 *
 *   public dispose(): void {
 *     this._unregisterListeners.callAndClear();
 *   }
 *
 *   private handleStringEvent(str: string) { }
 *   private handleNumberEvent(num: number) { }
 * }
 *```
 * @beta
 */
export class FunctionChain {
  protected _func?: () => void;

  /** Construct a new chain, optionally supplying the first function in the chain. */
  public constructor(func?: () => void) {
    this._func = func;
  }

  /** Add a function to the end of the chain. */
  public append(func: () => void): void {
    if (this._func)
      this._func = prepend(this._func, func);
    else
      this._func = func;
  }

  /** Add a function to the beginning of the chain. */
  public prepend(func: () => void): void {
    this._func = prepend(func, this._func);
  }

  /** Execute each function in the chain in sequence. */
  public call(): void {
    if (this._func)
      this._func();
  }

  /** Remove all functions from the chain. */
  public clear(): void {
    this._func = undefined;
  }

  /** Execute each function in the chain in sequence, then remove all functions from the chain. */
  public callAndClear(): void {
    this.call();
    this.clear();
  }

  /** True if this chain contains no functions. */
  public get isEmpty(): boolean {
    return undefined === this._func;
  }
}
