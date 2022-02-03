/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Common
 */

import { BehaviorSubject } from "rxjs/internal/BehaviorSubject";
import type { Observable } from "rxjs/internal/Observable";
import type { ConnectableObservable } from "rxjs/internal/observable/ConnectableObservable";
import { defer } from "rxjs/internal/observable/defer";
import { finalize } from "rxjs/internal/operators/finalize";
import { mergeMap } from "rxjs/internal/operators/mergeMap";
import { observeOn } from "rxjs/internal/operators/observeOn";
import { onErrorResumeNext } from "rxjs/internal/operators/onErrorResumeNext";
import { publish } from "rxjs/internal/operators/publish";
import { refCount } from "rxjs/internal/operators/refCount";
import { subscribeOn } from "rxjs/internal/operators/subscribeOn";
import { switchAll } from "rxjs/internal/operators/switchAll";
import { asapScheduler } from "rxjs/internal/scheduler/asap";
import { queueScheduler } from "rxjs/internal/scheduler/queue";
import { Subject } from "rxjs/internal/Subject";

const MAX_CONCURRENT_SUBSCRIPTIONS = 1;

/**
 * Controls observable subscription order and timing.
 *
 * Scheduled observables are placed at the end of a queue. The scheduler always
 * subscribes to at most one observable from the queue and waits until observables
 * either complete or get unscheduled before removing them from the queue.
 *
 * To schedule an observable, subscribe to the result of `scheduleSubscription()` call.
 * @internal
 */
export class SubscriptionScheduler<T> {
  // Maps source observables to scheduled observables.
  private _scheduledObservables = new Map<Observable<T>, Observable<T>>();

  // Subject that does the actual subscription scheduling
  private _scheduler = new Subject<ConnectableObservable<T>>();

  constructor() {
    this._scheduler
      .pipe(
        // Process all observables one by one in sequence
        mergeMap(
          (sourceObservable) => sourceObservable.pipe(
            // Connect the observable
            refCount(),
            // Guard against stack overflow when a lot of observables are scheduled.
            // Without this operation `mergeMap` will process each observable
            // that is present in the pipeline recursively.
            observeOn(queueScheduler),
            // Make sure that there is enough time to subscribe to a scheduled observable multiple times if needed
            subscribeOn(asapScheduler),
            // On error, proceed to the next observable. Outside subscribers will still receive an error notification.
            onErrorResumeNext(),
          ),
          MAX_CONCURRENT_SUBSCRIPTIONS,
        ),
      )
      // Start the scheduler and wait for observables to be scheduled
      .subscribe();
  }

  /**
   * Schedules `source` for subscription in the current scheduler.
   *
   * The actual scheduling is performed when the returned observable is subscribed to.
   * To cancel, simply remove all subscribers from the returned observable.
   *
   * @param source Input observable for which to schedule a subscription.
   * @returns Multicast observable which mirrors `source`.
   */
  public scheduleSubscription(source: Observable<T>): Observable<T> {
    // On subscription, determine which observable to return
    return defer(() => {
      // If this observable has already been scheduled, return the scheduled observable
      let scheduledObservable = this._scheduledObservables.get(source);
      if (scheduledObservable) {
        return scheduledObservable;
      }

      // Create a subject which emits observable sources
      const sourceSubject = new BehaviorSubject<Observable<T>>(source.pipe(
        // When source completes, allow scheduler to move on to the next observable
        finalize(() => {
          sourceSubject.complete();
        }),
      ));

      // Create an observable which will be passed to the scheduler
      const connectableObservable = publish<T>()(sourceSubject.pipe(
        // Unsubscribe from previous observable before subscribing to the next one
        switchAll(),
      ));

      // Create an observable which will be cached and returned
      scheduledObservable = connectableObservable.pipe(
        finalize(() => {
          // Invalidate cached scheduled observable
          this._scheduledObservables.delete(source);

          // Allow scheduler to move on to the next observable
          sourceSubject.complete();
        }),
        // Multicast values
        publish(),
        // Dispose the shared subscription when there are no subscribers left
        refCount(),
      );

      // Cache the scheduled observable
      this._scheduledObservables.set(source, scheduledObservable);

      // Schedule the subscription
      this._scheduler.next(connectableObservable);
      return scheduledObservable;
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
