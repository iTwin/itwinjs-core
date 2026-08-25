/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import * as path from "path";
import { DbResult, Id64String, StopWatch } from "@itwin/core-bentley";
import { Reporter } from "@itwin/perf-tools";
import { ECDb, ECSqlStatement, ECSqlWriteStatement, IModelHost, IModelJsFs } from "@itwin/core-backend";
import { KnownTestLocations } from "@itwin/core-backend/lib/cjs/test/index";

// @ts-expect-error package.json will resolve from the lib/{cjs,esm} dir without copying it into the build output we deliver
// eslint-disable-next-line @itwin/import-within-package
import { version } from "../../../../../core/backend/package.json";

const ITWINJS_CORE_VERSION = version as string;
const CORE_MAJ_MIN = `${ITWINJS_CORE_VERSION.split(".")[0]}.${ITWINJS_CORE_VERSION.split(".")[1]}.x`;

const testSchema = `<ECSchema schemaName="BulkPerf" alias="bp" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
  <ECEntityClass typeName="Item" modifier="Sealed">
    <ECProperty propertyName="Name" typeName="string"/>
    <ECProperty propertyName="Code" typeName="string"/>
    <ECProperty propertyName="Quantity" typeName="int"/>
    <ECProperty propertyName="Weight" typeName="double"/>
    <ECProperty propertyName="Active" typeName="boolean"/>
  </ECEntityClass>
</ECSchema>`;
const propertyNames = ["Name", "Code", "Quantity", "Weight", "Active"];

interface ItemProps {
  classFullName: string;
  name: string;
  code: string;
  quantity: number;
  weight: number;
  active: boolean;
}

function makeItems(count: number): ItemProps[] {
  const items: ItemProps[] = new Array(count);
  for (let i = 0; i < count; ++i) {
    items[i] = {
      classFullName: "BulkPerf.Item",
      name: `Item-${i}`,
      code: `CODE-${`${i}`.padStart(9, "0")}`,
      quantity: i % 1000,
      weight: 1.5 + (i % 97),
      active: 0 === i % 2,
    };
  }
  return items;
}

function ensureDirectoryExists(dir: string) {
  if (!IModelJsFs.existsSync(dir))
    IModelJsFs.mkdirSync(dir);
}

function createEcdb(dir: string, fileName: string): ECDb {
  const filePath = path.join(dir, fileName);
  if (IModelJsFs.existsSync(filePath))
    IModelJsFs.removeSync(filePath);
  const ecdb = new ECDb();
  ecdb.createDb(filePath);
  const schemaPath = path.join(dir, "BulkPerf.ecschema.xml");
  // Always rewrite so a change to `testSchema` is never masked by a stale file from an earlier run.
  IModelJsFs.writeFileSync(schemaPath, testSchema);
  ecdb.importSchema(schemaPath);
  ecdb.saveChanges();
  return ecdb;
}

function countItems(ecdb: ECDb): number {
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  return ecdb.withPreparedStatement("SELECT COUNT(*) FROM bp.Item", (stmt: ECSqlStatement) => {
    assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
    return stmt.getValue(0).getInteger();
  });
}

/** Baseline: the prepare / bind / step / reset loop driven one row at a time from JavaScript. */
function insertWithWriteStatement(ecdb: ECDb, items: ItemProps[]): number {
  const sw = new StopWatch(undefined, true);
  ecdb.withCachedWriteStatement("INSERT INTO bp.Item(Name,Code,Quantity,Weight,Active) VALUES(?,?,?,?,?)", (stmt: ECSqlWriteStatement) => {
    for (const item of items) {
      stmt.bindString(1, item.name);
      stmt.bindString(2, item.code);
      stmt.bindInteger(3, item.quantity);
      stmt.bindDouble(4, item.weight);
      stmt.bindBoolean(5, item.active);
      const res = stmt.stepForInsert();
      assert.equal(res.status, DbResult.BE_SQLITE_DONE);
      stmt.reset();
      stmt.clearBindings();
    }
  });
  ecdb.saveChanges();
  return sw.stop().milliseconds;
}

/** The batched API: the whole set crosses into native in one (or a few) call(s). */
function insertWithBulkApi(ecdb: ECDb, items: ItemProps[], batchSize: number): { elapsed: number, ids: Id64String[] } {
  const rows = items.map((item) => [item.name, item.code, item.quantity, item.weight, item.active]);
  let ids: Id64String[] = [];
  const sw = new StopWatch(undefined, true);
  if (batchSize <= 0) {
    ids = ecdb.bulkInsertInstances("BulkPerf.Item", propertyNames, rows);
  } else {
    for (let i = 0; i < rows.length; i += batchSize) {
      // Note: no `push(...batch)` here - spreading a multi-million element array exceeds the argument limit.
      for (const id of ecdb.bulkInsertInstances("BulkPerf.Item", propertyNames, rows.slice(i, i + batchSize)))
        ids.push(id);
    }
  }
  ecdb.saveChanges();
  return { elapsed: sw.stop().milliseconds, ids };
}

