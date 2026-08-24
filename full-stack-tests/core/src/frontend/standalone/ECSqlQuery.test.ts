/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "vitest";
import { DbResult, ProcessDetector } from "@itwin/core-bentley";
import { QueryRowFormat } from "@itwin/core-common";
import { IModelConnection } from "@itwin/core-frontend";
import { TestUtility } from "../TestUtility";
import { TestSnapshotConnection } from "../TestSnapshotConnection";

function skipIf(cond: () => boolean, skipMsg: string, title: string, callback: () => unknown) {
  if (cond()) {
    return it.skip(`${title} [${skipMsg}]`, callback);
  }
  return it(title, callback);
}
function skipIfWeb(title: string, callback: () => unknown) {
  return skipIf(() => ProcessDetector.isBrowserProcess, "skipping for browser", title, callback);
}

describe("ECSql Query", () => {
  let imodel1: IModelConnection;
  let imodel2: IModelConnection;
  let imodel3: IModelConnection;
  let imodel4: IModelConnection;
  let imodel5: IModelConnection;

  beforeAll(async () => {
    await TestUtility.startFrontend();
    imodel1 = await TestSnapshotConnection.openFile("test.bim"); // relative path resolved by BackendTestAssetResolver
    imodel2 = await TestSnapshotConnection.openFile("CompatibilityTestSeed.bim"); // relative path resolved by BackendTestAssetResolver
    imodel3 = await TestSnapshotConnection.openFile("GetSetAutoHandledStructProperties.bim"); // relative path resolved by BackendTestAssetResolver
    imodel4 = await TestSnapshotConnection.openFile("GetSetAutoHandledArrayProperties.bim"); // relative path resolved by BackendTestAssetResolver
    imodel5 = await TestSnapshotConnection.openFile("mirukuru.ibim"); // relative path resolved by BackendTestAssetResolver
  });

  afterAll(async () => {
    await imodel1?.close();
    await imodel2?.close();
    await imodel3?.close();
    await imodel4?.close();
    await imodel5?.close();
    await TestUtility.shutdownFrontend();
  });

  skipIfWeb("Restart query frontend", async () => {
    let cancelled = 0;
    let successful = 0;
    let rowCount = 0;
    const cb = async () => {
      return new Promise<void>(async (resolve, reject) => {
        try {
          for await (const _row of imodel1.createQueryReader("SELECT * FROM BisCore.element", undefined, { restartToken: "tag" })) {
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
            reject(err); // eslint-disable-line @typescript-eslint/prefer-promise-reject-errors
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
    expect(cancelled).toBeGreaterThanOrEqual(1);
    expect(successful).toBeGreaterThanOrEqual(1);
    expect(rowCount).toBeGreaterThanOrEqual(1);
  });

  it("concurrent query use primary connection", async () => {
    const reader = imodel1.createQueryReader("SELECT * FROM BisCore.element", undefined, { usePrimaryConn: true });
    let props = await reader.getMetaData();
    expect(props.length).toBe(11);
    let rows = 0;
    while (await reader.step()) {
      rows++;
    }
    expect(rows).toBe(46);
    props = await reader.getMetaData();
    expect(props.length).toBe(11);
  });
  it("concurrent query get meta data", async () => {
    const reader = imodel1.createQueryReader("SELECT * FROM BisCore.element");
    let props = await reader.getMetaData();
    expect(props.length).toBe(11);
    let rows = 0;
    while (await reader.step()) {
      rows++;
    }
    expect(rows).toBe(46);
    props = await reader.getMetaData();
    expect(props.length).toBe(11);
  });
  it("concurrent query quota", async () => {
    let reader = imodel1.createQueryReader("SELECT * FROM BisCore.element", undefined, { limit: { count: 4 } });
    let rows = 0;
    while (await reader.step()) {
      rows++;
    }
    expect(rows).toBe(4);
    reader = imodel1.createQueryReader("SELECT * FROM BisCore.element", undefined, { limit: { offset: 4, count: 4 } });
    rows = 0;
    while (await reader.step()) {
      rows++;
    }
    expect(rows).toBe(4);
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
      const reader = db.createQueryReader(`SELECT COUNT(*) FROM (${query})`);
      if (await reader.step())
        pendingRowCount.push(reader.current[0] as number);
    }

    const rowCounts = pendingRowCount;
    const expected = [46, 62, 7, 7, 28];
    expect(rowCounts.length).toBe(expected.length);
    for (let i = 0; i < expected.length; i++) {
      expect(rowCounts[i]).toBe(expected[i]);
    }
    // verify row per page
    for (const db of dbs) {
      const i = dbs.indexOf(db);
      const rowPerPage = getRowPerPage(pageSize, expected[i]);
      for (let k = 0; k < rowPerPage.length; k++) {
        const result = await db.createQueryReader(query, undefined, { limit: { count: pageSize, offset: k * pageSize } }).toArray();
        expect(result.length).toBe(rowPerPage[k]);
      }
    }

    // verify async iterator
    for (const db of dbs) {
      const resultSet = [];
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      for await (const queryRow of db.createQueryReader(query, undefined, { rowFormat: QueryRowFormat.UseJsPropertyNames })) {
        const row = queryRow.toRow();
        resultSet.push(row);
        expect(Reflect.has(row, "id")).toBe(true);
        if (Reflect.ownKeys(row).length > 1) {
          expect(Reflect.has(row, "parentId")).toBe(true);
          const parentId: string = row.parentId;
          expect(parentId.startsWith("0x")).toBe(true);
        }
        const id: string = row.id;
        expect(id.startsWith("0x")).toBe(true);
      }
      const entry = dbs.indexOf(db);
      expect(rowCounts[entry]).toBe(resultSet.length);
    }
  });
});
