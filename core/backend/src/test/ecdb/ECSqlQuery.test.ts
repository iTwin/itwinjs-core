/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { DbResult, Id64 } from "@itwin/core-bentley";
import { QueryBinder, QueryRowFormat } from "@itwin/core-common";
import { IModelDb, SnapshotDb } from "../../core-backend";
import { IModelTestUtils } from "../IModelTestUtils";
import { SequentialLogMatcher } from "../SequentialLogMatcher";

// cspell:ignore mirukuru ibim

async function executeQuery(iModel: IModelDb, ecsql: string, bindings?: any[] | object, abbreviateBlobs?: boolean): Promise<any[]> {
  const rows: any[] = [];
  for await (const row of iModel.query(ecsql, QueryBinder.from(bindings), { rowFormat: QueryRowFormat.UseJsPropertyNames, abbreviateBlobs })) {
    rows.push(row);
  }
  return rows;
}

describe("ECSql Query", () => {
  let imodel1: SnapshotDb;
  let imodel2: SnapshotDb;
  let imodel3: SnapshotDb;
  let imodel4: SnapshotDb;
  let imodel5: SnapshotDb;

  before(async () => {
    imodel1 = SnapshotDb.openFile(IModelTestUtils.resolveAssetFile("test.bim"));
    imodel2 = SnapshotDb.openFile(IModelTestUtils.resolveAssetFile("CompatibilityTestSeed.bim"));
    imodel3 = SnapshotDb.openFile(IModelTestUtils.resolveAssetFile("GetSetAutoHandledStructProperties.bim"));
    imodel4 = SnapshotDb.openFile(IModelTestUtils.resolveAssetFile("GetSetAutoHandledArrayProperties.bim"));
    imodel5 = SnapshotDb.openFile(IModelTestUtils.resolveAssetFile("mirukuru.ibim"));
  });

  after(async () => {
    imodel1.close();
    imodel2.close();
    imodel3.close();
    imodel4.close();
    imodel5.close();
  });

  // new new addon build
  it("ecsql with blob", async () => {
    let rows = await executeQuery(imodel1, "SELECT ECInstanceId,GeometryStream FROM bis.GeometricElement3d WHERE GeometryStream IS NOT NULL LIMIT 1");
    assert.equal(rows.length, 1);
    const row: any = rows[0];

    assert.isTrue(Id64.isValidId64(row.id));

    assert.isDefined(row.geometryStream);
    const geomStream: Uint8Array = row.geometryStream;
    assert.isAtLeast(geomStream.byteLength, 1);

    rows = await executeQuery(imodel1, "SELECT 1 FROM bis.GeometricElement3d WHERE GeometryStream=?", [geomStream]);
    assert.equal(rows.length, 1);

    rows = await executeQuery(imodel1, "SELECT ECInstanceId,GeometryStream FROM bis.GeometricElement3d WHERE GeometryStream IS NOT NULL LIMIT 1", undefined, true);
    assert.equal(rows.length, 1);
    assert.isTrue(Id64.isValidId64(rows[0].id));
    assert.isDefined(rows[0].geometryStream);
  });
  it("check prepare logErrors flag", () => {
    const ecdb = imodel1;
    // expect log message when statement fails
    let slm = new SequentialLogMatcher();
    slm.append().error().category("BeSQLite").message("Error \"no such table: def (BE_SQLITE_ERROR)\" preparing SQL: SELECT abc FROM def");
    assert.throw(() => ecdb.withSqliteStatement("SELECT abc FROM def", () => { }), "no such table: def (BE_SQLITE_ERROR)");
    assert.isTrue(slm.finishAndDispose(), "logMatcher should detect log");

    // now pass suppress log error which mean we should not get the error
    slm = new SequentialLogMatcher();
    slm.append().error().category("BeSQLite").message("Error \"no such table: def (BE_SQLITE_ERROR)\" preparing SQL: SELECT abc FROM def");
    assert.throw(() => ecdb.withSqliteStatement("SELECT abc FROM def", () => { }, /* logErrors = */ false), "no such table: def (BE_SQLITE_ERROR)");
    assert.isFalse(slm.finishAndDispose(), "logMatcher should not detect log");

    // expect log message when statement fails
    slm = new SequentialLogMatcher();
    slm.append().error().category("ECDb").message("ECClass 'abc.def' does not exist or could not be loaded.");
    assert.throw(() => ecdb.withPreparedStatement("SELECT abc FROM abc.def", () => { }), "ECClass 'abc.def' does not exist or could not be loaded.");
    assert.isTrue(slm.finishAndDispose(), "logMatcher should detect log");

    // now pass suppress log error which mean we should not get the error
    slm = new SequentialLogMatcher();
    slm.append().error().category("ECDb").message("ECClass 'abc.def' does not exist or could not be loaded.");
    assert.throw(() => ecdb.withPreparedStatement("SELECT abc FROM abc.def", () => { }, /* logErrors = */ false), "");
    assert.isFalse(slm.finishAndDispose(), "logMatcher should not detect log");
  });
  it("restart query", async () => {
    let cancelled = 0;
    let successful = 0;
    let rowCount = 0;
    const cb = async () => {
      return new Promise<void>(async (resolve, reject) => {
        try {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          for await (const _row of imodel1.restartQuery("tag", "SELECT ECInstanceId as Id, Parent.Id as ParentId FROM BisCore.element")) {
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
    for (let i = 0; i < 100; i++) {
      queries.push(cb());
    }
    await Promise.all(queries);
    // We expect at least one query to be cancelled
    assert.isAtLeast(cancelled, 1);
    assert.isAtLeast(successful, 1);
    assert.isAtLeast(rowCount, 1);
  });
  it("concurrent query use primary connection", async () => {
    const reader = imodel1.createQueryReader("SELECT * FROM BisCore.element", undefined, { usePrimaryConn: true });
    let props = await reader.getMetaData();
    assert.equal(props.length, 11);
    let rows = 0;
    while (await reader.step()) {
      rows++;
    }
    assert.equal(rows, 46);
    props = await reader.getMetaData();
    assert.equal(props.length, 11);
    assert.equal(reader.stats.backendRowsReturned, 46);
    assert.isTrue(reader.stats.backendCpuTime > 0);
    assert.isTrue(reader.stats.backendMemUsed > 1000);
    assert.isTrue(reader.stats.totalTime > 0);
  });
  it("concurrent query use idset", async () => {
    const ids: string[] = [];
    for await (const row of imodel1.query("SELECT ECInstanceId FROM BisCore.Element LIMIT 23")) {
      ids.push(row[0]);
    }
    const reader = imodel1.createQueryReader("SELECT * FROM BisCore.element WHERE InVirtualSet(?, ECInstanceId)", QueryBinder.from([ids]));
    let props = await reader.getMetaData();
    assert.equal(props.length, 11);
    let rows = 0;
    while (await reader.step()) {
      rows++;
    }
    assert.equal(rows, 23);
    props = await reader.getMetaData();
    assert.equal(props.length, 11);
    assert.equal(reader.stats.backendRowsReturned, 23);
    assert.isTrue(reader.stats.backendCpuTime > 0);
    assert.isTrue(reader.stats.backendMemUsed > 100);
  });
  it("concurrent query get meta data", async () => {
    const reader = imodel1.createQueryReader("SELECT * FROM BisCore.element");
    let props = await reader.getMetaData();
    assert.equal(props.length, 11);
    let rows = 0;
    while (await reader.step()) {
      rows++;
    }
    assert.equal(rows, 46);
    props = await reader.getMetaData();
    assert.equal(props.length, 11);
    assert.equal(reader.stats.backendRowsReturned, 46);
    assert.isTrue(reader.stats.backendCpuTime > 0);
    assert.isTrue(reader.stats.backendMemUsed > 1000);
  });
  it("concurrent query quota", async () => {
    let reader = imodel1.createQueryReader("SELECT * FROM BisCore.element", undefined, { limit: { count: 4 } });
    let rows = 0;
    while (await reader.step()) {
      rows++;
    }
    assert.equal(rows, 4);
    reader = imodel1.createQueryReader("SELECT * FROM BisCore.element", undefined, { limit: { offset: 4, count: 4 } });
    rows = 0;
    while (await reader.step()) {
      rows++;
    }
    assert.equal(rows, 4);
  });
  it("paging results", async () => {
    const getRowPerPage = (nPageSize: number, nRowCount: number) => {
      const nRowPerPage = nRowCount / nPageSize;
      const nPages = Math.ceil(nRowPerPage);
      const nRowOnLastPage = nRowCount - (Math.floor(nRowPerPage) * pageSize);
      const pages = new Array(nPages).fill(pageSize);
      if (nRowPerPage) {
        pages[nPages - 1] = nRowOnLastPage;
      }
      return pages;
    };

    const pageSize = 5;
    const query = "SELECT ECInstanceId as Id, Parent.Id as ParentId FROM BisCore.element";
    const dbs = [imodel1, imodel2, imodel3, imodel4, imodel5];
    const pendingRowCount = [];
    for (const db of dbs) {
      pendingRowCount.push(db.queryRowCount(query));
    }

    const rowCounts = await Promise.all(pendingRowCount);
    const expected = [46, 62, 7, 7, 28];
    assert.equal(rowCounts.length, expected.length);
    for (let i = 0; i < expected.length; i++) {
      assert.equal(rowCounts[i], expected[i]);
    }
    // verify row per page
    for (const db of dbs) {
      const i = dbs.indexOf(db);
      const rowPerPage = getRowPerPage(pageSize, expected[i]);
      for (let k = 0; k < rowPerPage.length; k++) {
        const rs = await db.createQueryReader(query, undefined, { rowFormat: QueryRowFormat.UseJsPropertyNames, limit: { count: pageSize, offset: k * pageSize } }).toArray();
        assert.equal(rs.length, rowPerPage[k]);
      }
    }

    // verify async iterator
    for (const db of dbs) {
      const resultSet = [];
      for await (const row of db.query(query, undefined, { rowFormat: QueryRowFormat.UseJsPropertyNames })) {
        resultSet.push(row);
        assert.isTrue(Reflect.has(row, "id"));
        if (Reflect.ownKeys(row).length > 1) {
          assert.isTrue(Reflect.has(row, "parentId"));
          const parentId: string = row.parentId as string;
          assert.isTrue(Id64.isValidId64(parentId));
        }
        const id: string = row.id as string;
        assert.isTrue(Id64.isValidId64(id));
      }
      const entry = dbs.indexOf(db);
      assert.equal(rowCounts[entry], resultSet.length);
    }
  });
});
