/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { ResolvablePromise } from "../test-helpers/misc";
import { Observable } from "rxjs/internal/Observable";
import { Subscription } from "rxjs/internal/Subscription";

/** Expects observable to emit nodes in a specific order. The order is defined by the sequence of groups of emitted node ids, e.g. `[[0], [1, 2]]`. */
export async function extractSequence<T>(observable: Observable<T>): Promise<T[]> {
  const sequence: T[] = [];
  await waitForUnsubscription(observable.subscribe((value) => sequence.push(value)));
  return sequence;
}

/** Returns a promise which is resolved when the input subscription is disposed. */
export async function waitForUnsubscription(subscription: Subscription): Promise<void> {
  const promise = new ResolvablePromise<void>();
  subscription.add(() => promise.resolve());
  return promise;
}
