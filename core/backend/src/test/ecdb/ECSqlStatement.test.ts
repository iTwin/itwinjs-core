/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { DbResult, Guid, GuidString, Id64, Id64String } from "@itwin/core-bentley";
import { NavigationValue, QueryBinder, QueryOptions, QueryOptionsBuilder, QueryRowFormat } from "@itwin/core-common";
import { Point2d, Point3d, Range3d, XAndY, XYAndZ } from "@itwin/core-geometry";
import { _nativeDb, ECDb, ECEnumValue, ECSqlColumnInfo, ECSqlInsertResult, ECSqlStatement, ECSqlValue, ECSqlWriteStatement, SnapshotDb } from "../../core-backend";
import { IModelTestUtils } from "../IModelTestUtils";
import { KnownTestLocations } from "../KnownTestLocations";
import { SequentialLogMatcher } from "../SequentialLogMatcher";
import { ECDbTestHelper } from "./ECDbTestHelper";
import { ConcurrentQuery } from "../../ConcurrentQuery";

/* eslint-disable @typescript-eslint/naming-convention */
const selectSingleRow = new QueryOptionsBuilder().setLimit({ count: 1, offset: -1 }).setRowFormat(QueryRowFormat.UseJsPropertyNames).getOptions();
async function query(ecdb: ECDb, ecsql: string, params?: QueryBinder, config?: QueryOptions, callback?: (row: any) => void) {
  ecdb.saveChanges();
  let rowCount: number = 0;
  for await (const queryRow of ecdb.createQueryReader(ecsql, params, { ...config, rowFormat: QueryRowFormat.UseJsPropertyNames })) {
    rowCount++;
    if (callback)
      callback(queryRow.toRow());
  }
  return rowCount;
}
async function queryRows(ecdb: ECDb, ecsql: string, params?: QueryBinder, config?: QueryOptions) {
  ecdb.saveChanges();
  const reader = ecdb.createQueryReader(ecsql, params, { ...config, rowFormat: QueryRowFormat.UseJsPropertyNames });
  return reader.toArray();
}
async function queryCount(ecdb: ECDb, ecsql: string, params?: QueryBinder, config?: QueryOptions): Promise<number> {
  ecdb.saveChanges();
  for await (const row of ecdb.createQueryReader(`SELECT COUNT(*) FROM (${ecsql})`, params, { ...config, rowFormat: QueryRowFormat.UseECSqlPropertyIndexes })) {
    return row[0] as number;
  }
  return -1;
}
function blobEqual(lhs: any, rhs: any) {
  if (!(lhs instanceof Uint8Array) || !(rhs instanceof Uint8Array))
    throw new Error("expecting uint8array");

  if (lhs.byteLength !== rhs.byteLength)
    return false;

  for (let i = 0; i < lhs.byteLength; i++) {
    if (lhs[i] !== rhs[i])
      return false;
  }
  return true;
}

