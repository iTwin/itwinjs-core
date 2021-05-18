/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as readline from "readline";
import { DbResult, StopWatch, using } from "@bentley/bentleyjs-core";
import { ECDb, ECDbOpenMode } from "../ECDb";
import { IModelHost } from "../IModelHost";
import { SqliteStatement } from "../SqliteStatement";
import { IModelTestUtils } from "../test/IModelTestUtils";
import { KnownTestLocations } from "../test/KnownTestLocations";

IModelTestUtils.init();
function makeRandStr(length: number) {
  let text = "";
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  for (let i = 0; i < length; i++)
    text += possible.charAt(Math.floor(Math.random() * possible.length));

  return text;
}
async function reportProgress(prefix: string, c: number, m: number) {
  readline.moveCursor(process.stdout, -(prefix.length + 20), 0);
  process.stdout.write(`${prefix} ${((c / m) * 100).toFixed(2)}%`);
  if (c === m) {
    process.stdout.write(os.EOL);
  }
}
async function createSeedFile(pathName: string, tbl: string, nCols: number, nRows: number, startId: number) {
  const kMaxLengthOfString = 11;
  await using(new ECDb(), async (ecdb) => {
    ecdb.createDb(pathName);
    const cols = [];
    for (let i = 0; i < nCols; i++) {
      cols.push(`[c${i}]`);
    }
    const sp = new StopWatch(undefined, true);
    process.stdout.write(`Creating seed file ... ${pathName}\n`);
    ecdb.withPreparedSqliteStatement(`create table [${tbl}](id integer primary key,${cols.join(",")});`, (stmt) => stmt.step());
    await using(ecdb.prepareSqliteStatement(`insert into ${tbl} values(?${",?".repeat(nCols)});`), async (stmt: SqliteStatement) => {
      for (let i = 0; i < nRows; i++) {
        stmt.reset();
        stmt.clearBindings();
        stmt.bindValue(1, startId + i);
        for (let j = 2; j < nCols; j++) {
          const randStr = makeRandStr(Math.round(Math.random() * kMaxLengthOfString + 1));
          stmt.bindValue(j, randStr);
        }
        stmt.step();
        await reportProgress("Generating seed file ...", i + 1, nRows);
      }
    });
    ecdb.saveChanges();
    sp.stop();
    process.stdout.write(`Completed in ${sp.elapsedSeconds} sec\n`);
  });
}
async function readRow(stmt: SqliteStatement, id: number, nParam: number = 1): Promise<boolean> {
  stmt.reset();
  stmt.clearBindings();
  stmt.bindValue(nParam, id);
  return stmt.step() === DbResult.BE_SQLITE_ROW && stmt.getValue(0).getInteger() === id;
}

async function simulateRowRead(stmt: SqliteStatement, probabiltyOfConsectiveReads: number, percentageOfRowToRead: number, startId: number, endId: number) {
  const nRows = endId - startId;
  const rowsToBeRead = Math.round((percentageOfRowToRead / 100) * nRows);
  let rowReadSoFar = 0;
  let nextRowToRead = 0;
  const sp = new StopWatch(undefined, true);
  do {
    if (await readRow(stmt, nextRowToRead))
      rowReadSoFar++;
    if (probabiltyOfConsectiveReads < Math.random()) {
      nextRowToRead++;
      while (nextRowToRead >= endId)
        nextRowToRead = startId;
    } else {
      nextRowToRead = Math.round(Math.random() * nRows) + startId;
    }
    rowReadSoFar++;
  } while (rowReadSoFar < rowsToBeRead);
  sp.stop();
  process.stdout.write(`took ${sp.elapsedSeconds} sec\n`);
  return sp.elapsedSeconds;
}

function changePageSize(iModelPath: string, pageSizeInKb: number) {
  const sp = new StopWatch(undefined, true);
  const pageSize = using(new ECDb(), (ecdb: ECDb) => {
    ecdb.openDb(iModelPath, ECDbOpenMode.ReadWrite);
    if (!ecdb.isOpen)
      throw new Error(`changePageSize() fail to open file ${iModelPath}`);
    return ecdb.withPreparedSqliteStatement(`PRAGMA page_size`, (stmt) => {
      if (DbResult.BE_SQLITE_ROW !== stmt.step())
        throw new Error(`changePageSize() fail to change page size to ${pageSizeInKb} Kb for ${iModelPath}`);
      return stmt.getValue(0).getInteger();
    });
  });

  IModelHost.platform.DgnDb.vacuum(iModelPath, pageSize === pageSizeInKb * 1024 ? undefined : pageSizeInKb * 1024);
  sp.stop();
  process.stdout.write(`Change vacuum with page size to ${pageSizeInKb}K took ${sp.elapsedSeconds} sec\n`);

}

