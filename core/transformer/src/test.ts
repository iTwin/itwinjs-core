/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ElementRefersToElements, IModelDb, IModelHost, SnapshotDb } from "@itwin/core-backend";

/* eslint-disable no-console */
/* eslint-disable prefer-template */

const COUNT = 3_000_000;

let lastRss = 0;
let itersBeforeChange = 0;

const fmter = Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function reportMemUsage() {
  const mu = process.memoryUsage();
  itersBeforeChange++;
  const heapSizeChange = mu.rss - lastRss;
  if (itersBeforeChange % 10_000 === 0)
    console.log("iters:" + itersBeforeChange + "; heap: " + fmter.format(mu.rss / 1024 / 1024) + "MB; change: " + heapSizeChange);
  // global.gc();
  lastRss = mu.rss;
}

async function rels(sourceDb: IModelDb) {
  const ids = [];

  {
    const sql = `SELECT ECInstanceId FROM ${ElementRefersToElements.classFullName} LIMIT ${COUNT}`;
    for await (const [relInstanceId] of sourceDb.query(sql)) {
      ids.push(relInstanceId);
      sourceDb.relationships.getInstanceProps(ElementRefersToElements.classFullName, relInstanceId);
      reportMemUsage();
    }
  }

  console.log("finished id query loop, starting gets loop");

  for (const relInstanceId of ids) {
    // const sql = `SELECT * FROM ${ElementRefersToElements.classFullName} WHERE ECInstanceId=?`;
    // const stmt = new IModelHost.platform.ECSqlStatement();
    // stmt.prepare(sourceDb.nativeDb, sql, true);
    // stmt.getBinder(1).bindId(relInstanceId);
    // stmt.step();
    sourceDb.relationships.getInstanceProps(ElementRefersToElements.classFullName, relInstanceId);
    reportMemUsage();
    // it actually garbage collects with this:
    // await new Promise(setImmediate);
  }
  /*
    sourceDb.withPreparedStatement(sql, (stmt) => {
      stmt.bindId(1, relInstanceId);
      stmt.step();
    });
    */
  // sourceDb.relationships.getInstanceProps(ElementRefersToElements.classFullName, relInstanceId);
  // }
}

async function main() {
  await IModelHost.startup();
  const sourceDb = SnapshotDb.openFile("/home/mike/shell.bim");
  return rels(sourceDb);
}

main().catch(console.error);
