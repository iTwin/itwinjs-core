/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable @typescript-eslint/no-deprecated -- Uncached preparation and native SQL inspection are required for these measurements. */
import { assert } from "chai";
import { mkdirSync, mkdtempSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import * as path from "node:path";
import { performance } from "node:perf_hooks";
import { DbResult, Id64String } from "@itwin/core-bentley";
import { Code, GeometricElementProps, IModel, SubCategoryAppearance } from "@itwin/core-common";
import { _nativeDb, ECSqlStatement, IModelHost, SnapshotDb, SpatialCategory } from "@itwin/core-backend";
import { IModelTestUtils, KnownTestLocations, withEditTxn } from "@itwin/core-backend/lib/cjs/test/index";
import { Reporter } from "@itwin/perf-tools";

type Mapping = "aligned" | "different";
interface ExpectedRow {
  id: Id64String;
  classId: Id64String;
  ordinal: number;
  numberValue: number | null;
  textValue: string | null;
}
interface Fixture {
  db: SnapshotDb;
  fileName: string;
  mapping: Mapping;
  classCount: number;
  rows: ExpectedRow[];
  storage: { columns: string[], objects: unknown[] };
}
interface Query {
  name: string;
  sql: string;
  params: Array<number | string>;
  propertyless: boolean;
  matches: (row: ExpectedRow) => boolean;
  compare?: (a: ExpectedRow, b: ExpectedRow) => number;
}
interface Sample {
  prepareMs: number;
  firstStepMs: number;
  consumeMs: number;
}
interface Config {
  rowCount: number;
  classCounts: number[];
  compoundSelectLimit: number;
  warmups: number;
  repetitions: number;
}

function readConfig(): Config {
  const config: unknown = JSON.parse(readFileSync(path.join(__dirname, "MixinQueryPerfConfig.json"), "utf8"));
  if (typeof config !== "object" || config === null || !("rowCount" in config) || !("classCounts" in config)
    || !("compoundSelectLimit" in config) || !("warmups" in config) || !("repetitions" in config) || !Array.isArray(config.classCounts))
    throw new Error("Invalid MixinQueryPerfConfig.json");

  function integer(value: unknown): number {
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0)
      throw new Error(`Expected a positive integer in MixinQueryPerfConfig.json, got ${String(value)}`);
    return value;
  }
  const result = {
    rowCount: integer(config.rowCount), classCounts: config.classCounts.map(integer),
    compoundSelectLimit: integer(config.compoundSelectLimit), warmups: integer(config.warmups), repetitions: integer(config.repetitions),
  };
  assert.isNotEmpty(result.classCounts);
  assert.isAtMost(Math.max(...result.classCounts), result.compoundSelectLimit);
  return result;
}

function property(name: string, type = "int"): string {
  return `<ECProperty propertyName="${name}" typeName="${type}"/>`;
}

function schemaXml(classCount: number, mapping: Mapping): string {
  const mixin = (name: string, base: string, props: string) => `
    <ECEntityClass typeName="${name}" modifier="Abstract">
      ${base ? `<BaseClass>${base}</BaseClass>` : ""}
      <ECCustomAttributes><IsMixin xmlns="CoreCustomAttributes.01.00.00">
        <AppliesToEntityClass>bis:Element</AppliesToEntityClass>
      </IsMixin></ECCustomAttributes>${props}
    </ECEntityClass>`;
  const padding = (prefix: string, count: number) => Array.from({ length: count }, (_, i) => property(`${prefix}${i}`)).join("");
  const entity = (name: string, base: string, extraBase: string, props: string, sealed = false) => `
    <ECEntityClass typeName="${name}" modifier="${sealed ? "Sealed" : "Abstract"}">
      <BaseClass>${base}</BaseClass>${extraBase ? `<BaseClass>${extraBase}</BaseClass>` : ""}${props}
    </ECEntityClass>`;

  // PhysicalElement already occupies one of 32 shared slots. Three mixin properties provide
  // C(31,3) distinct layouts without overflow; every leaf has the same 28 NULL padding properties.
  const layouts: Array<[number, number, number]> = [];
  for (let a = 0; a < 29; a++)
    for (let b = a + 1; b < 30; b++)
      for (let c = b + 1; c < 31; c++)
        layouts.push([a, b, c]);
  assert.isAtMost(classCount, layouts.length, "Not enough distinct same-table column layouts");

  const classes = Array.from({ length: classCount }, (_, i) => {
    const [a, b, c] = mapping === "aligned" ? layouts[0] : layouts[Math.floor(i * layouts.length / classCount)];
    return entity(`Pad${i}`, "bis:PhysicalElement", "", padding("A", a))
      + entity(`Num${i}`, `Pad${i}`, "INumber", padding("B", b - a - 1))
      + entity(`Txt${i}`, `Num${i}`, "IText", padding("C", c - b - 1))
      + entity(`Item${i}`, `Txt${i}`, "IValues", padding("D", 30 - c), true);
  }).join("");
  return `<?xml version="1.0" encoding="utf-8"?>
    <ECSchema schemaName="MixinQuery" alias="mq" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
      <ECSchemaReference name="BisCore" version="01.00.00" alias="bis"/>
      <ECSchemaReference name="CoreCustomAttributes" version="01.00.00" alias="cca"/>
      ${mixin("ITag", "", "")}
      ${mixin("INumber", "ITag", property("NumberValue"))}
      ${mixin("IText", "INumber", property("TextValue", "string"))}
      ${mixin("IValues", "IText", property("Ordinal"))}
      ${entity("Control", "bis:PhysicalElement", "", property("NumberValue") + property("TextValue", "string") + property("Ordinal"), true)}
      ${classes}
    </ECSchema>`;
}

