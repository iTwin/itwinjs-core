/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tree */

import { from as rxjsFrom } from "rxjs/internal/observable/from";

/** @alpha */
export function from<T>(iterable: Iterable<T>): Observable<T> {
  return rxjsFrom(iterable);
}

/**
 * Observable interface compatible with [rxjs](https://github.com/ReactiveX/rxjs)
 * This interface ensures that consumers are not required to have rxjs as dependency.
 * @alpha
 */
export interface Observable<T> extends Subscribable<T> { }

/** @alpha */
export interface Subscribable<T> {
  subscribe(observer?: Observer<T>): Subscription;
  subscribe(next: null | undefined, error: null | undefined, complete: () => void): Subscription;
  subscribe(next: null | undefined, error: (error: any) => void, complete?: () => void): Subscription;
  subscribe(next: (value: T) => void, error: null | undefined, complete: () => void): Subscription;
  subscribe(next?: (value: T) => void, error?: (error: any) => void, complete?: () => void): Subscription;
}

/**
 * Observer interface compatible with [rxjs](https://github.com/ReactiveX/rxjs)
 * This interface ensures that consumers are not required to have rxjs as dependency.
 * @alpha
 */
export declare type Observer<T> = NextObserver<T> | ErrorObserver<T> | CompletionObserver<T>;

/** @alpha */
export interface Unsubscribable {
  unsubscribe(): void;
}

/** @alpha */
export interface Subscription extends Unsubscribable {
  readonly closed: boolean;
  unsubscribe(): void;
  add(tearDown: Unsubscribable | (() => void) | void): void;
}

/** @alpha */
export interface NextObserver<T> {
  closed?: boolean;
  next: (value: T) => void;
  error?: (err: any) => void;
  complete?: () => void;
}

/** @alpha */
export interface ErrorObserver<T> {
  closed?: boolean;
  next?: (value: T) => void;
  error: (err: any) => void;
  complete?: () => void;
}

/** @alpha */
export interface CompletionObserver<T> {
  closed?: boolean;
  next?: (value: T) => void;
  error?: (err: any) => void;
  complete: () => void;
}
