/* eslint-disable prefer-template */
/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ElementRefersToElements, IModelDb, IModelHost, SnapshotDb } from "@itwin/core-backend";

/* eslint-disable no-console */

const formatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const COUNT = 100_000;

function reportMemUsage(i: number) {
  if (i % 10000 !== 0) return;
  const memUsageGb = process.memoryUsage().rss / 1024 / 1024 / 1024;
  const memUsageGbFmt = formatter.format(memUsageGb) + "GB";
  console.log(String(i) + " iterations, process memory at " + memUsageGbFmt);
}

async function rels(sourceDb: IModelDb) {
  const sql = `SELECT ECInstanceId FROM ${ElementRefersToElements.classFullName}`;
  let i = 0;

  const iter = sourceDb.query(sql);
  let iterVal = await iter.next();
  const ids = [];

  // for await (const [relInstanceId] of sourceDb.query(sql)) {
  while (!iterVal.done && i <= COUNT) {
    ids.push(iterVal.value[0]);
    reportMemUsage(i);
    ++i;
    iterVal = await iter.next();
  }

  console.log("finished id query loop, starting gets loop");

  i = 0;
  for (const relInstanceId of ids) {
    sourceDb.relationships.getInstanceProps(ElementRefersToElements.classFullName, relInstanceId);
    reportMemUsage(i);
    ++i;
    // it actually garbage collects with this:
    // await new Promise(setImmediate);
  }
}

async function main() {
  await IModelHost.startup();
  const sourceDb = SnapshotDb.openFile("/home/mike/shell.bim");
  return rels(sourceDb);
}

main().catch(console.error);
