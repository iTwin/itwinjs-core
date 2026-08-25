/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import * as fs from "fs";
import * as path from "path";
// @ts-expect-error node:sqlite is available in Node 22, but this package's typings also support Node 20.
import { DatabaseSync } from "node:sqlite";
import { DbResult, StopWatch } from "@itwin/core-bentley";
import { ECDb, ECDbOpenMode, ECSqlStatement, ECSqlWriteStatement, IModelHost } from "../../core-backend";
import { KnownTestLocations } from "../KnownTestLocations";

interface MemberForce {
  classFullName: "STAADPlusAnlResult.MemberForce";
  objectId: string;
  physicalId: string;
  loadCaseComboId: string;
  distanceFromStartPhysical: number;
  distanceFromStartAnalytical: number;
  force: {
    fx: number;
    fy: number;
    fz: number;
    mx: number;
    my: number;
    mz: number;
  };
  analyticalId: string;
}

interface Timing {
  key: "raw" | "bulk" | "bulk-flat" | "bulk-rows" | "ecsql";
  approach: string;
  elapsedMs: number;
}

const inputDir = process.env.ECDB_RAW_PERF_DIR ?? "/Users/affan.khan/Downloads/ECDBRaw";
const csvPath = path.join(inputDir, "test_1000142.csv");
const templateDbPath = path.join(inputDir, "SpResults.ecdb");
const tableName = "stdpanlres_MemberForce";
const ecClassName = "stdpanlres.MemberForce";
const bulkPropertyNames = [
  "ObjectId", "PhysicalId", "LoadCaseComboId", "DistanceFromStartPhysical", "DistanceFromStartAnalytical",
  "Force.Fx", "Force.Fy", "Force.Fz", "Force.Mx", "Force.My", "Force.Mz", "AnalyticalId",
];

function readCsv(): MemberForce[] {
  const lines = fs.readFileSync(csvPath, "utf8").trim().split(/\r?\n/);
  return lines.map((line, index) => {
    const columns = line.split(",");
    if (columns.length !== 12)
      throw new Error(`Expected 12 columns in CSV row ${index + 1}, found ${columns.length}`);

    return {
      classFullName: "STAADPlusAnlResult.MemberForce",
      objectId: columns[0],
      physicalId: columns[1],
      loadCaseComboId: columns[2],
      distanceFromStartPhysical: Number(columns[3]),
      distanceFromStartAnalytical: Number(columns[4]),
      force: {
        fx: Number(columns[5]),
        fy: Number(columns[6]),
        fz: Number(columns[7]),
        mx: Number(columns[8]),
        my: Number(columns[9]),
        mz: Number(columns[10]),
      },
      analyticalId: columns[11],
    };
  });
}

function prepareDb(outputDir: string, fileName: string): string {
  const dbPath = path.join(outputDir, fileName);
  fs.rmSync(`${dbPath}-shm`, { force: true });
  fs.rmSync(`${dbPath}-wal`, { force: true });
  fs.copyFileSync(templateDbPath, dbPath);
  return dbPath;
}

