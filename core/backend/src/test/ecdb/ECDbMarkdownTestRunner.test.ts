/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { DbResult } from "@itwin/core-bentley";
import { ECSqlStatement, IModelDb, SnapshotDb } from "../../core-backend";
import { KnownTestLocations } from "../KnownTestLocations";
import { QueryRowFormat } from "@itwin/core-common";
import { ECDbMarkdownTestParser, ECDbTestProps } from "./ECDbMarkdownTestParser";
import * as path from "path";
import * as fs from "fs";
import { ECDbMarkdownTestGenerator } from "./ECDbMarkdownTestGenerator";

function replacePropsInString(input: string, props: { [key: string]: any }): string {
  const regex = /\$\(([^)]+)\)/g;
  return input.replace(regex, (match, propName) => {
    return props[propName] !== undefined ? props[propName] : match;
  });
}

describe.only("Markdown based ECDb test runner", async () => {
  before(async () => {
    await ECDbMarkdownTestGenerator.generateFiles();
  });

  const tests: ECDbTestProps[] = ECDbMarkdownTestParser.parse();
  for (const test of tests) {
    if(!test.dataset)
      continue; // TODO logging

    const datasetFilePath = path.join(KnownTestLocations.outputDir, "ECDbTests" ,test.dataset);
    const propsFilePath = `${datasetFilePath}.props`;
    let props: { [key: string]: any } = {};
    if (fs.existsSync(propsFilePath)) {
      props = JSON.parse(fs.readFileSync(propsFilePath, "utf-8"));
    }

    it(`ECSqlStatement: ${test.title}`, () => {
      let imodel: IModelDb | undefined;
      try {
        imodel = SnapshotDb.openFile(datasetFilePath);
        if (test.sql === undefined) {
          assert.fail("Test does not have an ECSql statement");
        }

        const compiledSql = replacePropsInString(test.sql, props);
        let stmt: ECSqlStatement;
        try {
          stmt = imodel.prepareStatement(compiledSql); // TODO: Wire up logic for tests we expect to fail during prepare
        } catch (error: any) {
          assert.fail(`Error during prepare: ${error.name}`);
        }
        if(test.binders !== undefined) {
          for (const binder of test.binders) {
            // eslint-disable-next-line radix
            let id: number | string = Number.parseInt(binder.indexOrName);
            if (isNaN(id))
              id = binder.indexOrName;

            const compiledValue = replacePropsInString(binder.value, props);
            switch(binder.type.toLowerCase()) { // TODO: replace props variables in binder.value
              case "string":
                stmt.bindString(id, binder.value);
                break;
              case "integer":
                // eslint-disable-next-line radix
                stmt.bindInteger(id, Number.parseInt(compiledValue));
                break;
              case "double":
                stmt.bindDouble(id, Number.parseFloat(compiledValue));
                break;
              case "id":
                stmt.bindId(id, compiledValue);
                break;
              default:
                assert.fail(`Unsupported binder type ${binder.type}`);
            } // switch binder.type
          } // for binder
        } // if test.binders

        let resultCount = 0;
        let stepResult: DbResult;
        while ((stepResult = stmt.step()) === DbResult.BE_SQLITE_ROW) {
          if(test.expectedResults !== undefined && test.expectedResults.length > resultCount) {
            const expectedResult = test.expectedResults[resultCount];
            const actualResult = stmt.getRow({ rowFormat: QueryRowFormat.UseECSqlPropertyNames});
            assert.deepEqual(actualResult, expectedResult, `Expected ${JSON.stringify(expectedResult)} but got ${JSON.stringify(actualResult)}`);
          }
          resultCount++;

        }

        if (resultCount === 0 && test.stepStatus) {
          const stepResultString = DbResult[stepResult];
          assert.strictEqual(stepResultString, test.stepStatus, `Expected step status ${test.stepStatus} but got ${stepResultString}`);
        }

        if (test.expectedResults && test.expectedResults.length !== resultCount) {
          assert.fail(`Expected ${test.expectedResults.length} rows but got ${resultCount}`);
        }


      } finally {
        if(imodel !== undefined)
          imodel.close();
      }

    });
    it(`ConcurrentQuery: ${test.title}`, async () => {
    });
  }

});
