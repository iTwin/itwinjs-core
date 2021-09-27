/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Observable } from "rxjs/internal/Observable";
import { from } from "rxjs/internal/observable/from";
import { throwError } from "rxjs/internal/observable/throwError";
import { timer } from "rxjs/internal/observable/timer";
import { takeUntil } from "rxjs/internal/operators/takeUntil";
import { tap } from "rxjs/internal/operators/tap";
import { scheduled } from "rxjs/internal/scheduled/scheduled";
import { asapScheduler } from "rxjs/internal/scheduler/asap";
import { asyncScheduler } from "rxjs/internal/scheduler/async";
import { queueScheduler } from "rxjs/internal/scheduler/queue";
import { ObservableInput, SchedulerLike } from "rxjs/internal/types";
import sinon from "sinon";
import { scheduleSubscription, SubscriptionScheduler } from "../../components-react/common/SubscriptionScheduler";
import { extractSequence, waitForUnsubscription } from "./ObservableTestHelpers";
import { ResolvablePromise } from "../test-helpers/misc";

async function expectSequence<T>(expectedSequence: T[], observable: Observable<T>): Promise<void> {
  const actualSequence = await extractSequence(observable);
  expect(actualSequence).to.eql(expectedSequence);
}

describe("SubscriptionScheduler", () => {
  let subscriptionScheduler: SubscriptionScheduler<number>;

  beforeEach(() => {
    subscriptionScheduler = new SubscriptionScheduler();
  });

  describe("scheduleSubscription", () => {
    // Affects when input observables emit values to `SubscriptionScheduler`.
    const schedulers: Array<[string, undefined | SchedulerLike]> = [
      ["no", undefined],
      ["queue", queueScheduler],
      ["asap", asapScheduler],
      ["async", asyncScheduler],
    ];

    // Creates an observable which emits values using the specified `rxjs` scheduler
    function createScheduledObservable<T>(sequence: ObservableInput<T>, scheduler: undefined | SchedulerLike): Observable<T> {
      return scheduler ? scheduled(sequence, scheduler) : from(sequence);
    }

    for (const [schedulerName, scheduler] of schedulers) {
      const sequence = [0, 1, 2];

      describe(`with ${schedulerName} scheduler`, () => {
        it("schedules source observable and subscribes to it", async () => {
          const source = createScheduledObservable(sequence, scheduler);
          const subscriptionSpy = sinon.spy(source, "subscribe");
          await expectSequence(sequence, subscriptionScheduler.scheduleSubscription(source));
          expect(subscriptionSpy).to.have.been.calledOnce;
        });

        it("schedules source observables in subscription order", async () => {
          const firstSource = createScheduledObservable(sequence, scheduler);
          const firstSubscriptionSpy = sinon.spy(firstSource, "subscribe");
          const firstScheduledObservable = subscriptionScheduler.scheduleSubscription(firstSource);

          const secondSource = createScheduledObservable(sequence, scheduler);
          const secondSubscriptionSpy = sinon.spy(secondSource, "subscribe");
          const secondScheduledObservable = subscriptionScheduler.scheduleSubscription(secondSource);

          expect(firstSubscriptionSpy).to.have.not.been.called;
          expect(secondSubscriptionSpy).to.have.not.been.called;

          const secondObservableSubscription = secondScheduledObservable.subscribe();
          const firstObservableSubscription = firstScheduledObservable.subscribe();

          await waitForUnsubscription(secondObservableSubscription);
          await waitForUnsubscription(firstObservableSubscription);
          expect(secondSubscriptionSpy.calledBefore(firstSubscriptionSpy)).to.be.true;
          expect(firstSubscriptionSpy).to.have.been.calledOnce;
          expect(secondSubscriptionSpy).to.have.been.calledOnce;
        });

        it("reuses the same observable while it is scheduled", async () => {
          const source = createScheduledObservable(sequence, scheduler);
          const subscriptionSpy = sinon.spy(source, "subscribe");

          const firstScheduledObservable = subscriptionScheduler.scheduleSubscription(source).subscribe();
          const secondScheduledObservable = subscriptionScheduler.scheduleSubscription(source).subscribe();

          await waitForUnsubscription(firstScheduledObservable);
          await waitForUnsubscription(secondScheduledObservable);

          expect(subscriptionSpy).to.have.been.calledOnce;
        });

        it("reschedules the same observable source after it has been completed", async () => {
          const source = createScheduledObservable(sequence, scheduler);
          const subscriptionSpy = sinon.spy(source, "subscribe");

          const firstScheduledObservable = subscriptionScheduler.scheduleSubscription(source);
          await waitForUnsubscription(firstScheduledObservable.subscribe());

          const secondScheduledObservable = subscriptionScheduler.scheduleSubscription(source);
          await waitForUnsubscription(secondScheduledObservable.subscribe());

          expect(subscriptionSpy).to.have.been.calledTwice;
        });

        it("subscribes to one source observable at a time", async () => {
          const firstCompleteSpy = sinon.spy();
          const firstSource = createScheduledObservable(sequence, scheduler).pipe(tap({ complete: firstCompleteSpy }));
          const secondNextSpy = sinon.spy();
          const secondSource = createScheduledObservable(sequence, scheduler).pipe(tap({ next: secondNextSpy }));

          const firstSubscription = subscriptionScheduler.scheduleSubscription(firstSource).subscribe();
          const secondSubscription = subscriptionScheduler.scheduleSubscription(secondSource).subscribe();

          await waitForUnsubscription(firstSubscription);
          await waitForUnsubscription(secondSubscription);

          expect(firstCompleteSpy).to.have.been.calledBefore(secondNextSpy);
        });

        it("does not subscribe to the next observable until first is resolved", async () => {
          const firstSourcePromise = new ResolvablePromise<number>();
          const firstSource = createScheduledObservable(firstSourcePromise, scheduler);

          const secondSource = createScheduledObservable(sequence, scheduler);
          const secondSpy = sinon.spy(secondSource, "subscribe");

          const firstSubscription = subscriptionScheduler.scheduleSubscription(firstSource).pipe(takeUntil(timer(1))).subscribe();
          const secondSubscription = subscriptionScheduler.scheduleSubscription(secondSource).subscribe();

          expect(secondSpy).to.have.not.been.called;
          await waitForUnsubscription(firstSubscription);

          // should not be subscribed to second source as first is not resolved yet
          expect(secondSpy).to.have.not.been.called;

          await firstSourcePromise.resolve(999);

          await waitForUnsubscription(secondSubscription);
          expect(secondSpy).to.have.been.called;
        });

        it("notifies subscribers about error in source observable", async () => {
          const error = new Error("TestError");
          const source = createScheduledObservable(throwError(error), scheduler);
          const errorSpy = sinon.spy();

          const scheduledObservable = subscriptionScheduler.scheduleSubscription(source);
          await waitForUnsubscription(scheduledObservable.subscribe({ error: errorSpy }));

          expect(errorSpy).to.have.been.calledOnceWithExactly(error);
        });

        it("schedules the following observable when the previous one emits error", async () => {
          const error = new Error("TestError");
          const firstSource = createScheduledObservable(throwError(error), scheduler);
          const secondSource = createScheduledObservable(sequence, scheduler);

          const errorSpy = sinon.spy();
          const firstSubscription = subscriptionScheduler.scheduleSubscription(firstSource).subscribe({ error: errorSpy });
          const nextSpy = sinon.spy();
          const completeSpy = sinon.spy();
          const secondSubscription = subscriptionScheduler.scheduleSubscription(secondSource).subscribe({ next: nextSpy, complete: completeSpy });

          await waitForUnsubscription(firstSubscription);
          await waitForUnsubscription(secondSubscription);

          expect(errorSpy).to.have.been.calledOnceWithExactly(error);
          expect(errorSpy).to.have.been.calledBefore(nextSpy);
          expect(nextSpy).to.have.been.calledThrice;
          expect(completeSpy).to.have.been.calledAfter(nextSpy);
        });
      });
    }
  });
});

describe("scheduleSubscription", () => {
  it("calls SubscriptionScheduler", () => {
    const scheduler = new SubscriptionScheduler();
    const schedulerSpy = sinon.spy(scheduler, "scheduleSubscription");
    const source = from([0, 1, 2]);
    source.pipe(scheduleSubscription(scheduler)).subscribe();
    expect(schedulerSpy).to.have.been.calledOnceWithExactly(source);
  });
});