function insertRaw(dbPath: string, records: MemberForce[]): number {
  const db = new DatabaseSync(dbPath);
  try {
    const columns = [
      "ObjectId", "PhysicalId", "LoadCaseComboId", "DistanceFromStartPhysical", "DistanceFromStartAnalytical",
      "Force_Fx", "Force_Fy", "Force_Fz", "Force_Mx", "Force_My", "Force_Mz", "AnalyticalId",
    ];
    const insert = db.prepare(`INSERT INTO ${tableName} (${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")})`);
    const sw = new StopWatch(undefined, true);
    db.exec("BEGIN TRANSACTION");
    try {
      for (const record of records) {
        insert.run(
          record.objectId,
          record.physicalId,
          record.loadCaseComboId,
          record.distanceFromStartPhysical,
          record.distanceFromStartAnalytical,
          record.force.fx,
          record.force.fy,
          record.force.fz,
          record.force.mx,
          record.force.my,
          record.force.mz,
          record.analyticalId,
        );
      }
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
    const elapsedMs = sw.stop().milliseconds;
    assert.equal(Number(db.prepare(`SELECT COUNT(*) count FROM ${tableName}`).get().count), records.length);
    return elapsedMs;
  } finally {
    db.close();
  }
}

function openECDb(dbPath: string): ECDb {
  const db = new ECDb();
  db.openDb(dbPath, ECDbOpenMode.ReadWrite);
  return db;
}

function countRows(db: ECDb): number {
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  return db.withPreparedStatement(`SELECT COUNT(*) FROM ${ecClassName}`, (stmt: ECSqlStatement) => {
    assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
    return stmt.getValue(0).getInteger();
  });
}

function insertBulk(dbPath: string, records: MemberForce[]): number {
  using db = openECDb(dbPath);
  const rows = records.map((record) => [
    record.objectId,
    record.physicalId,
    record.loadCaseComboId,
    record.distanceFromStartPhysical,
    record.distanceFromStartAnalytical,
    record.force.fx,
    record.force.fy,
    record.force.fz,
    record.force.mx,
    record.force.my,
    record.force.mz,
    record.analyticalId,
  ]);
  const sw = new StopWatch(undefined, true);
  const inserted = db.bulkInsertInstances(ecClassName, bulkPropertyNames, rows, { returnIds: false });
  db.saveChanges();
  const elapsedMs = sw.stop().milliseconds;
  assert.equal(inserted, records.length);
  assert.equal(countRows(db), records.length);
  return elapsedMs;
}

function insertWithWriteStatement(dbPath: string, records: MemberForce[]): number {
  using db = openECDb(dbPath);
  const ecsql = `INSERT INTO ${ecClassName}(
    ObjectId, PhysicalId, LoadCaseComboId, DistanceFromStartPhysical, DistanceFromStartAnalytical,
    Force.Fx, Force.Fy, Force.Fz, Force.Mx, Force.My, Force.Mz, AnalyticalId
  ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`;
  const sw = new StopWatch(undefined, true);
  db.withCachedWriteStatement(ecsql, (stmt: ECSqlWriteStatement) => {
    for (const record of records) {
      stmt.bindString(1, record.objectId);
      stmt.bindString(2, record.physicalId);
      stmt.bindString(3, record.loadCaseComboId);
      stmt.bindDouble(4, record.distanceFromStartPhysical);
      stmt.bindDouble(5, record.distanceFromStartAnalytical);
      stmt.bindDouble(6, record.force.fx);
      stmt.bindDouble(7, record.force.fy);
      stmt.bindDouble(8, record.force.fz);
      stmt.bindDouble(9, record.force.mx);
      stmt.bindDouble(10, record.force.my);
      stmt.bindDouble(11, record.force.mz);
      stmt.bindString(12, record.analyticalId);
      const result = stmt.stepForInsert();
      if (result.status !== DbResult.BE_SQLITE_DONE)
        throw new Error(`ECSqlWriteStatement insert failed with status ${result.status}`);
      stmt.reset();
      stmt.clearBindings();
    }
  });
  db.saveChanges();
  const elapsedMs = sw.stop().milliseconds;
  assert.equal(countRows(db), records.length);
  return elapsedMs;
}

describe("ECDbRawPerformance", () => {
  let hostStarted = false;

  before(async function () {
    if (!fs.existsSync(csvPath) || !fs.existsSync(templateDbPath))
      this.skip();
    await IModelHost.startup();
    hostStarted = true;
  });

  after(async () => {
    if (hostStarted)
      await IModelHost.shutdown();
  });

  it("returns ids and rolls back the positional batch when a row is invalid", () => {
    const outputDir = path.join(KnownTestLocations.outputDir, "ECDbRawPerformance");
    fs.mkdirSync(outputDir, { recursive: true });
    const records = readCsv().slice(0, 2);
    const rows = records.map((record) => [
      record.objectId, record.physicalId, record.loadCaseComboId,
      record.distanceFromStartPhysical, record.distanceFromStartAnalytical,
      record.force.fx, record.force.fy, record.force.fz,
      record.force.mx, record.force.my, record.force.mz, record.analyticalId,
    ]);

    using db = openECDb(prepareDb(outputDir, "bulk-rows-correctness.ecdb"));
    const ids = db.bulkInsertInstances(ecClassName, bulkPropertyNames, rows);
    if (!Array.isArray(ids))
      assert.fail("Expected inserted instance ids");
    assert.lengthOf(ids, 2);
    db.saveChanges();
    assert.equal(countRows(db), 2);

    assert.throws(() => db.bulkInsertInstances(ecClassName, bulkPropertyNames, [rows[0], rows[1].slice(1)]));
    assert.equal(countRows(db), 2);
  });

  it("compares raw SQLite, ECDb bulk insert, and ECSqlWriteStatement using the same CSV", function () {
    this.timeout(0);
    const outputDir = path.join(KnownTestLocations.outputDir, "ECDbRawPerformance");
    fs.mkdirSync(outputDir, { recursive: true });

    const readTimer = new StopWatch(undefined, true);
    const records = readCsv();
    const readMs = readTimer.stop().milliseconds;
    const selectedApproach = process.env.ECDB_RAW_PERF_APPROACH;
    const approaches: Array<Omit<Timing, "elapsedMs"> & { run: () => number }> = [
      {
        key: "raw",
        approach: "Raw SQLite",
        run: () => insertRaw(prepareDb(outputDir, "raw.ecdb"), records),
      },
      {
        key: "bulk",
        approach: "ECDb bulk (positional rows)",
        run: () => insertBulk(prepareDb(outputDir, "bulk.ecdb"), records),
      },
      {
        key: "ecsql",
        approach: "ECSqlWriteStatement",
        run: () => insertWithWriteStatement(prepareDb(outputDir, "ecsql.ecdb"), records),
      },
    ];
    const timings = approaches
      .filter(({ key }) => selectedApproach === undefined || selectedApproach === key)
      .map(({ key, approach, run }) => ({ key, approach, elapsedMs: run() }));
    assert.isNotEmpty(timings, `Unknown ECDB_RAW_PERF_APPROACH '${selectedApproach}'`);

    const rawMs = timings.find(({ key }) => key === "raw")?.elapsedMs;
    const statementMs = timings.find(({ key }) => key === "ecsql")?.elapsedMs;
    // eslint-disable-next-line no-console
    console.log(`\nRead and parsed ${records.length.toLocaleString()} CSV rows in ${(readMs / 1000).toFixed(3)}s`);
    // eslint-disable-next-line no-console
    console.table(timings.map(({ approach, elapsedMs }) => ({
      approach,
      seconds: Number((elapsedMs / 1000).toFixed(3)),
      rowsPerSecond: Math.round(records.length / (elapsedMs / 1000)),
      versusRaw: rawMs === undefined ? undefined : Number((rawMs / elapsedMs).toFixed(2)),
      versusECSql: statementMs === undefined ? undefined : Number((statementMs / elapsedMs).toFixed(2)),
    })));
  });
});