function values(ordinal: number) {
  return {
    ordinal,
    numberValue: ordinal % 37 === 0 ? null : (ordinal * 17) % 1000,
    textValue: ordinal % 41 === 0 ? null : `group-${String((ordinal * 13) % 100).padStart(2, "0")}`,
  };
}

async function createFixture(outDir: string, mapping: Mapping, classCount: number, rowCount: number): Promise<Fixture> {
  const fileName = path.join(outDir, `${mapping}-${classCount}-${rowCount}.bim`);
  const db = SnapshotDb.createEmpty(fileName, { rootSubject: { name: "Mixin query performance" } });
  try {
    const schema = schemaXml(classCount, mapping);
    writeFileSync(path.join(outDir, `${mapping}-${classCount}.ecschema.xml`), schema);
    await db.importSchemaStrings([schema]);
    const storage: Fixture["storage"] = { columns: [], objects: [] };
    db.withPreparedSqliteStatement("PRAGMA table_info(bis_GeometricElement3d)", (stmt) => {
      let status: DbResult;
      while ((status = stmt.step()) === DbResult.BE_SQLITE_ROW)
        storage.columns.push(stmt.getValue(1).getString());
      assert.equal(status, DbResult.BE_SQLITE_DONE);
    });
    db.withPreparedSqliteStatement("SELECT name, type, sql FROM sqlite_master WHERE tbl_name='bis_GeometricElement3d' ORDER BY name", (stmt) => {
      let status: DbResult;
      while ((status = stmt.step()) === DbResult.BE_SQLITE_ROW)
        storage.objects.push(stmt.getRow());
      assert.equal(status, DbResult.BE_SQLITE_DONE);
    });
    assert.include(storage.columns, "js32", "Padding must allocate the full shared-column capacity");
    writeFileSync(path.join(outDir, `${mapping}-${classCount}-storage.json`), JSON.stringify(storage, undefined, 2));
    const rows: ExpectedRow[] = [];
    const classIds = Array.from({ length: classCount }, (_, i) => db.withStatement(`SELECT ec_classid('MixinQuery', 'Item${i}')`, (stmt) => {
      assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
      return stmt.getValue(0).getId();
    }));
    withEditTxn(db, (txn) => {
      const [, model] = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(txn, Code.createEmpty(), true);
      const category = SpatialCategory.insert(txn, IModel.dictionaryId, "MixinQuery", new SubCategoryAppearance());
      for (let ordinal = 0; ordinal < rowCount; ordinal++) {
        const classIndex = ordinal % classCount;
        const props: GeometricElementProps & ReturnType<typeof values> = {
          classFullName: `MixinQuery:Item${classIndex}`, model, category, code: Code.createEmpty(), ...values(ordinal),
        };
        const id = txn.insertElement(props);
        rows.push({ id, classId: classIds[classIndex], ...values(ordinal) });
      }
      const control: GeometricElementProps & ReturnType<typeof values> = {
        classFullName: "MixinQuery:Control", model, category, code: Code.createEmpty(), ...values(1),
      };
      txn.insertElement(control);
    });
    return { db, fileName, mapping, classCount, rows, storage };
  } catch (error) {
    db.close();
    throw error;
  }
}

function closeFixture(fixture: Fixture): void {
  fixture.db.close();
  unlinkSync(fixture.fileName);
}

