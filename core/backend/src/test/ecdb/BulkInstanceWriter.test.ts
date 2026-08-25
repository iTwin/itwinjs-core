/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert, expect } from "chai";
import { serialize } from "node:v8";
import { DbResult, Id64String } from "@itwin/core-bentley";
import { ECDb, ECSqlStatement, ECSqlWriteStatement } from "../../core-backend";
import { KnownTestLocations } from "../KnownTestLocations";
import { ECDbTestHelper } from "./ECDbTestHelper";

const testSchema = `<ECSchema schemaName="Test" alias="test" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
  <ECStructClass typeName="Details">
    <ECProperty propertyName="Nickname" typeName="string"/>
  </ECStructClass>
  <ECEntityClass typeName="Person" modifier="Sealed">
    <ECProperty propertyName="Name" typeName="string"/>
    <ECProperty propertyName="Age" typeName="int"/>
    <ECProperty propertyName="Salary" typeName="double"/>
    <ECStructProperty propertyName="Details" typeName="Details"/>
  </ECEntityClass>
</ECSchema>`;

const propertyNames = ["Name", "Age", "Salary", "Details.Nickname"];

function makePersonRow(i: number): unknown[] {
  return [`P${`${i}`.padStart(5, "0")}`, 20 + (i % 50), 1000.5 + i, `N${i}`];
}

function readPersons(ecdb: ECDb): Array<{ id: Id64String, name: string, age: number, salary: number, nickname: string }> {
  const rows: Array<{ id: Id64String, name: string, age: number, salary: number, nickname: string }> = [];
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  ecdb.withPreparedStatement("SELECT ECInstanceId, Name, Age, Salary, Details.Nickname FROM test.Person ORDER BY Name", (stmt: ECSqlStatement) => {
    while (stmt.step() === DbResult.BE_SQLITE_ROW) {
      rows.push({
        id: stmt.getValue(0).getId(),
        name: stmt.getValue(1).getString(),
        age: stmt.getValue(2).getInteger(),
        salary: stmt.getValue(3).getDouble(),
        nickname: stmt.getValue(4).getString(),
      });
    }
  });
  return rows;
}

function countPersons(ecdb: ECDb): number {
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  return ecdb.withPreparedStatement("SELECT COUNT(*) FROM test.Person", (stmt: ECSqlStatement) => {
    assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
    return stmt.getValue(0).getInteger();
  });
}

