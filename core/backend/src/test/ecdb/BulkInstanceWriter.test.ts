/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert, expect } from "chai";
import { DbResult } from "@itwin/core-bentley";
import { ECDb, ECSqlStatement, ECSqlWriteStatement } from "../../core-backend";
import { KnownTestLocations } from "../KnownTestLocations";
import { ECDbTestHelper } from "./ECDbTestHelper";

const testSchema = `<ECSchema schemaName="Test" alias="test" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
  <ECEntityClass typeName="Person" modifier="Sealed">
    <ECProperty propertyName="Name" typeName="string"/>
    <ECProperty propertyName="Age" typeName="int"/>
    <ECProperty propertyName="Salary" typeName="double"/>
  </ECEntityClass>
  <ECEntityClass typeName="Company" modifier="Sealed">
    <ECProperty propertyName="Name" typeName="string"/>
  </ECEntityClass>
</ECSchema>`;

/** Reads back every Person ordered by Name so bulk and single-row results can be compared. */
function readPersons(ecdb: ECDb): Array<{ name: string, age: number, salary: number }> {
  const rows: Array<{ name: string, age: number, salary: number }> = [];
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  ecdb.withPreparedStatement("SELECT Name, Age, Salary FROM test.Person ORDER BY Name", (stmt: ECSqlStatement) => {
    while (stmt.step() === DbResult.BE_SQLITE_ROW) {
      const row = stmt.getRow();
      rows.push({ name: row.name, age: row.age, salary: row.salary });
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

function makePerson(i: number) {
  return { classFullName: "Test.Person", name: `P${`${i}`.padStart(5, "0")}`, age: 20 + (i % 50), salary: 1000.5 + i };
}

describe("ECDb bulk instance write", () => {
  const outDir = KnownTestLocations.outputDir;

  before(() => {
    using probe = ECDbTestHelper.createECDb(outDir, "bulkwrite_probe.ecdb", testSchema);
    expect(probe.isBulkInstanceWriteSupported, "the pinned @bentley/imodeljs-native must expose the bulk API").to.be.true;
  });

  it("bulk insert produces the same result as inserting one row at a time via ECSqlWriteStatement", () => {
    const count = 500;
    const instances = Array.from({ length: count }, (_, i) => makePerson(i));

    using single = ECDbTestHelper.createECDb(outDir, "bulkwrite_single.ecdb", testSchema);
    for (const inst of instances) {
      single.withCachedWriteStatement("INSERT INTO test.Person(Name,Age,Salary) VALUES(?,?,?)", (stmt: ECSqlWriteStatement) => {
        stmt.bindString(1, inst.name);
        stmt.bindInteger(2, inst.age);
        stmt.bindDouble(3, inst.salary);
        const res = stmt.stepForInsert();
        assert.equal(res.status, DbResult.BE_SQLITE_DONE);
      });
    }
    single.saveChanges();

    using bulk = ECDbTestHelper.createECDb(outDir, "bulkwrite_bulk.ecdb", testSchema);
    const bulkIds = bulk.bulkInsertInstances(instances, { useJsNames: true });
    bulk.saveChanges();

    expect(bulkIds.length).to.equal(count);
    expect(new Set(bulkIds).size).to.equal(count, "every inserted instance must get a distinct id");
    expect(readPersons(bulk)).to.deep.equal(readPersons(single));
  });

  it("returns ids in input order and inserts the expected values", () => {
    using ecdb = ECDbTestHelper.createECDb(outDir, "bulkwrite_order.ecdb", testSchema);
    const instances = Array.from({ length: 10 }, (_, i) => makePerson(i));
    const ids = ecdb.bulkInsertInstances(instances, { useJsNames: true });
    ecdb.saveChanges();

    expect(ids.length).to.equal(10);
    ids.forEach((id, i) => {
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      ecdb.withPreparedStatement("SELECT Name, Age FROM test.Person WHERE ECInstanceId=?", (stmt: ECSqlStatement) => {
        stmt.bindId(1, id);
        assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
        expect(stmt.getValue(0).getString()).to.equal(instances[i].name);
        expect(stmt.getValue(1).getInteger()).to.equal(instances[i].age);
      });
    });
  });

  it("supports a batch spanning multiple classes", () => {
    using ecdb = ECDbTestHelper.createECDb(outDir, "bulkwrite_multiclass.ecdb", testSchema);
    const ids = ecdb.bulkInsertInstances([
      { classFullName: "Test.Person", name: "A", age: 1, salary: 1 },
      { classFullName: "Test.Company", name: "Acme" },
      { classFullName: "Test.Person", name: "B", age: 2, salary: 2 },
    ], { useJsNames: true });
    ecdb.saveChanges();

    expect(ids.length).to.equal(3);
    expect(countPersons(ecdb)).to.equal(2);
  });

  it("rolls back the entire batch when one instance fails to insert", () => {
    using ecdb = ECDbTestHelper.createECDb(outDir, "bulkwrite_rollback.ecdb", testSchema);
    ecdb.bulkInsertInstances([makePerson(0)], { useJsNames: true });
    ecdb.saveChanges();
    expect(countPersons(ecdb)).to.equal(1);

    const bad: any[] = [makePerson(1), makePerson(2), { classFullName: "Test.DoesNotExist", name: "X" }, makePerson(3)];
    expect(() => ecdb.bulkInsertInstances(bad, { useJsNames: true })).to.throw();

    // all-or-nothing: none of the good rows in the failed batch may survive
    expect(countPersons(ecdb)).to.equal(1);
  });

  it("rolls back and identifies a row whose property getter throws", () => {
    using ecdb = ECDbTestHelper.createECDb(outDir, "bulkwrite_throwing_getter.ecdb", testSchema);
    const throwing = {
      classFullName: "Test.Person",
      get name(): string { throw new Error("name getter failed"); },
      age: 42,
      salary: 100,
    };

    expect(() => ecdb.bulkInsertInstances([makePerson(0), throwing, makePerson(2)], { useJsNames: true }))
      .to.throw(/index 1.*name getter failed/);
    expect(countPersons(ecdb)).to.equal(0);
  });

  it("rolls back and identifies a throwing array element accessor", () => {
    using ecdb = ECDbTestHelper.createECDb(outDir, "bulkwrite_throwing_array_accessor.ecdb", testSchema);
    const instances = [makePerson(0), makePerson(1)];
    Object.defineProperty(instances, 1, {
      enumerable: true,
      get: () => { throw new Error("array accessor failed"); },
    });

    expect(() => ecdb.bulkInsertInstances(instances, { useJsNames: true }))
      .to.throw(/index 1.*array accessor failed/);
    expect(countPersons(ecdb)).to.equal(0);
  });

  it("rejects reentrant ECDb calls from property getters and remains usable", () => {
    using ecdb = ECDbTestHelper.createECDb(outDir, "bulkwrite_reentrant.ecdb", testSchema);
    const callbacks: Array<() => void> = [
      () => { ecdb.bulkInsertInstances([makePerson(100)], { useJsNames: true }); },
      () => ecdb.saveChanges(),
      () => ecdb.clearCaches(),
    ];

    for (const callback of callbacks) {
      const reentrant = makePerson(1);
      Object.defineProperty(reentrant, "name", {
        enumerable: true,
        get: () => {
          callback();
          return "unreachable";
        },
      });

      expect(() => ecdb.bulkInsertInstances([makePerson(0), reentrant], { useJsNames: true }))
        .to.throw(/index 1.*Cannot call ECDb while a bulk instance write is in progress/);
      expect(countPersons(ecdb)).to.equal(0);
    }

    expect(ecdb.bulkInsertInstances([makePerson(2)], { useJsNames: true })).to.have.lengthOf(1);
    expect(countPersons(ecdb)).to.equal(1);
  });

  it("honors standard EC property names when useJsNames is false or omitted", () => {
    using ecdb = ECDbTestHelper.createECDb(outDir, "bulkwrite_standard_names.ecdb", testSchema);
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    const classId = ecdb.withPreparedStatement("SELECT ECInstanceId FROM meta.ECClassDef WHERE Name='Person'", (stmt: ECSqlStatement) => {
      assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
      return stmt.getValue(0).getId();
    });

    const firstId = "0x123";
    const secondId = "0x124";
    /* eslint-disable @typescript-eslint/naming-convention -- Standard EC JSON uses schema property names verbatim. */
    expect(ecdb.bulkInsertInstances([{
      ECClassId: classId,
      ECInstanceId: firstId,
      Name: "standard-false",
      Age: 1,
      Salary: 2,
    }], { useJsNames: false, forceUseId: true })).to.deep.equal([firstId]);
    expect(ecdb.bulkInsertInstances([{
      ECClassId: classId,
      ECInstanceId: secondId,
      Name: "standard-default",
      Age: 3,
      Salary: 4,
    }], { forceUseId: true })).to.deep.equal([secondId]);
    /* eslint-enable @typescript-eslint/naming-convention */
    expect(countPersons(ecdb)).to.equal(2);
  });

  it("bulk update matches single-instance update and rolls back on failure", () => {
    using ecdb = ECDbTestHelper.createECDb(outDir, "bulkwrite_update.ecdb", testSchema);
    const instances = Array.from({ length: 20 }, (_, i) => makePerson(i));
    const ids = ecdb.bulkInsertInstances(instances, { useJsNames: true });
    ecdb.saveChanges();

    const updates = ids.map((id, i) => ({ id, classFullName: "Test.Person", name: instances[i].name, age: 99, salary: instances[i].salary }));
    const updated = ecdb.bulkUpdateInstances(updates, { useJsNames: true });
    ecdb.saveChanges();
    expect(updated).to.equal(updates.length);
    expect(readPersons(ecdb).every((r) => r.age === 99)).to.be.true;

    const before = readPersons(ecdb);
    const badUpdates: any[] = [
      { id: ids[0], classFullName: "Test.Person", name: "changed", age: 1, salary: 1 },
      { id: "0x0", classFullName: "Test.DoesNotExist", name: "nope" },
    ];
    expect(() => ecdb.bulkUpdateInstances(badUpdates, { useJsNames: true })).to.throw();
    expect(readPersons(ecdb)).to.deep.equal(before, "a failed update batch must not change any row");
  });

  it("returns the number of rows actually updated or deleted", () => {
    using ecdb = ECDbTestHelper.createECDb(outDir, "bulkwrite_affected_rows.ecdb", testSchema);
    const [existingId] = ecdb.bulkInsertInstances([makePerson(0)], { useJsNames: true });
    const missingId = "0xabcdef";

    expect(ecdb.bulkUpdateInstances([
      { id: existingId, classFullName: "Test.Person", name: "updated", age: 1, salary: 2 },
      { id: missingId, classFullName: "Test.Person", name: "missing", age: 3, salary: 4 },
    ], { useJsNames: true, useIncrementalUpdate: false })).to.equal(1);

    expect(ecdb.bulkDeleteInstances([
      { id: existingId, classFullName: "Test.Person" },
      { id: missingId, classFullName: "Test.Person" },
    ], { useJsNames: true })).to.equal(1);
    expect(countPersons(ecdb)).to.equal(0);
  });

  it("bulk delete removes all instances and rolls back on failure", () => {
    using ecdb = ECDbTestHelper.createECDb(outDir, "bulkwrite_delete.ecdb", testSchema);
    const instances = Array.from({ length: 25 }, (_, i) => makePerson(i));
    const ids = ecdb.bulkInsertInstances(instances, { useJsNames: true });
    ecdb.saveChanges();
    expect(countPersons(ecdb)).to.equal(25);

    const badKeys: any[] = [
      { id: ids[0], classFullName: "Test.Person" },
      { id: ids[1], classFullName: "Test.DoesNotExist" },
    ];
    expect(() => ecdb.bulkDeleteInstances(badKeys, { useJsNames: true })).to.throw();
    expect(countPersons(ecdb)).to.equal(25, "a failed delete batch must not delete any row");

    const deleted = ecdb.bulkDeleteInstances(ids.map((id) => ({ id, classFullName: "Test.Person" })), { useJsNames: true });
    ecdb.saveChanges();
    expect(deleted).to.equal(25);
    expect(countPersons(ecdb)).to.equal(0);
  });

  it("accepts an empty batch", () => {
    using ecdb = ECDbTestHelper.createECDb(outDir, "bulkwrite_empty.ecdb", testSchema);
    expect(ecdb.bulkInsertInstances([], { useJsNames: true })).to.deep.equal([]);
    expect(ecdb.bulkUpdateInstances([], { useJsNames: true })).to.equal(0);
    expect(ecdb.bulkDeleteInstances([], { useJsNames: true })).to.equal(0);
  });
});
