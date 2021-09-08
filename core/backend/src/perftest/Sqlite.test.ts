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
import { ChildProcess } from "child_process";
import { BlobCacheProps, BlobContainerProps, BlobDaemon, DaemonProps } from "@bentley/imodeljs-native";
import { IModelJsFs } from "../IModelJsFs";
import { Guid } from "../../../bentley/lib/Id";

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
async function createSeedFile(pathName: string, tbl: string, nCols: number, nRows: number, startId: number, bcvOpts?: {secure: boolean, auth: string}) {
  const kMaxLengthOfString = 11;
  await using(new ECDb(), async (ecdb) => {
    if (bcvOpts !== undefined) {
      ecdb.createDb(`file:///${pathName}?bcv_secure=${bcvOpts.secure ? "1" : "0"}&bcv_auth=${encodeURIComponent(bcvOpts.auth)}`);
    } else ecdb.createDb(pathName);
    const cols = [];
    for (let i = 0; i < nCols; i++) {
      cols.push(`[c${i}]`);
    }
    const sp = new StopWatch(undefined, true);
    console.log(`Creating seed file ... ${pathName}\n`);
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
    console.log(`Completed in ${sp.elapsedSeconds} sec\n`);
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
  // process.stdout.write(`took ${sp.elapsedSeconds} sec\n`);
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
  bcvOpts?: {
    secure: boolean;
    auth: string;
    checkpointProps: BlobCacheProps & BlobContainerProps;
  };
  passwordProtect?: boolean;
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
async function initializeContainer(checkpointProps: BlobContainerProps & BlobCacheProps, baseFile: string) {
  const props = {
    ...checkpointProps,
    dbAlias: "base.chkpt",
    localFile: baseFile,
  };
  await BlobDaemon.command("create", props);
  await BlobDaemon.command("upload", props);
}
async function runReadTest(param: ReadParams) {
  param.testFolder = param.testFolder || param.seedFolder;
  const testTableName = "foo";
  const seedFileName = `read_test_${param.seedRowCount}_${param.columnsCount}.ecdb`;
  const testFile = `read_test_${param.seedRowCount}_${param.columnsCount}_run.ecdb`;
  const seedFilePath = path.join(param.seedFolder, seedFileName);
  let testFilepath = path.join(param.testFolder, testFile);
  const report = path.join(param.seedFolder, "report.csv");
  if (!fs.existsSync(param.seedFolder))
    fs.mkdirSync(param.seedFolder, { recursive: true });
  if (!fs.existsSync(param.testFolder))
    fs.mkdirSync(param.testFolder, { recursive: true });
  if (!fs.existsSync(seedFilePath)) {
    await createSeedFile(seedFilePath, testTableName, param.columnsCount, param.seedRowCount, param.startId, param.bcvOpts);
    if (fs.existsSync(testFilepath))
      fs.unlinkSync(testFilepath);
  }
  if (!fs.existsSync(testFilepath))
    fs.copyFileSync(seedFilePath, testFilepath);

  changePageSize(testFilepath, param.pageSizeInKb);
  // Create a container and upload it to azurite.
  if (param.bcvOpts !== undefined) {
    await initializeContainer(param.bcvOpts.checkpointProps, testFilepath);
    testFilepath = path.join(param.bcvOpts.checkpointProps.daemonDir!, param.bcvOpts.checkpointProps.container, "base.chkpt");
  }
  if (param.passwordProtect === true)
    IModelHost.platform.DgnDb.encryptDb(testFilepath, {password: "password"});
  let r = 0;
  const result: number[] = [];
  while (r++ < param.runCount) {
    // process.stdout.write(`Run ... [${r}/${param.runCount}] `);
    await using(new ECDb(), async (ecdb: ECDb) => {
      if (param.bcvOpts !== undefined) {
        ecdb.openDb(`file:///${testFilepath}?bcv_secure=${param.bcvOpts.secure ? "1" : "0"}&bcv_auth=${encodeURIComponent(param.bcvOpts.auth)}`, ECDbOpenMode.Readonly);
      } else if (param.passwordProtect === true) {
        ecdb.openDb(testFilepath, ECDbOpenMode.Readonly, "password");
      } else ecdb.openDb(testFilepath, ECDbOpenMode.Readonly);
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
  console.log(`\nAvg Time:${avg.toFixed(4)} sec, stddev:${stddev.toFixed(4)}\n`);
  if (!fs.existsSync(report))
    fs.appendFileSync(report, "test dir, runs, page size, avg time elapsed (sec), std-dev\r\n");
  fs.appendFileSync(report, `${param.testFolder}, ${param.runCount}, ${param.pageSizeInKb}K, ${avg.toFixed(4)}, ${stddev.toFixed(4)}\r\n`);
}
/* This test suite require configuring dataset path
**/
async function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
describe.skip("SQLitePerformanceTest", () => {
  it("Read Test", async () => {
    const seedDir = path.join(KnownTestLocations.outputDir, "perf_test");
    const pageSizes = [4096 /* 1, 4, 8, 16, 32, 64, 128, 256, 512 */];
    const targets = ["C:\\test" /* "F:\\test", "Y:\\test", "Z:\\test"*/];
    await sleep(20000);
    for (const targetFolder of targets) {
      for (const pageSize of pageSizes) {
        await runReadTest({
          runCount: 1000,
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
  it.skip("Read Test Password Protected db", async () => {
    const seedDir = path.join(KnownTestLocations.outputDir, "perf_test");
    await sleep(20000);
    const pageSizes = [4096 /* 1, 4, 8, 16, 32, 64, 128, 256, 512 */];
    const targets = ["C:\\test" /* "F:\\test", "Y:\\test", "Z:\\test"*/];
    for (const targetFolder of targets) {
      for (const pageSize of pageSizes) {
        await runReadTest({
          runCount: 1000,
          seedRowCount: 50000,
          columnsCount: 20,
          startId: 1,
          percentageOfRowsToRead: 50,
          probabilityOfConsecutiveReads: 0.3,
          seedFolder: seedDir,
          testFolder: targetFolder,
          pageSizeInKb: pageSize,
          passwordProtect: true,
        });
      }
    }
  });
});

describe.only("SQLiteBlockcachePerformanceTest", () => {
  const azureStorageUser = "devstoreaccount1";
  const azureStorageKey = "Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw=="; // default Azurite password
  const daemonDir = path.resolve(__dirname, "blob-daemon");
  const storageType = "azure?emulator=127.0.0.1:10000&sas=0";
  const checkpointProps = {
    user: "devstoreaccount1",
    container: `imodelblocks-${Guid.createValue()}`,
    storageType,
    auth: azureStorageKey,
    writeable: true,
    daemonDir,
  };
  let daemonExitedPromise: Promise<void>;
  let daemon: ChildProcess;
  // let checkpointProps: BlobCacheProps & BlobContainerProps;
  it.skip("Read Test Blockcache Unencrypted", async () => {
    const seedDir = path.join(KnownTestLocations.outputDir, "perf_test");
    daemon = await startDaemon();
    process.stdout.write("Sleeping for 20 seconds");
    // await sleep(20000);
    const pageSizes = [4096 /* 1, 4, 8, 16, 32, 64, 128, 256, 512 */];
    const targets = ["C:\\test" /* "F:\\test", "Y:\\test", "Z:\\test"*/];
    for (const targetFolder of targets) {
      for (const pageSize of pageSizes) {
        await runReadTest({
          runCount: 1000,
          seedRowCount: 50000,
          columnsCount: 20,
          startId: 1,
          percentageOfRowsToRead: 50,
          probabilityOfConsecutiveReads: 0.3,
          seedFolder: seedDir,
          testFolder: targetFolder,
          pageSizeInKb: pageSize,
          bcvOpts: {
            secure: false,
            auth: azureStorageKey,
            checkpointProps,
          },
        });
      }
    }
    await cleanupDaemon();
  });
  it.only("Read Test Blockcache Encrypted", async () => {
    const seedDir = path.join(KnownTestLocations.outputDir, "perf_test");
    // await askQuestion("push key to continue");
    daemon = await startDaemon();
    // process.stdout.write("Sleeping for 20 seconds");
    await sleep(20000);
    const pageSizes = [4096 /* 1, 4, 8, 16, 32, 64, 128, 256, 512 */];
    const targets = ["C:\\test" /* "F:\\test", "Y:\\test", "Z:\\test"*/];
    for (const targetFolder of targets) {
      for (const pageSize of pageSizes) {
        await runReadTest({
          runCount: 1000,
          seedRowCount: 50000,
          columnsCount: 20,
          startId: 1,
          percentageOfRowsToRead: 50,
          probabilityOfConsecutiveReads: 0.3,
          seedFolder: seedDir,
          testFolder: targetFolder,
          pageSizeInKb: pageSize,
          bcvOpts: {
            secure: true,
            auth: azureStorageKey,
            checkpointProps,
          },
        });
      }
    }
    await cleanupDaemon();
  });

  async function startDaemon(): Promise<ChildProcess> {
    const cacheProps: BlobCacheProps = {
      user: azureStorageUser,
      storageType,
      daemonDir,
    };
    const daemonProps: DaemonProps = {
      log: "meh", // message, event, http
      maxCacheSize: "10G",
      gcTime: 600,
      pollTime: 600,
      lazy: true,
      addr: "127.0.0.1",
      portNumber: 2030,
      // NOTE: On windows you may want to pass the below option:
      spawnOptions: { stdio: "ignore"}, // On windows, using the default stdio of "pipe" causes a clash between daemon and backend client when logging is enabled.
    };

    if (os.platform() === "linux") {
      fs.chmodSync(path.join(path.dirname(require.resolve("@bentley/imodeljs-native")), "imodeljs-linux-x64", "BeBlobDaemon"), "755");
    }

    // startup daemon
    // noNonce true should be faster
    daemon = BlobDaemon.start({ ...daemonProps, ...cacheProps, noNonce: true });
    daemonExitedPromise = new Promise((resolve) => {
      daemon.on("exit", () => {
        resolve();
      });
    });
    return daemon;
  }
  async function cleanupDaemon() {
    // shutdown daemon
    daemon.kill("SIGKILL");
    await daemonExitedPromise;
    IModelJsFs.removeSync(daemonDir);
  }
});
