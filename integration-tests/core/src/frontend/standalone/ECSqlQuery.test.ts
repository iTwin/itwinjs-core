/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import * as path from "path";
import { IModelConnection } from "@bentley/imodeljs-frontend";

const iModelLocation = path.join(process.env.IMODELJS_CORE_DIRNAME!, "core/backend/lib/test/assets/");

describe("ECSql Query", () => {
  let imodel1: IModelConnection;
  let imodel2: IModelConnection;
  let imodel3: IModelConnection;
  let imodel4: IModelConnection;
  let imodel5: IModelConnection;

  before(async () => {
    imodel1 = await IModelConnection.openStandalone(iModelLocation + "test.bim");
    imodel2 = await IModelConnection.openStandalone(iModelLocation + "CompatibilityTestSeed.bim");
    imodel3 = await IModelConnection.openStandalone(iModelLocation + "GetSetAutoHandledStructProperties.bim");
    imodel4 = await IModelConnection.openStandalone(iModelLocation + "GetSetAutoHandledArrayProperties.bim");
    imodel5 = await IModelConnection.openStandalone(iModelLocation + "mirukuru.ibim");
  });

  after(async () => {
    if (imodel1) await imodel1.closeStandalone();
    if (imodel2) await imodel2.closeStandalone();
    if (imodel3) await imodel3.closeStandalone();
    if (imodel4) await imodel4.closeStandalone();
    if (imodel5) await imodel5.closeStandalone();

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
        const row = await db.queryPage(query, undefined, { size: pageSize, start: k });
        assert.equal(row.length, rowPerPage[k]);
      }
    }

    // verify async iterator
    for (const db of dbs) {
      const resultSet = [];
      for await (const row of db.query(query, undefined, { size: pageSize })) {
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
