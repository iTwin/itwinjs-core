/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { DbResult } from "@itwin/core-bentley";
import { QueryBinder, QueryRowFormat } from "@itwin/core-common";
import { IModelConnection, SnapshotConnection } from "@itwin/core-frontend";
import { TestUtility } from "../TestUtility";

describe("ECSql Query", () => {
  let imodel1: IModelConnection;
  let imodel2: IModelConnection;
  let imodel3: IModelConnection;
  let imodel4: IModelConnection;
  let imodel5: IModelConnection;

  before(async () => {
    await TestUtility.startFrontend();
    imodel1 = await SnapshotConnection.openFile("test.bim"); // relative path resolved by BackendTestAssetResolver
    imodel2 = await SnapshotConnection.openFile("CompatibilityTestSeed.bim"); // relative path resolved by BackendTestAssetResolver
    imodel3 = await SnapshotConnection.openFile("GetSetAutoHandledStructProperties.bim"); // relative path resolved by BackendTestAssetResolver
    imodel4 = await SnapshotConnection.openFile("GetSetAutoHandledArrayProperties.bim"); // relative path resolved by BackendTestAssetResolver
    imodel5 = await SnapshotConnection.openFile("mirukuru.ibim"); // relative path resolved by BackendTestAssetResolver
  });

  after(async () => {
    if (imodel1) await imodel1.close();
    if (imodel2) await imodel2.close();
    if (imodel3) await imodel3.close();
    if (imodel4) await imodel4.close();
    if (imodel5) await imodel5.close();
    await TestUtility.shutdownFrontend();
  });

  // ###TODO @khanaffan fails more often than succeeds on macOS.
  it.skip("Restart query", async () => {
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
            reject(err);
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
        const result = await db.createQueryReader(query, undefined, { limit: { count: pageSize, offset: k * pageSize } }).toArray();
        assert.equal(result.length, rowPerPage[k]);
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
          const parentId: string = row.parentId;
          assert.isTrue(parentId.startsWith("0x"));
        }
        const id: string = row.id;
        assert.isTrue(id.startsWith("0x"));
      }
      const entry = dbs.indexOf(db);
      assert.equal(rowCounts[entry], resultSet.length);
    }
  });

  it("Query with Abbreviated Blobs", async function () {
    const query1 = "SELECT ECInstanceId, GeometryStream FROM BisCore.GeometryPart LIMIT 1";
    const query2 = "SELECT ECInstanceId, GeometryStream FROM BisCore.GeometryPart WHERE ECInstanceId=?";
    let row1: any;
    let row2: any;
    let row3: any;
    for await (const row of imodel2.query(query1, undefined, { rowFormat: QueryRowFormat.UseJsPropertyNames }))
      row1 = row;
    assert.isNotEmpty(row1.geometryStream);
    for await (const row of imodel2.query(query2, QueryBinder.from([row1.id]), { rowFormat: QueryRowFormat.UseJsPropertyNames, abbreviateBlobs: false }))
      row2 = row;
    assert.isNotEmpty(row2.geometryStream);
    assert.deepEqual(row2.geometryStream, row1.geometryStream);
    for await (const row of imodel2.query(query2, QueryBinder.from([row1.id]), { rowFormat: QueryRowFormat.UseJsPropertyNames, abbreviateBlobs: true }))
      row3 = row;
    assert.equal(row3.id, row1.id);
    assert.include(row1.geometryStream, row3.geometryStream);
  });
});
