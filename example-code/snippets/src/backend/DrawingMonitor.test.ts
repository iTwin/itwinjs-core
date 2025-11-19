/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { StandaloneDb } from "@itwin/core-backend";
import { IModelTestUtils } from "./IModelTestUtils";
import { expect } from "chai";
import { createDrawingMonitor, DrawingMonitor, DrawingMonitorCreateArgs, DrawingUpdates } from "./DrawingMonitor";
import { Id64Set } from "@itwin/core-bentley";

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

  async function test(updateDelay: number, func: (monitor: DrawingMonitor) => Promise<void>): Promise<void> {
    const monitor = createDrawingMonitor({
      updateDelay,
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
      describe("on change detected", () => {
        it("=> Delayed if delay is defined", async () => {

        });

        it("=> Requested if no delay and any drawings need regeneration", async () => {

        });

        it("=> Cached if no delay and no drawings require regeneration", async () => {

        });
      });

      describe("on terminated", () => {
        it("=> Terminated", async () => {
          await test(100, async (mon) => {
            expect(mon.stateName).to.equal("Idle");
            mon.terminate();
            expect(mon.stateName).to.equal("Terminated");
          });
        });
      });
    })
  });
});
