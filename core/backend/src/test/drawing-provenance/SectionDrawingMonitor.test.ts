/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { SectionDrawingMonitor, SectionDrawingUpdate } from "../../SectionDrawingMonitor";
import { createFakeTimer, FakeTimer, TestCase } from "./TestCase";
import { DrawingProvenance, SectionDrawingProvenance } from "../../internal/DrawingProvenance";

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

  async function computeUpdates(drawingsToRegenerate: Map<string, SectionDrawingProvenance>, delay?: Promise<void>): Promise<SectionDrawingUpdate[]> {
    ++updateCount;
    if (delay) {
      await delay;
    }

    const payload = updateCount.toString(10);
    const updates: SectionDrawingUpdate[] = [];
    for (const [id, provenance] of drawingsToRegenerate) {
      updates.push({ id, provenance, payload });
    }

    return updates;
  }

  function applyUpdates(updates: SectionDrawingUpdate[]): void {
    for (const update of updates) {

      // This is where we would create/replace existing annotations.

      // Record the drawing's annotations as being up-to-date.
      DrawingProvenance.update(update.id, tc.db);

      tc.db.saveChanges();
    }
  }

  async function test(func: (monitor: SectionDrawingMonitor, timer: FakeTimer) => Promise<void>, computeDelay?: Promise<void>): Promise<void> {
    const timer = createFakeTimer();
    const monitor = SectionDrawingMonitor.create({
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

  async function expectUpdates(mon: SectionDrawingMonitor, expected: Array<[string, number]>): Promise<void> {
    const updates = await mon.getUpdates();
    const actual = Array.from(updates).map((x) => [x.id, x.payload]).sort();
    expect(actual).to.deep.equal(expected.map((x) => [x[0], x[1].toString(10)]).sort());
    applyUpdates(updates);
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
