/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { DbResult, Id64 } from "@itwin/core-bentley";
import { DbQueryRequest, DbQueryResponse, DbRequestExecutor, DbRequestKind, ECSqlReader, QueryBinder, QueryOptionsBuilder, QueryRowFormat } from "@itwin/core-common";
import { ConcurrentQuery } from "../../ConcurrentQuery";
import { ECSqlStatement, IModelDb, SnapshotDb } from "../../core-backend";
import { IModelTestUtils } from "../IModelTestUtils";
import { SequentialLogMatcher } from "../SequentialLogMatcher";

// cspell:ignore mirukuru ibim

async function executeQuery(iModel: IModelDb, ecsql: string, bindings?: any[] | object, abbreviateBlobs?: boolean): Promise<any[]> {
  const rows: any[] = [];
  for await (const queryRow of iModel.createQueryReader(ecsql, QueryBinder.from(bindings), { rowFormat: QueryRowFormat.UseJsPropertyNames, abbreviateBlobs })) {
    rows.push(queryRow.toRow());
  }
  return rows;
}

describe("ECSql Query", () => {
  let imodel1: SnapshotDb;
  let imodel2: SnapshotDb;
  let imodel3: SnapshotDb;
  let imodel4: SnapshotDb;
  let imodel5: SnapshotDb;
  let imodel6: SnapshotDb;

  before(async () => {
    imodel1 = SnapshotDb.openFile(IModelTestUtils.resolveAssetFile("test.bim"));
    imodel2 = SnapshotDb.openFile(IModelTestUtils.resolveAssetFile("CompatibilityTestSeed.bim"));
    imodel3 = SnapshotDb.openFile(IModelTestUtils.resolveAssetFile("GetSetAutoHandledStructProperties.bim"));
    imodel4 = SnapshotDb.openFile(IModelTestUtils.resolveAssetFile("GetSetAutoHandledArrayProperties.bim"));
    imodel5 = SnapshotDb.openFile(IModelTestUtils.resolveAssetFile("mirukuru.ibim"));
    imodel6 = SnapshotDb.openFile(IModelTestUtils.resolveAssetFile("test_ec_4003.bim"));
  });

  after(async () => {
    imodel1.close();
    imodel2.close();
    imodel3.close();
    imodel4.close();
    imodel5.close();
    imodel6.close();
  });

  it("verify return values for system properties", async () => {
    const testQueries = [
      {
        query: "SELECT ECInstanceId, ECClassId FROM Bis.Element LIMIT 1", expected: {
          id: "0x19",
          className: "BisCore.DrawingCategory",
        },
      },
      {
        query: "SELECT * FROM (SELECT ECInstanceId, ECClassId FROM Bis.Element) LIMIT 1", expected: {
          id: "0x19",
          className: "BisCore.DrawingCategory",
        },
      },
      {
        query: "SELECT ECInstanceId, ECClassId, SourceECInstanceId, SourceECClassId, TargetECInstanceid, TargetECClassId FROM Bis.ElementRefersToElements LIMIT 1", expected: {
          id: "0x1",
          className: "BisCore.PartitionOriginatesFromRepository",
          sourceId: "0x1c",
          sourceClassName: "BisCore.PhysicalPartition",
          targetId: "0x12",
          targetClassName: "BisCore.RepositoryLink",
        },
      },
      {
        query: "SELECT * FROM (SELECT ECInstanceId, ECClassId, SourceECInstanceId, SourceECClassId, TargetECInstanceid, TargetECClassId FROM Bis.ElementRefersToElements) LIMIT 1", expected: {
          id: "0x1",
          className: "BisCore.PartitionOriginatesFromRepository",
          sourceId: "0x1c",
          sourceClassName: "BisCore.PhysicalPartition",
          targetId: "0x12",
          targetClassName: "BisCore.RepositoryLink",
        },
      },
      {
        query: "SELECT ECInstanceId a, ECClassId b FROM Bis.Element LIMIT 1", expected: {
          a: "0x19",
          b: "0x4c",
        },
      },
      {
        query: "SELECT * FROM (SELECT ECInstanceId a, ECClassId b FROM Bis.Element) LIMIT 1", expected: {
          a: "0x19",
          b: "0x4c",
        },
      },
      {
        query: "SELECT ECInstanceId a, ECClassId b, SourceECInstanceId c, SourceECClassId d, TargetECInstanceid e, TargetECClassId f FROM Bis.ElementRefersToElements LIMIT 1", expected: {
          a: "0x1",
          b: "0xa8",
          c: "0x1c",
          d: "0xb4",
          e: "0x12",
          f: "0xa9",
        },
      },
      {
        query: "SELECT * FROM (SELECT ECInstanceId a, ECClassId b, SourceECInstanceId c, SourceECClassId d, TargetECInstanceid e, TargetECClassId f FROM Bis.ElementRefersToElements) LIMIT 1", expected: {
          a: "0x1",
          b: "0xa8",
          c: "0x1c",
          d: "0xb4",
          e: "0x12",
          f: "0xa9",
        },
      },
      {
        query: "SELECT Model, Model.Id, Model.RelECClassId from Bis.Element limit 1", expected: {
          "model": {
            id: "0x1",
            relClassName: "BisCore.ModelContainsElements",
          },
          "model.id": "0x1",
          "model.relClassName": "BisCore.ModelContainsElements",
        },
      },
      {
        query: "SELECT * FROM (SELECT Model, Model.Id, Model.RelECClassId from Bis.Element) LIMIT 1", expected: {
          "model": {
            id: "0x1",
            relClassName: "BisCore.ModelContainsElements",
          },
          "model.id": "0x1",
          "model.relClassName": "BisCore.ModelContainsElements",
        },
      },
    ];
    const builder = new QueryOptionsBuilder();
    builder.setRowFormat(QueryRowFormat.UseJsPropertyNames);
    builder.setConvertClassIdsToNames(true);
    // With ECDb Profile 4002
    for (const testQuery of testQueries) {
      imodel1.withPreparedStatement(testQuery.query, (stmt: ECSqlStatement) => {
        assert.equal(DbResult.BE_SQLITE_ROW, stmt.step(), "expected DbResult.BE_SQLITE_ROW");
        assert.deepEqual(stmt.getRow(), testQuery.expected, `${testQuery.query} does not match expected result`);
      });

      let hasRow = false;
      for await (const row of imodel1.createQueryReader(testQuery.query, undefined, builder.getOptions())) {
        assert.deepEqual(row.toRow(), testQuery.expected, `${testQuery.query} does not match expected result`);
        hasRow = true;
      }
      assert.isTrue(hasRow, "imodel1.query() must return latest one row");
    }
    // With ECDb Profile 4003
    for (const testQuery of testQueries) {
      imodel6.withPreparedStatement(testQuery.query, (stmt: ECSqlStatement) => {
        assert.equal(DbResult.BE_SQLITE_ROW, stmt.step(), "expected DbResult.BE_SQLITE_ROW");
        assert.deepEqual(stmt.getRow(), testQuery.expected, `${testQuery.query} does not match expected result`);
      });
      let hasRow = false;
      for await (const row of imodel6.createQueryReader(testQuery.query, undefined, builder.getOptions())) {
        assert.deepEqual(row.toRow(), testQuery.expected, `${testQuery.query} does not match expected result`);
        hasRow = true;
      }
      assert.isTrue(hasRow, "imodel1.query() must return latest one row");
    }
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
    try {
      ConcurrentQuery.shutdown(imodel1.nativeDb);
      ConcurrentQuery.resetConfig(imodel1.nativeDb, { globalQuota: { time: 1 }, ignoreDelay: false });

      const scheduleQuery = async (delay: number) => {
        return new Promise<void>(async (resolve, reject) => {
          try {
            const options = new QueryOptionsBuilder();
            options.setDelay(delay);
            options.setRestartToken("tag");
            const reader = imodel1.createQueryReader("SELECT ECInstanceId as Id, Parent.Id as ParentId FROM BisCore.element", undefined, options.getOptions());
            while (await reader.step()) {
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
      assert.isAtLeast(cancelled, 1, "cancelled should be at least 1");
      assert.isAtLeast(successful, 1, "successful should be at least 1");
      assert.isAtLeast(rowCount, 1, "rowCount should be at least 1");
    } finally {
      ConcurrentQuery.shutdown(imodel1.nativeDb);
      ConcurrentQuery.resetConfig(imodel1.nativeDb);
    }
  });
  it("concurrent query should retry on timeout", async () => {
    class MockECSqlReader extends ECSqlReader {
      public constructor(_executor: DbRequestExecutor<DbQueryRequest, DbQueryResponse>, query: string) {
        super(_executor, query);
      }
      public async mockReadRows(queryRequest: DbQueryRequest): Promise<DbQueryResponse> {
        return super.runWithRetry(queryRequest);
      }
    }

    // Set time to 1 sec to simulate a timeout scenario
    ConcurrentQuery.resetConfig(imodel1.nativeDb, { globalQuota: { time: 1 }, ignoreDelay: false });
    const executor = {
      execute: async (req: DbQueryRequest) => {
        return ConcurrentQuery.executeQueryRequest(imodel1.nativeDb, req);
      },
    };
    const request: DbQueryRequest = {
      kind: DbRequestKind.ECSql,
      query: "SELECT * FROM BisCore.element",
      delay: 5000,  // Set delay to a value > timeout
    };
    try {
      await new MockECSqlReader(executor, request.query).mockReadRows(request);
      assert(false);  // We expect this scenario to always throw
    } catch (error: any) {
      // Query should give up after max retry count has been reached
      assert(error.message === "query too long to execute or server is too busy");
    }
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
    for await (const row of imodel1.createQueryReader("SELECT ECInstanceId FROM BisCore.Element LIMIT 23")) {
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
      for await (const row of db.createQueryReader(`SELECT count(*) FROM (${query})`)) {
        pendingRowCount.push(row[0] as number);
      }
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
      for await (const queryRow of db.createQueryReader(query, undefined, { rowFormat: QueryRowFormat.UseJsPropertyNames })) {
        const row = queryRow.toRow();
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