interface ReadParams {
  runCount: number;
  seedRowCount: number;
  columnsCount: number;
  startId: number;
  percentageOfRowsToRead: number;
  probabilityOfConsecutiveReads: number;
  seedFolder: string;
  testFolder?: string;
  pageSizeInKb: number;
}
function standardDeviation(values: number[]) {
  const avg = average(values);
  const squareDiffs = values.map((value) => {
    const diff = value - avg;
    const sqrDiff = diff * diff;
    return sqrDiff;
  });

  const avgSquareDiff = average(squareDiffs);

  const stdDev = Math.sqrt(avgSquareDiff);
  return stdDev;
}

function average(data: number[]) {
  const sum = data.reduce((sum0, value) => {
    return sum0 + value;
  }, 0);

  const avg = sum / data.length;
  return avg;
}
async function runReadTest(param: ReadParams) {
  param.testFolder = param.testFolder || param.seedFolder;
  const testTableName = "foo";
  const seedFileName = `read_test_${param.seedRowCount}_${param.columnsCount}.ecdb`;
  const testFile = `read_test_${param.seedRowCount}_${param.columnsCount}_run.ecdb`;
  const seedFilePath = path.join(param.seedFolder, seedFileName);
  const testFilepath = path.join(param.testFolder, testFile);
  const report = path.join(param.seedFolder, "report.csv");
  if (!fs.existsSync(param.seedFolder))
    fs.mkdirSync(param.seedFolder, { recursive: true });
  if (!fs.existsSync(param.testFolder))
    fs.mkdirSync(param.testFolder, { recursive: true });
  if (!fs.existsSync(seedFilePath)) {
    await createSeedFile(seedFilePath, testTableName, param.columnsCount, param.seedRowCount, param.startId);
    if (fs.existsSync(testFilepath))
      fs.unlinkSync(testFilepath);
  }
  if (!fs.existsSync(testFilepath))
    fs.copyFileSync(seedFilePath, testFilepath);

  changePageSize(testFilepath, param.pageSizeInKb);
  let r = 0;
  const result: number[] = [];
  while (r++ < param.runCount) {
    process.stdout.write(`Run ... [${r}/${param.runCount}] `);
    await using(new ECDb(), async (ecdb: ECDb) => {
      ecdb.openDb(testFilepath, ECDbOpenMode.Readonly);
      if (!ecdb.isOpen)
        throw new Error(`changePageSize() fail to open file ${testFilepath}`);
      await ecdb.withPreparedSqliteStatement(`select * from ${testTableName} where id=?`, async (stmt: SqliteStatement) => {
        const elapsedTime = await simulateRowRead(stmt, param.probabilityOfConsecutiveReads, param.percentageOfRowsToRead, param.startId, param.startId + param.seedRowCount);
        result.push(elapsedTime);
      });
    });
  }

  const avg = average(result);
  const stddev = standardDeviation(result);
  process.stdout.write(`\nAvg Time:${avg.toFixed(4)} sec, stddev:${stddev.toFixed(4)}\n`);
  if (!fs.existsSync(report))
    fs.appendFileSync(report, "test dir, runs, page size, avg time elapsed (sec), std-dev\r\n");
  fs.appendFileSync(report, `${param.testFolder}, ${param.runCount}, ${param.pageSizeInKb}K, ${avg.toFixed(4)}, ${stddev.toFixed(4)}\r\n`);
}
/* This test suite require configuring dataset path
**/
describe.skip("SQLite performance test", () => {
  it("Read Test", async () => {
    const seedDir = path.join(KnownTestLocations.outputDir, "perf_test");
    const pageSizes = [1, 4 /* , 8, 16, 32, 64, 128, 256, 512 */];
    const targets = ["C:\\test", "F:\\test", "Y:\\test", "Z:\\test"];
    for (const targetFolder of targets) {
      for (const pageSize of pageSizes) {
        await runReadTest({
          runCount: 1,
          seedRowCount: 50000,
          columnsCount: 20,
          startId: 1,
          percentageOfRowsToRead: 50,
          probabilityOfConsecutiveReads: 0.3,
          seedFolder: seedDir,
          testFolder: targetFolder,
          pageSizeInKb: pageSize,
        });
      }
    }
  });
});
