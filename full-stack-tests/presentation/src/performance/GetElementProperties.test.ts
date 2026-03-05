/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/* eslint-disable no-console */

import { expect } from "chai";
import * as fs from "fs";
import { availableParallelism } from "node:os";
import { join } from "path";
import { IModelHost, SnapshotDb } from "@itwin/core-backend";
import { Id64String, StopWatch } from "@itwin/core-bentley";
import { Presentation } from "@itwin/presentation-backend";
import { DiagnosticsLogEntry } from "@itwin/presentation-common";

describe("#performance Element properties loading", () => {
  let imodel: SnapshotDb;
  let testIModelName: string;

  before(async () => {
    if (!process.env.TEST_IMODEL) {
      throw new Error("The test requires tested imodel path to be set through TEST_IMODEL environment variable");
    }
    if (!fs.existsSync(process.env.TEST_IMODEL)) {
      throw new Error(`Test imodel path is set, but the file does not exist (TEST_IMODEL = ${process.env.TEST_IMODEL})`);
    }
    testIModelName = process.env.TEST_IMODEL;

    await IModelHost.startup({ cacheDir: join(import.meta.dirname, ".cache") });
    Presentation.initialize({
      useMmap: true,
      workerThreadsCount: availableParallelism(),
    });
  });

  after(async () => {
    await IModelHost.shutdown();
    Presentation.terminate();
  });

  beforeEach(() => {
    imodel = SnapshotDb.openFile(testIModelName);
    expect(imodel).is.not.null;
  });

  afterEach(() => {
    imodel.close();
  });

  it("load properties using 'getElementProperties' with element class name", async function () {
    const timer = new StopWatch(undefined, true);
    const itemIds = new Set<Id64String>();
    const { total, iterator } = await Presentation.getManager().getElementProperties({
      imodel,
      elementClasses: ["BisCore.GeometricElement"],
      batchSize: 1000,
      diagnostics: {
        perf: { minimumDuration: 500 },
        handler: (d) => handleLogs(d.logs),
      },
    });
    console.log(`Loading properties for ${total} elements...`);
    for await (const items of iterator()) {
      items.forEach((item) => itemIds.add(item.id));
      console.log(`Got ${itemIds.size} items. Elapsed: ${timer.currentSeconds} s., Speed: ${(itemIds.size / timer.currentSeconds).toFixed(2)} el./s.`);
    }
    expect(itemIds.size).to.eq(total);
    console.log(`Loaded ${itemIds.size} elements properties in ${timer.currentSeconds.toFixed(2)} s`);
  });

  it("load properties using 'getElementProperties' with element ids", async function () {
    const elementIds = new Array<Id64String>();
    for await (const row of imodel.createQueryReader(`SELECT IdToHex(ECInstanceId) id FROM BisCore.GeometricElement`)) {
      elementIds.push(row.id);
    }
    console.log(`Created an array of ${elementIds.length} elements ids`);

    const timer = new StopWatch(undefined, true);
    const itemIds = new Set<Id64String>();
    const { total, iterator } = await Presentation.getManager().getElementProperties({
      imodel,
      elementIds,
      batchSize: 1000,
      diagnostics: {
        perf: { minimumDuration: 500 },
        handler: (d) => handleLogs(d.logs),
      },
    });
    console.log(`Loading properties for ${total} elements...`);
    for await (const items of iterator()) {
      items.forEach((item) => itemIds.add(item.id));
      console.log(`Got ${itemIds.size} items. Elapsed: ${timer.currentSeconds} s., Speed: ${(itemIds.size / timer.currentSeconds).toFixed(2)} el./s.`);
    }
    expect(itemIds.size).to.eq(total);
    console.log(`Loaded ${itemIds.size} elements properties in ${timer.currentSeconds.toFixed(2)} s`);
  });
});

function handleLogs(logs: DiagnosticsLogEntry[] | undefined, indent = 0): void {
  if (!logs || !process.env.ENABLE_LOGS) {
    return;
  }
  logs.forEach((log) => {
    if (DiagnosticsLogEntry.isScope(log)) {
      if (log.duration) {
        console.log(`[${log.duration.toFixed(2)} ms] ${" ".repeat(indent * 2)} ${log.scope}`);
        ++indent;
      }
      handleLogs(log.logs, indent);
    }
  });
}