describe("ECDb positional bulk instance write", () => {
  const outDir = KnownTestLocations.outputDir;

  it("inserts the same values as ECSqlWriteStatement and returns ordered ids", () => {
    const rows = Array.from({ length: 100 }, (_, i) => makePersonRow(i));

    using single = ECDbTestHelper.createECDb(outDir, "bulkwrite_single.ecdb", testSchema);
    for (const row of rows) {
      single.withCachedWriteStatement("INSERT INTO test.Person(Name,Age,Salary,Details.Nickname) VALUES(?,?,?,?)", (stmt: ECSqlWriteStatement) => {
        stmt.bindString(1, row[0] as string);
        stmt.bindInteger(2, row[1] as number);
        stmt.bindDouble(3, row[2] as number);
        stmt.bindString(4, row[3] as string);
        assert.equal(stmt.step(), DbResult.BE_SQLITE_DONE);
      });
    }
    single.saveChanges();

    using bulk = ECDbTestHelper.createECDb(outDir, "bulkwrite_bulk.ecdb", testSchema);
    const ids = bulk.bulkInsertInstances("Test.Person", propertyNames, rows);
    bulk.saveChanges();

    const bulkPersons = readPersons(bulk);
    expect(ids).to.have.lengthOf(rows.length);
    expect(new Set(ids).size).to.equal(rows.length);
    expect(bulkPersons.map(({ id: _id, ...values }) => values)).to.deep.equal(readPersons(single).map(({ id: _id, ...values }) => values));
    ids.forEach((id, index) => expect(bulkPersons[index].id).to.equal(id));
  });

  it("returns a count when ids are disabled and rolls back an invalid row", () => {
    using ecdb = ECDbTestHelper.createECDb(outDir, "bulkwrite_insert_rollback.ecdb", testSchema);
    expect(ecdb.bulkInsertInstances("Test.Person", propertyNames, [makePersonRow(0)], { returnIds: false })).to.equal(1);
    expect(() => ecdb.bulkInsertInstances("Test.Person", propertyNames, [makePersonRow(1), makePersonRow(2).slice(1)]))
      .to.throw(/rows\[1\]/);
    expect(countPersons(ecdb)).to.equal(1);
  });

  it("streams V8-serialized primitive rows and rolls back malformed row layouts", () => {
    const rows = Array.from({ length: 5 }, (_, i) => makePersonRow(i));
    rows[1][3] = "Résumé";
    rows[2][3] = "用户";
    using ecdb = ECDbTestHelper.createECDb(outDir, "bulkwrite_serialized.ecdb", testSchema);
    expect(ecdb.bulkInsertInstancesSerialized("Test.Person", propertyNames, serialize(rows), { returnIds: false })).to.equal(rows.length);
    expect(readPersons(ecdb).map(({ id: _id, ...values }) => values)).to.deep.equal(rows.map((row) => ({
      name: row[0],
      age: row[1],
      salary: row[2],
      nickname: row[3],
    })));

    expect(() => ecdb.bulkInsertInstancesSerialized("Test.Person", propertyNames, serialize([makePersonRow(5), makePersonRow(6).slice(1)])))
      .to.throw(/unexpected column count/);
    expect(countPersons(ecdb)).to.equal(rows.length);
  });

  it("rejects invalid layouts before writing", () => {
    using ecdb = ECDbTestHelper.createECDb(outDir, "bulkwrite_layout.ecdb", testSchema);
    expect(() => ecdb.bulkInsertInstances("Test.Missing", propertyNames, [makePersonRow(0)])).to.throw(/className/);
    expect(() => ecdb.bulkInsertInstances("Test.Person", ["Missing"], [["value"]])).to.throw(/property path/);
    expect(() => ecdb.bulkInsertInstances("Test.Person", ["Name", "name"], [["one", "two"]])).to.throw(/duplicates/);
    expect(countPersons(ecdb)).to.equal(0);
  });

  it("updates positional rows, counts matches, and rolls back an invalid id", () => {
    using ecdb = ECDbTestHelper.createECDb(outDir, "bulkwrite_update.ecdb", testSchema);
    const rows = Array.from({ length: 5 }, (_, i) => makePersonRow(i));
    const ids = ecdb.bulkInsertInstances("Test.Person", propertyNames, rows);
    ecdb.saveChanges();

    const updates = ids.map((id, i) => [id, rows[i][0], 99, rows[i][2], `updated-${i}`]);
    updates.push(["0xabcdef", "missing", 1, 2, "missing"]);
    expect(ecdb.bulkUpdateInstances("Test.Person", propertyNames, updates)).to.equal(ids.length);
    expect(readPersons(ecdb).every(({ age }) => age === 99)).to.be.true;

    const before = readPersons(ecdb);
    expect(() => ecdb.bulkUpdateInstances("Test.Person", propertyNames, [
      [ids[0], "changed", 1, 2, "changed"],
      ["not-an-id", "invalid", 3, 4, "invalid"],
    ])).to.throw(/rows\[1\]\[0\]/);
    expect(readPersons(ecdb)).to.deep.equal(before);
  });

  it("rejects reentrant ECDb calls and remains usable", () => {
    using ecdb = ECDbTestHelper.createECDb(outDir, "bulkwrite_reentrant.ecdb", testSchema);
    const row = makePersonRow(0);
    Object.defineProperty(row, 0, {
      enumerable: true,
      get: () => {
        ecdb.saveChanges();
        return "unreachable";
      },
    });

    expect(() => ecdb.bulkInsertInstances("Test.Person", propertyNames, [row]))
      .to.throw(/Cannot call ECDb while a bulk instance write is in progress/);
    expect(countPersons(ecdb)).to.equal(0);
    expect(ecdb.bulkInsertInstances("Test.Person", propertyNames, [makePersonRow(1)])).to.have.lengthOf(1);
  });

  it("accepts empty insert and update batches", () => {
    using ecdb = ECDbTestHelper.createECDb(outDir, "bulkwrite_empty.ecdb", testSchema);
    expect(ecdb.bulkInsertInstances("Test.Person", propertyNames, [])).to.deep.equal([]);
    expect(ecdb.bulkUpdateInstances("Test.Person", propertyNames, [])).to.equal(0);
  });
});
