/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { StandaloneDb } from "@itwin/core-backend";
import { IModelTestUtils } from "./IModelTestUtils";
import { expect } from "chai";
import { createDrawingMonitor, DrawingMonitor, DrawingUpdates } from "./DrawingMonitor";
import { Id64Set } from "@itwin/core-bentley";

function createFakeTimer() {
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return {
    promise,
    resolve,
    reject,
  };
}

describe.only("DrawingMonitor", () => {
  let db: StandaloneDb;

  before(async () => {
    db = IModelTestUtils.openIModelForWrite("test.bim", { copyFilename: "DrawingMonitor.bim", upgradeStandaloneSchemas: true });
    let bisVer = db.querySchemaVersionNumbers("BisCore")!;
    expect(bisVer.read).to.equal(1);
    expect(bisVer.write).to.equal(0);
    expect(bisVer.minor).least(22);
  });

  after(() => db.close());

  async function computeUpdates(drawingIds: Id64Set): Promise<DrawingUpdates> {
    const map = new Map<string, string>();
    for (const id of drawingIds) {
      map.set(id, id);
    }

    return map;
  }

  async function test(getUpdateDelay: (() => Promise<void>) | undefined, func: (monitor: DrawingMonitor) => Promise<void>): Promise<void> {
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
          expect(mon.stateName).to.equal("Idle");
          mon.fakeGeometryChange();
          expect(mon.stateName).to.equal("Delayed");
        });
      });

      describe("getUpdates", () => {
        it("=> Requested if any drawings require regeneration", async () => {

        });

        it("=> Cached (empty) if no drawings require regeneration", async () => {
          await test(undefined, async (mon) => {
            expect(mon.stateName).to.equal("Idle");
            const promise = mon.getUpdates();
            expect(mon.stateName).to.equal("Cached");
            const results = await promise;
            expect(results.size).to.equal(0);
          })
        });
      });

      it("terminate => Terminated", async () => {
        await test(undefined, async (mon) => {
          expect(mon.stateName).to.equal("Idle");
          mon.terminate();
          expect(mon.stateName).to.equal("Terminated");
        });
      });
    })

    describe("Terminated", () => {
      it("change detected => Terminated", async () => {
        await test(undefined, async (mon) => {
          mon.terminate();
          expect(mon.stateName).to.equal("Terminated");

          mon.fakeGeometryChange();
          expect(mon.stateName).to.equal("Terminated");
        });
      });

      it("getUpdates => Error", async () => {
        await test(undefined, async (mon) => {
          mon.terminate();
          expect(mon.stateName).to.equal("Terminated");

          expect(() => mon.getUpdates()).to.throw();
        });
      });

      it("terminate => Terminated", async () => {
        await test(undefined, async (mon) => {
          mon.terminate();
          expect(mon.stateName).to.equal("Terminated");

          mon.terminate();
          expect(mon.stateName).to.equal("Terminated");
        });
      });
    });

    describe("Delayed", async () => {
      /*
      it("change detected => Delayed (restart)", async () => {
          const timer = createFakeTimer();
          await test(() => , async (mon) => {
            mon.fakeGeometryChange();
            expect(mon.stateName).to.equal("Delayed");
        
            mon.fakeGeometryChange();
            expect(mon.stateName).to.equal("Delayed");

      });
      */

      describe("delay expired", () => {
        it("=> Requested if any drawings require regeneration", async () => {

        });

        it("=> Cached (empty) if no drawings require regeneration", async () => {

        });
      });

      describe("getUpdates", () => {
        it("=> Requested if any drawings require regeneration", async () => {

        });

        it("=> Cached (empty) if no drawings require regeneration", async () => {
          await test(undefined, async (mon) => {
            mon.fakeGeometryChange();
            expect(mon.stateName).to.equal("Delayed");
            const promise = mon.getUpdates();
            expect(mon.stateName).to.equal("Cached");
            const results = await promise;
            expect(results.size).to.equal(0);
          });
        });
      });

      it("terminate => Terminated", async () => {
        await test(undefined, async (mon) => {
          mon.fakeGeometryChange();
          expect(mon.stateName).to.equal("Delayed");
          mon.terminate();
          expect(mon.stateName).to.equal("Terminated");
        });
      });
    });

    describe("Requested", async () => {

    });

    describe("Cached", async () => {

    });
  });
});
