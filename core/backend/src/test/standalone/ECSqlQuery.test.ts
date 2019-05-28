/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { IModelTestUtils } from "../IModelTestUtils";
import { IModelDb } from "../../IModelDb";

describe("ECSql Query", () => {
  let imodel1: IModelDb;
  let imodel2: IModelDb;
  let imodel3: IModelDb;
  let imodel4: IModelDb;
  let imodel5: IModelDb;

  before(async () => {
    imodel1 = IModelDb.openSnapshot(IModelTestUtils.resolveAssetFile("test.bim"));
    imodel2 = IModelDb.openSnapshot(IModelTestUtils.resolveAssetFile("CompatibilityTestSeed.bim"));
    imodel3 = IModelDb.openSnapshot(IModelTestUtils.resolveAssetFile("GetSetAutoHandledStructProperties.bim"));
    imodel4 = IModelDb.openSnapshot(IModelTestUtils.resolveAssetFile("GetSetAutoHandledArrayProperties.bim"));
    imodel5 = IModelDb.openSnapshot(IModelTestUtils.resolveAssetFile("mirukuru.ibim"));
  });

  after(async () => {
    imodel1.closeSnapshot();
    imodel2.closeSnapshot();
    imodel3.closeSnapshot();
    imodel4.closeSnapshot();
    imodel5.closeSnapshot();
  });

  it.only("Paging Results", async () => {
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
      for await (const row of db.query("SELECT ECInstanceId as Id, Parent.Id as ParentId FROM BisCore.element")) {
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
});
