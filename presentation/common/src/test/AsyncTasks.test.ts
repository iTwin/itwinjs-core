/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { using } from "@itwin/core-bentley";
import { AsyncTasksTracker } from "../presentation-common";

describe("AsyncTasksTracker", () => {

  it("tracks async task while it's disposed", () => {
    const tracker = new AsyncTasksTracker();
    expect(tracker.pendingAsyncs.size).to.eq(0);
    const res = tracker.trackAsyncTask();
    expect(tracker.pendingAsyncs.size).to.eq(1);
    res.dispose();
    expect(tracker.pendingAsyncs.size).to.eq(0);
  });

  it("supports nesting", () => {
    const tracker = new AsyncTasksTracker();
    using(tracker.trackAsyncTask(), (_r1) => {
      expect(tracker.pendingAsyncs.size).to.eq(1);
      using(tracker.trackAsyncTask(), (_r2) => {
        expect(tracker.pendingAsyncs.size).to.eq(2);
      });
      expect(tracker.pendingAsyncs.size).to.eq(1);
    });
    expect(tracker.pendingAsyncs.size).to.eq(0);
  });

});
