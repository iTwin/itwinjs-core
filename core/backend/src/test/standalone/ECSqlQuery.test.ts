/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { DbResult, Id64 } from "@bentley/bentleyjs-core";
import { ECSqlStatement, IModelDb, SnapshotDb } from "../../imodeljs-backend";
import { IModelTestUtils } from "../IModelTestUtils";

// cspell:ignore mirukuru ibim

async function executeQuery(iModel: IModelDb, ecsql: string, bindings?: any[] | object, abbreviateBlobs?: boolean): Promise<any[]> {
  const rows: any[] = [];
  for await (const row of iModel.query(ecsql, bindings, undefined, undefined, undefined, abbreviateBlobs)) {
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
  it("verify return values for system properties with ecdb", async () => {
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

    // Test with ECDb Profile 4002
    for (const testQuery of testQueries) {
      imodel1.withPreparedStatement(testQuery.query, (stmt: ECSqlStatement) => {
        assert.equal(DbResult.BE_SQLITE_ROW, stmt.step(), "expected DbResult.BE_SQLITE_ROW");
        assert.deepEqual(stmt.getRow(), testQuery.expected, `${testQuery.query} does not match expected result`);
      });
      let hasRow = false;
      for await (const row of imodel1.query(testQuery.query)) {
        assert.deepEqual(row, testQuery.expected, `${testQuery.query} does not match expected result`);
        hasRow = true;
      }
      assert.isTrue(hasRow, "imodel1.query() must return latest one row");
    }

    // Test with ECDb Profile 4003
    for (const testQuery of testQueries) {
      imodel6.withPreparedStatement(testQuery.query, (stmt: ECSqlStatement) => {
        assert.equal(DbResult.BE_SQLITE_ROW, stmt.step(), "expected DbResult.BE_SQLITE_ROW");
        assert.deepEqual(stmt.getRow(), testQuery.expected, `${testQuery.query} does not match expected result`);
      });
      let hasRow = false;
      for await (const row of imodel6.query(testQuery.query)) {
        assert.deepEqual(row, testQuery.expected, `${testQuery.query} does not match expected result`);
        hasRow = true;
      }
      assert.isTrue(hasRow, "imodel1.query() must return latest one row");
    }
  });

  // new new addon build
  it("ECSQL with BLOB", async () => {
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

  it("Restart query", async () => {
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
        } catch (err) {
          // we expect query to be cancelled
          if (err.errorNumber === DbResult.BE_SQLITE_INTERRUPT) {
            cancelled++;
            resolve();
          } else {
            reject();
          }
        }
      });
    };

    const queries = [];
    for (let i = 0; i < 20; i++) {
      queries.push(cb());
    }
    await Promise.all(queries);
    // We expect at least one query to be cancelled
    assert.isAtLeast(cancelled, 1);
    assert.isAtLeast(successful, 1);
    assert.isAtLeast(rowCount, 1);
  });

  it("Paging Results", async () => {
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
        const rs = await db.queryRows(query, undefined, { maxRowAllowed: pageSize, startRowOffset: k * pageSize });
        assert.equal(rs.rows.length, rowPerPage[k]);
      }
    }

    // verify async iterator
    for (const db of dbs) {
      const resultSet = [];
      for await (const row of db.query(query)) {
        resultSet.push(row);
        assert.isTrue(Reflect.has(row, "id"));
        if (Reflect.ownKeys(row).length > 1) {
          assert.isTrue(Reflect.has(row, "parentId"));
          const parentId: string = row.parentId;
          assert.isTrue(Id64.isValidId64(parentId));
        }
        const id: string = row.id;
        assert.isTrue(Id64.isValidId64(id));
      }
      const entry = dbs.indexOf(db);
      assert.equal(rowCounts[entry], resultSet.length);
    }
  });
});