function updateWithWriteStatement(ecdb: ECDb, items: ItemProps[], ids: Id64String[]): number {
  const sw = new StopWatch(undefined, true);
  // Sets every property, because the bulk API is handed whole instances and therefore writes every
  // column. Updating a narrower column set here would not be a like-for-like comparison.
  ecdb.withCachedWriteStatement("UPDATE bp.Item SET Name=?, Code=?, Quantity=?, Weight=?, Active=? WHERE ECInstanceId=?", (stmt: ECSqlWriteStatement) => {
    for (let i = 0; i < ids.length; ++i) {
      stmt.bindString(1, items[i].name);
      stmt.bindString(2, items[i].code);
      stmt.bindInteger(3, i % 7);
      stmt.bindDouble(4, 42.5);
      stmt.bindBoolean(5, items[i].active);
      stmt.bindId(6, ids[i]);
      assert.equal(stmt.step(), DbResult.BE_SQLITE_DONE);
      stmt.reset();
      stmt.clearBindings();
    }
  });
  ecdb.saveChanges();
  return sw.stop().milliseconds;
}

function updateWithBulkApi(ecdb: ECDb, items: ItemProps[], ids: Id64String[], batchSize: number): number {
  const updates = ids.map((id, i) => [id, items[i].name, items[i].code, i % 7, 42.5, items[i].active]);
  const sw = new StopWatch(undefined, true);
  let affected = 0;
  if (batchSize <= 0) {
    affected = ecdb.bulkUpdateInstances("BulkPerf.Item", propertyNames, updates);
  } else {
    for (let i = 0; i < updates.length; i += batchSize)
      affected += ecdb.bulkUpdateInstances("BulkPerf.Item", propertyNames, updates.slice(i, i + batchSize));
  }
  assert.equal(affected, updates.length);
  ecdb.saveChanges();
  return sw.stop().milliseconds;
}

