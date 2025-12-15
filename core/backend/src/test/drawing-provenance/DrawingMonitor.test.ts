/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { Id64Set, Id64String } from "@itwin/core-bentley";
import { StandaloneDb } from "../../IModelDb";
import { DrawingMonitor, DrawingUpdates } from "../../DrawingMonitor";
import { createFakeTimer, FakeTimer, TestCase } from "./TestCase";
import { createDrawingMonitor } from "../../internal/DrawingMonitorImpl";
import { DrawingProvenance } from "../../internal/DrawingProvenance";

describe.only("DrawingMonitor", () => {
  let tc: TestCase;
  let initialTxnId: string;
  let updateCount = 0;

  before(async () => {
    tc = TestCase.create("DrawingMonitor");
    initialTxnId = tc.db.txns.getCurrentTxnId();
  });

  afterEach(() => {
    tc.db.txns.reverseTo(initialTxnId);
  })

  after(() => {
    tc.db.close();
  });

  async function computeUpdates(drawingsToRegenerate: Id64Set, delay?: Promise<void>): Promise<DrawingUpdates> {
    ++updateCount;
    if (delay) {
      await delay;
    }

    const str = updateCount.toString(10);
    const updates = new Map<string, string>();
    for (const id of drawingsToRegenerate) {
      updates.set(id, str);
    }

    return updates;
  }

  function applyUpdates(updates: DrawingUpdates): void {
    for (const [drawingId, value] of updates) {

      // This is where we would create/replace existing annotations.

      // Record the drawing's annotations as being up-to-date.
      DrawingProvenance.update(drawingId, tc.db);

      tc.db.saveChanges();
    }
  }

  async function test(func: (monitor: DrawingMonitor, timer: FakeTimer) => Promise<void>, computeDelay?: Promise<void>): Promise<void> {
    const timer = createFakeTimer();
    const monitor = createDrawingMonitor({
      iModel: tc.db,
      getUpdateDelay: () => timer.promise,
      computeUpdates: (ids) => computeUpdates(ids, computeDelay),
    });

    try {
      await func(monitor, timer);
    } finally {
      monitor.terminate();
    }
  }

  async function expectUpdates(mon: DrawingMonitor, expected: Array<[string, number]>): Promise<void> {
    const actual = await mon.getUpdates();
    expect(Array.from(actual).sort()).to.deep.equal(expected.map((x) => [x[0], x[1].toString(10)]).sort());
    applyUpdates(actual);
  }

  it("updates drawings when the geometry of a viewed spatial model is modified", async () => {
    await test(async (mon, timer) => {
      timer.resolve();
      await expectUpdates(mon, []);
      expect(updateCount).to.equal(0);

      tc.touchSpatialElement(tc.spatial3.element);
      await expectUpdates(mon, []);

      tc.touchSpatialElement(tc.spatial1.element);
      await expectUpdates(mon, [[tc.drawing1, updateCount+1], [tc.drawing2, updateCount+1]]);

      tc.touchSpatialElement(tc.spatial2.element);
      await expectUpdates(mon, [[tc.drawing2, updateCount+1]]);
    });
  });

  it("updates drawings when a viewed spatial model is deleted", async () => {
    // delete model viewed by one view
    // delete model viewed by two views
  });

  it("waits a specified delay before updating drawings", async () => {

  });

  it("only returns the most up-to-date results if multiple changes occur while delayed", async () => {

  });

  it("cancels delay if updates are requested while delayed", async () => {

  });

  it("requests new updates if changes occur before previously-requested updates are delivered", async () => {

  });

  it("updates drawings if their provenance is out of date or missing at initialization", async () => {

  });

  it("only updates drawings affected by a particular set of changes", async () => {

  });

  it("throws when attempting to access updates after termination", async () => {

  });

  it("produces no updates if changes are undone", async () => {

  });
});