describe("ECSqlStatement", () => {
  const outDir = KnownTestLocations.outputDir;
  const testRange = new Range3d(1.2, 2.3, 3.4, 4.5, 5.6, 6.7);
  const blobVal = new Uint8Array(testRange.toFloat64Array().buffer);
  const abbreviatedBlobVal = `{"bytes":${blobVal.byteLength}}`;

  it("check asynchronous step and stepForInsert methods", async () => {
    using ecdb = ECDbTestHelper.createECDb(outDir, "asyncmethodtest.ecdb",
      `<ECSchema schemaName="Test" alias="ts" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
        <ECEntityClass typeName="Foo" modifier="Sealed">
          <ECProperty propertyName="n" typeName="int"/>
          <ECProperty propertyName="dt" typeName="dateTime"/>
          <ECProperty propertyName="fooId" typeName="long" extendedTypeName="Id"/>
        </ECEntityClass>
      </ECSchema>`);
    assert.isTrue(ecdb.isOpen);

    const r = await ecdb.withCachedWriteStatement("INSERT INTO ts.Foo(n,dt,fooId) VALUES(20,TIMESTAMP '2018-10-18T12:00:00Z',20)", async (stmt: ECSqlWriteStatement) => {
      return stmt.stepForInsert();
    });
    ecdb.saveChanges();
    assert.equal(r.status, DbResult.BE_SQLITE_DONE);
    assert.equal(r.id, "0x1");
  });

  it("concurrent query get meta data", async () => {
    using ecdb = ECDbTestHelper.createECDb(outDir, "asyncmethodtest.ecdb",
      `<ECSchema schemaName="Test" alias="ts" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
        <ECEntityClass typeName="Foo" modifier="Sealed">
          <ECProperty propertyName="n" typeName="int"/>
          <ECProperty propertyName="dt" typeName="dateTime"/>
          <ECProperty propertyName="fooId" typeName="long" extendedTypeName="Id"/>
        </ECEntityClass>
      </ECSchema>`);
    assert.isTrue(ecdb.isOpen);

    await ecdb.withCachedWriteStatement("INSERT INTO ts.Foo(n,dt,fooId) VALUES(20,TIMESTAMP '2018-10-18T12:00:00Z',20)", async (stmt: ECSqlWriteStatement) => {
      stmt.stepForInsert();
    });
    await ecdb.withCachedWriteStatement("INSERT INTO ts.Foo(n,dt,fooId) VALUES(30,TIMESTAMP '2019-10-18T12:00:00Z',30)", async (stmt: ECSqlWriteStatement) => {
      stmt.stepForInsert();
    });
    ecdb.saveChanges();
    const reader = ecdb.createQueryReader("SELECT * FROM ts.Foo");
    let props = await reader.getMetaData();
    assert.equal(props.length, 5);
    let rows = 0;
    while (await reader.step()) {
      rows++;
    }
    assert.equal(rows, 2);
    props = await reader.getMetaData();
    assert.equal(props.length, 5);
  });
  it("null string accessor", async () => {
    using ecdb = ECDbTestHelper.createECDb(outDir, "nullstring.ecdb");
    assert.isTrue(ecdb.isOpen);
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    await ecdb.withPreparedStatement(`VALUES(NULL)`, async (stmt: ECSqlStatement) => {
      stmt.step();
      const str = stmt.getValue(0).getString();
      assert.equal(str, "");
    });
  });
  it("should page results", async () => {
    using ecdb = ECDbTestHelper.createECDb(outDir, "pagingresultset.ecdb",
      `<ECSchema schemaName="Test" alias="ts" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
        <ECEntityClass typeName="Foo" modifier="Sealed">
          <ECProperty propertyName="n" typeName="int"/>
        </ECEntityClass>
      </ECSchema>`);
    assert.isTrue(ecdb.isOpen);
    const ROW_COUNT = 27;
    // insert test rows
    for (let i = 1; i <= ROW_COUNT; i++) {
      const r = await ecdb.withCachedWriteStatement(`insert into ts.Foo(n) values(${i})`, async (stmt: ECSqlWriteStatement) => {
        return stmt.stepForInsert();
      });
      assert.equal(r.status, DbResult.BE_SQLITE_DONE);
    }
    ecdb.saveChanges();
    for (let i = 1; i < ROW_COUNT; i++) {
      const rowCount = await queryCount(ecdb, "SELECT ECInstanceId, ECClassId, n FROM ts.Foo WHERE n <= ?", new QueryBinder().bindInt(1, i));
      assert.equal(rowCount, i);
    }

    const temp = await queryRows(ecdb, "SELECT ECInstanceId FROM ONLY ts.Foo");
    assert.equal(temp.length, ROW_COUNT);
    // query page by page
    const PAGE_SIZE = 5;
    const QUERY = "SELECT n FROM ts.Foo";
    const EXPECTED_ROW_COUNT = [5, 5, 5, 5, 5, 2];
    const ready = [];
    for (let i = 0; i < EXPECTED_ROW_COUNT.length; i++) {
      ready.push(queryRows(ecdb, QUERY, undefined, new QueryOptionsBuilder().setLimit({ offset: i * PAGE_SIZE, count: PAGE_SIZE }).getOptions()));
    }
    // verify if each page has right count of rows
    const results = await Promise.all(ready);
    for (let i = 0; i < EXPECTED_ROW_COUNT.length; i++) {
      assert.equal(results[i].length, EXPECTED_ROW_COUNT[i]);
    }
  });

  it("paging use cache statement queryRows()", async () => {
    using ecdb = ECDbTestHelper.createECDb(outDir, "pagingresultset.ecdb",
      `<ECSchema schemaName="Test" alias="ts" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
        <ECEntityClass typeName="Foo" modifier="Sealed">
          <ECProperty propertyName="n" typeName="int"/>
        </ECEntityClass>
      </ECSchema>`);
    assert.isTrue(ecdb.isOpen);
    const ROW_COUNT = 100;
    // insert test rows
    for (let i = 1; i <= ROW_COUNT; i++) {
      const r = await ecdb.withCachedWriteStatement(`insert into ts.Foo(n) values(${i})`, async (stmt: ECSqlWriteStatement) => {
        return stmt.stepForInsert();
      });
      assert.equal(r.status, DbResult.BE_SQLITE_DONE);
    }
    ecdb.saveChanges();
    // check if varying page number does not require prepare new statements
    ecdb.clearStatementCache();
    const rca = await queryRows(ecdb, "SELECT count(*) as nRows FROM ts.Foo");
    assert.equal(rca[0].nRows, 100); // expe
    const rc = await queryCount(ecdb, "SELECT * FROM ts.Foo");
    assert.equal(rc, 100); // expe
    let rowNo = 0;
    for await (const row of ecdb.createQueryReader("SELECT * FROM ts.Foo", undefined, { rowFormat: QueryRowFormat.UseJsPropertyNames })) {
      assert.equal(row.n, rowNo + 1);
      rowNo = rowNo + 1;
    }
    assert.equal(rowNo, 100); // expect all rows
  });

  it("should restart query", async () => {
    using ecdb = ECDbTestHelper.createECDb(outDir, "cancelquery.ecdb",
      `<ECSchema schemaName="Test" alias="ts" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
        <ECEntityClass typeName="Foo" modifier="Sealed">
          <ECProperty propertyName="n" typeName="int"/>
        </ECEntityClass>
      </ECSchema>`);
    assert.isTrue(ecdb.isOpen);
    const ROW_COUNT = 100;
    // insert test rows
    for (let i = 1; i <= ROW_COUNT; i++) {
      const r = await ecdb.withCachedWriteStatement(`insert into ts.Foo(n) values(${i})`, async (stmt: ECSqlWriteStatement) => {
        return stmt.stepForInsert();
      });
      assert.equal(r.status, DbResult.BE_SQLITE_DONE);
    }
    ecdb.saveChanges();
    ConcurrentQuery.resetConfig(ecdb[_nativeDb], { globalQuota: { time: 1 }, ignoreDelay: false });

    let cancelled = 0;
    let successful = 0;
    let rowCount = 0;
    const scheduleQuery = async (delay: number) => {
      return new Promise<void>(async (resolve, reject) => {
        try {
          const options = new QueryOptionsBuilder();
          options.setDelay(delay);
          options.setRowFormat(QueryRowFormat.UseJsPropertyNames);
          options.setRestartToken("tag");
          for await (const _row of ecdb.createQueryReader("SELECT * FROM ts.Foo", undefined, options.getOptions())) {
            rowCount++;
          }
          successful++;
          resolve();
        } catch (err: any) {
          // we expect query to be cancelled
          if (err.errorNumber === DbResult.BE_SQLITE_INTERRUPT) {
            cancelled++;
            resolve();
          } else {
            reject(new Error("rejected"));
          }
        }
      });
    };

    const queries = [];
    queries.push(scheduleQuery(5000));
    queries.push(scheduleQuery(0));

    await Promise.all(queries);
    // We expect at least one query to be cancelled
    assert.isAtLeast(cancelled, 1);
    assert.isAtLeast(successful, 1);
    assert.isAtLeast(rowCount, 1);
  });
  it("should use cache statement for query()", async () => {
    using ecdb = ECDbTestHelper.createECDb(outDir, "pagingresultset.ecdb",
      `<ECSchema schemaName="Test" alias="ts" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
        <ECEntityClass typeName="Foo" modifier="Sealed">
          <ECProperty propertyName="n" typeName="int"/>
        </ECEntityClass>
      </ECSchema>`);
    assert.isTrue(ecdb.isOpen);
    const ROW_COUNT = 27;
    // insert test rows
    for (let i = 1; i <= ROW_COUNT; i++) {
      const r = await ecdb.withCachedWriteStatement(`insert into ts.Foo(n) values(${i})`, async (stmt: ECSqlWriteStatement) => {
        return stmt.stepForInsert();
      });
      assert.equal(r.status, DbResult.BE_SQLITE_DONE);
    }
    ecdb.saveChanges();
    // check if varying page number does not require prepare new statements
    ecdb.clearStatementCache();
    for (const _testPageSize of [1, 2, 4, 5, 6, 7, 10, ROW_COUNT]) {
      let rowNo = 1;
      for await (const row of ecdb.createQueryReader("SELECT n FROM ts.Foo WHERE n != ? and ECInstanceId < ?", new QueryBinder().bindInt(1, 123).bindInt(2, 30), { rowFormat: QueryRowFormat.UseJsPropertyNames })) {
        assert.equal(row.n, rowNo);
        rowNo = rowNo + 1;
      }
      assert.equal(rowNo, 28); // expect all rows
      assert.equal(0, ecdb.getCachedStatementCount()); // there must be single cached statement used with different size pages.
    }
  });
  it("concurrent query binding", async () => {
    using ecdb = ECDbTestHelper.createECDb(outDir, "pagingresultset.ecdb",
      `<ECSchema schemaName="Test" alias="ts" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
        <ECEntityClass typeName="Foo" modifier="Sealed">
          <ECProperty propertyName="n" typeName="int"/>
        </ECEntityClass>
      </ECSchema>`);
    assert.isTrue(ecdb.isOpen);
    for (let i = 1; i <= 5; i++) {
      const r = await ecdb.withCachedWriteStatement(`insert into ts.Foo(n) values(${i})`, async (stmt: ECSqlWriteStatement) => {
        return stmt.stepForInsert();
      });
      assert.equal(r.status, DbResult.BE_SQLITE_DONE);
    }
    ecdb.saveChanges();
    for await (const row of ecdb.createQueryReader("SELECT count(*) as cnt FROM ts.Foo WHERE n in (:a, :b, :c)", new QueryBinder().bindInt("a", 1).bindInt("b", 2).bindInt("c", 3), { rowFormat: QueryRowFormat.UseJsPropertyNames })) {
      assert.equal(row.cnt, 3);
    }
    for await (const row of ecdb.createQueryReader("SELECT count(*) as cnt FROM ts.Foo WHERE n in (?, ?, ?)", new QueryBinder().bindInt(1, 1).bindInt(2, 2).bindInt(3, 3), { rowFormat: QueryRowFormat.UseJsPropertyNames })) {
      assert.equal(row.cnt, 3);
    }
    const slm = new SequentialLogMatcher();
    slm.append().error().category("ECDb").message("No parameter index found for parameter name: d.");
    try {
      for await (const row of ecdb.createQueryReader("SELECT count(*) as cnt FROM ts.Foo WHERE n in (:a, :b, :c)", new QueryBinder().bindInt("a", 1).bindInt("b", 2).bindInt("c", 3).bindInt("d", 3), { rowFormat: QueryRowFormat.UseJsPropertyNames })) {
        assert.equal(row.cnt, 3);
      }
      assert.isFalse(true);
    } catch (e) { assert.isNotNull(e); }
    assert.isTrue(slm.finishAndDispose());
  });
  it("check HextoId() and IdToHex() ecsql functions", async () => {
    using ecdb = ECDbTestHelper.createECDb(outDir, "pagingresultset.ecdb",
      `<ECSchema schemaName="Test" alias="ts" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
        <ECEntityClass typeName="Foo" modifier="Sealed">
          <ECProperty propertyName="n" typeName="int"/>
        </ECEntityClass>
      </ECSchema>`);
    assert.isTrue(ecdb.isOpen);
    for (let i = 1; i <= 2; i++) {
      const r = await ecdb.withCachedWriteStatement(`insert into ts.Foo(n) values(${i})`, async (stmt: ECSqlWriteStatement) => {
        return stmt.stepForInsert();
      });
      assert.equal(r.status, DbResult.BE_SQLITE_DONE);
    }
    ecdb.saveChanges();
    for await (const row of ecdb.createQueryReader("SELECT IdToHex(ECInstanceId) as hexId, ECInstanceId, HexToId('0x1') as idhex FROM ts.Foo WHERE n = ?", new QueryBinder().bindInt(1, 1), { rowFormat: QueryRowFormat.UseJsPropertyNames })) {
      assert.equal(row.hexId, row.id);
      assert.equal(row.hexId, row.idhex);
    }
  });
  it("should bind BeGuid", async () => {
    using ecdb = ECDbTestHelper.createECDb(outDir, "pagingresultset.ecdb",
      `<ECSchema schemaName="Test" alias="ts" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
        <ECEntityClass typeName="Foo" modifier="Sealed">
          <ECProperty propertyName="guid" typeName="binary" extendedTypeName="BeGuid"/>
        </ECEntityClass>
      </ECSchema>`);
    assert.isTrue(ecdb.isOpen);
    const maxRows = 10;
    const guids: GuidString[] = [];
    for (let i = 0; i < maxRows; i++) {
      const r = await ecdb.withCachedWriteStatement(`insert into ts.Foo(guid) values(?)`, async (stmt: ECSqlWriteStatement) => {
        guids.push(Guid.createValue());
        stmt.bindGuid(1, guids[i]);
        return stmt.stepForInsert();
      });
      assert.equal(r.status, DbResult.BE_SQLITE_DONE);
    }
    ecdb.saveChanges();

    const uint8arrayToGuid = (guidArray: any) => {
      if (!(guidArray instanceof Uint8Array))
        throw new Error("Expecting a Uint8Array type argument");

      if (guidArray.byteLength !== 16)
        throw new Error("Expecting a Uint8Array of length 16");

      let guidStr: string = "";
      const part = [0, 4, 6, 8, 10, 16];
      for (let z = 0; z < part.length - 1; z++) {
        guidArray.subarray(part[z], part[z + 1]).forEach((c) => {
          guidStr += (`00${c.toString(16)}`).slice(-2);
        });
        if (z < part.length - 2)
          guidStr += "-";
      }
      return guidStr;
    };
    const guidToUint8Array = (v: GuidString) => {
      if (v.length !== 36)
        throw new Error("Guid is expected to have 36 characters xxxxxxxx-xxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx");

      const ar = new Uint8Array(16);
      const t = v.split("-").join("");
      let i = 0;
      for (let z = 0; z < 32; z += 2) {
        ar[i++] = parseInt(t.substring(z, z + 2), 16);
      }
      return ar;
    };

    const testGuid = "74da899a-6dde-406c-bf45-f4547d948f00";
    assert.equal(testGuid, uint8arrayToGuid(guidToUint8Array(testGuid)));
    let k = 0;
    assert.equal(await query(ecdb, "SELECT guid FROM ts.Foo ORDER BY ECInstanceId", undefined, undefined, (row: any) => {
      assert.equal(row.guid, guids[k++]);
    }), maxRows);

    // following will not return any guid BLOB ? = STRING
    for (const guid of guids) {
      assert.equal(await query(ecdb, "SELECT guid FROM ts.Foo WHERE guid=?", new QueryBinder().bindString(1, guid), undefined, (row: any) => {
        assert.equal(row.guid, guid);
      }), 1);
      assert.equal(await query(ecdb, `SELECT guid FROM ts.Foo WHERE guid='${guid}'`, undefined, undefined, (row: any) => {
        assert.equal(row.guid, guid);
      }), 0);
      assert.equal(await query(ecdb, `SELECT guid FROM ts.Foo WHERE guid=StrToGuid('${guid}')`, undefined, undefined, (row: any) => {
        assert.equal(row.guid, guid);
      }), 1);
      assert.equal(await query(ecdb, "SELECT guid FROM ts.Foo WHERE guid=StrToGuid(?)", new QueryBinder().bindString(1, guid), undefined, (row: any) => {
        assert.equal(row.guid, guid);
      }), 1);
      assert.equal(await query(ecdb, "SELECT guid FROM ts.Foo WHERE GuidToStr(guid)=?", new QueryBinder().bindString(1, guid), undefined, (row: any) => {
        assert.equal(row.guid, guid);
      }), 1);
      assert.equal(await query(ecdb, "SELECT guid FROM ts.Foo WHERE guid=?", new QueryBinder().bindBlob(1, guidToUint8Array(guid)), undefined, (row: any) => {
        assert.equal(row.guid, guid);
      }), 1);
      assert.equal(await query(ecdb, "SELECT guid FROM ts.Foo WHERE guid=StrToGuid(?)", new QueryBinder().bindString(1, guid), undefined, (row: any) => {
        assert.equal(row.guid, guid);
      }), 1);
      assert.equal(await query(ecdb, "SELECT GuidToStr(guid) as gstr FROM ts.Foo WHERE guid=StrToGuid(?)", new QueryBinder().bindString(1, guid), undefined, (row: any) => {
        assert.equal(row.gstr, guid);
      }), 1);
    }
  });
  it("should bind Ids", async () => {
    using ecdb = ECDbTestHelper.createECDb(outDir, "bindids.ecdb");

    assert.isTrue(ecdb.isOpen);

    const verify = async (ecdbToVerify: ECDb, actualRes: ECSqlInsertResult, expectedECInstanceId?: Id64String) => {
      if (!expectedECInstanceId) {
        assert.notEqual(actualRes.status, DbResult.BE_SQLITE_DONE);
        assert.isUndefined(actualRes.id);
        return;
      }

      assert.equal(actualRes.status, DbResult.BE_SQLITE_DONE);
      assert.isDefined(actualRes.id);
      assert.equal(actualRes.id!, expectedECInstanceId);

      // eslint-disable-next-line @typescript-eslint/no-deprecated
      ecdbToVerify.withPreparedStatement("SELECT ECInstanceId, ECClassId, Name FROM ecdbf.ExternalFileInfo WHERE ECInstanceId=?", (stmt: ECSqlStatement) => {
        stmt.bindId(1, expectedId);
        assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
        const row = stmt.getRow();
        assert.equal(row.id, expectedECInstanceId);
        assert.equal(row.className, "ECDbFileInfo.ExternalFileInfo");
        assert.equal(row.name, `${Id64.getLocalId(expectedECInstanceId).toString()}.txt`);
      });
      assert.equal(await query(ecdb, "SELECT ECInstanceId, ECClassId, Name FROM ecdbf.ExternalFileInfo WHERE ECInstanceId=?", new QueryBinder().bindString(1, expectedId), new QueryOptionsBuilder().setLimit({ count: 1, offset: -1 }).getOptions(), (row) => {
        assert.equal(row.id, expectedECInstanceId);
        assert.equal(row.className, "ECDbFileInfo.ExternalFileInfo");
        assert.equal(row.name, `${Id64.getLocalId(expectedECInstanceId).toString()}.txt`);
      }), 1);
    };

    let expectedId = Id64.fromLocalAndBriefcaseIds(4444, 0);
    let r: ECSqlInsertResult = ecdb.withCachedWriteStatement("INSERT INTO ecdbf.ExternalFileInfo(ECInstanceId,Name) VALUES(?,?)", (stmt: ECSqlWriteStatement) => {
      stmt.bindId(1, expectedId);
      stmt.bindString(2, "4444.txt");
      return stmt.stepForInsert();
    });
    await verify(ecdb, r, expectedId);

    expectedId = Id64.fromLocalAndBriefcaseIds(4445, 0);
    r = ecdb.withCachedWriteStatement("INSERT INTO ecdbf.ExternalFileInfo(ECInstanceId,Name) VALUES(:id,:name)", (stmt: ECSqlWriteStatement) => {
      stmt.bindId("id", expectedId);
      stmt.bindString("name", "4445.txt");

      return stmt.stepForInsert();
    });
    await verify(ecdb, r, expectedId);

    expectedId = Id64.fromLocalAndBriefcaseIds(4446, 0);
    r = ecdb.withCachedWriteStatement("INSERT INTO ecdbf.ExternalFileInfo(ECInstanceId,Name) VALUES(?,?)", (stmt: ECSqlWriteStatement) => {
      stmt.bindValues([expectedId, "4446.txt"]);
      return stmt.stepForInsert();
    });
    await verify(ecdb, r, expectedId);

    expectedId = Id64.fromLocalAndBriefcaseIds(4447, 0);
    r = ecdb.withCachedWriteStatement("INSERT INTO ecdbf.ExternalFileInfo(ECInstanceId,Name) VALUES(:id,:name)", (stmt: ECSqlWriteStatement) => {
      stmt.bindValues({ id: expectedId, name: "4447.txt" });
      return stmt.stepForInsert();
    });
    await verify(ecdb, r, expectedId);
  });

  it("should bind numeric and date strings", async () => {
    const slm = new SequentialLogMatcher();
    slm.append().error().category("ECDb").message("Type mismatch: only BindDateTime or BindText can be called for a column of the DateTime type.");
    slm.append().error().category("ECDb").message("Type mismatch: only BindDateTime or BindText can be called for a column of the DateTime type.");
    slm.append().error().category("ECDb").message("Type mismatch: only BindDateTime or BindText can be called for a column of the DateTime type.");
    slm.append().error().category("ECDb").message("Type mismatch: only BindDateTime or BindText can be called for a column of the DateTime type.");
    slm.append().error().category("ECDb").message("Type mismatch: only BindDateTime or BindText can be called for a column of the DateTime type.");
    slm.append().error().category("ECDb").message(/String must be a valid ISO 8601 date, time or timestamp/gm);
    slm.append().error().category("ECDb").message(/String must be a valid ISO 8601 date, time or timestamp/gm);
    slm.append().error().category("ECDb").message(/String must be a valid ISO 8601 date, time or timestamp/gm);
    slm.append().error().category("ECDb").message(/String must be a valid ISO 8601 date, time or timestamp/gm);
    slm.append().error().category("ECDb").message(/String must be a valid ISO 8601 date, time or timestamp/gm);
    slm.append().error().category("ECDb").message(/String must be a valid ISO 8601 date, time or timestamp/gm);
    slm.append().error().category("ECDb").message(/String must be a valid ISO 8601 date, time or timestamp/gm);
    slm.append().error().category("ECDb").message(/String must be a valid ISO 8601 date, time or timestamp/gm);
    slm.append().error().category("ECDb").message(/String must be a valid ISO 8601 date, time or timestamp/gm);
    slm.append().error().category("ECDb").message(/String must be a valid ISO 8601 date, time or timestamp/gm);
    slm.append().error().category("ECDb").message(/String must be a valid ISO 8601 date, time or timestamp/gm);
    slm.append().error().category("ECDb").message(/String must be a valid ISO 8601 date, time or timestamp/gm);
    slm.append().error().category("ECDb").message(/only BindDateTime or BindText can be called for a column of the DateTime type/gm);

    using ecdb = ECDbTestHelper.createECDb(outDir, "bindnumericanddatestrings.ecdb",
      `<ECSchema schemaName="Test" alias="ts" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
        <ECEntityClass typeName="Foo" modifier="Sealed">
          <ECProperty propertyName="n" typeName="int"/>
          <ECProperty propertyName="dt" typeName="dateTime"/>
          <ECProperty propertyName="fooId" typeName="long" extendedTypeName="Id"/>
        </ECEntityClass>
      </ECSchema>`);
    assert.isTrue(ecdb.isOpen);

    const r: ECSqlInsertResult = ecdb.withCachedWriteStatement("INSERT INTO ts.Foo(n,dt,fooId) VALUES(20,TIMESTAMP '2018-10-18T12:00:00Z',20)", (stmt: ECSqlWriteStatement) => {
      return stmt.stepForInsert();
    });
    ecdb.saveChanges();
    assert.equal(r.status, DbResult.BE_SQLITE_DONE);
    const ecsqln = "SELECT 1 FROM ts.Foo WHERE n=?";
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    await ecdb.withPreparedStatement(ecsqln, async (stmt: ECSqlStatement) => {
      const nNum: number = 20;
      const nStr: string = "20";
      const nDt: string = "2019-01-21T12:00:00Z";
      const nHexStr: string = "0x14";

      stmt.bindInteger(1, nNum);
      assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
      stmt.reset();
      stmt.clearBindings();
      assert.equal(await queryCount(ecdb, ecsqln, new QueryBinder().bindInt(1, nNum), selectSingleRow), 1);

      stmt.bindValue(1, nNum);
      assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
      stmt.reset();
      stmt.clearBindings();

      stmt.getBinder(1).bind(nNum);
      assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
      stmt.reset();
      stmt.clearBindings();

      stmt.bindValues([nNum]);
      assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
      stmt.reset();
      stmt.clearBindings();

      stmt.bindString(1, nStr);
      assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
      stmt.reset();
      stmt.clearBindings();

      assert.equal(await queryCount(ecdb, ecsqln, new QueryBinder().bindString(1, nStr), selectSingleRow), 1);

      stmt.bindValue(1, nStr);
      assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
      stmt.reset();
      stmt.clearBindings();

      stmt.getBinder(1).bind(nStr);
      assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
      stmt.reset();
      stmt.clearBindings();

      stmt.bindValues([nStr]);
      assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
      stmt.reset();
      stmt.clearBindings();

      stmt.bindString(1, nDt);
      assert.equal(stmt.step(), DbResult.BE_SQLITE_DONE, "Date time string is not parsed. SQLite just converts it to something which does not match");
      stmt.reset();
      stmt.clearBindings();

      assert.equal(await queryCount(ecdb, ecsqln, new QueryBinder().bindString(1, nDt), selectSingleRow), 0);

      stmt.bindValue(1, nDt);
      assert.equal(stmt.step(), DbResult.BE_SQLITE_DONE, "Date time string is not parsed. SQLite just converts it to something which does not match");
      stmt.reset();
      stmt.clearBindings();

      stmt.getBinder(1).bind(nDt);
      assert.equal(stmt.step(), DbResult.BE_SQLITE_DONE, "Date time string is not parsed. SQLite just converts it to something which does not match");
      stmt.reset();
      stmt.clearBindings();

      stmt.bindValues([nDt]);
      assert.equal(stmt.step(), DbResult.BE_SQLITE_DONE, "Date time string is not parsed. SQLite just converts it to something which does not match");
      stmt.reset();
      stmt.clearBindings();

      stmt.bindString(1, nHexStr);
      assert.equal(stmt.step(), DbResult.BE_SQLITE_DONE, "Hex string is not parsed. SQLite just converts it to something which does not match");
      stmt.reset();
      stmt.clearBindings();

      assert.equal(await queryCount(ecdb, ecsqln, new QueryBinder().bindString(1, nHexStr), selectSingleRow), 0);

      stmt.bindValue(1, nHexStr);
      assert.equal(stmt.step(), DbResult.BE_SQLITE_DONE, "Hex string is not parsed. SQLite just converts it to something which does not match");
      stmt.reset();
      stmt.clearBindings();

      stmt.getBinder(1).bind(nHexStr);
      assert.equal(stmt.step(), DbResult.BE_SQLITE_DONE, "Hex string is not parsed. SQLite just converts it to something which does not match");
      stmt.reset();
      stmt.clearBindings();

      stmt.bindValues([nHexStr]);
      assert.equal(stmt.step(), DbResult.BE_SQLITE_DONE, "Hex string is not parsed. SQLite just converts it to something which does not match");
      stmt.reset();
      stmt.clearBindings();
    });

    const ecsqldt = "SELECT 1 FROM ts.Foo WHERE dt=?";
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    await ecdb.withPreparedStatement(ecsqldt, async (stmt: ECSqlStatement) => {
      const dtStr: string = "2018-10-18T12:00:00Z";
      const num: number = 2458410;
      const str: string = "2458410";
      const hexStr: string = "0x25832a";

      stmt.bindDateTime(1, dtStr);
      assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
      stmt.reset();
      stmt.clearBindings();

      assert.equal(await queryCount(ecdb, ecsqldt, new QueryBinder().bindString(1, dtStr)), 1);
      stmt.bindString(1, dtStr);
      assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
      stmt.reset();
      stmt.clearBindings();

      stmt.bindValue(1, dtStr);
      assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
      stmt.reset();
      stmt.clearBindings();

      stmt.getBinder(1).bind(dtStr);
      assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
      stmt.reset();
      stmt.clearBindings();

      stmt.bindValues([dtStr]);
      assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
      stmt.reset();
      stmt.clearBindings();

      assert.throw(() => stmt.bindInteger(1, num));
      stmt.clearBindings();

      assert.equal(await queryCount(ecdb, ecsqldt, QueryBinder.from([num])), 0);
      assert.throw(() => stmt.bindValue(1, num));
      stmt.clearBindings();

      assert.throw(() => stmt.getBinder(1).bind(num));
      stmt.clearBindings();

      assert.throw(() => stmt.bindValues([num]));
      stmt.clearBindings();

      assert.throw(() => stmt.bindString(1, str));
      stmt.clearBindings();

      assert.throw(() => stmt.bindValue(1, str));
      stmt.clearBindings();

      assert.equal(await queryCount(ecdb, ecsqldt, QueryBinder.from([str])), 0);

      assert.throw(() => stmt.getBinder(1).bind(str));
      stmt.clearBindings();

      assert.throw(() => stmt.bindValues([str]));
      stmt.clearBindings();

      assert.throw(() => stmt.bindString(1, hexStr));
      stmt.clearBindings();

      assert.equal(await queryCount(ecdb, ecsqldt, QueryBinder.from([hexStr])), 0);

      assert.throw(() => stmt.bindValue(1, hexStr));
      stmt.clearBindings();

      assert.throw(() => stmt.getBinder(1).bind(hexStr));
      stmt.clearBindings();

      assert.throw(() => stmt.bindValues([hexStr]));
      stmt.clearBindings();
    });

    const ecsqlfooId = "SELECT 1 FROM ts.Foo WHERE fooId=?";
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    await ecdb.withPreparedStatement(ecsqlfooId, async (stmt: ECSqlStatement) => {
      const num: number = 20;
      const str: string = "20";
      const dt: string = "2019-01-21T12:00:00Z";
      const hexStr: string = "0x14";

      stmt.bindId(1, hexStr);
      assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
      stmt.reset();
      stmt.clearBindings();

      assert.equal(await queryCount(ecdb, ecsqldt, QueryBinder.from([hexStr])), 0);

      stmt.bindValues([hexStr]);
      assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
      stmt.reset();
      stmt.clearBindings();

      stmt.bindString(1, hexStr);
      assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
      stmt.reset();
      stmt.clearBindings();

      stmt.bindValue(1, hexStr);
      assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
      stmt.reset();
      stmt.clearBindings();

      stmt.getBinder(1).bind(hexStr);
      assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
      stmt.reset();
      stmt.clearBindings();

      stmt.bindValues([hexStr]);
      assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
      stmt.reset();
      stmt.clearBindings();

      stmt.bindString(1, str);
      assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
      stmt.reset();
      stmt.clearBindings();

      assert.equal(await queryCount(ecdb, ecsqldt, QueryBinder.from([str])), 0);

      stmt.bindValue(1, str);
      assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
      stmt.reset();
      stmt.clearBindings();

      stmt.getBinder(1).bind(str);
      assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
      stmt.reset();
      stmt.clearBindings();

      stmt.bindValues([str]);
      assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
      stmt.reset();
      stmt.clearBindings();

      stmt.bindInteger(1, num);
      assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
      stmt.reset();
      stmt.clearBindings();

      assert.equal(await queryCount(ecdb, ecsqldt, QueryBinder.from([num])), 0);

      stmt.bindValue(1, num);
      assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
      stmt.reset();
      stmt.clearBindings();

      stmt.getBinder(1).bind(num);
      assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
      stmt.reset();
      stmt.clearBindings();

      stmt.bindValues([num]);
      assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
      stmt.reset();
      stmt.clearBindings();

      stmt.bindString(1, dt);
      assert.equal(stmt.step(), DbResult.BE_SQLITE_DONE, "DateTime string is not parsed into what it means. SQlite just uses its regular string conversion routines which don't match here");
      stmt.reset();
      stmt.clearBindings();

      assert.equal(await queryCount(ecdb, ecsqldt, QueryBinder.from([dt])), 0);

      stmt.bindValue(1, dt);
      assert.equal(stmt.step(), DbResult.BE_SQLITE_DONE, "DateTime string is not parsed into what it means. SQlite just uses its regular string conversion routines which don't match here");
      stmt.reset();
      stmt.clearBindings();

      stmt.getBinder(1).bind(dt);
      assert.equal(stmt.step(), DbResult.BE_SQLITE_DONE, "DateTime string is not parsed into what it means. SQlite just uses its regular string conversion routines which don't match here");
      stmt.reset();
      stmt.clearBindings();

      stmt.bindValues([dt]);
      assert.equal(stmt.step(), DbResult.BE_SQLITE_DONE, "DateTime string is not parsed into what it means. SQlite just uses its regular string conversion routines which don't match here");
      stmt.reset();
      stmt.clearBindings();
    });
    assert.isTrue(slm.finishAndDispose());
  });

  it("should bind numbers", async () => {
    using ecdb = ECDbTestHelper.createECDb(outDir, "bindnumbers.ecdb",
      `<ECSchema schemaName="Test" alias="test" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
    <ECEntityClass typeName="Foo" modifier="Sealed">
      <ECProperty propertyName="D" typeName="double"/>
      <ECProperty propertyName="I" typeName="int"/>
      <ECProperty propertyName="L" typeName="long"/>
      <ECProperty propertyName="S" typeName="string"/>
      <ECProperty propertyName="Description" typeName="string"/>
    </ECEntityClass>
    </ECSchema>`);
    assert.isTrue(ecdb.isOpen);

    const doubleVal: number = 3.5;
    let id = await ecdb.withCachedWriteStatement("INSERT INTO Test.Foo(D,I,L,S,Description) VALUES(?,?,?,?,'bindDouble')", async (stmt: ECSqlWriteStatement) => {
      stmt.bindDouble(1, doubleVal);
      stmt.bindDouble(2, doubleVal);
      stmt.bindDouble(3, doubleVal);
      stmt.bindDouble(4, doubleVal);
      const r: ECSqlInsertResult = stmt.stepForInsert();
      assert.equal(r.status, DbResult.BE_SQLITE_DONE);
      return r.id!;
    });

    // eslint-disable-next-line @typescript-eslint/no-deprecated
    await ecdb.withPreparedStatement("SELECT D,I,L,S FROM Test.Foo WHERE ECInstanceId=?", async (stmt: ECSqlStatement) => {
      stmt.bindId(1, id);
      assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
      const row = stmt.getRow();
      assert.equal(row.d, doubleVal);
      assert.equal(row.i, 3);
      assert.equal(row.l, 3);
      assert.equal(row.s, "3.5");
    });

    assert.equal(await query(ecdb, "SELECT D,I,L,S FROM Test.Foo WHERE ECInstanceId=?", QueryBinder.from([id]), { limit: { count: 1 } }, (row: any) => {
      assert.equal(row.d, doubleVal);
      assert.equal(row.i, 3);
      assert.equal(row.l, 3);
      assert.equal(row.s, "3.5");
    }), 1);

    const smallIntVal: number = 3;
    id = ecdb.withCachedWriteStatement("INSERT INTO Test.Foo(D,I,L,S,Description) VALUES(?,?,?,?,'bindInteger, small int')", (stmt: ECSqlWriteStatement) => {
      stmt.bindInteger(1, smallIntVal);
      stmt.bindInteger(2, smallIntVal);
      stmt.bindInteger(3, smallIntVal);
      stmt.bindInteger(4, smallIntVal);
      const r: ECSqlInsertResult = stmt.stepForInsert();
      assert.equal(r.status, DbResult.BE_SQLITE_DONE);
      return r.id!;
    });

    // eslint-disable-next-line @typescript-eslint/no-deprecated
    ecdb.withPreparedStatement("SELECT D,I,L,S FROM Test.Foo WHERE ECInstanceId=?", (stmt: ECSqlStatement) => {
      stmt.bindId(1, id);
      assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
      const row = stmt.getRow();
      assert.equal(row.d, smallIntVal);
      assert.equal(row.i, smallIntVal);
      assert.equal(row.l, smallIntVal);
      assert.equal(row.s, "3");
    });

    assert.equal(await query(ecdb, "SELECT D,I,L,S FROM Test.Foo WHERE ECInstanceId=?", QueryBinder.from([id]), selectSingleRow, (row: any) => {
      assert.equal(row.d, smallIntVal);
      assert.equal(row.i, smallIntVal);
      assert.equal(row.l, smallIntVal);
      assert.equal(row.s, "3");
    }), 1);

    const largeUnsafeNumber: number = 12312312312312323654; // too large for int64, but fits into uint64
    assert.isFalse(Number.isSafeInteger(largeUnsafeNumber));
    const largeUnsafeNumberStr: string = "12312312312312323654";
    const largeUnsafeNumberHexStr: string = "0xaade1ed08b0b5e46";

    id = ecdb.withCachedWriteStatement("INSERT INTO Test.Foo(D,I,L,S,Description) VALUES(?,?,?,?,'bindInteger, large unsafe number as string')", (stmt: ECSqlWriteStatement) => {
      stmt.bindInteger(1, largeUnsafeNumberStr);
      stmt.bindInteger(2, largeUnsafeNumberStr);
      stmt.bindInteger(3, largeUnsafeNumberStr);
      stmt.bindInteger(4, largeUnsafeNumberStr);
      const r: ECSqlInsertResult = stmt.stepForInsert();
      assert.equal(r.status, DbResult.BE_SQLITE_DONE);
      return r.id!;
    });

    // eslint-disable-next-line @typescript-eslint/no-deprecated
    ecdb.withPreparedStatement("SELECT Str(I) si, HexStr(I) hi, Str(L) sl, HexStr(L) hl FROM Test.Foo WHERE ECInstanceId=?", (stmt: ECSqlStatement) => {
      stmt.bindId(1, id);
      assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
      const row = stmt.getRow();
      assert.equal(row.si, largeUnsafeNumberStr);
      assert.equal(row.hi, largeUnsafeNumberHexStr);
      assert.equal(row.sl, largeUnsafeNumberStr);
      assert.equal(row.hl, largeUnsafeNumberHexStr);
    });

    // assert.equal(await query(ecdb, "SELECT Str(I) si, HexStr(I) hi, Str(L) sl, HexStr(L) hl FROM Test.Foo WHERE ECInstanceId=?", [id], 1, (row: any) => {
    //   assert.equal(row.si, largeUnsafeNumberStr);
    //   assert.equal(row.hi, largeUnsafeNumberHexStr);
    //   assert.equal(row.sl, largeUnsafeNumberStr);
    //   assert.equal(row.hl, largeUnsafeNumberHexStr);
    // }), 1);

    id = ecdb.withCachedWriteStatement("INSERT INTO Test.Foo(D,I,L,S,Description) VALUES(?,?,?,?,'bindInteger, large unsafe number as hexstring')", (stmt: ECSqlWriteStatement) => {
      stmt.bindInteger(1, largeUnsafeNumberHexStr);
      stmt.bindInteger(2, largeUnsafeNumberHexStr);
      stmt.bindInteger(3, largeUnsafeNumberHexStr);
      stmt.bindInteger(4, largeUnsafeNumberHexStr);
      const r: ECSqlInsertResult = stmt.stepForInsert();
      assert.equal(r.status, DbResult.BE_SQLITE_DONE);
      return r.id!;
    });

    // eslint-disable-next-line @typescript-eslint/no-deprecated
    ecdb.withPreparedStatement("SELECT Str(I) si, HexStr(I) hi, Str(L) sl, HexStr(L) hl FROM Test.Foo WHERE ECInstanceId=?", (stmt: ECSqlStatement) => {
      stmt.bindId(1, id);
      assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
      const row = stmt.getRow();
      assert.equal(row.si, largeUnsafeNumberStr);
      assert.equal(row.hi, largeUnsafeNumberHexStr);
      assert.equal(row.sl, largeUnsafeNumberStr);
      assert.equal(row.hl, largeUnsafeNumberHexStr);
    });

    // assert.equal(await query(ecdb, "SELECT Str(I) si, HexStr(I) hi, Str(L) sl, HexStr(L) hl FROM Test.Foo WHERE ECInstanceId=?", [id], 1, (row: any) => {
    //   assert.equal(row.si, largeUnsafeNumberStr);
    //   assert.equal(row.hi, largeUnsafeNumberHexStr);
    //   assert.equal(row.sl, largeUnsafeNumberStr);
    //   assert.equal(row.hl, largeUnsafeNumberHexStr);
    // }), 1);

    id = ecdb.withCachedWriteStatement("INSERT INTO Test.Foo(D,I,L,S,Description) VALUES(?,?,?,?,'bindString, large unsafe number as string')", (stmt: ECSqlWriteStatement) => {
      stmt.bindString(1, largeUnsafeNumberStr);
      stmt.bindString(2, largeUnsafeNumberStr);
      stmt.bindString(3, largeUnsafeNumberStr);
      stmt.bindString(4, largeUnsafeNumberStr);
      const r: ECSqlInsertResult = stmt.stepForInsert();
      assert.equal(r.status, DbResult.BE_SQLITE_DONE);
      return r.id!;
    });

    // uint64 cannot be bound as string in SQLite. They get converted to reals
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    ecdb.withPreparedStatement("SELECT D,I,L,S FROM Test.Foo WHERE ECInstanceId=?", (stmt: ECSqlStatement) => {
      stmt.bindId(1, id);
      assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
      const row = stmt.getRow();
      assert.isNumber(row.d);
      assert.isNumber(row.i);
      assert.isNumber(row.l);
      assert.equal(row.s, largeUnsafeNumberStr);
    });

    assert.equal(await query(ecdb, "SELECT D,I,L,S FROM Test.Foo WHERE ECInstanceId=?", QueryBinder.from([id]), selectSingleRow, (row: any) => {
      assert.isNumber(row.d);
      assert.isNumber(row.i);
      assert.isNumber(row.l);
      assert.equal(row.s, largeUnsafeNumberStr);
    }), 1);

    id = ecdb.withCachedWriteStatement("INSERT INTO Test.Foo(D,I,L,S,Description) VALUES(?,?,?,?,'bindString, large unsafe number as hexstring')", (stmt: ECSqlWriteStatement) => {
      stmt.bindString(1, largeUnsafeNumberHexStr);
      stmt.bindString(2, largeUnsafeNumberHexStr);
      stmt.bindString(3, largeUnsafeNumberHexStr);
      stmt.bindString(4, largeUnsafeNumberHexStr);
      const r: ECSqlInsertResult = stmt.stepForInsert();
      assert.equal(r.status, DbResult.BE_SQLITE_DONE);
      return r.id!;
    });

    // eslint-disable-next-line @typescript-eslint/no-deprecated
    ecdb.withPreparedStatement("SELECT CAST(D AS TEXT) d,CAST(I AS TEXT) i,CAST(L AS TEXT) l,S FROM Test.Foo WHERE ECInstanceId=?", (stmt: ECSqlStatement) => {
      stmt.bindId(1, id);
      assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
      const row = stmt.getRow();
      assert.equal(row.d, largeUnsafeNumberHexStr);
      assert.equal(row.i, largeUnsafeNumberHexStr);
      assert.equal(row.l, largeUnsafeNumberHexStr);
      assert.equal(row.s, largeUnsafeNumberHexStr);
    });

    assert.equal(await query(ecdb, "SELECT CAST(D AS TEXT) d,CAST(I AS TEXT) i,CAST(L AS TEXT) l,S FROM Test.Foo WHERE ECInstanceId=?", QueryBinder.from([id]), selectSingleRow, (row: any) => {
      assert.equal(row.d, largeUnsafeNumberHexStr);
      assert.equal(row.i, largeUnsafeNumberHexStr);
      assert.equal(row.l, largeUnsafeNumberHexStr);
      assert.equal(row.s, largeUnsafeNumberHexStr);
    }), 1);

    const largeNegUnsafeNumber: number = -123123123123123236;
    assert.isFalse(Number.isSafeInteger(largeNegUnsafeNumber));
    const largeNegUnsafeNumberStr: string = "-123123123123123236";

    id = ecdb.withCachedWriteStatement("INSERT INTO Test.Foo(D,I,L,S,Description) VALUES(?,?,?,?,'bindInteger, large negative unsafe number as string')", (stmt: ECSqlWriteStatement) => {
      stmt.bindInteger(1, largeNegUnsafeNumberStr);
      stmt.bindInteger(2, largeNegUnsafeNumberStr);
      stmt.bindInteger(3, largeNegUnsafeNumberStr);
      stmt.bindInteger(4, largeNegUnsafeNumberStr);
      const r: ECSqlInsertResult = stmt.stepForInsert();
      assert.equal(r.status, DbResult.BE_SQLITE_DONE);
      return r.id!;
    });

    // eslint-disable-next-line @typescript-eslint/no-deprecated
    ecdb.withPreparedStatement("SELECT CAST(I AS TEXT) i, CAST(L AS TEXT) l,S FROM Test.Foo WHERE ECInstanceId=?", (stmt: ECSqlStatement) => {
      stmt.bindId(1, id);
      assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
      const row = stmt.getRow();
      assert.equal(row.i, largeNegUnsafeNumberStr);
      assert.equal(row.l, largeNegUnsafeNumberStr);
      assert.equal(row.s, largeNegUnsafeNumberStr);
    });

    assert.equal(await query(ecdb, "SELECT CAST(I AS TEXT) i, CAST(L AS TEXT) l,S FROM Test.Foo WHERE ECInstanceId=?", QueryBinder.from([id]), selectSingleRow, (row: any) => {
      assert.equal(row.i, largeNegUnsafeNumberStr);
      assert.equal(row.l, largeNegUnsafeNumberStr);
      assert.equal(row.s, largeNegUnsafeNumberStr);
    }), 1);

    id = ecdb.withCachedWriteStatement("INSERT INTO Test.Foo(D,I,L,S,Description) VALUES(?,?,?,?,'bindString, large negative unsafe number as string')", (stmt: ECSqlWriteStatement) => {
      stmt.bindString(1, largeNegUnsafeNumberStr);
      stmt.bindString(2, largeNegUnsafeNumberStr);
      stmt.bindString(3, largeNegUnsafeNumberStr);
      stmt.bindString(4, largeNegUnsafeNumberStr);
      const r: ECSqlInsertResult = stmt.stepForInsert();
      assert.equal(r.status, DbResult.BE_SQLITE_DONE);
      return r.id!;
    });

    // eslint-disable-next-line @typescript-eslint/no-deprecated
    ecdb.withPreparedStatement("SELECT CAST(I AS TEXT) i, CAST(L AS TEXT) l,S FROM Test.Foo WHERE ECInstanceId=?", (stmt: ECSqlStatement) => {
      stmt.bindId(1, id);
      assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
      const row = stmt.getRow();
      assert.equal(row.i, largeNegUnsafeNumberStr);
      assert.equal(row.l, largeNegUnsafeNumberStr);
      assert.equal(row.s, largeNegUnsafeNumberStr);
    });

    assert.equal(await query(ecdb, "SELECT CAST(I AS TEXT) i, CAST(L AS TEXT) l,S FROM Test.Foo WHERE ECInstanceId=?", QueryBinder.from([id]), selectSingleRow, (row: any) => {
      assert.equal(row.i, largeNegUnsafeNumberStr);
      assert.equal(row.l, largeNegUnsafeNumberStr);
      assert.equal(row.s, largeNegUnsafeNumberStr);
    }), 1);

    const largeSafeNumber: number = 1231231231231232;
    assert.isTrue(Number.isSafeInteger(largeSafeNumber));
    const largeSafeNumberStr: string = largeSafeNumber.toString();
    const largeSafeNumberHexStr: string = "0x45fcc5c2c8500";

    id = ecdb.withCachedWriteStatement("INSERT INTO Test.Foo(D,I,L,S,Description) VALUES(?,?,?,?,'bindInteger, large safe number')", (stmt: ECSqlWriteStatement) => {
      stmt.bindInteger(1, largeSafeNumber);
      stmt.bindInteger(2, largeSafeNumber);
      stmt.bindInteger(3, largeSafeNumber);
      stmt.bindInteger(4, largeSafeNumber);
      const r: ECSqlInsertResult = stmt.stepForInsert();
      assert.equal(r.status, DbResult.BE_SQLITE_DONE);
      return r.id!;
    });

    // eslint-disable-next-line @typescript-eslint/no-deprecated
    ecdb.withPreparedStatement("SELECT D,I, Str(I) si, HexStr(I) hi, L, Str(L) sl, HexStr(L) hl,S FROM Test.Foo WHERE ECInstanceId=?", (stmt: ECSqlStatement) => {
      stmt.bindId(1, id);
      assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
      const row = stmt.getRow();
      assert.equal(row.d, largeSafeNumber);
      assert.equal(row.i, largeSafeNumber);
      assert.equal(row.si, largeSafeNumberStr);
      assert.equal(row.hi, largeSafeNumberHexStr);
      assert.equal(row.l, largeSafeNumber);
      assert.equal(row.sl, largeSafeNumberStr);
      assert.equal(row.hl, largeSafeNumberHexStr);
      assert.equal(row.s, largeSafeNumberStr);
    });

    // await query(ecdb, "SELECT D,I, Str(I) si, HexStr(I) hi, L, Str(L) sl, HexStr(L) hl,S FROM Test.Foo WHERE ECInstanceId=?", [id], 1, (row: any) => {
    //   assert.equal(row.d, largeSafeNumber);
    //   assert.equal(row.i, largeSafeNumber);
    //   assert.equal(row.si, largeSafeNumberStr);
    //   assert.equal(row.hi, largeSafeNumberHexStr);
    //   assert.equal(row.l, largeSafeNumber);
    //   assert.equal(row.sl, largeSafeNumberStr);
    //   assert.equal(row.hl, largeSafeNumberHexStr);
    //   assert.equal(row.s, largeSafeNumberStr);
    // });

    id = ecdb.withCachedWriteStatement("INSERT INTO Test.Foo(D,I,L,S,Description) VALUES(?,?,?,?,'bindInteger, large safe number as string')", (stmt: ECSqlWriteStatement) => {
      stmt.bindInteger(1, largeSafeNumberStr);
      stmt.bindInteger(2, largeSafeNumberStr);
      stmt.bindInteger(3, largeSafeNumberStr);
      stmt.bindInteger(4, largeSafeNumberStr);
      const r: ECSqlInsertResult = stmt.stepForInsert();
      assert.equal(r.status, DbResult.BE_SQLITE_DONE);
      return r.id!;
    });

    // eslint-disable-next-line @typescript-eslint/no-deprecated
    ecdb.withPreparedStatement("SELECT D,I,L,S FROM Test.Foo WHERE ECInstanceId=?", (stmt: ECSqlStatement) => {
      stmt.bindId(1, id);
      assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
      const row = stmt.getRow();
      assert.equal(row.d, largeSafeNumber);
      assert.equal(row.i, largeSafeNumber);
      assert.equal(row.l, largeSafeNumber);
      assert.equal(row.s, largeSafeNumberStr);
    });

    assert.equal(await query(ecdb, "SELECT D,I,L,S FROM Test.Foo WHERE ECInstanceId=?", QueryBinder.from([id]), selectSingleRow, (row: any) => {
      assert.equal(row.d, largeSafeNumber);
      assert.equal(row.i, largeSafeNumber);
      assert.equal(row.l, largeSafeNumber);
      assert.equal(row.s, largeSafeNumberStr);
    }), 1);

    id = ecdb.withCachedWriteStatement("INSERT INTO Test.Foo(D,I,L,S,Description) VALUES(?,?,?,?,'bindInteger, large safe number as hexstring')", (stmt: ECSqlWriteStatement) => {
      stmt.bindInteger(1, largeSafeNumberHexStr);
      stmt.bindInteger(2, largeSafeNumberHexStr);
      stmt.bindInteger(3, largeSafeNumberHexStr);
      stmt.bindInteger(4, largeSafeNumberHexStr);
      const r: ECSqlInsertResult = stmt.stepForInsert();
      assert.equal(r.status, DbResult.BE_SQLITE_DONE);
      return r.id!;
    });

    // eslint-disable-next-line @typescript-eslint/no-deprecated
    ecdb.withPreparedStatement("SELECT D,I,L,S FROM Test.Foo WHERE ECInstanceId=?", (stmt: ECSqlStatement) => {
      stmt.bindId(1, id);
      assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
      const row = stmt.getRow();
      assert.equal(row.d, largeSafeNumber);
      assert.equal(row.i, largeSafeNumber);
      assert.equal(row.l, largeSafeNumber);
      assert.equal(row.s, largeSafeNumberStr); // even though it was bound as hex str, it gets converted to int64 before persisting
    });

    assert.equal(await query(ecdb, "SELECT D,I,L,S FROM Test.Foo WHERE ECInstanceId=?", QueryBinder.from([id]), selectSingleRow, (row: any) => {
      assert.equal(row.d, largeSafeNumber);
      assert.equal(row.i, largeSafeNumber);
      assert.equal(row.l, largeSafeNumber);
      assert.equal(row.s, largeSafeNumberStr); // even though it was bound as hex str, it gets converted to int64 before persisting
    }), 1);

    id = ecdb.withCachedWriteStatement("INSERT INTO Test.Foo(D,I,L,S,Description) VALUES(?,?,?,?,'bindString, large safe number as string')", (stmt: ECSqlWriteStatement) => {
      stmt.bindString(1, largeSafeNumberStr);
      stmt.bindString(2, largeSafeNumberStr);
      stmt.bindString(3, largeSafeNumberStr);
      stmt.bindString(4, largeSafeNumberStr);
      const r: ECSqlInsertResult = stmt.stepForInsert();
      assert.equal(r.status, DbResult.BE_SQLITE_DONE);
      return r.id!;
    });

    // eslint-disable-next-line @typescript-eslint/no-deprecated
    ecdb.withPreparedStatement("SELECT D,I,L,S FROM Test.Foo WHERE ECInstanceId=?", (stmt: ECSqlStatement) => {
      stmt.bindId(1, id);
      assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
      const row = stmt.getRow();
      assert.equal(row.d, largeSafeNumber);
      assert.equal(row.i, largeSafeNumber);
      assert.equal(row.l, largeSafeNumber);
      assert.equal(row.s, largeSafeNumberStr);
    });

    assert.equal(await query(ecdb, "SELECT D,I,L,S FROM Test.Foo WHERE ECInstanceId=?", QueryBinder.from([id]), selectSingleRow, (row: any) => {
      assert.equal(row.d, largeSafeNumber);
      assert.equal(row.i, largeSafeNumber);
      assert.equal(row.l, largeSafeNumber);
      assert.equal(row.s, largeSafeNumberStr); // even though it was bound as hex str, it gets converted to int64 before persisting
    }), 1);

    // SQLite does not parse hex strs bound as strings.
    id = ecdb.withCachedWriteStatement("INSERT INTO Test.Foo(D,I,L,S,Description) VALUES(?,?,?,?,'bindString, large safe number as hexstring')", (stmt: ECSqlWriteStatement) => {
      stmt.bindString(1, largeSafeNumberHexStr);
      stmt.bindString(2, largeSafeNumberHexStr);
      stmt.bindString(3, largeSafeNumberHexStr);
      stmt.bindString(4, largeSafeNumberHexStr);
      const r: ECSqlInsertResult = stmt.stepForInsert();
      assert.equal(r.status, DbResult.BE_SQLITE_DONE);
      return r.id!;
    });

    // eslint-disable-next-line @typescript-eslint/no-deprecated
    ecdb.withPreparedStatement("SELECT CAST(D AS TEXT) d,CAST(I AS TEXT) i,CAST(L AS TEXT) l,S FROM Test.Foo WHERE ECInstanceId=?", (stmt: ECSqlStatement) => {
      stmt.bindId(1, id);
      assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
      const row = stmt.getRow();
      assert.equal(row.d, largeSafeNumberHexStr);
      assert.equal(row.i, largeSafeNumberHexStr);
      assert.equal(row.l, largeSafeNumberHexStr);
      assert.equal(row.s, largeSafeNumberHexStr);
    });

    assert.equal(await query(ecdb, "SELECT CAST(D AS TEXT) d,CAST(I AS TEXT) i,CAST(L AS TEXT) l,S FROM Test.Foo WHERE ECInstanceId=?", QueryBinder.from([id]), selectSingleRow, (row: any) => {
      assert.equal(row.d, largeSafeNumberHexStr);
      assert.equal(row.i, largeSafeNumberHexStr);
      assert.equal(row.l, largeSafeNumberHexStr);
      assert.equal(row.s, largeSafeNumberHexStr);
    }), 1);

    const largeNegSafeNumber: number = -1231231231231232;
    assert.isTrue(Number.isSafeInteger(largeNegSafeNumber));
    const largeNegSafeNumberStr: string = largeNegSafeNumber.toString();

    id = ecdb.withCachedWriteStatement("INSERT INTO Test.Foo(D,I,L,S,Description) VALUES(?,?,?,?,'bindInteger, large negative safe number')", (stmt: ECSqlWriteStatement) => {
      stmt.bindInteger(1, largeNegSafeNumber);
      stmt.bindInteger(2, largeNegSafeNumber);
      stmt.bindInteger(3, largeNegSafeNumber);
      stmt.bindInteger(4, largeNegSafeNumber);
      const r: ECSqlInsertResult = stmt.stepForInsert();
      assert.equal(r.status, DbResult.BE_SQLITE_DONE);
      return r.id!;
    });

    // eslint-disable-next-line @typescript-eslint/no-deprecated
    ecdb.withPreparedStatement("SELECT D,I,L,S FROM Test.Foo WHERE ECInstanceId=?", (stmt: ECSqlStatement) => {
      stmt.bindId(1, id);
      assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
      const row = stmt.getRow();
      assert.equal(row.d, largeNegSafeNumber);
      assert.equal(row.i, largeNegSafeNumber);
      assert.equal(row.l, largeNegSafeNumber);
      assert.equal(row.s, largeNegSafeNumberStr);
    });

    assert.equal(await query(ecdb, "SELECT D,I,L,S FROM Test.Foo WHERE ECInstanceId=?", QueryBinder.from([id]), selectSingleRow, (row: any) => {
      assert.equal(row.d, largeNegSafeNumber);
      assert.equal(row.i, largeNegSafeNumber);
      assert.equal(row.l, largeNegSafeNumber);
      assert.equal(row.s, largeNegSafeNumberStr);
    }), 1);

    id = ecdb.withCachedWriteStatement("INSERT INTO Test.Foo(D,I,L,S,Description) VALUES(?,?,?,?,'bindInteger, large negative safe number as string')", (stmt: ECSqlWriteStatement) => {
      stmt.bindInteger(1, largeNegSafeNumberStr);
      stmt.bindInteger(2, largeNegSafeNumberStr);
      stmt.bindInteger(3, largeNegSafeNumberStr);
      stmt.bindInteger(4, largeNegSafeNumberStr);
      const r: ECSqlInsertResult = stmt.stepForInsert();
      assert.equal(r.status, DbResult.BE_SQLITE_DONE);
      return r.id!;
    });

    // eslint-disable-next-line @typescript-eslint/no-deprecated
    ecdb.withPreparedStatement("SELECT D,I,L,S FROM Test.Foo WHERE ECInstanceId=?", (stmt: ECSqlStatement) => {
      stmt.bindId(1, id);
      assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
      const row = stmt.getRow();
      assert.equal(row.d, largeNegSafeNumber);
      assert.equal(row.i, largeNegSafeNumber);
      assert.equal(row.l, largeNegSafeNumber);
      assert.equal(row.s, largeNegSafeNumberStr);
    });

    await query(ecdb, "SELECT D,I,L,S FROM Test.Foo WHERE ECInstanceId=?", QueryBinder.from([id]), selectSingleRow, (row: any) => {
      assert.equal(row.d, largeNegSafeNumber);
      assert.equal(row.i, largeNegSafeNumber);
      assert.equal(row.l, largeNegSafeNumber);
      assert.equal(row.s, largeNegSafeNumberStr);
    });

    id = ecdb.withCachedWriteStatement("INSERT INTO Test.Foo(D,I,L,S,Description) VALUES(?,?,?,?,'bindString, large negative safe number as string')", (stmt: ECSqlWriteStatement) => {
      stmt.bindString(1, largeNegSafeNumberStr);
      stmt.bindString(2, largeNegSafeNumberStr);
      stmt.bindString(3, largeNegSafeNumberStr);
      stmt.bindString(4, largeNegSafeNumberStr);
      const r: ECSqlInsertResult = stmt.stepForInsert();
      assert.equal(r.status, DbResult.BE_SQLITE_DONE);
      return r.id!;
    });

    // eslint-disable-next-line @typescript-eslint/no-deprecated
    ecdb.withPreparedStatement("SELECT D,I,L,S FROM Test.Foo WHERE ECInstanceId=?", (stmt: ECSqlStatement) => {
      stmt.bindId(1, id);
      assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
      const row = stmt.getRow();
      assert.equal(row.d, largeNegSafeNumber);
      assert.equal(row.i, largeNegSafeNumber);
      assert.equal(row.l, largeNegSafeNumber);
      assert.equal(row.s, largeNegSafeNumberStr);
    });

    await query(ecdb, "SELECT D,I,L,S FROM Test.Foo WHERE ECInstanceId=?", QueryBinder.from([id]), selectSingleRow, (row: any) => {
      assert.equal(row.d, largeNegSafeNumber);
      assert.equal(row.i, largeNegSafeNumber);
      assert.equal(row.l, largeNegSafeNumber);
      assert.equal(row.s, largeNegSafeNumberStr);
    });

  });

  it("should bind primitives", async () => {
    using ecdb = ECDbTestHelper.createECDb(outDir, "bindprimitives.ecdb",
      `<ECSchema schemaName="Test" alias="test" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
  <ECStructClass typeName="MyStruct" modifier="Sealed">
      <ECProperty propertyName="Bl" typeName="binary"/>
      <ECProperty propertyName="Bo" typeName="boolean"/>
      <ECProperty propertyName="D" typeName="double"/>
      <ECProperty propertyName="Dt" typeName="dateTime"/>
      <ECProperty propertyName="G" typeName="Bentley.Geometry.Common.IGeometry"/>
      <ECProperty propertyName="I" typeName="int"/>
      <ECProperty propertyName="L" typeName="long"/>
      <ECProperty propertyName="P2d" typeName="Point2d"/>
      <ECProperty propertyName="P3d" typeName="Point3d"/>
      <ECProperty propertyName="S" typeName="string"/>
    </ECStructClass>
    <ECEntityClass typeName="Foo" modifier="Sealed">
      <ECProperty propertyName="Bl" typeName="binary"/>
      <ECProperty propertyName="Bo" typeName="boolean"/>
      <ECProperty propertyName="D" typeName="double"/>
      <ECProperty propertyName="Dt" typeName="dateTime"/>
      <ECProperty propertyName="G" typeName="Bentley.Geometry.Common.IGeometry"/>
      <ECProperty propertyName="I" typeName="int"/>
      <ECProperty propertyName="L" typeName="long"/>
      <ECProperty propertyName="P2d" typeName="Point2d"/>
      <ECProperty propertyName="P3d" typeName="Point3d"/>
      <ECProperty propertyName="S" typeName="string"/>
      <ECStructProperty propertyName="Struct" typeName="MyStruct"/>
    </ECEntityClass>
    </ECSchema>`);
    assert.isTrue(ecdb.isOpen);

    const boolVal = true;
    const doubleVal = 3.5;
    const dtVal: string = "2018-01-23T12:24:00.000";
    const intVal = 3;
    const p2dVal = new Point2d(1, 2);
    const p3dVal = new Point3d(1, 2, 3);
    const strVal: string = "Hello world";

    const verify = async (expectedId: Id64String) => {
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      await ecdb.withPreparedStatement("SELECT Bl,Bo,D,Dt,I,P2d,P3d,S,Struct.Bl s_bl,Struct.Bo s_bo,Struct.D s_d,Struct.Dt s_dt,Struct.I s_i,Struct.P2d s_p2d,Struct.P3d s_p3d,Struct.S s_s FROM test.Foo WHERE ECInstanceId=?", async (stmt: ECSqlStatement) => {
        stmt.bindId(1, expectedId);
        assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
        const row = stmt.getRow();
        assert.deepEqual(row.bl, blobVal);
        const f64 = new Float64Array(row.bl.buffer);
        const r2 = new Range3d(...f64);
        assert.deepEqual(r2, testRange);
        assert.equal(row.bo, boolVal);
        assert.equal(row.d, doubleVal);
        assert.equal(row.dt, dtVal);
        assert.equal(row.i, intVal);
        assert.equal(row.p2d.x, p2dVal.x);
        assert.equal(row.p2d.y, p2dVal.y);
        assert.equal(row.p3d.x, p3dVal.x);
        assert.equal(row.p3d.y, p3dVal.y);
        assert.equal(row.p3d.z, p3dVal.z);
        assert.equal(row.s, strVal);

        assert.deepEqual(row.s_bl, blobVal);
        assert.equal(row.s_bo, boolVal);
        assert.equal(row.s_d, doubleVal);
        assert.equal(row.s_dt, dtVal);
        assert.equal(row.s_i, intVal);
        assert.equal(row.s_p2d.x, p2dVal.x);
        assert.equal(row.s_p2d.y, p2dVal.y);
        assert.equal(row.s_p3d.x, p3dVal.x);
        assert.equal(row.s_p3d.y, p3dVal.y);
        assert.equal(row.s_p3d.z, p3dVal.z);
        assert.equal(row.s_s, strVal);

        assert.equal(await query(ecdb, "SELECT Bl,Bo,D,Dt,I,P2d,P3d,S,Struct.Bl s_bl,Struct.Bo s_bo,Struct.D s_d,Struct.Dt s_dt,Struct.I s_i,Struct.P2d s_p2d,Struct.P3d s_p3d,Struct.S s_s FROM test.Foo WHERE ECInstanceId=?", QueryBinder.from([expectedId]), selectSingleRow, (row1: any) => {
          assert.deepEqual(row1.bl, blobVal);
          const f64a = new Float64Array(row1.bl.buffer);
          const r2a = new Range3d(...f64a);
          assert.deepEqual(r2a, testRange);
          assert.equal(row1.bo, boolVal);
          assert.equal(row1.d, doubleVal);
          assert.equal(row1.dt, dtVal);
          assert.equal(row1.i, intVal);
          assert.equal(row1.p2d.x, p2dVal.x);
          assert.equal(row1.p2d.y, p2dVal.y);
          assert.equal(row1.p3d.x, p3dVal.x);
          assert.equal(row1.p3d.y, p3dVal.y);
          assert.equal(row1.p3d.z, p3dVal.z);
          assert.equal(row1.s, strVal);

          assert.deepEqual(row1.s_bl, blobVal);
          assert.equal(row1.s_bo, boolVal);
          assert.equal(row1.s_d, doubleVal);
          assert.equal(row1.s_dt, dtVal);
          assert.equal(row1.s_i, intVal);
          assert.equal(row1.s_p2d.x, p2dVal.x);
          assert.equal(row1.s_p2d.y, p2dVal.y);
          assert.equal(row1.s_p3d.x, p3dVal.x);
          assert.equal(row1.s_p3d.y, p3dVal.y);
          assert.equal(row1.s_p3d.z, p3dVal.z);
          assert.equal(row1.s_s, strVal);
        }), 1);
      });
    };

    const ids = new Array<Id64String>();
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    ecdb.withPreparedStatement("INSERT INTO test.Foo(Bl,Bo,D,Dt,I,P2d,P3d,S,Struct.Bl,Struct.Bo,Struct.D,Struct.Dt,Struct.I,Struct.P2d,Struct.P3d,Struct.S) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", (stmt: ECSqlStatement) => {
      stmt.bindBlob(1, blobVal);
      stmt.bindBoolean(2, boolVal);
      stmt.bindDouble(3, doubleVal);
      stmt.bindDateTime(4, dtVal);
      stmt.bindInteger(5, intVal);
      stmt.bindPoint2d(6, p2dVal);
      stmt.bindPoint3d(7, p3dVal);
      stmt.bindString(8, strVal);
      stmt.bindBlob(9, blobVal);
      stmt.bindBoolean(10, boolVal);
      stmt.bindDouble(11, doubleVal);
      stmt.bindDateTime(12, dtVal);
      stmt.bindInteger(13, intVal);
      stmt.bindPoint2d(14, p2dVal);
      stmt.bindPoint3d(15, p3dVal);
      stmt.bindString(16, strVal);

      let res: ECSqlInsertResult = stmt.stepForInsert();
      assert.equal(res.status, DbResult.BE_SQLITE_DONE);
      ids.push(res.id!);
      stmt.reset();
      stmt.clearBindings();
      stmt.bindValues([blobVal, boolVal, doubleVal, dtVal, intVal, p2dVal, p3dVal, strVal, blobVal, boolVal, doubleVal, dtVal, intVal, p2dVal, p3dVal, strVal]);

      res = stmt.stepForInsert();
      assert.equal(res.status, DbResult.BE_SQLITE_DONE);
      ids.push(res.id!);
    });

    // eslint-disable-next-line @typescript-eslint/no-deprecated
    ecdb.withPreparedStatement("INSERT INTO test.Foo(Bl,Bo,D,Dt,I,P2d,P3d,S,Struct.Bl,Struct.Bo,Struct.D,Struct.Dt,Struct.I,Struct.P2d,Struct.P3d,Struct.S) VALUES(:bl,:bo,:d,:dt,:i,:p2d,:p3d,:s,:s_bl,:s_bo,:s_d,:s_dt,:s_i,:s_p2d,:s_p3d,:s_s)", (stmt: ECSqlStatement) => {
      stmt.bindBlob("bl", blobVal);
      stmt.bindBoolean("bo", boolVal);
      stmt.bindDouble("d", doubleVal);
      stmt.bindDateTime("dt", dtVal);
      stmt.bindInteger("i", intVal);
      stmt.bindPoint2d("p2d", p2dVal);
      stmt.bindPoint3d("p3d", p3dVal);
      stmt.bindString("s", strVal);

      stmt.bindBlob("s_bl", blobVal);
      stmt.bindBoolean("s_bo", boolVal);
      stmt.bindDouble("s_d", doubleVal);
      stmt.bindDateTime("s_dt", dtVal);
      stmt.bindInteger("s_i", intVal);
      stmt.bindPoint2d("s_p2d", p2dVal);
      stmt.bindPoint3d("s_p3d", p3dVal);
      stmt.bindString("s_s", strVal);

      let res: ECSqlInsertResult = stmt.stepForInsert();
      assert.equal(res.status, DbResult.BE_SQLITE_DONE);
      ids.push(res.id!);
      stmt.reset();
      stmt.clearBindings();
      stmt.bindValues({
        bl: blobVal, bo: boolVal, d: doubleVal, dt: dtVal,
        i: intVal, p2d: p2dVal, p3d: p3dVal, s: strVal,
        s_bl: blobVal, s_bo: boolVal, s_d: doubleVal, s_dt: dtVal,
        s_i: intVal, s_p2d: p2dVal, s_p3d: p3dVal, s_s: strVal,
      });

      res = stmt.stepForInsert();
      assert.equal(res.status, DbResult.BE_SQLITE_DONE);
      ids.push(res.id!);
    });

    for (const id of ids) {
      await verify(id);
    }
  });

  it("should bind structs", async () => {
    using ecdb = ECDbTestHelper.createECDb(outDir, "bindstructs.ecdb",
      `<ECSchema schemaName="Test" alias="test" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
      <ECStructClass typeName="MyStruct" modifier="Sealed">
        <ECProperty propertyName="Bl" typeName="binary"/>
        <ECProperty propertyName="Bo" typeName="boolean"/>
        <ECProperty propertyName="D" typeName="double"/>
        <ECProperty propertyName="Dt" typeName="dateTime"/>
        <ECProperty propertyName="G" typeName="Bentley.Geometry.Common.IGeometry"/>
        <ECProperty propertyName="I" typeName="int"/>
        <ECProperty propertyName="L" typeName="long"/>
        <ECProperty propertyName="P2d" typeName="Point2d"/>
        <ECProperty propertyName="P3d" typeName="Point3d"/>
        <ECProperty propertyName="S" typeName="string"/>
      </ECStructClass>
      <ECEntityClass typeName="Foo" modifier="Sealed">
        <ECStructProperty propertyName="Struct" typeName="MyStruct"/>
      </ECEntityClass>
      </ECSchema>`);
    assert.isTrue(ecdb.isOpen);

    const structVal = {
      bl: blobVal, bo: true, d: 3.5,
      dt: "2018-01-23T12:24:00.000",
      i: 3, p2d: new Point2d(1, 2), p3d: new Point3d(1, 2, 3), s: "Hello World",
    };

    const verify = async (expectedId: Id64String) => {
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      await ecdb.withPreparedStatement("SELECT Struct FROM test.Foo WHERE ECInstanceId=?", async (stmt: ECSqlStatement) => {
        stmt.bindId(1, expectedId);
        assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
        const row = stmt.getRow();
        assert.isTrue(blobEqual(row.struct.bl, structVal.bl));
        assert.equal(row.struct.bo, structVal.bo);
        assert.equal(row.struct.d, structVal.d);
        assert.equal(row.struct.dt, structVal.dt);
        assert.equal(row.struct.i, structVal.i);
        assert.equal(row.struct.p2d.x, structVal.p2d.x);
        assert.equal(row.struct.p2d.y, structVal.p2d.y);
        assert.equal(row.struct.p3d.x, structVal.p3d.x);
        assert.equal(row.struct.p3d.y, structVal.p3d.y);
        assert.equal(row.struct.p3d.z, structVal.p3d.z);
        assert.equal(row.struct.s, structVal.s);

        assert.equal(await query(ecdb, "SELECT Struct FROM test.Foo WHERE ECInstanceId=?", QueryBinder.from([expectedId]), selectSingleRow, (row1: any) => {
          assert.isTrue(blobEqual(row1.struct.bl, structVal.bl));
          assert.equal(row1.struct.bo, structVal.bo);
          assert.equal(row1.struct.d, structVal.d);
          assert.equal(row1.struct.dt, structVal.dt);
          assert.equal(row1.struct.i, structVal.i);
          assert.equal(row1.struct.p2d.x, structVal.p2d.x);
          assert.equal(row1.struct.p2d.y, structVal.p2d.y);
          assert.equal(row1.struct.p3d.x, structVal.p3d.x);
          assert.equal(row1.struct.p3d.y, structVal.p3d.y);
          assert.equal(row1.struct.p3d.z, structVal.p3d.z);
          assert.equal(row1.struct.s, structVal.s);
        }), 1);
      });
    };
    await ecdb.withCachedWriteStatement("INSERT INTO test.Foo(Struct) VALUES(?)", async (stmt: ECSqlWriteStatement) => {
      stmt.bindStruct(1, structVal);
      const res: ECSqlInsertResult = stmt.stepForInsert();
      assert.equal(res.status, DbResult.BE_SQLITE_DONE);
      assert.isDefined(res.id);
      await verify(res.id!);
    });

    await ecdb.withCachedWriteStatement("INSERT INTO test.Foo(Struct) VALUES(?)", async (stmt: ECSqlWriteStatement) => {
      stmt.bindValues([structVal]);
      const res: ECSqlInsertResult = stmt.stepForInsert();
      assert.equal(res.status, DbResult.BE_SQLITE_DONE);
      assert.isDefined(res.id);
      await verify(res.id!);
    });

    await ecdb.withCachedWriteStatement("INSERT INTO test.Foo(Struct) VALUES(:str)", async (stmt: ECSqlWriteStatement) => {
      stmt.bindStruct("str", structVal);
      const res: ECSqlInsertResult = stmt.stepForInsert();
      assert.equal(res.status, DbResult.BE_SQLITE_DONE);
      assert.isDefined(res.id);
      await verify(res.id!);
    });

    await ecdb.withCachedWriteStatement("INSERT INTO test.Foo(Struct) VALUES(:str)", async (stmt: ECSqlWriteStatement) => {
      stmt.bindValues({ str: structVal });
      const res: ECSqlInsertResult = stmt.stepForInsert();
      assert.equal(res.status, DbResult.BE_SQLITE_DONE);
      assert.isDefined(res.id);
      await verify(res.id!);
    });

  });

  it("should bind arrays", async () => {
    using ecdb = ECDbTestHelper.createECDb(outDir, "bindarrays.ecdb",
      `<ECSchema schemaName="Test" alias="test" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
      <ECStructClass typeName="Location" modifier="Sealed">
        <ECProperty propertyName="City" typeName="string"/>
        <ECProperty propertyName="Zip" typeName="int"/>
      </ECStructClass>
      <ECEntityClass typeName="Foo" modifier="Sealed">
        <ECArrayProperty propertyName="I_Array" typeName="int"/>
        <ECArrayProperty propertyName="Dt_Array" typeName="dateTime"/>
        <ECStructArrayProperty propertyName="Addresses" typeName="Location"/>
      </ECEntityClass>
      </ECSchema>`);
    assert.isTrue(ecdb.isOpen);

    const intArray = [1, 2, 3];
    const dtArray = ["2018-01-23T00:00:00.000", "2018-01-23T16:39:00.000"];
    const addressArray = [{ city: "London", zip: 10000 }, { city: "Manchester", zip: 20000 }, { city: "Edinburgh", zip: 30000 }];

    const verify = async (expectedId: Id64String) => {
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      await ecdb.withPreparedStatement("SELECT I_Array, Dt_Array, Addresses FROM test.Foo WHERE ECInstanceId=?", async (stmt: ECSqlStatement) => {
        stmt.bindId(1, expectedId);
        assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
        const row = stmt.getRow();

        // don't know why assert.equal doesn't work on arrays directly
        assert.equal(row.i_Array.length, intArray.length);
        for (let i = 0; i < intArray.length; i++) {
          assert.equal(row.i_Array[i], intArray[i]);
        }

        assert.equal(row.dt_Array.length, dtArray.length);
        for (let i = 0; i < dtArray.length; i++) {
          assert.equal(row.dt_Array[i], dtArray[i]);
        }

        assert.equal(row.addresses.length, addressArray.length);
        for (let i = 0; i < addressArray.length; i++) {
          assert.equal(row.addresses[i].city, addressArray[i].city);
          assert.equal(row.addresses[i].zip, addressArray[i].zip);
        }
      });

      assert.equal(await query(ecdb, "SELECT I_Array, Dt_Array, Addresses FROM test.Foo WHERE ECInstanceId=?", QueryBinder.from([expectedId]), selectSingleRow, (row: any) => {
        // don't know why assert.equal doesn't work on arrays directly
        assert.equal(row.i_Array.length, intArray.length);
        for (let i = 0; i < intArray.length; i++) {
          assert.equal(row.i_Array[i], intArray[i]);
        }

        assert.equal(row.dt_Array.length, dtArray.length);
        for (let i = 0; i < dtArray.length; i++) {
          assert.equal(row.dt_Array[i], dtArray[i]);
        }

        assert.equal(row.addresses.length, addressArray.length);
        for (let i = 0; i < addressArray.length; i++) {
          assert.equal(row.addresses[i].city, addressArray[i].city);
          assert.equal(row.addresses[i].zip, addressArray[i].zip);
        }
      }), 1);
    };

    await ecdb.withCachedWriteStatement("INSERT INTO test.Foo(I_Array,Dt_Array,Addresses) VALUES(?,?,?)", async (stmt: ECSqlWriteStatement) => {
      stmt.bindArray(1, intArray);
      stmt.bindArray(2, dtArray);
      stmt.bindArray(3, addressArray);
      const res: ECSqlInsertResult = stmt.stepForInsert();
      assert.equal(res.status, DbResult.BE_SQLITE_DONE);
      assert.isDefined(res.id);
      await verify(res.id!);
    });

    await ecdb.withCachedWriteStatement("INSERT INTO test.Foo(I_Array,Dt_Array,Addresses) VALUES(?,?,?)", async (stmt: ECSqlWriteStatement) => {
      stmt.bindValues([intArray, dtArray, addressArray]);
      const res: ECSqlInsertResult = stmt.stepForInsert();
      assert.equal(res.status, DbResult.BE_SQLITE_DONE);
      assert.isDefined(res.id);
      await verify(res.id!);
    });

    await ecdb.withCachedWriteStatement("INSERT INTO test.Foo(I_Array,Dt_Array,Addresses) VALUES(:iarray,:dtarray,:addresses)", async (stmt: ECSqlWriteStatement) => {
      stmt.bindArray("iarray", intArray);
      stmt.bindArray("dtarray", dtArray);
      stmt.bindArray("addresses", addressArray);
      const res: ECSqlInsertResult = stmt.stepForInsert();
      assert.equal(res.status, DbResult.BE_SQLITE_DONE);
      assert.isDefined(res.id);
      await verify(res.id!);
    });

    await ecdb.withCachedWriteStatement("INSERT INTO test.Foo(I_Array,Dt_Array,Addresses) VALUES(:iarray,:dtarray,:addresses)", async (stmt: ECSqlWriteStatement) => {
      stmt.bindValues({ iarray: intArray, dtarray: dtArray, addresses: addressArray });
      const res: ECSqlInsertResult = stmt.stepForInsert();
      assert.equal(res.status, DbResult.BE_SQLITE_DONE);
      assert.isDefined(res.id);
      await verify(res.id!);
    });
  });

  it("should bind navigation", async () => {
    using ecdb = ECDbTestHelper.createECDb(outDir, "bindnavigation.ecdb",
      `<ECSchema schemaName="Test" alias="test" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
    <ECEntityClass typeName="Parent" modifier="Sealed">
      <ECProperty propertyName="Code" typeName="string"/>
    </ECEntityClass>
    <ECEntityClass typeName="Child" modifier="Sealed">
      <ECProperty propertyName="Name" typeName="string"/>
      <ECNavigationProperty propertyName="Parent" relationshipName="ParentHasChildren" direction="backward"/>
    </ECEntityClass>
    <ECRelationshipClass typeName="ParentHasChildren" modifier="None" strength="embedding">
      <Source multiplicity="(0..1)" roleLabel="has" polymorphic="false">
          <Class class="Parent"/>
      </Source>
      <Target multiplicity="(0..*)" roleLabel="has" polymorphic="false">
          <Class class="Child"/>
      </Target>
    </ECRelationshipClass>
    </ECSchema>`);

    assert.isTrue(ecdb.isOpen);

    const parentId: Id64String = ecdb.withCachedWriteStatement("INSERT INTO test.Parent(Code) VALUES('Parent 1')", (stmt: ECSqlWriteStatement) => {
      const res: ECSqlInsertResult = stmt.stepForInsert();
      assert.equal(res.status, DbResult.BE_SQLITE_DONE);
      assert.isDefined(res.id);
      return res.id!;
    });

    const childIds = new Array<Id64String>();
    ecdb.withCachedWriteStatement("INSERT INTO test.Child(Name,Parent) VALUES(?,?)", (stmt: ECSqlWriteStatement) => {
      stmt.bindString(1, "Child 1");
      stmt.bindNavigation(2, { id: parentId, relClassName: "Test.ParentHasChildren" });
      let res: ECSqlInsertResult = stmt.stepForInsert();
      assert.equal(res.status, DbResult.BE_SQLITE_DONE);
      assert.isDefined(res.id);
      childIds.push(res.id!);

      stmt.reset();
      stmt.clearBindings();

      stmt.bindValues(["Child 2", { id: parentId, relClassName: "Test.ParentHasChildren" }]);
      res = stmt.stepForInsert();
      assert.equal(res.status, DbResult.BE_SQLITE_DONE);
      assert.isDefined(res.id);
      childIds.push(res.id!);
    });

    ecdb.withCachedWriteStatement("INSERT INTO test.Child(Name,Parent) VALUES(:name,:parent)", (stmt: ECSqlWriteStatement) => {
      stmt.bindString("name", "Child 3");
      stmt.bindNavigation("parent", { id: parentId, relClassName: "Test.ParentHasChildren" });
      let res: ECSqlInsertResult = stmt.stepForInsert();
      assert.equal(res.status, DbResult.BE_SQLITE_DONE);
      assert.isDefined(res.id);
      childIds.push(res.id!);

      stmt.reset();
      stmt.clearBindings();

      stmt.bindValues({ name: "Child 4", parent: { id: parentId, relClassName: "Test.ParentHasChildren" } });
      res = stmt.stepForInsert();
      assert.equal(res.status, DbResult.BE_SQLITE_DONE);
      assert.isDefined(res.id);
      childIds.push(res.id!);
    });

    // eslint-disable-next-line @typescript-eslint/no-deprecated
    ecdb.withPreparedStatement("SELECT Name,Parent FROM test.Child ORDER BY Name", (stmt: ECSqlStatement) => {
      let rowCount: number = 0;
      while (stmt.step() === DbResult.BE_SQLITE_ROW) {
        rowCount++;
        const row = stmt.getRow();
        assert.equal(row.name, `Child ${rowCount}`);
        const parent: NavigationValue = row.parent as NavigationValue;
        assert.equal(parent.id, parentId);
        assert.equal(parent.relClassName, "Test.ParentHasChildren");
      }
      assert.equal(rowCount, 4);
    });

    let rowCount2: number = 0;
    assert.equal(await query(ecdb, "SELECT Name,Parent FROM test.Child ORDER BY Name", QueryBinder.from([]), undefined, (row: any) => {
      rowCount2++;
      assert.equal(row.name, `Child ${rowCount2}`);
      const parent: NavigationValue = row.parent as NavigationValue;
      assert.equal(parent.id, parentId);
      assert.equal(parent.relClassName, "Test.ParentHasChildren");
    }), 4);
  });

  it("should bind Range3d for parameter in spatial sql function", async () => {
    const iModel = SnapshotDb.createEmpty(IModelTestUtils.prepareOutputFile("ECSqlStatement", "BindRange3d.bim"), { rootSubject: { name: "BindRange3d" } });
    try {
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      iModel.withPreparedStatement("SELECT e.ECInstanceId FROM bis.Element e, bis.SpatialIndex rt WHERE rt.ECInstanceId MATCH DGN_spatial_overlap_aabb(?) AND e.ECInstanceId=rt.ECInstanceId",
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        (stmt: ECSqlStatement) => {
          stmt.bindRange3d(1, new Range3d(0.0, 0.0, 0.0, 1000.0, 1000.0, 1000.0));
          assert.equal(stmt.step(), DbResult.BE_SQLITE_DONE);
        });

      // eslint-disable-next-line @typescript-eslint/no-deprecated
      iModel.withPreparedStatement("SELECT e.ECInstanceId FROM bis.Element e, bis.SpatialIndex rt WHERE rt.ECInstanceId MATCH DGN_spatial_overlap_aabb(?) AND e.ECInstanceId=rt.ECInstanceId",
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        (stmt: ECSqlStatement) => {
          stmt.bindValues([new Range3d(0.0, 0.0, 0.0, 1000.0, 1000.0, 1000.0)]);
          assert.equal(stmt.step(), DbResult.BE_SQLITE_DONE);
        });

    } finally {
      iModel.saveChanges();
      iModel.close();
    }
  });

  it("should bind Range3d", async () => {
    using ecdb = ECDbTestHelper.createECDb(outDir, "bindrange3d.ecdb",
      `<ECSchema schemaName="Test" alias="test" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
        <ECEntityClass typeName="Foo" modifier="Sealed">
          <ECProperty propertyName="Range3d" typeName="binary"/>
        </ECEntityClass>
       </ECSchema>`);

    assert.isTrue(ecdb.isOpen);

    const id: Id64String = ecdb.withCachedWriteStatement("INSERT INTO test.Foo([Range3d]) VALUES(?)", (stmt: ECSqlWriteStatement) => {
      stmt.bindRange3d(1, testRange);
      const res: ECSqlInsertResult = stmt.stepForInsert();
      assert.equal(res.status, DbResult.BE_SQLITE_DONE);
      assert.isDefined(res.id);
      return res.id!;
    });
    ecdb.saveChanges();
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    ecdb.withPreparedStatement("SELECT [Range3d] FROM test.Foo WHERE ECInstanceId=?", (stmt: ECSqlStatement) => {
      stmt.bindId(1, id);
      assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
      const rangeBlob: Uint8Array = stmt.getValue(0).getBlob();
      const rangeFloatArray = new Float64Array(rangeBlob.buffer);
      assert.equal(rangeFloatArray.length, 6);
      const actualRange = new Range3d(...rangeFloatArray);
      assert.isTrue(actualRange.isAlmostEqual(testRange));
    });
  });

  it("should bind IdSets", async () => {
    using ecdb = ECDbTestHelper.createECDb(outDir, "bindids.ecdb");
    assert.isTrue(ecdb.isOpen);

    const idNumbers: number[] = [4444, 4545, 1234, 6758, 1312];
    ecdb.withCachedWriteStatement("INSERT INTO ecdbf.ExternalFileInfo(ECInstanceId,Name) VALUES(?,?)", (stmt: ECSqlWriteStatement) => {
      idNumbers.forEach((idNum: number) => {
        const expectedId = Id64.fromLocalAndBriefcaseIds(idNum, 0);
        stmt.bindId(1, expectedId);
        stmt.bindString(2, `${idNum}.txt`);
        const r: ECSqlInsertResult = stmt.stepForInsert();
        assert.equal(r.status, DbResult.BE_SQLITE_DONE);
        assert.isDefined(r.id);
        assert.equal(r.id!, expectedId);
        ecdb.saveChanges();

        // eslint-disable-next-line @typescript-eslint/no-deprecated
        ecdb.withStatement(`SELECT ECInstanceId, ECClassId, Name FROM ecdbf.ExternalFileInfo WHERE ECInstanceId=${expectedId}`, (confstmt: ECSqlStatement) => {
          assert.equal(confstmt.step(), DbResult.BE_SQLITE_ROW);
          const row = confstmt.getRow();
          assert.equal(row.id, expectedId);
          assert.equal(row.className, "ECDbFileInfo.ExternalFileInfo");
          assert.equal(row.name, `${Id64.getLocalId(expectedId).toString()}.txt`);
        });
        stmt.reset();
        stmt.clearBindings();
      });
    });

    // eslint-disable-next-line @typescript-eslint/no-deprecated
    ecdb.withPreparedStatement("SELECT ECInstanceId, ECClassId, Name from ecdbf.ExternalFileInfo WHERE InVirtualSet(?, ECInstanceId)", (stmt: ECSqlStatement) => {
      let idSet: Id64String[] = [];
      stmt.bindIdSet(1, idSet);
      let result = stmt.step();
      assert.equal(result, DbResult.BE_SQLITE_DONE);
      stmt.reset();
      stmt.clearBindings();

      idSet = [Id64.fromLocalAndBriefcaseIds(idNumbers[2], 0)];
      stmt.bindIdSet(1, idSet);
      result = stmt.step();
      assert.equal(result, DbResult.BE_SQLITE_ROW);
      let row = stmt.getRow();
      assert.equal(row.name, `${idNumbers[2]}.txt`);
      stmt.reset();
      stmt.clearBindings();

      idSet.push(idNumbers[0].toString());
      stmt.bindIdSet(1, idSet);
      result = stmt.step();
      assert.equal(result, DbResult.BE_SQLITE_ROW);
      row = stmt.getRow();
      assert.equal(row.name, `${idNumbers[2]}.txt`);
      result = stmt.step();
      assert.equal(result, DbResult.BE_SQLITE_ROW);
      row = stmt.getRow();
      assert.equal(row.name, `${idNumbers[0]}.txt`);
    });
  });

  it("should bind IdSets to IdSet Virtual Table", async () => {
    using ecdb = ECDbTestHelper.createECDb(outDir, "bindids.ecdb");
    assert.isTrue(ecdb.isOpen);

    const idNumbers: number[] = [4444, 4545, 1234, 6758, 1312];
    ecdb.withCachedWriteStatement("INSERT INTO ecdbf.ExternalFileInfo(ECInstanceId,Name) VALUES(?,?)", (stmt: ECSqlWriteStatement) => {
      idNumbers.forEach((idNum: number) => {
        const expectedId = Id64.fromLocalAndBriefcaseIds(idNum, 0);
        stmt.bindId(1, expectedId);
        stmt.bindString(2, `${idNum}.txt`);
        const r: ECSqlInsertResult = stmt.stepForInsert();
        assert.equal(r.status, DbResult.BE_SQLITE_DONE);
        assert.isDefined(r.id);
        assert.equal(r.id!, expectedId);
        ecdb.saveChanges();

        // eslint-disable-next-line @typescript-eslint/no-deprecated
        ecdb.withStatement(`SELECT ECInstanceId, ECClassId, Name FROM ecdbf.ExternalFileInfo WHERE ECInstanceId=${expectedId}`, (confstmt: ECSqlStatement) => {
          assert.equal(confstmt.step(), DbResult.BE_SQLITE_ROW);
          const row = confstmt.getRow();
          assert.equal(row.id, expectedId);
          assert.equal(row.className, "ECDbFileInfo.ExternalFileInfo");
          assert.equal(row.name, `${Id64.getLocalId(expectedId).toString()}.txt`);
        });
        stmt.reset();
        stmt.clearBindings();
      });
    });

    // eslint-disable-next-line @typescript-eslint/no-deprecated
    ecdb.withPreparedStatement("SELECT ECInstanceId, ECClassId, Name from ecdbf.ExternalFileInfo, IdSet(?) WHERE id = ECInstanceId ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES", (stmt: ECSqlStatement) => {
      let idSet: Id64String[] = [];
      stmt.bindIdSet(1, idSet);
      let result = stmt.step();
      assert.equal(result, DbResult.BE_SQLITE_DONE);
      stmt.reset();
      stmt.clearBindings();

      idSet = [Id64.fromLocalAndBriefcaseIds(idNumbers[2], 0)];
      stmt.bindIdSet(1, idSet);
      result = stmt.step();
      assert.equal(result, DbResult.BE_SQLITE_ROW);
      let row = stmt.getRow();
      assert.equal(row.name, `${idNumbers[2]}.txt`);
      stmt.reset();
      stmt.clearBindings();

      idSet.push(idNumbers[0].toString());
      stmt.bindIdSet(1, idSet);
      result = stmt.step();
      assert.equal(result, DbResult.BE_SQLITE_ROW);
      row = stmt.getRow();
      assert.equal(row.name, `${idNumbers[2]}.txt`);
      result = stmt.step();
      assert.equal(result, DbResult.BE_SQLITE_ROW);
      row = stmt.getRow();
      assert.equal(row.name, `${idNumbers[0]}.txt`);
    });
  });

  it("Error Checking For binding to IdSet statements", async () => {
    using ecdb = ECDbTestHelper.createECDb(outDir, "bindids.ecdb");
    assert.isTrue(ecdb.isOpen);

    const idNumbers: number[] = [4444, 4545, 1234, 6758, 1312];
    ecdb.withCachedWriteStatement("INSERT INTO ecdbf.ExternalFileInfo(ECInstanceId,Name) VALUES(?,?)", (stmt: ECSqlWriteStatement) => {
      idNumbers.forEach((idNum: number) => {
        const expectedId = Id64.fromLocalAndBriefcaseIds(idNum, 0);
        stmt.bindId(1, expectedId);
        stmt.bindString(2, `${idNum}.txt`);
        const r: ECSqlInsertResult = stmt.stepForInsert();
        assert.equal(r.status, DbResult.BE_SQLITE_DONE);
        assert.isDefined(r.id);
        assert.equal(r.id!, expectedId);
        ecdb.saveChanges();

        // eslint-disable-next-line @typescript-eslint/no-deprecated
        ecdb.withStatement(`SELECT ECInstanceId, ECClassId, Name FROM ecdbf.ExternalFileInfo WHERE ECInstanceId=${expectedId}`, (confstmt: ECSqlStatement) => {
          assert.equal(confstmt.step(), DbResult.BE_SQLITE_ROW);
          const row = confstmt.getRow();
          assert.equal(row.id, expectedId);
          assert.equal(row.className, "ECDbFileInfo.ExternalFileInfo");
          assert.equal(row.name, `${Id64.getLocalId(expectedId).toString()}.txt`);
        });
        stmt.reset();
        stmt.clearBindings();
      });
    });

    // eslint-disable-next-line @typescript-eslint/no-deprecated
    ecdb.withPreparedStatement("SELECT ECInstanceId, ECClassId, Name from ecdbf.ExternalFileInfo, ECVLib.IdSet(?) WHERE id = ECInstanceId ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES", (stmt: ECSqlStatement) => {
      let idSet: Id64String[] = [];
      stmt.bindIdSet(1, idSet);
      let result = stmt.step();
      assert.equal(result, DbResult.BE_SQLITE_DONE);
      stmt.reset();
      stmt.clearBindings();

      idSet = ["0X1", "ABC"];
      try {
        stmt.bindIdSet(1, idSet);
      } catch (err: any) {
        assert.equal(err.message, "Error binding id set");
      }
      result = stmt.step();
      assert.equal(result, DbResult.BE_SQLITE_DONE);
      stmt.reset();
      stmt.clearBindings();

      try {
        stmt.bindId(1, idNumbers[0].toString());
      } catch (err: any) {
        assert.equal(err.message, "Error binding Id");
      }
      result = stmt.step();
      assert.equal(result, DbResult.BE_SQLITE_DONE);
    });
  });

  /* This test doesn't do anything specific with the binder life time but just runs a few scenarios
     with and without statement cache to test that stuff works fine */
  it("check ECSqlBinder life time", async () => {
    using ecdb = ECDbTestHelper.createECDb(outDir, "ecsqlbinderlifetime.ecdb",
      `<ECSchema schemaName="Test" alias="test" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
    <ECStructClass typeName="Address" modifier="Sealed">
      <ECProperty propertyName="Street" typeName="string"/>
      <ECProperty propertyName="City" typeName="string"/>
      <ECProperty propertyName="Zip" typeName="int"/>
    </ECStructClass>
    <ECEntityClass typeName="Person" modifier="Sealed">
      <ECProperty propertyName="Name" typeName="string"/>
      <ECProperty propertyName="Age" typeName="int"/>
      <ECStructProperty propertyName="Location" typeName="Address"/>
    </ECEntityClass>
    </ECSchema>`);

    assert.isTrue(ecdb.isOpen);

    let id1: Id64String = "", id2: Id64String = "";

    // *** test without statement cache
    ecdb.withCachedWriteStatement("INSERT INTO test.Person(Name,Age,Location) VALUES(?,?,?)", (stmt: ECSqlWriteStatement) => {
      stmt.bindString(1, "Mary Miller");
      stmt.bindInteger(2, 30);
      stmt.bindStruct(3, { Street: "2000 Main Street", City: "New York", Zip: 12311 });

      const res: ECSqlInsertResult = stmt.stepForInsert();
      assert.equal(res.status, DbResult.BE_SQLITE_DONE);
      assert.isDefined(res.id);
      id1 = res.id!;
      assert.isTrue(Id64.isValidId64(id1));
    });


    // *** test withstatement cache
    ecdb.withCachedWriteStatement("INSERT INTO test.Person(Name,Age,Location) VALUES(?,?,?)", (stmt: ECSqlWriteStatement) => {
      stmt.bindString(1, "Mary Miller");
      stmt.bindInteger(2, 30);
      stmt.bindStruct(3, { Street: "2000 Main Street", City: "New York", Zip: 12311 });

      const res: ECSqlInsertResult = stmt.stepForInsert();
      assert.equal(res.status, DbResult.BE_SQLITE_DONE);
      assert.isDefined(res.id);
      id2 = res.id!;
      assert.isTrue(Id64.isValidId64(id2));
    });

    {
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      using stmt = ecdb.prepareStatement("SELECT ECInstanceId,ECClassId,Name,Age,Location FROM test.Person ORDER BY ECInstanceId");
      let rowCount = 0;
      while (stmt.step() === DbResult.BE_SQLITE_ROW) {
        rowCount++;
        const row = stmt.getRow();
        if (rowCount === 1)
          assert.equal(row.id, id1);
        else
          assert.equal(row.id, id2);

        assert.equal(row.className, "Test.Person");
        assert.equal(row.name, "Mary Miller");
        assert.equal(row.age, 30);
        assert.equal(row.location.street, "2000 Main Street");
        assert.equal(row.location.city, "New York");
        assert.equal(row.location.zip, 12311);
      }
      assert.equal(rowCount, 2);
    }

    let rowCount2: number = 0;
    assert.equal(await query(ecdb, "SELECT ECInstanceId,ECClassId,Name,Age,Location FROM test.Person ORDER BY ECInstanceId", QueryBinder.from([]), undefined, (row: any) => {
      rowCount2++;
      if (rowCount2 === 1)
        assert.equal(row.id, id1);
      else
        assert.equal(row.id, id2);

      assert.equal(row.className, "Test.Person");
      assert.equal(row.name, "Mary Miller");
      assert.equal(row.age, 30);
      assert.equal(row.location.street, "2000 Main Street");
      assert.equal(row.location.city, "New York");
      assert.equal(row.location.zip, 12311);
    }), 2);
  });

  it("getRow() with primitives values", async () => {
    using ecdb = ECDbTestHelper.createECDb(outDir, "getprimitives.ecdb",
      `<ECSchema schemaName="Test" alias="test" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
      <ECEntityClass typeName="Foo" modifier="Sealed">
        <ECProperty propertyName="Bl" typeName="binary"/>
        <ECProperty propertyName="Bo" typeName="boolean"/>
        <ECProperty propertyName="D" typeName="double"/>
        <ECProperty propertyName="Dt" typeName="dateTime"/>
        <ECProperty propertyName="G" typeName="Bentley.Geometry.Common.IGeometry"/>
        <ECProperty propertyName="I" typeName="int"/>
        <ECProperty propertyName="L" typeName="long"/>
        <ECProperty propertyName="P2d" typeName="Point2d"/>
        <ECProperty propertyName="P3d" typeName="Point3d"/>
        <ECProperty propertyName="S" typeName="string"/>
      </ECEntityClass>
      </ECSchema>`);
    assert.isTrue(ecdb.isOpen);

    const boolVal: boolean = true;
    const doubleVal: number = 3.5;
    const dtVal: string = "2018-01-23T12:24:00.000";
    const intVal: number = 3;
    const p2dVal = new Point2d(1, 2);
    const p3dVal = new Point3d(1, 2, 3);
    const strVal: string = "Hello world";

    const id: Id64String = ecdb.withCachedWriteStatement("INSERT INTO test.Foo(Bl,Bo,D,Dt,I,P2d,P3d,S) VALUES(?,?,?,?,?,?,?,?)", (stmt: ECSqlWriteStatement) => {
      stmt.bindBlob(1, blobVal);
      stmt.bindBoolean(2, boolVal);
      stmt.bindDouble(3, doubleVal);
      stmt.bindDateTime(4, dtVal);
      stmt.bindInteger(5, intVal);
      stmt.bindPoint2d(6, p2dVal);
      stmt.bindPoint3d(7, p3dVal);
      stmt.bindString(8, strVal);
      const res: ECSqlInsertResult = stmt.stepForInsert();
      assert.equal(res.status, DbResult.BE_SQLITE_DONE);
      return res.id!;
    });

    // eslint-disable-next-line @typescript-eslint/no-deprecated
    ecdb.withPreparedStatement("SELECT ECInstanceId, ECClassId, Bl,Bo,D,Dt,I,P2d,P3d,S FROM test.Foo WHERE ECInstanceId=?", (stmt: ECSqlStatement) => {
      stmt.bindId(1, id);
      assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
      const row = stmt.getRow();
      assert.equal(row.id, id);
      assert.equal(row.className, "Test.Foo");
      assert.deepEqual(row.bl, blobVal);
      assert.equal(row.bo, boolVal);
      assert.equal(row.d, doubleVal);
      assert.equal(row.dt, dtVal);
      assert.equal(row.i, intVal);
      assert.equal(row.p2d.x, p2dVal.x);
      assert.equal(row.p2d.y, p2dVal.y);
      assert.equal(row.p3d.x, p3dVal.x);
      assert.equal(row.p3d.y, p3dVal.y);
      assert.equal(row.p3d.z, p3dVal.z);
      assert.equal(row.s, strVal);
    });

    assert.equal(await query(ecdb, "SELECT ECInstanceId, ECClassId, Bl FROM test.Foo WHERE ECInstanceId=?", QueryBinder.from([id]), { abbreviateBlobs: true, ...selectSingleRow }, (row: any) => {
      assert.equal(row.id, id);
      assert.equal(row.className, "Test.Foo");
      assert.deepEqual(row.bl, abbreviatedBlobVal);
    }), 1);

    assert.equal(await query(ecdb, "SELECT ECInstanceId, ECClassId, Bl FROM test.Foo WHERE ECInstanceId=?", QueryBinder.from([id]), { abbreviateBlobs: false, ...selectSingleRow }, (row: any) => {
      assert.equal(row.id, id);
      assert.equal(row.className, "Test.Foo");
      assert.deepEqual(row.bl, blobVal);
    }), 1);

    // assert.equal(await query(ecdb, "SELECT ECInstanceId, ECClassId, Bl,Bo,D,Dt,I,P2d,P3d,S FROM test.Foo WHERE ECInstanceId=?", [id], 1, (row: any) => {
    //   assert.equal(row.id, id);
    //   assert.equal(row.className, "Test.Foo");
    //   assert.deepEqual(row.bl, blobVal);
    //   assert.equal(row.bo, boolVal);
    //   assert.equal(row.d, doubleVal);
    //   assert.equal(row.dt, dtVal);
    //   assert.equal(row.i, intVal);
    //   assert.equal(row.p2d.x, p2dVal.x);
    //   assert.equal(row.p2d.y, p2dVal.y);
    //   assert.equal(row.p3d.x, p3dVal.x);
    //   assert.equal(row.p3d.y, p3dVal.y);
    //   assert.equal(row.p3d.z, p3dVal.z);
    //   assert.equal(row.s, strVal);
    // }), 1);

    // eslint-disable-next-line @typescript-eslint/no-deprecated
    ecdb.withPreparedStatement("SELECT Bl AS Blobby, I+10, Lower(S), Upper(S) CapitalS FROM test.Foo WHERE ECInstanceId=?", (stmt: ECSqlStatement) => {
      stmt.bindId(1, id);
      assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
      const row = stmt.getRow();
      assert.deepEqual(row.blobby, blobVal);
      assert.equal(row["[I] + 10"], intVal + 10);
      assert.equal(row["lower([S])"], strVal.toLowerCase());
      assert.equal(row.capitalS, strVal.toUpperCase());
    });

    // assert.equal(await query(ecdb, "SELECT Bl AS Blobby, I+10, Lower(S), Upper(S) CapitalS FROM test.Foo WHERE ECInstanceId=?", [id], 1, (row: any) => {
    //   assert.deepEqual(row.blobby, blobVal);
    //   assert.equal(row["[I] + 10"], intVal + 10);
    //   assert.equal(row["lower([S])"], strVal.toLowerCase());
    //   assert.equal(row.capitalS, strVal.toUpperCase());
    // }), 1);

    // eslint-disable-next-line @typescript-eslint/no-deprecated
    const testSchemaId: Id64String = ecdb.withPreparedStatement("SELECT ECInstanceId FROM meta.ECSchemaDef WHERE Name='Test'", (stmt: ECSqlStatement) => {
      assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
      const row = stmt.getRow();
      assert.equal(stmt.step(), DbResult.BE_SQLITE_DONE);
      return Id64.fromJSON(row.id);
    });

    // eslint-disable-next-line @typescript-eslint/no-deprecated
    const fooClassId: Id64String = ecdb.withPreparedStatement("SELECT ECInstanceId FROM meta.ECClassDef WHERE Name='Foo'", (stmt: ECSqlStatement) => {
      assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
      const row = stmt.getRow();
      assert.equal(stmt.step(), DbResult.BE_SQLITE_DONE);
      return Id64.fromJSON(row.id);
    });

    // eslint-disable-next-line @typescript-eslint/no-deprecated
    ecdb.withPreparedStatement("SELECT s.ECInstanceId, c.ECInstanceId, c.Name, s.Name FROM meta.ECClassDef c JOIN meta.ECSchemaDef s ON c.Schema.Id=s.ECInstanceId WHERE s.Name='Test' AND c.Name='Foo'", (stmt: ECSqlStatement) => {
      assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
      const row = stmt.getRow();
      assert.equal(row.id, testSchemaId);
      assert.equal(row.id_1, fooClassId);
    });

    assert.equal(await query(ecdb, "SELECT s.ECInstanceId, c.ECInstanceId, c.Name, s.Name FROM meta.ECClassDef c JOIN meta.ECSchemaDef s ON c.Schema.Id=s.ECInstanceId WHERE s.Name='Test' AND c.Name='Foo'", QueryBinder.from([]), selectSingleRow, (row: any) => {
      assert.equal(row.id, testSchemaId);
      assert.equal(row.id_1, fooClassId);
    }), 1);

    // eslint-disable-next-line @typescript-eslint/no-deprecated
    ecdb.withPreparedStatement("SELECT count(*) cnt FROM meta.ECSchemaDef", (stmt: ECSqlStatement) => {
      assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
      const row = stmt.getRow();
      assert.isDefined(row.cnt);
      assert.equal(typeof (row.cnt), "number");
      assert.equal(row.cnt, 6);
    });

    assert.equal(await query(ecdb, "SELECT count(*) cnt FROM meta.ECSchemaDef", QueryBinder.from([]), selectSingleRow, (row: any) => {
      assert.isDefined(row.cnt);
      assert.equal(typeof (row.cnt), "number");
      assert.equal(row.cnt, 6);
    }), 1);

    // eslint-disable-next-line @typescript-eslint/no-deprecated
    ecdb.withPreparedStatement("SELECT 1 FROM meta.ECSchemaDef LIMIT 1", (stmt: ECSqlStatement) => {
      assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
      const row = stmt.getRow();
      assert.equal(typeof (row["1"]), "number");
      assert.equal(row["1"], 1);
    });

    assert.equal(await query(ecdb, "SELECT 1 FROM meta.ECSchemaDef LIMIT 1", QueryBinder.from([]), undefined, (row: any) => {
      assert.equal(typeof (row["1"]), "number");
      assert.equal(row["1"], 1);
    }), 1);

    // eslint-disable-next-line @typescript-eslint/no-deprecated
    ecdb.withPreparedStatement("SELECT NULL FROM meta.ECSchemaDef LIMIT 1", (stmt: ECSqlStatement) => {
      assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
      const row = stmt.getRow();
      assert.equal(Object.entries(row).length, 0);
    });

    assert.equal(await query(ecdb, "SELECT NULL FROM meta.ECSchemaDef LIMIT 1", QueryBinder.from([]), undefined, (row: any) => {
      assert.equal(Object.entries(row).length, 0);
    }), 1);
  });

  it("getRow() with abbreviated blobs", async () => {
    using ecdb = ECDbTestHelper.createECDb(outDir, "getblobs.ecdb",
      `<ECSchema schemaName="Test" alias="test" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
      <ECEntityClass typeName="Foo" modifier="Sealed">
        <ECProperty propertyName="Bl" typeName="binary"/>
      </ECEntityClass>
      </ECSchema>`);
    assert.isTrue(ecdb.isOpen);

    const singleBlobVal = blobVal.slice(0, 1);
    const abbreviatedSingleBlobVal = `{"bytes":${singleBlobVal.byteLength}}`;
    const emptyBlobVal = new Uint8Array();

    const fullId: Id64String = ecdb.withCachedWriteStatement("INSERT INTO test.Foo(Bl) VALUES(?)", (stmt: ECSqlWriteStatement) => {
      stmt.bindBlob(1, blobVal);
      const res: ECSqlInsertResult = stmt.stepForInsert();
      assert.equal(res.status, DbResult.BE_SQLITE_DONE);
      return res.id!;
    });

    const singleId: Id64String = ecdb.withCachedWriteStatement("INSERT INTO test.Foo(Bl) VALUES(?)", (stmt: ECSqlWriteStatement) => {
      stmt.bindBlob(1, singleBlobVal);
      const res: ECSqlInsertResult = stmt.stepForInsert();
      assert.equal(res.status, DbResult.BE_SQLITE_DONE);
      return res.id!;
    });

    const emptyId: Id64String = ecdb.withCachedWriteStatement("INSERT INTO test.Foo(Bl) VALUES(?)", (stmt: ECSqlWriteStatement) => {
      stmt.bindBlob(1, emptyBlobVal);
      const res: ECSqlInsertResult = stmt.stepForInsert();
      assert.equal(res.status, DbResult.BE_SQLITE_DONE);
      return res.id!;
    });

    const nullId: Id64String = ecdb.withCachedWriteStatement("INSERT INTO test.Foo(Bl) VALUES(?)", (stmt: ECSqlWriteStatement) => {
      stmt.bindNull(1);
      const res: ECSqlInsertResult = stmt.stepForInsert();
      assert.equal(res.status, DbResult.BE_SQLITE_DONE);
      return res.id!;
    });

    assert.equal(await query(ecdb, "SELECT ECInstanceId, ECClassId, Bl FROM test.Foo WHERE ECInstanceId=?", QueryBinder.from([fullId]), { abbreviateBlobs: true, ...selectSingleRow }, (row: any) => {
      assert.equal(row.id, fullId);
      assert.equal(row.className, "Test.Foo");
      assert.deepEqual(row.bl, abbreviatedBlobVal);
    }), 1);

    assert.equal(await query(ecdb, "SELECT ECInstanceId, ECClassId, Bl FROM test.Foo WHERE ECInstanceId=?", QueryBinder.from([fullId]), { abbreviateBlobs: false, ...selectSingleRow }, (row: any) => {
      assert.equal(row.id, fullId);
      assert.equal(row.className, "Test.Foo");
      assert.deepEqual(row.bl, blobVal);
    }), 1);

    assert.equal(await query(ecdb, "SELECT ECInstanceId, ECClassId, Bl FROM test.Foo WHERE ECInstanceId=?", QueryBinder.from([fullId]), selectSingleRow, (row: any) => {
      assert.equal(row.id, fullId);
      assert.equal(row.className, "Test.Foo");
      assert.deepEqual(row.bl, blobVal);
    }), 1);

    assert.equal(await query(ecdb, "SELECT ECInstanceId, ECClassId, Bl FROM test.Foo WHERE ECInstanceId=?", QueryBinder.from([singleId]), { abbreviateBlobs: true, ...selectSingleRow }, (row: any) => {
      assert.equal(row.id, singleId);
      assert.equal(row.className, "Test.Foo");
      assert.deepEqual(row.bl, abbreviatedSingleBlobVal);
    }), 1);

    assert.equal(await query(ecdb, "SELECT ECInstanceId, ECClassId, Bl FROM test.Foo WHERE ECInstanceId=?", QueryBinder.from([singleId]), { abbreviateBlobs: false, ...selectSingleRow }, (row: any) => {
      assert.equal(row.id, singleId);
      assert.equal(row.className, "Test.Foo");
      assert.deepEqual(row.bl, singleBlobVal);
    }), 1);

    assert.equal(await query(ecdb, "SELECT ECInstanceId, ECClassId, Bl FROM test.Foo WHERE ECInstanceId=?", QueryBinder.from([singleId]), { ...selectSingleRow }, (row: any) => {
      assert.equal(row.id, singleId);
      assert.equal(row.className, "Test.Foo");
      assert.deepEqual(row.bl, singleBlobVal);
    }), 1);

    assert.equal(await query(ecdb, "SELECT ECInstanceId, ECClassId, Bl FROM test.Foo WHERE ECInstanceId=?", QueryBinder.from([emptyId]), { abbreviateBlobs: true, ...selectSingleRow }, (row: any) => {
      assert.equal(row.id, emptyId);
      assert.equal(row.className, "Test.Foo");
      assert.deepEqual(row.bl, "{\"bytes\":0}");
    }), 1);

    assert.equal(await query(ecdb, "SELECT ECInstanceId, ECClassId, Bl FROM test.Foo WHERE ECInstanceId=?", QueryBinder.from([emptyId]), { abbreviateBlobs: false, ...selectSingleRow }, (row: any) => {
      assert.equal(row.id, emptyId);
      assert.equal(row.className, "Test.Foo");
      assert.deepEqual(row.bl.length, 0);
    }), 1);

    assert.equal(await query(ecdb, "SELECT ECInstanceId, ECClassId, Bl FROM test.Foo WHERE ECInstanceId=?", QueryBinder.from([emptyId]), selectSingleRow, (row: any) => {
      assert.equal(row.id, emptyId);
      assert.equal(row.className, "Test.Foo");
      assert.deepEqual(row.bl.length, 0);
    }), 1);

    assert.equal(await query(ecdb, "SELECT ECInstanceId, ECClassId, Bl FROM test.Foo WHERE ECInstanceId=?", QueryBinder.from([nullId]), { abbreviateBlobs: true, ...selectSingleRow }, (row: any) => {
      assert.equal(row.id, nullId);
      assert.equal(row.className, "Test.Foo");
      assert.deepEqual(row.bl, undefined);
    }), 1);

    assert.equal(await query(ecdb, "SELECT ECInstanceId, ECClassId, Bl FROM test.Foo WHERE ECInstanceId=?", QueryBinder.from([nullId]), { abbreviateBlobs: false, ...selectSingleRow }, (row: any) => {
      assert.equal(row.id, nullId);
      assert.equal(row.className, "Test.Foo");
      assert.deepEqual(row.bl, undefined);
    }), 1);

    assert.equal(await query(ecdb, "SELECT ECInstanceId, ECClassId, Bl FROM test.Foo WHERE ECInstanceId=?", QueryBinder.from([nullId]), selectSingleRow, (row: any) => {
      assert.equal(row.id, nullId);
      assert.equal(row.className, "Test.Foo");
      assert.deepEqual(row.bl, undefined);
    }), 1);
  });

  it("getRow() with navigation properties and relationships", async () => {
    using ecdb = ECDbTestHelper.createECDb(outDir, "getnavandrels.ecdb",
      `<ECSchema schemaName="Test" alias="test" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
        <ECEntityClass typeName="Parent" modifier="Sealed">
          <ECProperty propertyName="Code" typeName="string"/>
        </ECEntityClass>
        <ECEntityClass typeName="Child" modifier="Sealed">
          <ECProperty propertyName="Name" typeName="string"/>
          <ECNavigationProperty propertyName="Parent" relationshipName="ParentHasChildren" direction="backward"/>
        </ECEntityClass>
        <ECRelationshipClass typeName="ParentHasChildren" modifier="None" strength="embedding">
          <Source multiplicity="(0..1)" roleLabel="has" polymorphic="false">
              <Class class="Parent"/>
          </Source>
          <Target multiplicity="(0..*)" roleLabel="has" polymorphic="false">
              <Class class="Child"/>
          </Target>
        </ECRelationshipClass>
        </ECSchema>`);
    assert.isTrue(ecdb.isOpen);
    let rowCount: number;
    const parentId: Id64String = ecdb.withCachedWriteStatement("INSERT INTO test.Parent(Code) VALUES('Parent 1')", (stmt: ECSqlWriteStatement) => {
      const res: ECSqlInsertResult = stmt.stepForInsert();
      assert.equal(res.status, DbResult.BE_SQLITE_DONE);
      assert.isDefined(res.id);
      return res.id!;
    });

    const childIds = new Array<Id64String>();
    ecdb.withCachedWriteStatement("INSERT INTO test.Child(Name,Parent) VALUES(?,?)", (stmt: ECSqlWriteStatement) => {
      stmt.bindString(1, "Child 1");
      stmt.bindNavigation(2, { id: parentId, relClassName: "Test.ParentHasChildren" });
      let res: ECSqlInsertResult = stmt.stepForInsert();
      assert.equal(res.status, DbResult.BE_SQLITE_DONE);
      assert.isDefined(res.id);
      childIds.push(res.id!);

      stmt.reset();
      stmt.clearBindings();

      stmt.bindValues(["Child 2", { id: parentId, relClassName: "Test.ParentHasChildren" }]);
      res = stmt.stepForInsert();
      assert.equal(res.status, DbResult.BE_SQLITE_DONE);
      assert.isDefined(res.id);
      childIds.push(res.id!);
    });

    // eslint-disable-next-line @typescript-eslint/no-deprecated
    ecdb.withPreparedStatement("SELECT Name,Parent FROM test.Child ORDER BY Name", (stmt: ECSqlStatement) => {
      rowCount = 0;
      while (stmt.step() === DbResult.BE_SQLITE_ROW) {
        rowCount++;
        const row = stmt.getRow();
        assert.equal(row.name, `Child ${rowCount}`);
        assert.equal(row.parent.id, parentId);
        assert.equal(row.parent.relClassName, "Test.ParentHasChildren");
      }
      assert.equal(rowCount, 2);
    });

    rowCount = 0;
    assert.equal(await query(ecdb, "SELECT Name,Parent FROM test.Child ORDER BY Name", QueryBinder.from([]), undefined, (row: any) => {
      rowCount++;
      assert.equal(row.name, `Child ${rowCount}`);
      assert.equal(row.parent.id, parentId);
      assert.equal(row.parent.relClassName, "Test.ParentHasChildren");
    }), 2);

    // eslint-disable-next-line @typescript-eslint/no-deprecated
    ecdb.withPreparedStatement("SELECT Name,Parent.Id,Parent.RelECClassId, Parent.Id myParentId, Parent.RelECClassId myParentRelClassId FROM test.Child ORDER BY Name", (stmt: ECSqlStatement) => {
      rowCount = 0;
      while (stmt.step() === DbResult.BE_SQLITE_ROW) {
        rowCount++;
        const row = stmt.getRow();
        assert.equal(row.name, `Child ${rowCount}`);
        assert.equal(row["parent.id"], parentId);
        assert.equal(row["parent.relClassName"], "Test.ParentHasChildren");
        assert.equal(row.myParentId, parentId);
        assert.isTrue(Id64.isValidId64(row.myParentRelClassId));
      }
      assert.equal(rowCount, 2);
    });

    rowCount = 0;
    assert.equal(await query(ecdb, "SELECT Name,Parent.Id,Parent.RelECClassId, Parent.Id myParentId, Parent.RelECClassId myParentRelClassId FROM test.Child ORDER BY Name", QueryBinder.from([]), undefined, (row: any) => {
      rowCount++;
      assert.equal(row.name, `Child ${rowCount}`);
      assert.equal(row["parent.id"], parentId);
      assert.equal(row["parent.relClassName"], "Test.ParentHasChildren");
      assert.equal(row.myParentId, parentId);
      assert.isTrue(Id64.isValidId64(row.myParentRelClassId));
    }), 2);

    const childId: Id64String = childIds[0];
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    ecdb.withPreparedStatement("SELECT ECInstanceId,ECClassId,SourceECInstanceId,SourceECClassId,TargetECInstanceId,TargetECClassId FROM test.ParentHasChildren WHERE TargetECInstanceId=?", (stmt: ECSqlStatement) => {
      stmt.bindId(1, childId);
      assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
      const row = stmt.getRow();
      assert.equal(row.id, childId);
      assert.equal(row.className, "Test.ParentHasChildren");
      assert.equal(row.sourceId, parentId);
      assert.equal(row.sourceClassName, "Test.Parent");
      assert.equal(row.targetId, childId);
      assert.equal(row.targetClassName, "Test.Child");
    });

    assert.equal(await query(ecdb, "SELECT ECInstanceId,ECClassId,SourceECInstanceId,SourceECClassId,TargetECInstanceId,TargetECClassId FROM test.ParentHasChildren WHERE TargetECInstanceId=?", QueryBinder.from([childId]), undefined, (row: any) => {
      assert.equal(row.id, childId);
      assert.equal(row.className, "Test.ParentHasChildren");
      assert.equal(row.sourceId, parentId);
      assert.equal(row.sourceClassName, "Test.Parent");
      assert.equal(row.targetId, childId);
      assert.equal(row.targetClassName, "Test.Child");
    }), 1);

    // eslint-disable-next-line @typescript-eslint/no-deprecated
    ecdb.withPreparedStatement("SELECT ECInstanceId as MyId,ECClassId as MyClassId,SourceECInstanceId As MySourceId,SourceECClassId As MySourceClassId,TargetECInstanceId As MyTargetId,TargetECClassId As MyTargetClassId FROM test.ParentHasChildren WHERE TargetECInstanceId=?", (stmt: ECSqlStatement) => {
      stmt.bindId(1, childId);
      assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
      const row = stmt.getRow();
      assert.equal(row.myId, childId);
      assert.isTrue(Id64.isValidId64(row.myClassId));
      assert.equal(row.mySourceId, parentId);
      assert.isTrue(Id64.isValidId64(row.mySourceClassId));
      assert.equal(row.myTargetId, childId);
      assert.isTrue(Id64.isValidId64(row.myTargetClassId));
    });

    assert.equal(await query(ecdb, "SELECT ECInstanceId as MyId,ECClassId as MyClassId,SourceECInstanceId As MySourceId,SourceECClassId As MySourceClassId,TargetECInstanceId As MyTargetId,TargetECClassId As MyTargetClassId FROM test.ParentHasChildren WHERE TargetECInstanceId=?", QueryBinder.from([childId]), undefined, (row: any) => {
      rowCount++;
      assert.equal(row.myId, childId);
      assert.isTrue(Id64.isValidId64(row.myClassId));
      assert.equal(row.mySourceId, parentId);
      assert.isTrue(Id64.isValidId64(row.mySourceClassId));
      assert.equal(row.myTargetId, childId);
      assert.isTrue(Id64.isValidId64(row.myTargetClassId));
    }), 1);

  });

  it("getRow() with structs", async () => {
    using ecdb = ECDbTestHelper.createECDb(outDir, "getstructs.ecdb",
      `<ECSchema schemaName="Test" alias="test" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
      <ECStructClass typeName="MyStruct" modifier="Sealed">
        <ECProperty propertyName="Bl" typeName="binary"/>
        <ECProperty propertyName="Bo" typeName="boolean"/>
        <ECProperty propertyName="D" typeName="double"/>
        <ECProperty propertyName="Dt" typeName="dateTime"/>
        <ECProperty propertyName="G" typeName="Bentley.Geometry.Common.IGeometry"/>
        <ECProperty propertyName="I" typeName="int"/>
        <ECProperty propertyName="L" typeName="long"/>
        <ECProperty propertyName="P2d" typeName="Point2d"/>
        <ECProperty propertyName="P3d" typeName="Point3d"/>
        <ECProperty propertyName="S" typeName="string"/>
      </ECStructClass>
      <ECEntityClass typeName="Foo" modifier="Sealed">
        <ECStructProperty propertyName="Struct" typeName="MyStruct"/>
      </ECEntityClass>
      </ECSchema>`);
    assert.isTrue(ecdb.isOpen);

    const boolVal: boolean = true;
    const doubleVal: number = 3.5;
    const dtVal: string = "2018-01-23T12:24:00.000";
    const intVal: number = 3;
    const p2dVal: XAndY = { x: 1, y: 2 };
    const p3dVal: XYAndZ = { x: 1, y: 2, z: 3 };
    const stringVal: string = "Hello World";

    const id: Id64String = ecdb.withCachedWriteStatement("INSERT INTO test.Foo(Struct) VALUES(?)", (stmt: ECSqlWriteStatement) => {
      stmt.bindStruct(1, { bl: blobVal, bo: boolVal, d: doubleVal, dt: dtVal, i: intVal, p2d: p2dVal, p3d: p3dVal, s: stringVal });
      const res: ECSqlInsertResult = stmt.stepForInsert();
      assert.equal(res.status, DbResult.BE_SQLITE_DONE);
      assert.isDefined(res.id);
      return res.id!;
    });

    const expectedStruct = { bl: blobVal, bo: boolVal, d: doubleVal, dt: dtVal, i: intVal, p2d: p2dVal, p3d: p3dVal, s: stringVal };
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    ecdb.withPreparedStatement("SELECT Struct FROM test.Foo WHERE ECInstanceId=?", (stmt: ECSqlStatement) => {
      stmt.bindId(1, id);
      assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
      const row: any = stmt.getRow();
      assert.deepEqual(row.struct.bl, expectedStruct.bl);
      assert.equal(row.struct.bo, expectedStruct.bo);
      assert.equal(row.struct.d, expectedStruct.d);
      assert.equal(row.struct.dt, expectedStruct.dt);
      assert.equal(row.struct.i, expectedStruct.i);
      assert.equal(row.struct.p2d.x, expectedStruct.p2d.x);
      assert.equal(row.struct.p2d.y, expectedStruct.p2d.y);
      assert.equal(row.struct.p3d.x, expectedStruct.p3d.x);
      assert.equal(row.struct.p3d.y, expectedStruct.p3d.y);
      assert.equal(row.struct.p3d.z, expectedStruct.p3d.z);
      assert.equal(row.struct.s, expectedStruct.s);
    });

    assert.equal(await query(ecdb, "SELECT Struct FROM test.Foo WHERE ECInstanceId=?", QueryBinder.from([id]), undefined, (row: any) => {
      assert.deepEqual(row.struct.bl, expectedStruct.bl);
      assert.equal(row.struct.bo, expectedStruct.bo);
      assert.equal(row.struct.d, expectedStruct.d);
      assert.equal(row.struct.dt, expectedStruct.dt);
      assert.equal(row.struct.i, expectedStruct.i);
      assert.equal(row.struct.p2d.x, expectedStruct.p2d.x);
      assert.equal(row.struct.p2d.y, expectedStruct.p2d.y);
      assert.equal(row.struct.p3d.x, expectedStruct.p3d.x);
      assert.equal(row.struct.p3d.y, expectedStruct.p3d.y);
      assert.equal(row.struct.p3d.z, expectedStruct.p3d.z);
      assert.equal(row.struct.s, expectedStruct.s);
    }), 1);

    // eslint-disable-next-line @typescript-eslint/no-deprecated
    ecdb.withPreparedStatement("SELECT Struct FROM test.Foo WHERE ECInstanceId=?", (stmt: ECSqlStatement) => {
      stmt.bindId(1, id);
      assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
      const actualStruct: any = stmt.getValue(0).getStruct();
      assert.deepEqual(actualStruct.bl, expectedStruct.bl);
      assert.equal(actualStruct.bo, expectedStruct.bo);
      assert.equal(actualStruct.d, expectedStruct.d);
      assert.equal(actualStruct.dt, expectedStruct.dt);
      assert.equal(actualStruct.i, expectedStruct.i);
      assert.equal(actualStruct.p2d.x, expectedStruct.p2d.x);
      assert.equal(actualStruct.p2d.y, expectedStruct.p2d.y);
      assert.equal(actualStruct.p3d.x, expectedStruct.p3d.x);
      assert.equal(actualStruct.p3d.y, expectedStruct.p3d.y);
      assert.equal(actualStruct.p3d.z, expectedStruct.p3d.z);
      assert.equal(actualStruct.s, expectedStruct.s);
    });

    // eslint-disable-next-line @typescript-eslint/no-deprecated
    ecdb.withPreparedStatement("SELECT Struct.Bl, Struct.Bo, Struct.D, Struct.Dt, Struct.I, Struct.P2d, Struct.P3d, Struct.S FROM test.Foo WHERE ECInstanceId=?", (stmt: ECSqlStatement) => {
      stmt.bindId(1, id);
      assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
      const row: any = stmt.getRow();
      assert.deepEqual(row["struct.Bl"], expectedStruct.bl);
      assert.equal(row["struct.Bo"], expectedStruct.bo);
      assert.equal(row["struct.D"], expectedStruct.d);
      assert.equal(row["struct.Dt"], expectedStruct.dt);
      assert.equal(row["struct.I"], expectedStruct.i);
      assert.equal(row["struct.P2d"].x, expectedStruct.p2d.x);
      assert.equal(row["struct.P2d"].y, expectedStruct.p2d.y);
      assert.equal(row["struct.P3d"].x, expectedStruct.p3d.x);
      assert.equal(row["struct.P3d"].y, expectedStruct.p3d.y);
      assert.equal(row["struct.P3d"].z, expectedStruct.p3d.z);
      assert.equal(row["struct.S"], expectedStruct.s);
    });

    assert.equal(await query(ecdb, "SELECT Struct.Bl, Struct.Bo, Struct.D, Struct.Dt, Struct.I, Struct.P2d, Struct.P3d, Struct.S FROM test.Foo WHERE ECInstanceId=?", QueryBinder.from([id]), undefined, (row: any) => {
      assert.deepEqual(row["struct.Bl"], expectedStruct.bl);
      assert.equal(row["struct.Bo"], expectedStruct.bo);
      assert.equal(row["struct.D"], expectedStruct.d);
      assert.equal(row["struct.Dt"], expectedStruct.dt);
      assert.equal(row["struct.I"], expectedStruct.i);
      assert.equal(row["struct.P2d"].x, expectedStruct.p2d.x);
      assert.equal(row["struct.P2d"].y, expectedStruct.p2d.y);
      assert.equal(row["struct.P3d"].x, expectedStruct.p3d.x);
      assert.equal(row["struct.P3d"].y, expectedStruct.p3d.y);
      assert.equal(row["struct.P3d"].z, expectedStruct.p3d.z);
      assert.equal(row["struct.S"], expectedStruct.s);
    }), 1);
  });

  it("check HexStr() sql function", async () => {
    const slm = new SequentialLogMatcher();
    slm.append().error().category("ECDb").message(/Step failed for ECSQL/gm);
    slm.append().error().category("ECDb").message(/Step failed for ECSQL/gm);
    slm.append().error().category("ECDb").message(/Step failed for ECSQL/gm);
    slm.append().error().category("ECDb").message(/Failed to prepare function expression/gm);
    slm.append().error().category("ECDb").message(/Failed to prepare function expression/gm);
    slm.append().error().category("ECDb").message(/Step failed for ECSQL/gm);

    using ecdb = ECDbTestHelper.createECDb(outDir, "hexstrfunction.ecdb",
      `<ECSchema schemaName="Test" alias="test" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
       <ECEntityClass typeName="Foo" modifier="Sealed">
        <ECProperty propertyName="Bl" typeName="binary"/>
        <ECProperty propertyName="Bo" typeName="boolean"/>
        <ECProperty propertyName="D" typeName="double"/>
        <ECProperty propertyName="Dt" typeName="dateTime"/>
        <ECProperty propertyName="G" typeName="Bentley.Geometry.Common.IGeometry"/>
        <ECProperty propertyName="I" typeName="int"/>
        <ECProperty propertyName="L" typeName="long"/>
        <ECProperty propertyName="P2d" typeName="Point2d"/>
        <ECProperty propertyName="P3d" typeName="Point3d"/>
        <ECProperty propertyName="S" typeName="string"/>
       </ECEntityClass>
      </ECSchema>`);
    assert.isTrue(ecdb.isOpen);

    const expectedRow = {
      bl: blobVal, bo: true, d: 3.5, dt: "2018-01-23T12:24:00.000",
      i: 3, l: 12312312312312, p2d: { x: 1, y: 2 }, p3d: { x: 1, y: 2, z: 3 }, s: "Hello World",
    };

    const id: Id64String = ecdb.withCachedWriteStatement("INSERT INTO test.Foo(Bl,Bo,D,Dt,I,L,P2d,P3d,S) VALUES(:bl,:bo,:d,:dt,:i,:l,:p2d,:p3d,:s)", (stmt: ECSqlWriteStatement) => {
      stmt.bindValues({
        bl: blobVal, bo: expectedRow.bo, d: expectedRow.d,
        dt: expectedRow.dt, i: expectedRow.i, l: expectedRow.l, p2d: expectedRow.p2d, p3d: expectedRow.p3d, s: expectedRow.s,
      });
      const res: ECSqlInsertResult = stmt.stepForInsert();
      assert.equal(res.status, DbResult.BE_SQLITE_DONE);
      assert.isDefined(res.id);
      return res.id!;
    });

    ecdb.saveChanges();
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    ecdb.withPreparedStatement("SELECT I, HexStr(I) hex FROM test.Foo WHERE ECInstanceId=?", (stmt: ECSqlStatement) => {
      stmt.bindId(1, id);
      assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
      const row: any = stmt.getRow();
      assert.equal(row.i, expectedRow.i);
      assert.equal(row.hex, "0x3");
    });

    // eslint-disable-next-line @typescript-eslint/no-deprecated
    ecdb.withPreparedStatement("SELECT L, HexStr(L) hex FROM test.Foo WHERE ECInstanceId=?", (stmt: ECSqlStatement) => {
      stmt.bindId(1, id);
      assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
      const row: any = stmt.getRow();
      assert.equal(row.l, expectedRow.l);
      assert.equal(row.hex, "0xb32af0071f8");
    });

    // eslint-disable-next-line @typescript-eslint/no-deprecated
    ecdb.withPreparedStatement("SELECT Bl, HexStr(Bl) hex FROM test.Foo WHERE ECInstanceId=?", (stmt: ECSqlStatement) => {
      stmt.bindId(1, id);
      assert.equal(stmt.step(), DbResult.BE_SQLITE_ERROR);
    });

    // eslint-disable-next-line @typescript-eslint/no-deprecated
    ecdb.withPreparedStatement("SELECT Bo, HexStr(Bo) hex FROM test.Foo WHERE ECInstanceId=?", (stmt: ECSqlStatement) => {
      stmt.bindId(1, id);
      assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
      const row: any = stmt.getRow();
      assert.equal(row.bo, expectedRow.bo);
      assert.equal(row.hex, "0x1");
    });

    // eslint-disable-next-line @typescript-eslint/no-deprecated
    ecdb.withPreparedStatement("SELECT D, HexStr(D) hex FROM test.Foo WHERE ECInstanceId=?", (stmt: ECSqlStatement) => {
      stmt.bindId(1, id);
      assert.equal(stmt.step(), DbResult.BE_SQLITE_ERROR);
    });

    // eslint-disable-next-line @typescript-eslint/no-deprecated
    ecdb.withPreparedStatement("SELECT Dt, HexStr(Dt) hex FROM test.Foo WHERE ECInstanceId=?", (stmt: ECSqlStatement) => {
      stmt.bindId(1, id);
      assert.equal(stmt.step(), DbResult.BE_SQLITE_ERROR);
    });

    // SQL functions cannot take points. So here preparation already fails
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    assert.throw(() => ecdb.withPreparedStatement("SELECT P2d, HexStr(P2d) hex FROM test.Foo WHERE ECInstanceId=?", () => {
      assert.fail();
    }));

    // SQL functions cannot take points. So here preparation already fails
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    assert.throw(() => ecdb.withPreparedStatement("SELECT P3d, HexStr(P3d) hex FROM test.Foo WHERE ECInstanceId=?", () => {
      assert.fail();
    }));

    // eslint-disable-next-line @typescript-eslint/no-deprecated
    ecdb.withPreparedStatement("SELECT S, HexStr(S) hex FROM test.Foo WHERE ECInstanceId=?", (stmt: ECSqlStatement) => {
      stmt.bindId(1, id);
      assert.equal(stmt.step(), DbResult.BE_SQLITE_ERROR);
    });
    assert.isTrue(slm.finishAndDispose());
  });

  it("check ec enums", async () => {
    using ecdb = ECDbTestHelper.createECDb(outDir, "ecenums.ecdb",
      `<ECSchema schemaName="Test" alias="test" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
        <ECEnumeration typeName="Status" backingTypeName="int" isStrict="true">
          <ECEnumerator name="On" value="1" />
          <ECEnumerator name="Off" value="2" />
        </ECEnumeration>
        <ECEnumeration typeName="Domain" backingTypeName="string" isStrict="true">
          <ECEnumerator name="Org" value="Org" />
          <ECEnumerator name="Com" value="Com" />
        </ECEnumeration>
        <ECEntityClass typeName="Foo" modifier="Sealed">
          <ECProperty propertyName="MyStat" typeName="Status"/>
          <ECArrayProperty propertyName="MyStats" typeName="Status"/>
          <ECProperty propertyName="MyDomain" typeName="Domain"/>
          <ECArrayProperty propertyName="MyDomains" typeName="Domain"/>
       </ECEntityClass>
      </ECSchema>`);
    assert.isTrue(ecdb.isOpen);

    const id: Id64String = ecdb.withCachedWriteStatement("INSERT INTO test.Foo(MyStat,MyStats,MyDomain,MyDomains) VALUES(test.Status.[On],?,test.Domain.Org,?)", (stmt: ECSqlWriteStatement) => {
      stmt.bindValue(1, [1, 2]);
      stmt.bindValue(2, ["Org", "Com"]);
      const res: ECSqlInsertResult = stmt.stepForInsert();
      assert.equal(res.status, DbResult.BE_SQLITE_DONE);
      assert.isDefined(res.id);
      return res.id!;
    });

    // eslint-disable-next-line @typescript-eslint/no-deprecated
    ecdb.withPreparedStatement("SELECT MyStat,MyStats, MyDomain,MyDomains FROM test.Foo WHERE ECInstanceId=?", (stmt: ECSqlStatement) => {
      stmt.bindId(1, id);
      assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
      // getRow just returns the enum values
      const row: any = stmt.getRow();
      assert.equal(row.myStat, 1);
      assert.deepEqual(row.myStats, [1, 2]);
      assert.equal(row.myDomain, "Org");
      assert.deepEqual(row.myDomains, ["Org", "Com"]);

      // eslint-disable-next-line @typescript-eslint/no-deprecated
      const myStatVal: ECSqlValue = stmt.getValue(0);
      assert.isFalse(myStatVal.isNull);
      assert.isTrue(myStatVal.columnInfo.isEnum());
      assert.equal(myStatVal.getInteger(), 1);
      assert.deepEqual(myStatVal.getEnum(), [{ schema: "Test", name: "Status", key: "On", value: 1 }]);

      // eslint-disable-next-line @typescript-eslint/no-deprecated
      const myStatsVal: ECSqlValue = stmt.getValue(1);
      assert.isFalse(myStatsVal.isNull);
      assert.isTrue(myStatsVal.columnInfo.isEnum());
      assert.deepEqual(myStatsVal.getArray(), [1, 2]);
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      const actualStatsEnums: ECEnumValue[][] = [];
      for (const arrayElement of myStatsVal.getArrayIterator()) {
        actualStatsEnums.push(arrayElement.getEnum()!);
      }
      assert.equal(actualStatsEnums.length, 2);
      assert.deepEqual(actualStatsEnums[0], [{ schema: "Test", name: "Status", key: "On", value: 1 }]);
      assert.deepEqual(actualStatsEnums[1], [{ schema: "Test", name: "Status", key: "Off", value: 2 }]);

      // eslint-disable-next-line @typescript-eslint/no-deprecated
      const myDomainVal: ECSqlValue = stmt.getValue(2);
      assert.isFalse(myDomainVal.isNull);
      assert.isTrue(myDomainVal.columnInfo.isEnum());
      assert.equal(myDomainVal.getString(), "Org");
      assert.deepEqual(myDomainVal.getEnum(), [{ schema: "Test", name: "Domain", key: "Org", value: "Org" }]);

      // eslint-disable-next-line @typescript-eslint/no-deprecated
      const myDomainsVal: ECSqlValue = stmt.getValue(3);
      assert.isFalse(myDomainsVal.isNull);
      assert.isTrue(myDomainsVal.columnInfo.isEnum());
      assert.deepEqual(myDomainsVal.getArray(), ["Org", "Com"]);
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      const actualDomainsEnums: ECEnumValue[][] = [];
      for (const arrayElement of myDomainsVal.getArrayIterator()) {
        actualDomainsEnums.push(arrayElement.getEnum()!);
      }
      assert.equal(actualDomainsEnums.length, 2);
      assert.deepEqual(actualDomainsEnums[0], [{ schema: "Test", name: "Domain", key: "Org", value: "Org" }]);
      assert.deepEqual(actualDomainsEnums[1], [{ schema: "Test", name: "Domain", key: "Com", value: "Com" }]);
    });

    assert.equal(await query(ecdb, "SELECT MyStat,MyStats, MyDomain,MyDomains FROM test.Foo WHERE ECInstanceId=?", QueryBinder.from([id]), undefined, (row: any) => {
      assert.equal(row.myStat, 1);
      assert.deepEqual(row.myStats, [1, 2]);
      assert.equal(row.myDomain, "Org");
      assert.deepEqual(row.myDomains, ["Org", "Com"]);
    }), 1);

    // test some enums in the built-in schemas
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    ecdb.withPreparedStatement("SELECT Type,Modifier FROM meta.ECClassDef WHERE Name='Foo'", (stmt: ECSqlStatement) => {
      assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
      // getRow just returns the enum values
      const row: any = stmt.getRow();
      assert.deepEqual(row, { type: 0, modifier: 2 });

      // eslint-disable-next-line @typescript-eslint/no-deprecated
      const typeVal: ECSqlValue = stmt.getValue(0);
      assert.isFalse(typeVal.isNull);
      assert.isTrue(typeVal.columnInfo.isEnum());
      assert.equal(typeVal.getInteger(), 0);
      assert.deepEqual(typeVal.getEnum(), [{ schema: "ECDbMeta", name: "ECClassType", key: "Entity", value: 0 }]);

      // eslint-disable-next-line @typescript-eslint/no-deprecated
      const modifierVal: ECSqlValue = stmt.getValue(1);
      assert.isFalse(modifierVal.isNull);
      assert.isTrue(modifierVal.columnInfo.isEnum());
      assert.equal(modifierVal.getInteger(), 2);
      assert.deepEqual(modifierVal.getEnum(), [{ schema: "ECDbMeta", name: "ECClassModifier", key: "Sealed", value: 2 }]);
    });

    assert.equal(await query(ecdb, "SELECT Type,Modifier FROM meta.ECClassDef WHERE Name='Foo'", QueryBinder.from([id]), undefined, (row: any) => {
      assert.deepEqual(row, { type: 0, modifier: 2 });
    }), 1);
  });

  it("check ORed ECEnums", async () => {
    const slm = new SequentialLogMatcher();
    slm.append().error().category("ECDb").message(/The value 9 cannot be broken down into a combination of ECEnumerators/gm);
    slm.append().error().category("ECDb").message(/The value 'gov,de' cannot be broken down into a combination of ECEnumerators/gm);

    using ecdb = ECDbTestHelper.createECDb(outDir, "oredecenums.ecdb",
      `<ECSchema schemaName="Test" alias="test" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
        <ECEnumeration typeName="Color" backingTypeName="int" isStrict="true">
          <ECEnumerator name="Red" value="1" />
          <ECEnumerator name="Yellow" value="2" />
          <ECEnumerator name="Blue" value="4" />
        </ECEnumeration>
        <ECEnumeration typeName="Domain" backingTypeName="string" isStrict="true">
          <ECEnumerator name="Org" value="org" />
          <ECEnumerator name="Com" value="com" />
          <ECEnumerator name="Gov" value="gov" />
        </ECEnumeration>
        <ECEntityClass typeName="Foo" modifier="Sealed">
          <ECProperty propertyName="MyColor" typeName="Color"/>
          <ECProperty propertyName="MyDomain" typeName="Domain"/>
       </ECEntityClass>
      </ECSchema>`);
    assert.isTrue(ecdb.isOpen);

    const ids: { unored: Id64String, ored: Id64String, unmatched: Id64String } = ecdb.withCachedWriteStatement("INSERT INTO test.Foo(MyColor,MyDomain) VALUES(?,?)", (stmt: ECSqlWriteStatement) => {
      stmt.bindValue(1, 4);
      stmt.bindValue(2, "com");
      let res: ECSqlInsertResult = stmt.stepForInsert();
      assert.equal(res.status, DbResult.BE_SQLITE_DONE);
      assert.isDefined(res.id);
      const unored: Id64String = res.id!;
      stmt.reset();
      stmt.clearBindings();

      stmt.bindValue(1, 5);
      stmt.bindValue(2, "gov,com");
      res = stmt.stepForInsert();
      assert.equal(res.status, DbResult.BE_SQLITE_DONE);
      assert.isDefined(res.id);
      const ored: Id64String = res.id!;
      stmt.reset();
      stmt.clearBindings();

      stmt.bindValue(1, 9);
      stmt.bindValue(2, "gov,de");
      res = stmt.stepForInsert();
      assert.equal(res.status, DbResult.BE_SQLITE_DONE);
      assert.isDefined(res.id);
      const unmatched: Id64String = res.id!;
      stmt.reset();
      stmt.clearBindings();

      return { unored, ored, unmatched };
    });

    // eslint-disable-next-line @typescript-eslint/no-deprecated
    ecdb.withPreparedStatement("SELECT MyColor,MyDomain FROM test.Foo WHERE ECInstanceId=?", (stmt: ECSqlStatement) => {
      stmt.bindId(1, ids.unored);
      assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
      // getRow just returns the enum values
      let row: any = stmt.getRow();
      assert.equal(row.myColor, 4);
      assert.equal(row.myDomain, "com");

      // eslint-disable-next-line @typescript-eslint/no-deprecated
      let colVal: ECSqlValue = stmt.getValue(0);
      assert.isFalse(colVal.isNull);
      assert.isTrue(colVal.columnInfo.isEnum());
      assert.equal(colVal.getInteger(), 4);
      assert.deepEqual(colVal.getEnum(), [{ schema: "Test", name: "Color", key: "Blue", value: 4 }]);

      // eslint-disable-next-line @typescript-eslint/no-deprecated
      let domainVal: ECSqlValue = stmt.getValue(1);
      assert.isFalse(domainVal.isNull);
      assert.isTrue(domainVal.columnInfo.isEnum());
      assert.equal(domainVal.getString(), "com");
      assert.deepEqual(domainVal.getEnum(), [{ schema: "Test", name: "Domain", key: "Com", value: "com" }]);
      stmt.reset();
      stmt.clearBindings();

      stmt.bindId(1, ids.ored);
      assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
      // getRow just returns the enum values
      row = stmt.getRow();
      assert.equal(row.myColor, 5);
      assert.equal(row.myDomain, "gov,com");

      colVal = stmt.getValue(0);
      assert.isFalse(colVal.isNull);
      assert.isTrue(colVal.columnInfo.isEnum());
      assert.equal(colVal.getInteger(), 5);
      assert.deepEqual(colVal.getEnum(), [{ schema: "Test", name: "Color", key: "Red", value: 1 }, { schema: "Test", name: "Color", key: "Blue", value: 4 }]);

      domainVal = stmt.getValue(1);
      assert.isFalse(domainVal.isNull);
      assert.isTrue(domainVal.columnInfo.isEnum());
      assert.equal(domainVal.getString(), "gov,com");
      assert.deepEqual(domainVal.getEnum(), [{ schema: "Test", name: "Domain", key: "Com", value: "com" }, { schema: "Test", name: "Domain", key: "Gov", value: "gov" }]);

      stmt.reset();
      stmt.clearBindings();

      stmt.bindId(1, ids.unmatched);
      assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
      // getRow just returns the enum values
      row = stmt.getRow();
      assert.equal(row.myColor, 9);
      assert.equal(row.myDomain, "gov,de");

      colVal = stmt.getValue(0);
      assert.isFalse(colVal.isNull);
      assert.isTrue(colVal.columnInfo.isEnum());
      assert.equal(colVal.getInteger(), 9);
      assert.isUndefined(colVal.getEnum());

      domainVal = stmt.getValue(1);
      assert.isFalse(domainVal.isNull);
      assert.isTrue(domainVal.columnInfo.isEnum());
      assert.equal(domainVal.getString(), "gov,de");
      assert.isUndefined(domainVal.getEnum());
    });

    assert.equal(await query(ecdb, "SELECT MyColor,MyDomain FROM test.Foo WHERE ECInstanceId=?", QueryBinder.from([ids.unored]), undefined, (row: any) => {
      assert.equal(row.myColor, 4);
      assert.equal(row.myDomain, "com");
    }), 1);

    assert.equal(await query(ecdb, "SELECT MyColor,MyDomain FROM test.Foo WHERE ECInstanceId=?", QueryBinder.from([ids.ored]), undefined, (row: any) => {
      assert.equal(row.myColor, 5);
      assert.equal(row.myDomain, "gov,com");
    }), 1);

    assert.equal(await query(ecdb, "SELECT MyColor,MyDomain FROM test.Foo WHERE ECInstanceId=?", QueryBinder.from([ids.unmatched]), undefined, (row: any) => {
      assert.equal(row.myColor, 9);
      assert.equal(row.myDomain, "gov,de");
    }), 1);

    // test some enums in the built-in schemas
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    ecdb.withPreparedStatement("SELECT CustomAttributeContainerType caType FROM meta.ECClassDef WHERE Type=meta.ECClassType.CustomAttribute AND Name='DateTimeInfo'", (stmt: ECSqlStatement) => {
      assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
      const row: any = stmt.getRow();
      assert.equal(row.caType, 160);

      // eslint-disable-next-line @typescript-eslint/no-deprecated
      const caTypeVal: ECSqlValue = stmt.getValue(0);
      assert.isFalse(caTypeVal.isNull);
      assert.isTrue(caTypeVal.columnInfo.isEnum());
      assert.equal(caTypeVal.getInteger(), 160);
      assert.deepEqual(caTypeVal.getEnum(), [
        { schema: "ECDbMeta", name: "ECCustomAttributeContainerType", key: "PrimitiveProperty", value: 32 },
        { schema: "ECDbMeta", name: "ECCustomAttributeContainerType", key: "PrimitiveArrayProperty", value: 128 }]);
    });
    assert.equal(await query(ecdb, "SELECT CustomAttributeContainerType caType FROM meta.ECClassDef WHERE Type=meta.ECClassType.CustomAttribute AND Name='DateTimeInfo'", QueryBinder.from([ids.unmatched]), undefined, (row: any) => {
      assert.equal(row.caType, 160);
    }), 1);
    assert.isTrue(slm.finishAndDispose());
  });

  it("should get native sql", async () => {
    using ecdb = ECDbTestHelper.createECDb(outDir, "asyncmethodtest.ecdb",
      `<ECSchema schemaName="Test" alias="ts" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
        <ECEntityClass typeName="Foo" modifier="Sealed">
          <ECProperty propertyName="n" typeName="int"/>
          <ECProperty propertyName="dt" typeName="dateTime"/>
          <ECProperty propertyName="fooId" typeName="long" extendedTypeName="Id"/>
        </ECEntityClass>
      </ECSchema>`);
    assert.isTrue(ecdb.isOpen);

    const r = await ecdb.withCachedWriteStatement("INSERT INTO ts.Foo(n,dt,fooId) VALUES(20,TIMESTAMP '2018-10-18T12:00:00Z',20)", async (stmt: ECSqlWriteStatement) => {
      const nativesql: string = stmt.getNativeSql();
      assert.isTrue(nativesql.startsWith("INSERT INTO [ts_Foo]"));
      return stmt.stepForInsert();
    });
    ecdb.saveChanges();
    assert.equal(r.status, DbResult.BE_SQLITE_DONE);
    assert.equal(r.id, "0x1");
  });

  it("check column info", async () => {
    using ecdb = ECDbTestHelper.createECDb(outDir, "columnInfo.ecdb",
      `<ECSchema schemaName="Test" alias="test" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
        <ECEntityClass typeName="MyClass" modifier="Sealed">
          <ECProperty propertyName="MyProperty" typeName="string"/>
       </ECEntityClass>
      </ECSchema>`);
    assert.isTrue(ecdb.isOpen);

    const id: Id64String = ecdb.withCachedWriteStatement("INSERT INTO test.MyClass(MyProperty) VALUES('Value')", (stmt: ECSqlWriteStatement) => {
      const res: ECSqlInsertResult = stmt.stepForInsert();
      assert.equal(res.status, DbResult.BE_SQLITE_DONE);
      assert.isDefined(res.id);
      return res.id!;
    });

    // eslint-disable-next-line @typescript-eslint/no-deprecated
    ecdb.withPreparedStatement("SELECT MyProperty as MyAlias, 1 as MyGenerated FROM test.MyClass WHERE ECInstanceId=?", (stmt: ECSqlStatement) => {
      stmt.bindId(1, id);
      assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
      // getRow just returns the enum values
      const row: any = stmt.getRow();
      assert.equal(row.myAlias, "Value");
      assert.equal(row.myGenerated, 1);

      // eslint-disable-next-line @typescript-eslint/no-deprecated
      const val0: ECSqlValue = stmt.getValue(0);
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      const colInfo0: ECSqlColumnInfo = val0.columnInfo;

      assert.equal(colInfo0.getPropertyName(), "MyAlias");
      const accessString0 = colInfo0.getAccessString();
      assert.equal(accessString0, "MyAlias");
      const originPropertyName = colInfo0.getOriginPropertyName();
      assert.isDefined(originPropertyName);
      assert.equal(originPropertyName, "MyProperty");

      // eslint-disable-next-line @typescript-eslint/no-deprecated
      const val1: ECSqlValue = stmt.getValue(1);
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      const colInfo1: ECSqlColumnInfo = val1.columnInfo;

      assert.equal(colInfo1.getPropertyName(), "MyGenerated");
      const accessString1 = colInfo1.getAccessString();
      assert.equal(accessString1, "MyGenerated");
      assert.isUndefined(colInfo1.getOriginPropertyName());
    });
  });

  it("check access string metadata in nested struct", async () => {
    using ecdb = ECDbTestHelper.createECDb(outDir, "columnInfo.ecdb",
      `<ECSchema schemaName="Test" alias="test" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
        <ECSchemaReference name="ECDbMap" version="02.00.00" alias="ecdbmap"/>
        <ECStructClass typeName="InnerStruct">
          <ECProperty propertyName="a" typeName="string"/>
          <ECProperty propertyName="b" typeName="string"/>
        </ECStructClass>
        <ECStructClass typeName="OuterStruct">
          <ECStructProperty propertyName="c" typeName="InnerStruct"/>
          <ECProperty propertyName="d" typeName="string"/>
        </ECStructClass>
        <ECEntityClass typeName="Z">
          <ECCustomAttributes>
            <ClassMap xmlns="ECDbMap.02.00.00">
              <MapStrategy>TablePerHierarchy</MapStrategy>
            </ClassMap>
            <ShareColumns xmlns="ECDbMap.02.00.00">
                <MaxSharedColumnsBeforeOverflow>32</MaxSharedColumnsBeforeOverflow>
            </ShareColumns>
          </ECCustomAttributes>
        </ECEntityClass>
        <ECEntityClass typeName="A">
          <BaseClass>Z</BaseClass>
          <ECStructProperty propertyName="f" typeName="OuterStruct"/>
          <ECProperty propertyName="g" typeName="string"/>
        </ECEntityClass>
        <ECEntityClass typeName="B">
          <BaseClass>Z</BaseClass>
          <ECStructProperty propertyName="h" typeName="InnerStruct" />
          <ECProperty propertyName="i" typeName="string"/>
        </ECEntityClass>
      </ECSchema>`);
    assert.isTrue(ecdb.isOpen);

    ecdb.withCachedWriteStatement("INSERT INTO Test.A (f.c.a, f.c.b, f.d, g) VALUES ('f.c.a' ,'f.c.b', 'f.d', 'g')", (stmt: ECSqlWriteStatement) => {
      const res: ECSqlInsertResult = stmt.stepForInsert();
      assert.equal(res.status, DbResult.BE_SQLITE_DONE);
      assert.isDefined(res.id);
    });

    // eslint-disable-next-line @typescript-eslint/no-deprecated
    ecdb.withPreparedStatement("SELECT f, f.c.a, f.c.b, f.d, g FROM Test.A", (stmt: ECSqlStatement) => {
      assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
      // getRow just returns the enum values
      const row: any = stmt.getRow();
      assert.equal(row.f.c.a, "f.c.a");
      assert.equal(row.f.c.b, "f.c.b");
      assert.equal(row.f.d, "f.d");
      assert.equal(row.g, "g");

      // eslint-disable-next-line @typescript-eslint/no-deprecated
      const val0: ECSqlValue = stmt.getValue(0);
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      const colInfo0: ECSqlColumnInfo = val0.columnInfo;

      assert.equal(colInfo0.getPropertyName(), "f");
      const accessString0 = colInfo0.getAccessString();
      assert.equal(accessString0, "f");
      const originPropertyName0 = colInfo0.getOriginPropertyName();
      assert.isDefined(originPropertyName0);
      assert.equal(originPropertyName0, "f");

      // eslint-disable-next-line @typescript-eslint/no-deprecated
      const val1: ECSqlValue = stmt.getValue(1);
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      const colInfo1: ECSqlColumnInfo = val1.columnInfo;

      assert.equal(colInfo1.getPropertyName(), "a");
      const accessString1 = colInfo1.getAccessString();
      assert.equal(accessString1, "f.c.a");
      const originPropertyName1 = colInfo1.getOriginPropertyName();
      assert.isDefined(originPropertyName1);
      assert.equal(originPropertyName1, "a");

      // eslint-disable-next-line @typescript-eslint/no-deprecated
      const val2: ECSqlValue = stmt.getValue(2);
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      const colInfo2: ECSqlColumnInfo = val2.columnInfo;

      assert.equal(colInfo2.getPropertyName(), "b");
      const accessString2 = colInfo2.getAccessString();
      assert.equal(accessString2, "f.c.b");
      const originPropertyName2 = colInfo2.getOriginPropertyName();
      assert.isDefined(originPropertyName2);
      assert.equal(originPropertyName2, "b");

      // eslint-disable-next-line @typescript-eslint/no-deprecated
      const val3: ECSqlValue = stmt.getValue(3);
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      const colInfo3: ECSqlColumnInfo = val3.columnInfo;

      assert.equal(colInfo3.getPropertyName(), "d");
      const accessString3 = colInfo3.getAccessString();
      assert.equal(accessString3, "f.d");
      const originPropertyName3 = colInfo3.getOriginPropertyName();
      assert.isDefined(originPropertyName3);
      assert.equal(originPropertyName3, "d");

      // eslint-disable-next-line @typescript-eslint/no-deprecated
      const val4: ECSqlValue = stmt.getValue(4);
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      const colInfo4: ECSqlColumnInfo = val4.columnInfo;

      assert.equal(colInfo4.getPropertyName(), "g");
      const accessString4 = colInfo4.getAccessString();
      assert.equal(accessString4, "g");
      const originPropertyName4 = colInfo4.getOriginPropertyName();
      assert.isDefined(originPropertyName4);
      assert.equal(originPropertyName4, "g");
    });

    ecdb.withCachedWriteStatement("INSERT INTO Test.B (h.a, h.b, i) VALUES ('h.a' ,'h.b', 'i')", (stmt: ECSqlWriteStatement) => {
      const res: ECSqlInsertResult = stmt.stepForInsert();
      assert.equal(res.status, DbResult.BE_SQLITE_DONE);
      assert.isDefined(res.id);
    });

    // eslint-disable-next-line @typescript-eslint/no-deprecated
    ecdb.withPreparedStatement("SELECT h, i FROM Test.B", (stmt: ECSqlStatement) => {
      assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
      // getRow just returns the enum values
      const row: any = stmt.getRow();
      assert.equal(row.h.a, "h.a");
      assert.equal(row.h.b, "h.b");
      assert.equal(row.i, "i");
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      const val0: ECSqlValue = stmt.getValue(0);
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      const colInfo0: ECSqlColumnInfo = val0.columnInfo;

      assert.equal(colInfo0.getPropertyName(), "h");
      const accessString0 = colInfo0.getAccessString();
      assert.equal(accessString0, "h");
      const originPropertyName0 = colInfo0.getOriginPropertyName();
      assert.isDefined(originPropertyName0);
      assert.equal(originPropertyName0, "h");
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      const val1: ECSqlValue = stmt.getValue(1);
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      const colInfo1: ECSqlColumnInfo = val1.columnInfo;

      assert.equal(colInfo1.getPropertyName(), "i");
      const accessString1 = colInfo1.getAccessString();
      assert.equal(accessString1, "i");
      const originPropertyName1 = colInfo1.getOriginPropertyName();
      assert.isDefined(originPropertyName1);
      assert.equal(originPropertyName1, "i");
    });
  });

  it("ecsql statements with QueryBinder", async () => {
    using ecdb = ECDbTestHelper.createECDb(outDir, "test.ecdb",
      `<ECSchema schemaName="Test" alias="ts" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
        <ECEntityClass typeName="Foo" modifier="Sealed">
          <ECProperty propertyName="booleanProperty" typeName="boolean"/>
          <ECProperty propertyName="blobProperty" typeName="binary"/>
          <ECProperty propertyName="doubleProperty" typeName="double"/>
          <ECProperty propertyName="customIdProperty" typeName="string"/>
          <ECProperty propertyName="customIdSetProperty" typeName="string"/>
          <ECProperty propertyName="intProperty" typeName="int"/>
          <ECProperty propertyName="longProperty" typeName="long"/>
          <ECProperty propertyName="stringProperty" typeName="string"/>
          <ECProperty propertyName="nullProperty" typeName="int"/>
          <ECProperty propertyName="point2dProperty" typeName="point2d"/>
          <ECProperty propertyName="point3dProperty" typeName="point3d"/>
        </ECEntityClass>
        <ECStructClass typeName="Bar" modifier="Sealed">
          <ECProperty propertyName="structClassProperty" typeName="string"/>
        </ECStructClass>
        <ECEntityClass typeName="Baz" modifier="Sealed">
          <ECStructProperty propertyName="structProperty" typeName="Bar"/>
        </ECEntityClass>
      </ECSchema>`);
    assert.isTrue(ecdb.isOpen);

    const booleanValue = true;
    const blobValue = new Uint8Array([0, 0, 0]);
    const doubleValue = 12.12;
    const customIdValue = "1234";
    const customIdSetValue = ["0x9"];
    const intValue = 10;
    const longValue = 1e9;
    const stringValue = "test string value";
    const point2dValue = new Point2d(10, 20);
    const point3dValue = new Point3d(15, 30, 45);
    const structValue = { structClassProperty: "test string value for struct property" };

    let r = await ecdb.withCachedWriteStatement(
      `INSERT INTO ts.Foo(booleanProperty, blobProperty, doubleProperty, customIdProperty, customIdSetProperty, intProperty, longProperty, stringProperty, nullProperty, point2dProperty, point3dProperty)
          VALUES(:booleanValue, :blobValue, :doubleValue, :customIdValue, :customIdSetValue, :intValue, :longValue, :stringValue, :nullValue, :point2dValue, :point3dValue)`,
      async (stmt: ECSqlWriteStatement) => {
        stmt.bindBoolean("booleanValue", booleanValue);
        stmt.bindBlob("blobValue", blobValue);
        stmt.bindDouble("doubleValue", doubleValue);
        stmt.bindId("customIdValue", customIdValue);
        stmt.bindId("customIdSetValue", customIdSetValue[0]);
        stmt.bindInteger("intValue", intValue);
        stmt.bindInteger("longValue", longValue);
        stmt.bindString("stringValue", stringValue);
        stmt.bindNull("nullValue");
        stmt.bindPoint2d("point2dValue", point2dValue);
        stmt.bindPoint3d("point3dValue", point3dValue);
        return stmt.stepForInsert();
      },
    );

    ecdb.saveChanges();
    assert.equal(r.status, DbResult.BE_SQLITE_DONE);
    assert.equal(r.id, "0x1");

    const params = new QueryBinder();
    params.bindBoolean("booleanValue", booleanValue);
    params.bindBlob("blobValue", blobValue);
    params.bindDouble("doubleValue", doubleValue);
    params.bindId("customIdValue", customIdValue);
    params.bindInt("intValue", intValue);
    params.bindLong("longValue", longValue);
    params.bindString("stringValue", stringValue);
    params.bindPoint2d("point2dValue", point2dValue);
    params.bindPoint3d("point3dValue", point3dValue);
    params.bindIdSet("customIdSetValue", customIdSetValue);

    let reader = ecdb.createQueryReader(
      `SELECT booleanProperty, blobProperty, doubleProperty, customIdProperty, customIdSetProperty, intProperty, longProperty, stringProperty, nullProperty, point2dProperty, point3dProperty FROM ts.Foo
          WHERE booleanProperty = :booleanValue AND blobProperty = :blobValue AND doubleProperty = :doubleValue AND customIdProperty = :customIdValue AND InVirtualSet(:customIdSetValue, customIdSetProperty) AND
          intProperty = :intValue AND longProperty = :longValue AND stringProperty = :stringValue AND point2dProperty = :point2dValue AND point3dProperty = :point3dValue`,
      params,
    );
    const row = (await reader.toArray())[0];

    assert.isNotNull(row);
    assert.equal(row[0], booleanValue);
    assert.deepEqual(row[1], blobValue);
    assert.equal(row[2], doubleValue);
    assert.equal(row[3], customIdValue);
    assert.equal(row[4], "9");
    assert.equal(row[5], intValue);
    assert.equal(row[6], longValue);
    assert.equal(row[7], stringValue);
    assert.equal(row[8], null);
    assert.deepEqual(row[9], { X: 10, Y: 20 });
    assert.deepEqual(row[10], { X: 15, Y: 30, Z: 45 });

    assert.isFalse(await reader.step());

    r = await ecdb.withCachedWriteStatement(
      "INSERT INTO ts.Baz(structProperty) VALUES(:structValue)",
      async (stmt: ECSqlWriteStatement) => {
        stmt.bindStruct("structValue", structValue);
        return stmt.stepForInsert();
      },
    );

    ecdb.saveChanges();
    assert.equal(r.status, DbResult.BE_SQLITE_DONE);
    assert.equal(r.id, "0x2");

    reader = ecdb.createQueryReader(
      `SELECT * FROM ts.Baz`,
    );

    await reader.step();

    assert.deepEqual(reader.current.structProperty, structValue);

    const paramsWithStruct = new QueryBinder();
    paramsWithStruct.bindStruct("structValue", structValue);
    reader = ecdb.createQueryReader("SELECT * FROM ts.Baz WHERE structProperty = :structValue", paramsWithStruct);

    await assert.isRejected(reader.toArray(), "Struct type binding not supported");
  });

  describe("invalid RelECClassId with pragma validate_ecsql_writes", () => {
    let ecdb: ECDb;
    let parentHasChildrenClassId: Id64String;
    let childHasFriendsClassId: Id64String;
    let validRelClassId: Id64String;

    before(async () => {
      ecdb = ECDbTestHelper.createECDb(outDir, "bindnavigation.ecdb",
        `<ECSchema schemaName="Test" alias="test" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">

          <ECEntityClass typeName="Parent" modifier="Sealed">
            <ECProperty propertyName="Code" typeName="string"/>
          </ECEntityClass>

          <ECEntityClass typeName="ChildTemplate" modifier="Abstract">
            <ECProperty propertyName="Name" typeName="string"/>
            <ECNavigationProperty propertyName="Parent" relationshipName="ParentHasChildren" direction="backward"/>
          </ECEntityClass>

          <ECEntityClass typeName="Child" modifier="Sealed">
            <BaseClass>ChildTemplate</BaseClass>
            <ECProperty propertyName="Age" typeName="int"/>
            <ECNavigationProperty propertyName="Friends" relationshipName="ChildHasFriends" direction="backward"/>
          </ECEntityClass>

          <ECRelationshipClass typeName="ParentHasChildren" modifier="None" strength="embedding">
            <Source multiplicity="(0..1)" roleLabel="has" polymorphic="false">
                <Class class="Parent"/>
            </Source>
            <Target multiplicity="(0..*)" roleLabel="has" polymorphic="false">
                <Class class="ChildTemplate"/>
            </Target>
          </ECRelationshipClass>

          <ECRelationshipClass typeName="ChildHasFriends" modifier="None" strength="embedding">
            <Source multiplicity="(0..1)" roleLabel="has" polymorphic="false">
                <Class class="Child"/>
            </Source>
            <Target multiplicity="(0..*)" roleLabel="has" polymorphic="false">
                <Class class="Child"/>
            </Target>
          </ECRelationshipClass>
        </ECSchema>`);

      assert.isTrue(ecdb.isOpen);

      let reader = ecdb.createQueryReader("SELECT ECInstanceId FROM meta.ECClassDef WHERE Name='Parent'");
      assert.isTrue(await reader.step());
      parentHasChildrenClassId = reader.current.ECInstanceId;
      assert.isTrue(Id64.isValidId64(parentHasChildrenClassId));

      // When the ECSql insert validation is set to true, the invalid relClassId is detected and an error is thrown.
      assert.isTrue(await (ecdb.createQueryReader("PRAGMA validate_ecsql_writes=true")).step());

      reader = ecdb.createQueryReader("SELECT ECInstanceId FROM meta.ECClassDef WHERE Name='ParentHasChildren'");
      assert.isTrue(await reader.step());
      validRelClassId = reader.current.ECInstanceId;
      assert.isTrue(Id64.isValidId64(validRelClassId));

      reader = ecdb.createQueryReader("SELECT ECInstanceId FROM meta.ECClassDef WHERE Name='ChildHasFriends'");
      assert.isTrue(await reader.step());
      childHasFriendsClassId = reader.current.ECInstanceId;
      assert.isTrue(Id64.isValidId64(childHasFriendsClassId));

      ecdb.saveChanges();
    });

    after(() => {
      ecdb.closeDb();
    });

    function testECSqlWithoutBinders(testCaseNumber: number, sqlStmt: string, shouldSucceed: boolean, expectedError: string, isInsert: boolean = true, expectedResult: DbResult = DbResult.BE_SQLITE_DONE) {
      let id: Id64String | undefined;
      let stmt: ECSqlWriteStatement | undefined;
      try {
        stmt = ecdb.prepareWriteStatement(sqlStmt);
        assert.isDefined(stmt);
        if (isInsert) {
          const res: ECSqlInsertResult = stmt.stepForInsert();
          assert.equal(res.status, expectedResult);
          assert.isDefined(res.id);
        } else {
          assert.equal(stmt.step(), expectedResult);
        }
      } catch (err: any) {
        if (shouldSucceed)
          assert.fail(`Test case ${testCaseNumber} should not have thrown an error: ${err.message}`);
        else
          assert.equal(err.message, expectedError, `Test case ${testCaseNumber} Expected error: ${err.message}`);
      }
      if (stmt !== undefined)
        stmt[Symbol.dispose]();
      return id;
    };

    function testECSqlWithBinders(testCaseNumber: number, sqlStmt: string, firstBinderValue: string, secondBinderValue: string, shouldSucceed: boolean, expectedError: string, isInsert: boolean = true, expectedResult: DbResult = DbResult.BE_SQLITE_DONE) {
      let stmt: ECSqlWriteStatement | undefined;
      try {
        stmt = ecdb.prepareWriteStatement(sqlStmt);
        if (firstBinderValue !== "")
          stmt.bindNavigation(1, { id: "1", relClassName: firstBinderValue });
        if (secondBinderValue !== "")
          stmt.bindNavigation(2, { id: "2", relClassName: secondBinderValue });

        if (isInsert) {
          const res: ECSqlInsertResult = stmt.stepForInsert();
          assert.equal(res.status, expectedResult);
          assert.isDefined(res.id);
        } else {
          assert.equal(stmt.step(), expectedResult);
        }
      } catch (err: any) {
        if (shouldSucceed)
          assert.fail(`Test case ${testCaseNumber} should not have thrown an error: ${err.message}`);
        else
          assert.equal(err.message, expectedError, `Test case ${testCaseNumber} Expected error: ${err.message}`);
      }

      if (stmt !== undefined)
        stmt[Symbol.dispose]();
      stmt?.clearBindings();
    };

    it("insert statement with invalid relClassId in navigation properties", async () => {
      // Invalid RelECClassId values
      testECSqlWithoutBinders(1, `INSERT INTO test.Child(Parent.Id, Parent.RelECClassId) VALUES(1, 9999)`, false, `The ECSql statement contains a class with id '9999' which is not a valid relationship class.`);
      testECSqlWithoutBinders(2, `INSERT INTO test.Child(Parent.Id, Parent.RelECClassId) VALUES(1, NULL)`, false, `The ECSql statement contains an invalid relationship class id.`);
      testECSqlWithoutBinders(3, `INSERT INTO test.Child(Parent.Id, Parent.RelECClassId) VALUES(1, ${parentHasChildrenClassId})`, false, `The ECSql statement contains a class with id '${parentHasChildrenClassId}' which is not a valid relationship class.`);
      testECSqlWithoutBinders(4, `INSERT INTO test.Child(Parent.Id, Parent.RelECClassId) VALUES(1, ${validRelClassId})`, true, "");

      // Invalid RelClassName values with binders
      testECSqlWithBinders(5, "INSERT INTO test.Child(Parent) VALUES(?)", "Test.InvalidClass", "", false, "The ECSql statement contains a relationship class 'Test.InvalidClass' which does not correspond to any EC class.");

      // Valid RelClassName values with binders
      testECSqlWithBinders(6, "INSERT INTO test.Child(Parent) VALUES(?)", "Test.ParentHasChildren", "", true, "");
      testECSqlWithBinders(7, "INSERT INTO test.Child(Friends) VALUES(?)", "Test.ChildHasFriends", "", true, "");

      // Valid RelClassName values with binders but invalid relClassId
      testECSqlWithBinders(8, "INSERT INTO test.Child(Parent) VALUES(?)", "Test.ChildHasFriends", "", false, "The ECSql statement contains a relationship class 'Test.ChildHasFriends' which does not match the relationship class in the navigation property.");
      testECSqlWithBinders(9, "INSERT INTO test.Child(Friends) VALUES(?)", "Test.ParentHasChildren", "", false, "The ECSql statement contains a relationship class 'Test.ParentHasChildren' which does not match the relationship class in the navigation property.");

      // Valid multiple RelClassName values with binders
      testECSqlWithBinders(10, "INSERT INTO test.Child(Parent, Friends) VALUES(?, ?)", "Test.ParentHasChildren", "Test.ChildHasFriends", true, "");
      testECSqlWithBinders(11, "INSERT INTO test.Child(Friends, Parent) VALUES(?, ?)", "Test.ParentHasChildren", "Test.ChildHasFriends", false, "The ECSql statement contains a relationship class 'Test.ParentHasChildren' which does not match the relationship class in the navigation property.");
    });

    it("update statement with invalid relClassId in navigation properties", async () => {
      // insert a value that can be updated in the test suite
      ecdb.withWriteStatement("INSERT INTO test.Child(Name, Parent, Friends) VALUES('Test123', ?, ?)", (stmt: ECSqlWriteStatement) => {
        stmt.bindNavigation(1, { id: "1", relClassName: "Test.ParentHasChildren" });
        stmt.bindNavigation(2, { id: "2", relClassName: "Test.ChildHasFriends" });
        const res: ECSqlInsertResult = stmt.stepForInsert();
        assert.equal(res.status, DbResult.BE_SQLITE_DONE);
        assert.isDefined(res.id);
        stmt.clearBindings();
        stmt[Symbol.dispose]();
        ecdb.saveChanges();
      });

      // Invalid RelECClassId values
      testECSqlWithoutBinders(1, `UPDATE test.Child SET Parent.RelECClassId = 9999`, false, `The ECSql statement contains a class with id '9999' which is not a valid relationship class.`, false);
      testECSqlWithoutBinders(2, `UPDATE test.Child SET Parent.RelECClassId = NULL`, false, `The ECSql statement contains an invalid relationship class id.`, false);
      testECSqlWithoutBinders(3, `UPDATE test.Child SET Parent.RelECClassId = ${parentHasChildrenClassId}`, false, `The ECSql statement contains a class with id '${parentHasChildrenClassId}' which is not a valid relationship class.`, false);
      testECSqlWithoutBinders(4, `UPDATE test.Child SET Parent.RelECClassId = ${validRelClassId}`, true, "", false);

      // Invalid RelClassName values with binders
      testECSqlWithBinders(5, "UPDATE test.Child SET Parent = ?", "Test.InvalidClass", "", false, "The ECSql statement contains a relationship class 'Test.InvalidClass' which does not correspond to any EC class.", false);

      // Valid RelClassName values with binders
      testECSqlWithBinders(6, "UPDATE test.Child SET Parent = ?", "Test.ParentHasChildren", "", true, "", false);
      testECSqlWithBinders(7, "UPDATE test.Child SET Friends = ?", "Test.ChildHasFriends", "", true, "", false);

      // Valid RelClassName values with binders but invalid relClassId
      testECSqlWithBinders(8, "UPDATE test.Child SET Parent = ?", "Test.ChildHasFriends", "", false, "The ECSql statement contains a relationship class 'Test.ChildHasFriends' which does not match the relationship class in the navigation property.", false);
      testECSqlWithBinders(9, "UPDATE test.Child SET Friends = ?", "Test.ParentHasChildren", "", false, "The ECSql statement contains a relationship class 'Test.ParentHasChildren' which does not match the relationship class in the navigation property.", false);

      // Valid multiple RelClassName values with binders
      testECSqlWithBinders(10, "UPDATE test.Child SET Parent = ?, Friends = ?", "Test.ParentHasChildren", "Test.ChildHasFriends", true, "", false);
      testECSqlWithBinders(11, "UPDATE test.Child SET Friends = ?, Parent = ?", "Test.ParentHasChildren", "Test.ChildHasFriends", false, "The ECSql statement contains a relationship class 'Test.ParentHasChildren' which does not match the relationship class in the navigation property.", false);
    });

    it("select statement with invalid relClassId in navigation properties", async () => {
      // insert a value that can be updated in the test suite
      ecdb.withWriteStatement("INSERT INTO test.Child(Name, Parent, Friends) VALUES('Test123', ?, ?)", (stmt: ECSqlWriteStatement) => {
        stmt.bindNavigation(1, { id: "1", relClassName: "Test.ParentHasChildren" });
        stmt.bindNavigation(2, { id: "2", relClassName: "Test.ChildHasFriends" });
        const res: ECSqlInsertResult = stmt.stepForInsert();
        assert.equal(res.status, DbResult.BE_SQLITE_DONE);
        assert.isDefined(res.id);
        stmt.clearBindings();
        stmt[Symbol.dispose]();
        ecdb.saveChanges();
      });

      // Invalid RelECClassId values
      testECSqlWithoutBinders(1, `SELECT * from test.Child where Parent.RelECClassId = 9999`, true, "", false);
      testECSqlWithoutBinders(2, `SELECT * from test.Child where Parent.RelECClassId = NULL`, true, "", false);
      testECSqlWithoutBinders(3, `SELECT * from test.Child where Parent.RelECClassId = ${parentHasChildrenClassId}`, true, "", false);
      testECSqlWithoutBinders(4, `SELECT * from test.Child where Parent.RelECClassId = ${validRelClassId}`, true, "", false, DbResult.BE_SQLITE_ROW);

      // Invalid RelClassName values with binders
      testECSqlWithBinders(5, "SELECT * from test.Child where Parent = ?", "Test.InvalidClass", "", true, "", false);

      // Valid RelClassName values with binders
      testECSqlWithBinders(6, "SELECT * from test.Child where Parent = ?", "Test.ParentHasChildren", "", true, "", false, DbResult.BE_SQLITE_ROW);
      testECSqlWithBinders(7, "SELECT * from test.Child where Friends = ?", "Test.ChildHasFriends", "", true, "", false);

      // Valid RelClassName values with binders but invalid relClassId
      testECSqlWithBinders(8, "SELECT * from test.Child where Parent = ?", "Test.ChildHasFriends", "", true, "", false);
      testECSqlWithBinders(9, "SELECT * from test.Child where Friends = ?", "Test.ParentHasChildren", "", true, "", false);

      // Valid multiple RelClassName values with binders
      testECSqlWithBinders(10, "SELECT * from test.Child where Parent = ? and Friends = ?", "Test.ParentHasChildren", "Test.ChildHasFriends", true, "", false, DbResult.BE_SQLITE_ROW);
      testECSqlWithBinders(11, "SELECT * from test.Child where Friends = ? and Parent = ?", "Test.ParentHasChildren", "Test.ChildHasFriends", true, "", false);
    });
  });
});
