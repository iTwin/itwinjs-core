/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { SectionDrawingMonitor, SectionDrawingUpdate } from "../../SectionDrawingMonitor";
import { createFakeTimer, FakeTimer, TestCase } from "./TestCase";
import { SectionDrawingProvenance } from "../../SectionDrawingProvenance";
import { BeDuration } from "@itwin/core-bentley";
import { SectionDrawing } from "../../Element";

describe("SectionDrawingMonitor", () => {
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
      const drawing = tc.db.elements.getElement<SectionDrawing>(update.id);

      // This is where we would create/replace existing annotations.

      // Record the drawing's annotations as being up-to-date, as of the time the request for updates was made.
      SectionDrawingProvenance.store(drawing, update.provenance);
      drawing.update();

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
    await test(async (mon) => {
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
    await test(async (mon) => {
      tc.db.models.deleteModel(tc.spatial2.model);
      await expectUpdates(mon, [[tc.drawing2, updateCount+1]]);
    });
  });

  it("waits a specified delay before computing updates", async () => {
    await test(async (_, timer) => {
      const prevUpdateCount = updateCount;
      tc.touchSpatialElement(tc.spatial1.element);
      await BeDuration.wait(2);
      expect(updateCount).to.equal(prevUpdateCount);

      timer.resolve();
      await BeDuration.wait(2);
      expect(updateCount).to.equal(prevUpdateCount + 1);
    });
  });

  it("cancels delay if updates are requested while delayed", async () => {
    await test(async (mon, timer) => {
      tc.touchSpatialElement(tc.spatial2.element);
      await expectUpdates(mon, [[tc.drawing2, updateCount+1]]);
      expect(timer.isResolved()).to.be.false;
    });
  });

  it("requests new updates if changes occur before previously-requested updates are delivered", async () => {
    const computeTimer = createFakeTimer();
    await test(async (mon, delayTimer) => {
      const initialUpdateCount = updateCount;
      delayTimer.resolve();

      // Invalidate only tc.drawing2.
      tc.touchSpatialElement(tc.spatial2.element);
      await BeDuration.wait(2);

      // Our update function got invoked because 1 drawing needs regeneration.
      // It is currently waiting for our computeTimer to resolve.
      expect(updateCount).to.equal(initialUpdateCount + 1);

      // Invalidate tc.drawing1 too.
      // This will discard the updates currently being computed, and compute new ones.
      tc.touchSpatialElement(tc.spatial1.element)
      computeTimer.resolve();
      await BeDuration.wait(2);

      await expectUpdates(mon, [[tc.drawing1, updateCount], [tc.drawing2, updateCount]]);
      expect(updateCount).to.equal(initialUpdateCount + 2);
      
    }, computeTimer.promise);
  });

  it("updates drawings if their provenance is out of date at initialization", async () => {
    const drawing1 = tc.db.elements.getElement<SectionDrawing>(tc.drawing1);
    let provenance = SectionDrawingProvenance.compute(drawing1);
    provenance = { ...provenance, guids: [...provenance.guids, "0xdeadbeef"] };
    SectionDrawingProvenance.store(drawing1, provenance);
    drawing1.update();

    await test(async (mon) => {
      await expectUpdates(mon, [[tc.drawing1, updateCount+1]]);
    });
  });

  it("updates drawings if their provenance is missing at initialization", async () => {
    const drawing1 = tc.db.elements.getElement<SectionDrawing>(tc.drawing1);
    SectionDrawingProvenance.store(drawing1, undefined);
    drawing1.update();

    await test(async (mon) => {
      await expectUpdates(mon, [[tc.drawing1, updateCount+1]]);
    });
  });

  it("throws when attempting to access updates after termination", async () => {
    await test(async (mon) => {
      mon.terminate();
      expect(() => mon.getUpdates()).to.throw();
    });
  });

  it("throws when attempting to access updates while awaiting updates", async () => {
    await test(async (mon) => {
      tc.touchSpatialElement(tc.spatial1.element);
      mon.getUpdates();
      expect(() => mon.getUpdates()).to.throw();
    });
  });

  it("produces no updates if changes are undone", async () => {
    await test(async (mon) => {
      const prevUpdateCount = updateCount;
      const txnId = tc.db.txns.getCurrentTxnId();
      tc.touchSpatialElement(tc.spatial1.element);
      tc.db.txns.reverseTo(txnId);
      await expectUpdates(mon, []);
      expect(updateCount).to.equal(prevUpdateCount);
    });
  });
});
