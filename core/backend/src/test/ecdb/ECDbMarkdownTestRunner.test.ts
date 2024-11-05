/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { DbResult } from "@itwin/core-bentley";
import { ECSqlStatement, IModelDb, SnapshotDb } from "../../core-backend";
import { KnownTestLocations } from "../KnownTestLocations";
import { ECSqlValueType, QueryRowFormat } from "@itwin/core-common";
import { ECDbMarkdownTestParser, ECDbTestProps } from "./ECDbMarkdownTestParser";
import * as path from "path";
import * as fs from "fs";
import { ECDbMarkdownTestGenerator } from "./ECDbMarkdownTestGenerator";

function replacePropsInString(input: string, props: { [key: string]: any }): string {
  const regex = /\$\(([^)]+)\)/g;
  return input.replace(regex, (match, propName) => {
    return props[propName] !== undefined ? props[propName] : `***NOTFOUND:${match}***`;
  });
}

function readPropsFromFile(datasetFilePath: string): { [key: string]: any } {
  const propsFilePath = `${datasetFilePath}.props`;
  if (fs.existsSync(propsFilePath)) {
    return JSON.parse(fs.readFileSync(propsFilePath, "utf-8"));
  }

  return {};
}

function logWarning(message: string) {
  // eslint-disable-next-line no-console
  console.log(message);
}

describe.only("Markdown based ECDb test runner", async () => {
  before(async () => {
    await ECDbMarkdownTestGenerator.generateFiles();
  });

  const tests: ECDbTestProps[] = ECDbMarkdownTestParser.parse();
  //TODO: Mechanism to run a single test, put something like it.only into the test md which causes this loop to only run those tests
  for (const test of tests) {
    if(!test.dataset) {
      logWarning(`Skipping test ${test.title} because it does not have a dataset`);
      continue;
    }

    const datasetFilePath = path.join(KnownTestLocations.outputDir, "ECDbTests" ,test.dataset);


    it(`ECSqlStatement: ${test.title}`, () => {
      let imodel: IModelDb | undefined;
      let stmt: ECSqlStatement | undefined;
      try {
        imodel = SnapshotDb.openFile(datasetFilePath);
        if (test.sql === undefined) {
          assert.fail("Test does not have an ECSql statement");
        }
        const props = readPropsFromFile(datasetFilePath);

        const compiledSql = replacePropsInString(test.sql, props);

        try {
          // TODO: statement options should be exposed through the markdown
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
          if (resultCount === 0 && test.columns) {
            // Verify the columns on the first result row (TODO: for dynamic columns we have to do this every item)
            const colCount = stmt.getColumnCount();
            assert.strictEqual(colCount, test.columns.length, `Expected ${test.columns.length} columns but got ${colCount}`);
            for (let i = 0; i < colCount; i++) {
              const colInfo = stmt.getValue(i).columnInfo;
              const expectedColInfo = test.columns[i];
              // cannot directly compare against colInfo because it has methods instead of getters
              assert.strictEqual(colInfo.getAccessString(), expectedColInfo.accessString, `Expected access string ${expectedColInfo.accessString} but got ${colInfo.getAccessString()} for column index ${i}`);
              //if (expectedColInfo.isDynamicProp !== undefined) TODO: Is this not exposed?
              //  assert.strictEqual(colInfo..isDynamicProperty, expectedColInfo.isDynamicProp, `Expected dynamic property ${expectedColInfo.isDynamicProp} but got ${colInfo.isDynamicProperty} for column index ${i}`);
              // TODO: Extended type name not exposed??
              if (expectedColInfo.isEnum !== undefined)
                assert.strictEqual(colInfo.isEnum(), expectedColInfo.isEnum, `Expected enum property ${expectedColInfo.isEnum} but got ${colInfo.isEnum()} for column index ${i}`);
              if (expectedColInfo.isGeneratedProperty !== undefined)
                assert.strictEqual(colInfo.isGeneratedProperty(), expectedColInfo.isGeneratedProperty, `Expected generated property ${expectedColInfo.isGeneratedProperty} but got ${colInfo.isGeneratedProperty()} for column index ${i}`);
              if (expectedColInfo.isSystemProperty !== undefined)
                assert.strictEqual(colInfo.isSystemProperty(), expectedColInfo.isSystemProperty, `Expected system property ${expectedColInfo.isSystemProperty} but got ${colInfo.isSystemProperty()} for column index ${i}`);
              if (expectedColInfo.originPropertyName !== undefined)
                assert.strictEqual(colInfo.getOriginPropertyName(), expectedColInfo.originPropertyName, `Expected origin property name ${expectedColInfo.originPropertyName} but got ${colInfo.getOriginPropertyName()} for column index ${i}`);
              if (expectedColInfo.propertyName !== undefined)
                assert.strictEqual(colInfo.getPropertyName(), expectedColInfo.propertyName, `Expected property name ${expectedColInfo.propertyName} but got ${colInfo.getPropertyName()} for column index ${i}`);
              if (expectedColInfo.rootClassAlias !== undefined)
                assert.strictEqual(colInfo.getRootClassAlias(), expectedColInfo.rootClassAlias, `Expected root class alias ${expectedColInfo.rootClassAlias} but got ${colInfo.getRootClassAlias()} for column index ${i}`);
              if (expectedColInfo.rootClassName !== undefined)
                assert.strictEqual(colInfo.getRootClassName(), expectedColInfo.rootClassName, `Expected root class name ${expectedColInfo.rootClassName} but got ${colInfo.getRootClassName()} for column index ${i}`);
              if (expectedColInfo.rootClassTableSpace !== undefined)
                assert.strictEqual(colInfo.getRootClassTableSpace(), expectedColInfo.rootClassTableSpace, `Expected root class table space ${expectedColInfo.rootClassTableSpace} but got ${colInfo.getRootClassTableSpace()} for column index ${i}`);
              if (expectedColInfo.type !== undefined)
                assert.strictEqual(ECSqlValueType[colInfo.getType()], expectedColInfo.type, `Expected type ${expectedColInfo.type} but got ${ECSqlValueType[colInfo.getType()]} for column index ${i}`);

            }
          }

          if (test.expectedResults !== undefined && test.expectedResults.length > resultCount) {
            let expectedResult = test.expectedResults[resultCount];
            // replace props in expected result, TODO: optimize this
            const expectedJson = JSON.stringify(expectedResult);
            const compiledExpectedJson = replacePropsInString(expectedJson, props);
            expectedResult = JSON.parse(compiledExpectedJson);

            const actualResult = stmt.getRow({ rowFormat: QueryRowFormat.UseECSqlPropertyNames}); // TODO: should we test getValue() as well?
            assert.deepEqual(actualResult, expectedResult, `Expected ${JSON.stringify(expectedResult)} but got ${JSON.stringify(actualResult)}`);
          }
          resultCount++;
        }
        stmt.dispose();
        stmt = undefined;

        if (resultCount === 0 && test.stepStatus) {
          const stepResultString = DbResult[stepResult];
          assert.strictEqual(stepResultString, test.stepStatus, `Expected step status ${test.stepStatus} but got ${stepResultString}`);
        }

        if (test.expectedResults && test.expectedResults.length !== resultCount) {
          assert.fail(`Expected ${test.expectedResults.length} rows but got ${resultCount}`);
        }


      } finally {
        if(stmt !== undefined)
          stmt.dispose();
        if(imodel !== undefined)
          imodel.close();
      }

    });
    it(`ConcurrentQuery: ${test.title}`, async () => {
    });
  }

});
