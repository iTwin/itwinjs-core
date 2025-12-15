/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { SectionDrawingUpdate } from "../../SectionDrawingMonitor";
import { createSectionDrawingMonitor, SectionDrawingMonitorImpl } from "../../internal/SectionDrawingMonitorImpl";
import { TxnIdString } from "../../TxnManager";
import { createFakeTimer, TestCase } from "./TestCase";
import { SectionDrawingProvenance } from "../../SectionDrawingProvenance";

async function computeUpdates(drawings: Map<string, SectionDrawingProvenance>): Promise<SectionDrawingUpdate[]> {
  const updates = [];
  for (const [id, provenance] of drawings) {
    updates.push({ id, provenance, payload: id });
  }

  return updates;
}

describe("SectionDrawingMonitorImpl", () => {
  let tc: TestCase;

  before(async () => {
    tc = TestCase.create("DrawingMonitorImpl");

    let bisVer = tc.db.querySchemaVersionNumbers("BisCore")!;
    expect(bisVer.read).to.equal(1);
    expect(bisVer.write).to.equal(0);
    expect(bisVer.minor).least(22);
  });

  after(() => tc.db.close());

  async function test(getUpdateDelay: (() => Promise<void>) | undefined, func: (monitor: SectionDrawingMonitorImpl) => Promise<void>, updateDelay?: Promise<void>): Promise<void> {
    const compute = updateDelay ? async (ids: Map<string, SectionDrawingProvenance>) => { await updateDelay; return computeUpdates(ids); } : computeUpdates;
    const monitor = createSectionDrawingMonitor({
      getUpdateDelay: getUpdateDelay ?? (() => Promise.resolve()),
      iModel: tc.db,
      computeUpdates: compute,
    });

    try {
      await func(monitor);
    } finally {
      monitor.terminate();
    }
  }

  describe("state transitions", () => {
    let initialTxnId: TxnIdString;

    beforeEach(() => {
      initialTxnId = tc.db.txns.getCurrentTxnId();
    });

    afterEach(() => {
      tc.db.txns.reverseTo(initialTxnId);
    });

    describe("Construction", () => {
      it("=> Idle if no drawings require regeneration", async () => {
        await test(undefined, async (mon) => {
          expect(mon.state.name).to.equal("Idle");
        });
      });

      it("=> Delayed if any drawings require regeneration", async () => {
        tc.touchSpatialElement(tc.spatial1.element);
        await test(undefined, async (mon) => {
          expect(mon.state.name).to.equal("Delayed");
        });
      });
    });

    describe("Idle", () => {
      it("geometry change detected => Delayed", async () => {
        await test(undefined, async (mon) => {
          expect(mon.state.name).to.equal("Idle");
          tc.touchSpatialElement(tc.spatial1.element);
          expect(mon.state.name).to.equal("Delayed");
        });
      });

      it("unrelated geometry change => Idle", async () => {
        await test(undefined, async (mon) => {
          expect(mon.state.name).to.equal("Idle");
          tc.touchSpatialElement(tc.spatial3.element);
          expect(mon.state.name).to.equal("Idle");
        });
      });

      describe("getUpdates", () => {
        it("=> Idle (empty) if no drawings require regeneration", async () => {
          await test(undefined, async (mon) => {
            expect(mon.state.name).to.equal("Idle");
            const promise = mon.getUpdates();
            expect(mon.state.name).to.equal("Idle");
            const results = await promise;
            expect(results.length).to.equal(0);
          });
        });
      });

      it("terminate => Terminated", async () => {
        await test(undefined, async (mon) => {
          expect(mon.state.name).to.equal("Idle");
          mon.terminate();
          expect(mon.state.name).to.equal("Terminated");
        });
      });
    })

    describe("Terminated", () => {
      it("geometry change detected => Terminated", async () => {
        await test(undefined, async (mon) => {
          mon.terminate();
          expect(mon.state.name).to.equal("Terminated");

          tc.touchSpatialElement(tc.spatial1.element);
          expect(mon.state.name).to.equal("Terminated");
        });
      });

      it("getUpdates => Error", async () => {
        await test(undefined, async (mon) => {
          mon.terminate();
          expect(mon.state.name).to.equal("Terminated");

          expect(() => mon.getUpdates()).to.throw();
        });
      });

      it("terminate => Terminated", async () => {
        await test(undefined, async (mon) => {
          mon.terminate();
          expect(mon.state.name).to.equal("Terminated");

          mon.terminate();
          expect(mon.state.name).to.equal("Terminated");
        });
      });
    });

    describe("Delayed", async () => {
      it("geometry change detected => Delayed (restart)", async () => {
        const timer = createFakeTimer();
        await test(() => timer.promise, async (mon) => {
          tc.touchSpatialElement(tc.spatial1.element);
          const state = mon.state;
          expect(state.name).to.equal("Delayed");
      
          tc.touchSpatialElement(tc.spatial1.element);
          expect(mon.state.name).to.equal("Delayed");
          expect(mon.state).not.to.equal(state);
        });
      });

      it("timer expired => Cached", async () => {
        const timer = createFakeTimer();
        await test(() => timer.promise, async (mon) => {
          tc.touchSpatialElement(tc.spatial1.element);
          expect(mon.state.name).to.equal("Delayed");
          await timer.resolve();
          expect(mon.state.name).to.equal("Cached");
          const results = await mon.getUpdates();
          expect(results.length).to.equal(2);
        });
      });

      describe("getUpdates => Requested", async () => {
        await test(undefined, async (mon) => {
          tc.touchSpatialElement(tc.spatial1.element);
          expect(mon.state.name).to.equal("Delayed");
          const promise = mon.getUpdates();
          expect(mon.state.name).to.equal("Requested");
          const results = await promise;
          expect(results.length).to.equal(2);
        });
      });

      it("terminate => Terminated", async () => {
        await test(undefined, async (mon) => {
          tc.touchSpatialElement(tc.spatial1.element);
          expect(mon.state.name).to.equal("Delayed");
          mon.terminate();
          expect(mon.state.name).to.equal("Terminated");
        });
      });
    });

    describe("Requested", async () => {
      it("geometry change detected => Requested", async () => {
        const delayTimer = createFakeTimer();
        const computeTimer = createFakeTimer();
        await test(() => delayTimer.promise, async (mon) => {
          tc.touchSpatialElement(tc.spatial1.element);
          await delayTimer.resolve();
          const state = mon.state;
          expect(state.name).to.equal("Requested");
          tc.touchSpatialElement(tc.spatial2.element);
          expect(mon.state.name).to.equal("Requested");
          expect(mon.state).not.to.equal(state);
        }, computeTimer.promise);
      });

      it("getUpdates => Error", async () => {
        await test(undefined, async (mon) => {
          tc.touchSpatialElement(tc.spatial1.element);
          mon.getUpdates();
          expect(mon.state.name).to.equal("Requested");
          expect(() => mon.getUpdates()).to.throw();
        });
      });

      it("terminate => Terminated", async () => {
        await test(undefined, async (mon) => {
          tc.touchSpatialElement(tc.spatial1.element);
          mon.getUpdates();
          expect(mon.state.name).to.equal("Requested");
          mon.terminate();
          expect(mon.state.name).to.equal("Terminated");
        }, createFakeTimer().promise);
      });
    });

    describe("Cached", async () => {
      describe("geometry change detected", () => {
        it("=> Delayed if not awaiting updates", async () => {
          const timer1 = createFakeTimer();
          const timer2 = createFakeTimer();
          let timer1Resolved = false;
          await test(() => timer1Resolved ? timer2.promise : timer1.promise, async (mon) => {
            expect(mon.state.name).to.equal("Idle");

            tc.touchSpatialElement(tc.spatial1.element);
            expect(mon.state.name).to.equal("Delayed");

            await timer1.resolve();
            timer1Resolved = true;
            expect(mon.state.name).to.equal("Cached");

            tc.touchSpatialElement(tc.spatial1.element);
            expect(mon.state.name).to.equal("Delayed");
          });
        });

        it("=> Requested if awaiting updates", async () => {
          // ###TODO
        });
      });

      it("terminate => Terminated", async () => {
        const timer = createFakeTimer();
        await test(() => timer.promise, async (mon) => {
          tc.touchSpatialElement(tc.spatial1.element);
          await timer.resolve();
          expect(mon.state.name).to.equal("Cached");

          mon.terminate();
          expect(mon.state.name).to.equal("Terminated");
        });
      });
    });
  });
});

