/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { BeDuration, BeEvent, Id64Set } from "@itwin/core-bentley";
import { DrawingUpdates } from "../../DrawingMonitor";
import { createDrawingMonitor, DrawingMonitorImpl } from "../../internal/DrawingMonitorImpl";
import { StandaloneDb } from "../../IModelDb";
import { TxnIdString } from "../../TxnManager";
import { IModelTestUtils } from "../IModelTestUtils";

function createFakeTimer() {
  const onResolved = new BeEvent<() => void>();
  const onError = new BeEvent<(reason: string) => void>();
  const promise = new Promise<void>((resolve, reject) => {
    onResolved.addListener(() => resolve());
    onError.addListener((reason) => reject(reason));
  });

  return {
    promise,
    resolve: async () => {
      onResolved.raiseEvent();
      return BeDuration.wait(1);
    },
    reject: async (reason: string) => {
      onError.raiseEvent(reason);
      return BeDuration.wait(1);
    },
  };
}

async function computeUpdates(drawingIds: Id64Set): Promise<DrawingUpdates> {
  const map = new Map<string, string>();
  for (const id of drawingIds) {
    map.set(id, id);
  }

  return map;
}

async function awaitState(mon: DrawingMonitorImpl, state: string): Promise<void> {
  if (mon.state.name === state) {
    return;
  }

  await BeDuration.wait(1);
  return awaitState(mon, state);
}

describe.only("DrawingMonitorImpl", () => {
  let db: StandaloneDb;
  let initialTxnId: TxnIdString;

  before(async () => {
    const filePath = IModelTestUtils.prepareOutputFile("DrawingMonitorImplTests", "DrawingMonitorImpl.bim");
    db = StandaloneDb.createEmpty(filePath, {
      rootSubject: { name: "DrawingMonitorImpl", description: "" },
      enableTransactions: true,
    });

    let bisVer = db.querySchemaVersionNumbers("BisCore")!;
    expect(bisVer.read).to.equal(1);
    expect(bisVer.write).to.equal(0);
    expect(bisVer.minor).least(22);

    initialTxnId = db.txns.getCurrentTxnId();
  });

  afterEach(() => {
    db.txns.reverseTo(initialTxnId);
  });

  after(() => db.close());

  async function test(getUpdateDelay: (() => Promise<void>) | undefined, func: (monitor: DrawingMonitorImpl) => Promise<void>): Promise<void> {
    const monitor = createDrawingMonitor({
      getUpdateDelay: getUpdateDelay ?? (() => Promise.resolve()),
      iModel: db,
      computeUpdates,
    });

    try {
      await func(monitor);
    } finally {
      monitor.terminate();
    }
  }

  describe("state transitions", () => {
    describe("Idle", () => {
      it("change detected => Delayed", async () => {
        await test(undefined, async (mon) => {
          expect(mon.state.name).to.equal("Idle");
          mon.fakeGeometryChange();
          expect(mon.state.name).to.equal("Delayed");
        });
      });

      describe("getUpdates", () => {
        it("=> Requested if any drawings require regeneration", async () => {

        });

        it("=> Idle (empty) if no drawings require regeneration", async () => {
          await test(undefined, async (mon) => {
            expect(mon.state.name).to.equal("Idle");
            const promise = mon.getUpdates();
            expect(mon.state.name).to.equal("Idle");
            const results = await promise;
            expect(results.size).to.equal(0);
          })
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
      it("change detected => Terminated", async () => {
        await test(undefined, async (mon) => {
          mon.terminate();
          expect(mon.state.name).to.equal("Terminated");

          mon.fakeGeometryChange();
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
      it("change detected => Delayed (restart)", async () => {
        const timer = createFakeTimer();
        await test(() => timer.promise, async (mon) => {
          mon.fakeGeometryChange();
          const state = mon.state;
          expect(state.name).to.equal("Delayed");
      
          mon.fakeGeometryChange();
          expect(mon.state.name).to.equal("Delayed");
          expect(mon.state).not.to.equal(state);
        });
      });

      describe("delay expired", () => {
        it("=> Requested if any drawings require regeneration", async () => {

        });

        it("=> Cached (empty) if no drawings require regeneration", async () => {
          const timer = createFakeTimer();
          await test(() => timer.promise, async (mon) => {
            mon.fakeGeometryChange();
            expect(mon.state.name).to.equal("Delayed");
            await timer.resolve();
            expect(mon.state.name).to.equal("Cached");
            const results = await mon.getUpdates();
            expect(results.size).to.equal(0);
          });
        });
      });

      describe("getUpdates", () => {
        it("=> Requested if any drawings require regeneration", async () => {

        });

        it("=> Idle (empty) if no drawings require regeneration", async () => {
          await test(undefined, async (mon) => {
            mon.fakeGeometryChange();
            expect(mon.state.name).to.equal("Delayed");
            const promise = mon.getUpdates();
            expect(mon.state.name).to.equal("Idle");
            const results = await promise;
            expect(results.size).to.equal(0);
          });
        });
      });

      it("terminate => Terminated", async () => {
        await test(undefined, async (mon) => {
          mon.fakeGeometryChange();
          expect(mon.state.name).to.equal("Delayed");
          mon.terminate();
          expect(mon.state.name).to.equal("Terminated");
        });
      });
    });

    describe("Requested", async () => {
      
    });

    describe.skip("Cached", async () => {
      describe("change detected", () => {
        it("=> Delayed if not awaiting updates", async () => {
          const timer = createFakeTimer();
          await test(() => timer.promise, async (mon) => {
            expect(mon.state.name).to.equal("Idle");

            mon.fakeGeometryChange();
            expect(mon.state.name).to.equal("Delayed");

            await timer.resolve();
            expect(mon.state.name).to.equal("Cached");

            mon.fakeGeometryChange();
            expect(mon.state.name).to.equal("Delayed"); // ###TODO actually Cached (timer already resolved, I think)
          });
        });

        it("=> Requested if awaiting updates and drawings require regeneration", async () => {

        });

        it("=> Idle (empty) if awaiting updates and no drawings require regeneration", async () => {
          await test(undefined, async (mon) => {
            const promise = mon.getUpdates();
            const state = mon.state;
            expect(state.name).to.equal("Idle");

            mon.fakeGeometryChange();
            expect(mon.state.name).to.equal("Idle"); // ###TODO actually Delayed
            expect(mon.state).not.to.equal(state);
            const results = await promise;
            expect(results.size).to.equal(0);
          });
        });
      });

      it("###TODO");
    });
  });
});