function queries(): Query[] {
  const projection = "SELECT ECInstanceId, ECClassId, Ordinal, NumberValue, TextValue FROM mq.IValues";
  const all = () => true;
  const numberCompare = (a: ExpectedRow, b: ExpectedRow) => (a.numberValue ?? -1) - (b.numberValue ?? -1) || a.ordinal - b.ordinal;
  const textCompare = (a: ExpectedRow, b: ExpectedRow) => a.textValue === b.textValue ? a.ordinal - b.ordinal
    : a.textValue === null ? -1 : b.textValue === null ? 1 : a.textValue < b.textValue ? -1 : 1;
  const range = (limit: number) => (row: ExpectedRow) => row.numberValue !== null && row.numberValue < limit;
  const propertyQueries: Query[] = [
    { name: "read", sql: projection, params: [], propertyless: false, matches: all },
    ...[100, 500].map((limit) => ({
      name: `number-filter-${limit}`, sql: `${projection} WHERE NumberValue < ?`, params: [limit], propertyless: false, matches: range(limit),
    })),
    { name: "text-filter", sql: `${projection} WHERE TextValue = ?`, params: ["group-13"], propertyless: false, matches: (row) => row.textValue === "group-13" },
    { name: "number-sort-asc", sql: `${projection} ORDER BY NumberValue, Ordinal`, params: [], propertyless: false, matches: all, compare: numberCompare },
    { name: "number-sort-desc", sql: `${projection} ORDER BY NumberValue DESC, Ordinal DESC`, params: [], propertyless: false, matches: all, compare: (a, b) => -numberCompare(a, b) },
    { name: "text-sort", sql: `${projection} ORDER BY TextValue, Ordinal`, params: [], propertyless: false, matches: all, compare: textCompare },
    { name: "filter-sort", sql: `${projection} WHERE NumberValue < ? ORDER BY TextValue, Ordinal`, params: [100], propertyless: false, matches: range(100), compare: textCompare },
    { name: "empty", sql: `${projection} WHERE NumberValue < ? ORDER BY TextValue, Ordinal`, params: [-1], propertyless: false, matches: range(-1), compare: textCompare },
  ];
  return [
    ...propertyQueries,
    { name: "tag-read", sql: "SELECT ECInstanceId, ECClassId FROM mq.ITag", params: [], propertyless: true, matches: all },
    {
      name: "tag-filter-sort", sql: "SELECT ECInstanceId, ECClassId FROM mq.ITag WHERE ECInstanceId > ? ORDER BY ECInstanceId",
      params: ["0x1"], propertyless: true, matches: all,
      compare: (a, b) => Number(BigInt(a.id) - BigInt(b.id)),
    },
  ];
}

function expectedRows(fixture: Fixture, query: Query): ExpectedRow[] {
  const rows = fixture.rows.filter(query.matches);
  if (query.compare)
    rows.sort(query.compare);
  return rows;
}

function validate(fixture: Fixture, query: Query, expected: ExpectedRow[]): void {
  using stmt = fixture.db.prepareStatement(query.sql);
  stmt.bindValues(query.params);
  const byId = new Map(expected.map((row) => [row.id, row]));
  const seen = new Set<string>();
  let count = 0;
  let status: DbResult;
  while ((status = stmt.step()) === DbResult.BE_SQLITE_ROW) {
    const id = stmt.getValue(0).getId();
    const row = query.compare ? expected[count] : byId.get(id);
    assert.isDefined(row, `${query.name}: unexpected row ${id}`);
    assert(row !== undefined);
    assert.equal(id, row.id);
    assert.equal(stmt.getValue(1).getId(), row.classId);
    assert.isFalse(seen.has(id), "Duplicate mixin result");
    seen.add(id);
    if (!query.propertyless) {
      assert.equal(stmt.getValue(2).getInteger(), row.ordinal);
      assert.equal(stmt.getValue(3).isNull ? null : stmt.getValue(3).getInteger(), row.numberValue);
      assert.equal(stmt.getValue(4).isNull ? null : stmt.getValue(4).getString(), row.textValue);
    }
    count++;
  }
  assert.equal(status, DbResult.BE_SQLITE_DONE);
  assert.equal(count, expected.length, query.name);
}

