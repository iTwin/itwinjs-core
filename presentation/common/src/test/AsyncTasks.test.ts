/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { AsyncTasksTracker } from "../presentation-common.js";

describe("AsyncTasksTracker", () => {
  it("tracks async task while it's disposed", () => {
    const tracker = new AsyncTasksTracker();
    expect(tracker.pendingAsyncs.size).to.eq(0);
    const res = tracker.trackAsyncTask();
    expect(tracker.pendingAsyncs.size).to.eq(1);
    res[Symbol.dispose]();
    expect(tracker.pendingAsyncs.size).to.eq(0);
  });

  it("supports nesting", () => {
    const tracker = new AsyncTasksTracker();
    {
      using _r1 = tracker.trackAsyncTask();
      expect(tracker.pendingAsyncs.size).to.eq(1);
      {
        using _r2 = tracker.trackAsyncTask();
        expect(tracker.pendingAsyncs.size).to.eq(2);
      }
      expect(tracker.pendingAsyncs.size).to.eq(1);
    }
    expect(tracker.pendingAsyncs.size).to.eq(0);
  });
});