describe("BulkInstanceWritePerformance", () => {
  const outDir: string = path.join(KnownTestLocations.outputDir, "BulkInstanceWritePerformance");
  const reporter = new Reporter();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const config = require(path.join(__dirname, "BulkInstanceWriterConfig.json"));
  const batchSize: number = config.batchSize ?? 0;
  const rowCounts: number[] = process.env.BULK_WRITE_PERF_LARGE
    ? [...config.rowCounts, ...config.largeRowCounts]
    : config.rowCounts;

  before(async () => {
    await IModelHost.startup();
    ensureDirectoryExists(KnownTestLocations.outputDir);
    ensureDirectoryExists(outDir);
  });

  after(async () => {
    reporter.exportCSV(path.join(outDir, "PerformanceResults.csv"));
    await IModelHost.shutdown();
  });

  it("exposes the bulk instance write API surface", () => {
    using ecdb = createEcdb(outDir, "bulkperf_surface.ecdb");
    assert.isTrue(typeof ecdb.bulkInsertInstances === "function");
    assert.isTrue(typeof ecdb.bulkUpdateInstances === "function");
  });

  function report(op: string, approach: string, rows: number, elapsedMs: number) {
    /* eslint-disable @typescript-eslint/naming-convention -- reporter keys become CSV column headers, matching the other perf tests. */
    reporter.addEntry("BulkInstanceWritePerformance", op, "Execution time(s)", elapsedMs / 1000, {
      Approach: approach,
      RowCount: rows,
      RowsPerSecond: Math.round(rows / (elapsedMs / 1000)),
      CoreVersion: CORE_MAJ_MIN,
    });
    /* eslint-enable @typescript-eslint/naming-convention */
    // eslint-disable-next-line no-console
    console.log(`  ${op.padEnd(6)} ${approach.padEnd(20)} rows=${`${rows}`.padStart(8)}  ${(elapsedMs / 1000).toFixed(3)}s  ${Math.round(rows / (elapsedMs / 1000))} rows/s`);
  }

  for (const rows of [1000, 10000, 100000, 1000000]) {
    it(`Insert/Update ${rows} rows: ECSqlWriteStatement vs bulk API`, function () {
      if (!rowCounts.includes(rows))
        this.skip();

      const items = makeItems(rows);

      // ---- baseline: one prepare/bind/step/reset cycle per row ----
      using stmtDb = createEcdb(outDir, `bulkperf_stmt_${rows}.ecdb`);
      const stmtInsertMs = insertWithWriteStatement(stmtDb, items);
      assert.equal(countItems(stmtDb), rows);
      report("Insert", "ECSqlWriteStatement", rows, stmtInsertMs);

      const stmtIds: Id64String[] = [];
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      stmtDb.withPreparedStatement("SELECT ECInstanceId FROM bp.Item", (stmt: ECSqlStatement) => {
        while (stmt.step() === DbResult.BE_SQLITE_ROW)
          stmtIds.push(stmt.getValue(0).getId());
      });

      const stmtUpdateMs = updateWithWriteStatement(stmtDb, items, stmtIds);
      report("Update", "ECSqlWriteStatement", rows, stmtUpdateMs);

      // ---- batched API ----
      using bulkDb = createEcdb(outDir, `bulkperf_bulk_${rows}.ecdb`);
      const { elapsed: bulkInsertMs, ids: bulkIds } = insertWithBulkApi(bulkDb, items, batchSize);
      assert.equal(countItems(bulkDb), rows);
      assert.equal(bulkIds.length, rows);
      report("Insert", "BulkInstanceWrite", rows, bulkInsertMs);

      const bulkUpdateMs = updateWithBulkApi(bulkDb, items, bulkIds, batchSize);
      report("Update", "BulkInstanceWrite", rows, bulkUpdateMs);

      // eslint-disable-next-line no-console
      console.log(`  => speedup insert=${(stmtInsertMs / bulkInsertMs).toFixed(2)}x update=${(stmtUpdateMs / bulkUpdateMs).toFixed(2)}x`);

      // The batched path exists to be faster; a regression below parity is a real failure.
      assert.isBelow(bulkInsertMs, stmtInsertMs, "bulk insert should outperform the per-row statement loop");
    });
  }

  it("batch size sweep: rows per native call vs ECSqlWriteStatement bind/step", function () {
    const rows: number = config.batchSweepRowCount;
    const sizes: number[] = config.batchSizes;
    const repeats: number = config.repeats ?? 3;
    const items = makeItems(rows);

    interface Timing { insert: number, update: number }

    /** Times one full insert/update cycle on a fresh db. `size < 0` selects the statement baseline. */
    const cycle = (tag: string, size: number): Timing => {
      using db = createEcdb(outDir, `bulkperf_sweep_${tag}.ecdb`);
      let ids: Id64String[];
      let insert: number;

      if (size < 0) {
        insert = insertWithWriteStatement(db, items);
        ids = [];
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        db.withPreparedStatement("SELECT ECInstanceId FROM bp.Item", (stmt: ECSqlStatement) => {
          while (stmt.step() === DbResult.BE_SQLITE_ROW)
            ids.push(stmt.getValue(0).getId());
        });
      } else {
        const r = insertWithBulkApi(db, items, size);
        insert = r.elapsed;
        ids = r.ids;
      }
      assert.equal(countItems(db), rows);

      const update = size < 0 ? updateWithWriteStatement(db, items, ids) : updateWithBulkApi(db, items, ids, size);
      return { insert, update };
    };

    /** Minimum of `repeats` runs: the least noise-contaminated estimate of the true cost. */
    const bestOf = (tag: string, size: number): Timing => {
      let best: Timing | undefined;
      for (let i = 0; i < repeats; ++i) {
        const t = cycle(`${tag}_r${i}`, size);
        best = best === undefined ? t : {
          insert: Math.min(best.insert, t.insert),
          update: Math.min(best.update, t.update),
        };
      }
      return best!;
    };

    const base = bestOf("stmt", -1);
    report("Insert", "ECSqlWriteStatement", rows, base.insert);
    report("Update", "ECSqlWriteStatement", rows, base.update);

    /* eslint-disable no-console */
    console.log(`\n  Batch size sweep over ${rows} rows, best of ${repeats} (baseline = ECSqlWriteStatement bind/step per row)`);
    console.log(`  ${"batch".padStart(8)} | ${"insert".padStart(18)} | ${"update".padStart(18)}`);
    console.log(`  ${"-".repeat(8)}-+-${"-".repeat(18)}-+-${"-".repeat(18)}`);
    const asSec = (ms: number) => `${(ms / 1000).toFixed(3)}s`.padStart(18);
    console.log(`  ${"stmt".padStart(8)} | ${asSec(base.insert)} | ${asSec(base.update)}`);

    for (const size of sizes) {
      // A batch larger than the row count is indistinguishable from a single call; skip the duplicate.
      if (size > rows)
        continue;

      const label = 0 === size ? `all` : `${size}`;
      const t = bestOf(`b${label}`, size);

      report("Insert", `BulkInstanceWrite/batch=${label}`, rows, t.insert);
      report("Update", `BulkInstanceWrite/batch=${label}`, rows, t.update);

      const fmt = (ms: number, b: number) => `${(ms / 1000).toFixed(3)}s ${(b / ms).toFixed(2)}x`.padStart(18);
      console.log(`  ${label.padStart(8)} | ${fmt(t.insert, base.insert)} | ${fmt(t.update, base.update)}`);
    }
    console.log("");
    /* eslint-enable no-console */
  });
});
