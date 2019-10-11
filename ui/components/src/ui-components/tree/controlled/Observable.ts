/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tree */

import { from as rxjsFrom } from "rxjs/internal/observable/from";

/** @internal */
export function from<T>(iterable: Iterable<T>): Observable<T> {
  return rxjsFrom(iterable);
}

/**
 * Observable interface compatible with [rxjs](https://github.com/ReactiveX/rxjs)
 * This interface ensures that consumers are not required to have rxjs as dependency.
 * @internal
 */
export interface Observable<T> extends Subscribable<T> { }

/** @internal */
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
 * @internal
 */
export declare type Observer<T> = NextObserver<T> | ErrorObserver<T> | CompletionObserver<T>;

/** @internal */
export interface Subscription {
  readonly closed: boolean;
  unsubscribe(): void;
}

/** @internal */
export interface NextObserver<T> {
  closed?: boolean;
  next: (value: T) => void;
  error?: (err: any) => void;
  complete?: () => void;
}

/** @internal */
export interface ErrorObserver<T> {
  closed?: boolean;
  next?: (value: T) => void;
  error: (err: any) => void;
  complete?: () => void;
}

/** @internal */
export interface CompletionObserver<T> {
  closed?: boolean;
  next?: (value: T) => void;
  error?: (err: any) => void;
  complete: () => void;
}
