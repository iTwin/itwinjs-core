/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Common
 */

import { Observable } from "rxjs/internal/Observable";
import { ConnectableObservable } from "rxjs/internal/observable/ConnectableObservable";
import { defer } from "rxjs/internal/observable/defer";
import { EMPTY } from "rxjs/internal/observable/empty";
import { iif } from "rxjs/internal/observable/iif";
import { finalize } from "rxjs/internal/operators/finalize";
import { mergeMap } from "rxjs/internal/operators/mergeMap";
import { observeOn } from "rxjs/internal/operators/observeOn";
import { onErrorResumeNext } from "rxjs/internal/operators/onErrorResumeNext";
import { publish } from "rxjs/internal/operators/publish";
import { refCount } from "rxjs/internal/operators/refCount";
import { subscribeOn } from "rxjs/internal/operators/subscribeOn";
import { asapScheduler } from "rxjs/internal/scheduler/asap";
import { queueScheduler } from "rxjs/internal/scheduler/queue";
import { Subject } from "rxjs/internal/Subject";

const MAX_CONCURRENT_SUBSCRIPTIONS = 1;

/**
 * Limits concurrent observable subscriptions to one.
 *
 * Scheduled observables are placed at the end of a queue. Each queued observable is subscribed to and awaited until the
 * completion.
 *
 * To schedule an observable, subscribe to the result of `scheduleSubscription()` call.
 * @internal
 */
export class SubscriptionScheduler<T> {
  private _scheduler = new Subject<ConnectableObservable<T>>();

  constructor() {
    this._scheduler
      .pipe(
        mergeMap(
          (sourceObservable) => sourceObservable.pipe(
            // Connect the observable
            refCount(),
            // Guard against stack overflow when a lot of observables are scheduled. Without this operation `mergeMap`
            // will process each observable that is present in the pipeline recursively.
            observeOn(queueScheduler),
            // Delay the connection until another event loop task
            subscribeOn(asapScheduler),
            // Ignore errors in this pipeline without suppressing them for other subscribers
            onErrorResumeNext(),
          ),
          MAX_CONCURRENT_SUBSCRIPTIONS,
        ),
      )
      // Start consuming scheduled observables
      .subscribe();
  }

  /**
   * Schedules `source` for subscription in the current scheduler.
   *
   * The actual scheduling is performed when the returned observable is subscribed to. To cancel, remove all subscribers
   * from the returned observable.
   *
   * @param source Input observable for which to schedule a subscription.
   * @returns Hot observable which starts emitting `source` values after subscription.
   */
  public scheduleSubscription(source: Observable<T>): Observable<T> {
    return defer(() => {
      let unsubscribed = false;
      // Do not subscribe to source observable if it was unsubscribed from before being processed by the scheduler
      const connectableObservable = iif(() => unsubscribed, EMPTY, source).pipe(publish()) as ConnectableObservable<T>;
      this._scheduler.next(connectableObservable);
      return connectableObservable.pipe(finalize(() => unsubscribed = true));
    });
  }
}

/**
 * Helper function for use as a `pipe()` argument with `rxjs` observables.
 * @internal
 */
export function scheduleSubscription<T>(scheduler: SubscriptionScheduler<T>): (source: Observable<T>) => Observable<T> {
  return (source) => scheduler.scheduleSubscription(source);
}