function inspect(fixture: Fixture, query: Query, outDir: string): number {
  using stmt = fixture.db.prepareStatement(query.sql);
  const sql = stmt.getNativeSql();
  const unions = sql.match(/\bUNION ALL\b/g)?.length ?? 0;
  const branches = unions + 1;
  assert.equal(branches, query.propertyless || fixture.mapping === "aligned" ? 1 : fixture.classCount, query.name);
  const tables = [...sql.matchAll(/\bFROM \[main\]\.\[([^\]]+)\]/g)].map((match) => match[1]);
  assert.equal(tables.length, branches, "Each branch must read one table without hidden nested scans");
  assert.deepEqual([...new Set(tables)], ["bis_GeometricElement3d"], "No overflow or separate-table mapping");
  assert.notMatch(sql, /\bJOIN\b/, "Unexpected storage joins");
  const plan: unknown[] = [];
  fixture.db.withPreparedSqliteStatement(`EXPLAIN QUERY PLAN ${sql}`, (explain) => {
    explain.bindValues(query.params);
    let status: DbResult;
    while ((status = explain.step()) === DbResult.BE_SQLITE_ROW)
      plan.push(explain.getRow());
    assert.equal(status, DbResult.BE_SQLITE_DONE);
  });
  writeFileSync(path.join(outDir, `${fixture.mapping}-${fixture.classCount}-${fixture.rows.length}-${query.name}.json`),
    JSON.stringify({ ecsql: query.sql, params: query.params, branches, sql, plan }, undefined, 2));
  return branches;
}

function sample(fixture: Fixture, query: Query, stmt: ECSqlStatement, expected: ExpectedRow[]): Sample {
  const prepareStart = performance.now();
  const fresh = fixture.db.prepareStatement(query.sql);
  const prepareMs = performance.now() - prepareStart;
  fresh[Symbol.dispose]();
  stmt.reset();
  stmt.clearBindings();
  stmt.bindValues(query.params);
  const start = performance.now();
  let status = stmt.step();
  const firstStepMs = performance.now() - start;
  let count = 0;
  let idSum = 0;
  let ordinalSum = 0;
  let numberSum = 0;
  let textLength = 0;
  while (status === DbResult.BE_SQLITE_ROW) {
    idSum += Number(BigInt(stmt.getValue(0).getId()));
    stmt.getValue(1).getId();
    if (!query.propertyless) {
      ordinalSum += stmt.getValue(2).getInteger();
      numberSum += stmt.getValue(3).isNull ? 0 : stmt.getValue(3).getInteger();
      textLength += stmt.getValue(4).isNull ? 0 : stmt.getValue(4).getString().length;
    }
    count++;
    status = stmt.step();
  }
  const consumeMs = performance.now() - start;
  assert.equal(status, DbResult.BE_SQLITE_DONE);
  assert.equal(count, expected.length);
  assert.equal(idSum, expected.reduce((sum, row) => sum + Number(BigInt(row.id)), 0));
  if (!query.propertyless) {
    assert.equal(ordinalSum, expected.reduce((sum, row) => sum + row.ordinal, 0));
    assert.equal(numberSum, expected.reduce((sum, row) => sum + (row.numberValue ?? 0), 0));
    assert.equal(textLength, expected.reduce((sum, row) => sum + (row.textValue?.length ?? 0), 0));
  }
  return { prepareMs, firstStepMs, consumeMs };
}

