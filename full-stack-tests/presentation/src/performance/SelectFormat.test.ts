/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { join } from "path";
import { IModelHost, SnapshotDb } from "@itwin/core-backend";
import { QueryRowFormat } from "@itwin/core-common";


describe("Normal vs Instance Query (#performance)", () => {
  let imodel: SnapshotDb;
  let testIModelName: string;

  before(async () => {
    await IModelHost.startup({ cacheDir: join(__dirname, ".cache") });

    testIModelName = "assets/datasets/your_imodel_file.bim";
    console.log("Using iModel: ", testIModelName);
  });

  after(async () => {
    await IModelHost.shutdown();
  });

  beforeEach(() => {
    imodel = SnapshotDb.openFile(testIModelName);
    expect(imodel).is.not.null;
  });

  describe("Compare Select Statements", () => {

    function createSimpleSelectTest(selectType: string, numResults: number | undefined, rowFormat: QueryRowFormat) {
      it(`Select ${numResults} Rows Using ${selectType} and ${QueryRowFormat[rowFormat]}`, async function () {
        let count = 0;
        const query = `
          SELECT ${selectType} FROM bis.Element
        `;
        const startTime = new Date().getTime();

        const queryStream = imodel.query(query, undefined, { limit: { count: numResults }, rowFormat: rowFormat });
        for await (const row of queryStream)
          count++;

        const totalTime = (new Date()).getTime() - startTime;

        console.log({
          timeInMilliseconds: totalTime,
          symbolUsed: selectType,
          rowFormat: QueryRowFormat[rowFormat],
          numResults: count,
        });
      });
    }

    for (const rowFormat of [QueryRowFormat.UseECSqlPropertyIndexes, QueryRowFormat.UseECSqlPropertyNames, QueryRowFormat.UseJsPropertyNames]) {
      for (const numResults of [1, 100, 1000, 10000, 100000, 1000000/*, undefined*/]) {
        createSimpleSelectTest("*", numResults, rowFormat);
        createSimpleSelectTest("$", numResults, rowFormat);
      }
    }
  });

});
