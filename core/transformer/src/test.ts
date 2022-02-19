/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ElementRefersToElements, IModelDb, IModelHost, SnapshotDb } from "@itwin/core-backend";
import * as fs from "fs";

/* eslint-disable no-console */

const formatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const COUNT = 1_000_000;

async function rels(sourceDb: IModelDb) {
  const sql = `SELECT ECInstanceId FROM ${ElementRefersToElements.classFullName}`;
  let i = 0;
  for await (const [relInstanceId] of sourceDb.query(sql)) {
    sourceDb.relationships.getInstanceProps(ElementRefersToElements.classFullName, relInstanceId);
    const memUsageGb = process.memoryUsage().rss / 1024 / 1024 / 1024;
    if (i % 10000 === 0) console.log(`${i} iterations, process memory at ${formatter.format(memUsageGb)}GB`);
    ++i;
    if (i >= COUNT) break;
  }
}

async function main() {
  await IModelHost.startup();
  const sourceDb = SnapshotDb.openFile("/home/mike/shell.bim");
  return rels(sourceDb);
}

main().catch(console.error);