describe("MixinQueryPerformance", () => {
  const config = readConfig();
  const reporter = new Reporter();
  let outDir: string;
  let runtime: object;

  before(async () => {
    await IModelHost.startup();
    const parent = path.join(KnownTestLocations.outputDir, "MixinQueryPerformance");
    mkdirSync(parent, { recursive: true });
    outDir = mkdtempSync(path.join(parent, "run-"));
    const probe = SnapshotDb.createEmpty(path.join(outDir, "runtime.bim"), { rootSubject: { name: "Runtime" } });
    try {
      runtime = {
        coreVersion: IModelHost.backendVersion, node: process.version, platform: `${process.platform}-${process.arch}`,
        nativeAddon: Object.keys(require.cache).filter((file) => file.endsWith(".node")),
        sqlite: probe.withPreparedSqliteStatement("SELECT sqlite_version() AS version, sqlite_source_id() AS source", (stmt) => {
          assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
          return stmt.getRow();
        }),
        cache: "warm connection; fresh prepare and reused statement execution",
        comparison: "same-table mapping layouts, not isolated UNION operator cost",
      };
      writeFileSync(path.join(outDir, "runtime.json"), JSON.stringify({ ...runtime, config }, undefined, 2));
    } finally {
      probe.close();
      unlinkSync(path.join(outDir, "runtime.bim"));
    }
  });

  after(async () => {
    try {
      if (outDir)
        reporter.exportCSV(path.join(outDir, "MixinQueryPerformance.csv"));
    } finally {
      await IModelHost.shutdown();
    }
  });

  async function measurePair(classCount: number, rowCount: number): Promise<void> {
    const fixtures: Fixture[] = [];
    try {
      for (const mapping of ["aligned", "different"] as const)
        fixtures.push(await createFixture(outDir, mapping, classCount, rowCount));
      assert.deepEqual(fixtures[0].storage, fixtures[1].storage, "Paired fixtures must have identical table and index definitions");
      for (const query of queries()) {
        const expected = fixtures.map((fixture) => expectedRows(fixture, query));
        const branches = fixtures.map((fixture, index) => {
          validate(fixture, query, expected[index]);
          return inspect(fixture, query, outDir);
        });
        const statements: ECSqlStatement[] = [];
        const samples: Sample[][] = fixtures.map(() => []);
        try {
          for (const fixture of fixtures)
            statements.push(fixture.db.prepareStatement(query.sql));
          for (let repetition = -config.warmups; repetition < config.repetitions; repetition++) {
            for (const index of repetition % 2 === 0 ? [0, 1] : [1, 0]) {
              const measurement = sample(fixtures[index], query, statements[index], expected[index]);
              if (repetition >= 0)
                samples[index].push(measurement);
            }
          }
        } finally {
          for (const stmt of statements)
            stmt[Symbol.dispose]();
        }
        fixtures.forEach((fixture, index) => {
          const info = {
            ...runtime, mapping: fixture.mapping, classCount, totalRows: rowCount,
            rowsPerClass: Math.floor(rowCount / classCount), remainder: rowCount % classCount,
            resultRows: expected[index].length, branches: branches[index], unions: branches[index] - 1,
            propertyless: query.propertyless, warmups: config.warmups, repetitions: config.repetitions,
          };
          for (const metric of ["prepareMs", "firstStepMs", "consumeMs"] as const) {
            const times = samples[index].map((measurement) => measurement[metric]).sort((a, b) => a - b);
            samples[index].forEach((measurement, repetition) => {
              assert.isTrue(Number.isFinite(measurement[metric]));
              reporter.addEntry("MixinQueryPerformance", query.name, metric, measurement[metric], { ...info, repetition });
            });
            for (const [summary, value] of [["min", times[0]], ["median", times[Math.floor(times.length / 2)]], ["max", times[times.length - 1]]] as const)
              reporter.addEntry("MixinQueryPerformance", query.name, `${metric}-${summary}`, value, info);
          }
        });
      }
    } finally {
      for (const fixture of fixtures)
        closeFixture(fixture);
    }
  }

  it("smoke: verifies aligned/differing mappings, NULLs, ties, empty results and propertyless controls", async () => {
    await measurePair(1, 101);
    await measurePair(3, 101);
  });

  it("verifies the generated mixin compound-SELECT boundary", async () => {
    const boundary: object[] = [];
    for (const classCount of [config.compoundSelectLimit - 1, config.compoundSelectLimit, config.compoundSelectLimit + 1]) {
      for (const mapping of ["aligned", "different"] as const) {
        const fixture = await createFixture(outDir, mapping, classCount, classCount);
        try {
          for (const query of queries().filter((q) => ["read", "filter-sort", "tag-read"].includes(q.name))) {
            if (mapping === "different" && classCount > config.compoundSelectLimit && !query.propertyless) {
              using stmt = new ECSqlStatement();
              const result = stmt.tryPrepare(fixture.db[_nativeDb], query.sql);
              assert.equal(result.status, DbResult.BE_SQLITE_ERROR);
              assert.match(result.message, /too many terms in compound SELECT/);
              boundary.push({ mapping, classCount, query: query.name, outcome: "too many terms in compound SELECT" });
            } else {
              const branches = inspect(fixture, query, outDir);
              validate(fixture, query, expectedRows(fixture, query));
              boundary.push({ mapping, classCount, query: query.name, branches, outcome: "success" });
            }
          }
        } finally {
          closeFixture(fixture);
        }
      }
    }
    writeFileSync(path.join(outDir, "boundary.json"), JSON.stringify(boundary, undefined, 2));
  });

  for (const classCount of new Set([...config.classCounts, config.compoundSelectLimit - 1, config.compoundSelectLimit])) {
    it(`measures ${classCount} implementing classes with ${config.rowCount} total rows`, async () => {
      await measurePair(classCount, config.rowCount);
    });
  }
});
