/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tree
 */

import { from as rxjsFrom } from "rxjs/internal/observable/from";
import { Observable as RxjsObservable } from "rxjs/internal/Observable";

/**
 * Helper method that creates an Observable from Iterable or Promise.
 * @public
 */
export function from<T>(iterable: Iterable<T> | PromiseLike<T>): Observable<T> {
  return rxjsFrom(iterable);
}

/** @internal */
export function toRxjsObservable<T>(observable: Observable<T>): RxjsObservable<T> {
  return new RxjsObservable((subscriber) => { observable.subscribe(subscriber); });
}

/**
 * Observable interface compatible with [rxjs](https://github.com/ReactiveX/rxjs)
 * This interface ensures that consumers are not required to have rxjs as dependency.
 * @public
 */
export interface Observable<T> extends Subscribable<T> { } // eslint-disable-line @typescript-eslint/no-empty-interface

/**
 * Subscribable interface compatible with [rxjs](https://github.com/ReactiveX/rxjs)
 * This interface ensures that consumers are not required to have rxjs as dependency.
 * @public
 */
export interface Subscribable<T> {
  subscribe(observer?: Observer<T>): Subscription;
  subscribe(next: null | undefined, error: null | undefined, complete: () => void): Subscription;
  subscribe(next: null | undefined, error: (error: any) => void, complete?: () => void): Subscription;
  subscribe(next: (value: T) => void, error: null | undefined, complete: () => void): Subscription; // eslint-disable-line @typescript-eslint/unified-signatures
  subscribe(next?: (value: T) => void, error?: (error: any) => void, complete?: () => void): Subscription;
}

/**
 * Observer interface compatible with [rxjs](https://github.com/ReactiveX/rxjs)
 * This interface ensures that consumers are not required to have rxjs as dependency.
 * @public
 */
export declare type Observer<T> = NextObserver<T> | ErrorObserver<T> | CompletionObserver<T>;

/**
 * Unsubscribable interface compatible with [rxjs](https://github.com/ReactiveX/rxjs)
 * This interface ensures that consumers are not required to have rxjs as dependency.
 * @public
 */
export interface Unsubscribable {
  unsubscribe(): void;
}

/**
 * Subscription interface compatible with [rxjs](https://github.com/ReactiveX/rxjs)
 * This interface ensures that consumers are not required to have rxjs as dependency.
 * @public
 */
export interface Subscription extends Unsubscribable {
  readonly closed: boolean;
  unsubscribe(): void;
  add(tearDown: Unsubscribable | (() => void) | void): void;
}

/**
 * NextObserver interface compatible with [rxjs](https://github.com/ReactiveX/rxjs)
 * This interface ensures that consumers are not required to have rxjs as dependency.
 * @public
 */
export interface NextObserver<T> {
  closed?: boolean;
  next: (value: T) => void;
  error?: (err: any) => void;
  complete?: () => void;
}

/**
 * ErrorObserver interface compatible with [rxjs](https://github.com/ReactiveX/rxjs)
 * This interface ensures that consumers are not required to have rxjs as dependency.
 * @public
 */
export interface ErrorObserver<T> {
  closed?: boolean;
  next?: (value: T) => void;
  error: (err: any) => void;
  complete?: () => void;
}

/**
 * CompletionObserver interface compatible with [rxjs](https://github.com/ReactiveX/rxjs)
 * This interface ensures that consumers are not required to have rxjs as dependency.
 * @public
 */
export interface CompletionObserver<T> {
  closed?: boolean;
  next?: (value: T) => void;
  error?: (err: any) => void;
  complete: () => void;
}
