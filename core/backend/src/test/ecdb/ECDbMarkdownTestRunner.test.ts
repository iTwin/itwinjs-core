/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { DbResult } from "@itwin/core-bentley";
import { ECSqlRowArg, ECSqlStatement, IModelDb, SnapshotDb } from "../../core-backend";
import { KnownTestLocations } from "../KnownTestLocations";
import { ECSqlReader, ECSqlValueType, QueryBinder, QueryOptions, QueryRowFormat } from "@itwin/core-common";
import { buildBinaryData, ECDbMarkdownTestParser, ECDbTestMode, ECDbTestProps, ECDbTestRowFormat } from "./ECDbMarkdownTestParser";
import * as path from "path";
import * as fs from "fs";
import { ECDbMarkdownDatasets } from "./ECDbMarkdownDatasets";

describe.only("Markdown based ECDb test runner", async () => {
  before(async () => {
    await ECDbMarkdownDatasets.generateFiles();
  });

  const tests: ECDbTestProps[] = ECDbMarkdownTestParser.parse();
  //TODO: Mechanism to run a single test, put something like it.only into the test md which causes this loop to only run those tests
  for (const test of tests) {
    if(!test.dataset) {
      logWarning(`Skipping test ${test.title} because it does not have a dataset`);
      continue;
    }

    const datasetFilePath = path.join(KnownTestLocations.outputDir, "ECDbTests" ,test.dataset);

    if(test.mode === ECDbTestMode.Both || test.mode === ECDbTestMode.Statement)
    {
      if(test.only)
        it.only(`${test.fileName}: ${test.title} (Statement)`, () => {
          runECSqlStatementTest(test, datasetFilePath);
        });
      else
        it(`${test.fileName}: ${test.title} (Statement)`, () => {
          runECSqlStatementTest(test, datasetFilePath);
        });
    }

    if(test.mode === ECDbTestMode.Both || test.mode === ECDbTestMode.ConcurrentQuery)
    {
      if(test.only)
        it.only(`${test.fileName}: ${test.title} (ConcurrentQuery)`, async () => {
          await runConcurrentQueryTest(test, datasetFilePath);
        });
      else
        it(`${test.fileName}: ${test.title} (ConcurrentQuery)`, async () => {
          await runConcurrentQueryTest(test, datasetFilePath);
        });
    }
  }
});

function runECSqlStatementTest(test: ECDbTestProps, datasetFilePath: string) {
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
      if(test.errorDuringPrepare)
        return;
      else
        assert.fail(`Error during prepare of Statement: ${error.message}`);
    }

    if(test.errorDuringPrepare)
      assert.fail(`Statement is expected to fail during prepare`);

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
      if (resultCount === 0 && test.columnInfo) {
        // Verify the columns on the first result row (TODO: for dynamic columns we have to do this every item)
        const colCount = stmt.getColumnCount();
        assert.strictEqual(colCount, test.columnInfo.length, `Expected ${test.columnInfo.length} columns but got ${colCount}`);
        for (let i = 0; i < colCount; i++) {
          const colInfo = stmt.getValue(i).columnInfo;
          const expectedColInfo = test.columnInfo[i];
          // cannot directly compare against colInfo because it has methods instead of getters
          assert.strictEqual(colInfo.getPropertyName(), expectedColInfo.name, `Expected property name ${expectedColInfo.name} but got ${colInfo.getPropertyName()} for column index ${i}`);
          //if (expectedColInfo.isDynamicProp !== undefined) TODO: Is this not exposed?
          //  assert.strictEqual(colInfo..isDynamicProperty, expectedColInfo.isDynamicProp, `Expected dynamic property ${expectedColInfo.isDynamicProp} but got ${colInfo.isDynamicProperty} for column index ${i}`);
          // TODO: Extended type name not exposed??
          if (expectedColInfo.generated !== undefined)
            assert.strictEqual(colInfo.isGeneratedProperty(), expectedColInfo.generated, `Expected generated property ${expectedColInfo.generated} but got ${colInfo.isGeneratedProperty()} for column index ${i}`);
          if (expectedColInfo.accessString !== undefined)
            assert.strictEqual(colInfo.getAccessString(), expectedColInfo.accessString, `Expected access string ${expectedColInfo.accessString} but got ${colInfo.getAccessString()} for column index ${i}`);
          if (expectedColInfo.type !== undefined)
            assert.strictEqual(ECSqlValueType[colInfo.getType()], expectedColInfo.type, `Expected type ${expectedColInfo.type} but got ${ECSqlValueType[colInfo.getType()]} for column index ${i}`);
          if (expectedColInfo.originPropertyName !== undefined)
            assert.strictEqual(colInfo.getOriginPropertyName(), expectedColInfo.originPropertyName, `Expected extended type ${expectedColInfo.originPropertyName} but got ${colInfo.getOriginPropertyName()} for column index ${i}`);
        }
      }

      if (test.expectedResults !== undefined && test.expectedResults.length > resultCount) {
        let expectedResult = test.expectedResults[resultCount];
        // replace props in expected result, TODO: optimize this
        const expectedJson = JSON.stringify(expectedResult);
        const compiledExpectedJson = replacePropsInString(expectedJson, props);
        expectedResult = JSON.parse(compiledExpectedJson);
        expectedResult = buildBinaryData(expectedResult);
        const rowArgs: ECSqlRowArg = { rowFormat: getRowFormat(test.rowFormat), classIdsToClassNames: test.convertClassIdsToClassNames };
        // TODO: abbreviate blobs is not supported here?
        if(test.abbreviateBlobs)
          logWarning("Abbreviate blobs is not supported for statement tests");

        const actualResult = stmt.getRow(rowArgs);
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
}

function getRowFormat(rowFormat: ECDbTestRowFormat) : QueryRowFormat {
  switch(rowFormat) {
    case ECDbTestRowFormat.ECSqlNames:
      return QueryRowFormat.UseECSqlPropertyNames;
    case ECDbTestRowFormat.ECSqlIndexes:
      return QueryRowFormat.UseECSqlPropertyIndexes;
    case ECDbTestRowFormat.JsNames:
      return QueryRowFormat.UseJsPropertyNames;
    default:
      return QueryRowFormat.UseECSqlPropertyNames;
  }
}

async function runConcurrentQueryTest(test: ECDbTestProps, datasetFilePath: string): Promise<void> {
  let imodel: IModelDb | undefined;
  let reader: ECSqlReader;
  try {
    imodel = SnapshotDb.openFile(datasetFilePath);
    if (test.sql === undefined) {
      assert.fail("Test does not have an ECSql statement");
    }
    const props = readPropsFromFile(datasetFilePath);

    const compiledSql = replacePropsInString(test.sql, props);
    let params: QueryBinder | undefined;
    if(test.binders !== undefined) {
      params = new QueryBinder();
      for (const binder of test.binders) {
        // eslint-disable-next-line radix
        let id: number | string = Number.parseInt(binder.indexOrName);
        if (isNaN(id))
          id = binder.indexOrName;

        const compiledValue = replacePropsInString(binder.value, props);
        switch(binder.type.toLowerCase()) { // TODO: replace props variables in binder.value
          case "string":
            params.bindString(id, binder.value);
            break;
          case "integer":
            // eslint-disable-next-line radix
            params.bindInt(id, Number.parseInt(compiledValue));
            break;
          case "double":
            params.bindDouble(id, Number.parseFloat(compiledValue));
            break;
          case "id":
            params.bindId(id, compiledValue);
            break;
          default:
            assert.fail(`Unsupported binder type ${binder.type}`);
        } // switch binder.type
      } // for binder
    } // if test.binders

    const queryOptions: QueryOptions = {};
    queryOptions.rowFormat = getRowFormat(test.rowFormat);
    if (test.abbreviateBlobs)
      queryOptions.abbreviateBlobs = true;
    if (test.convertClassIdsToClassNames)
      queryOptions.convertClassIdsToClassNames = true;

    try {
      reader = imodel.createQueryReader(compiledSql, params, queryOptions); // TODO: Wire up logic for tests we expect to fail during prepare
    } catch (error: any) {
        assert.fail(`Error during creating QueryReader: ${error.message}`);
    }

    let resultCount = 0;
    let rows;
    try{
      rows = await reader.toArray();
    }
    catch (error: any) {
      if(test.errorDuringPrepare)
        return;
      else
        assert.fail(`Error during prepare of Concurrent Query: ${error.message}`);
    }

    if(test.errorDuringPrepare)
      assert.fail(`Statement is expected to fail during prepare`);

    const colMetaData = await reader.getMetaData();
    while (resultCount < rows.length) {
      if (resultCount === 0 && test.columnInfo) {
        // Verify the columns on the first result row (TODO: for dynamic columns we have to do this every item)
        assert.strictEqual(colMetaData.length, test.columnInfo.length, `Expected ${test.columnInfo.length} columns but got ${colMetaData.length}`);
        for (let i = 0; i < colMetaData.length; i++) {
          const colInfo = colMetaData[i];
          const expectedColInfo = test.columnInfo[i];
          // cannot directly compare against colInfo because it has methods instead of getters
          assert.strictEqual(colInfo.name, expectedColInfo.name, `Expected name ${expectedColInfo.name} but got ${colInfo.name} for column index ${i}`);
          if (expectedColInfo.generated !== undefined)
            assert.strictEqual(colInfo.generated, expectedColInfo.generated, `Expected generated property ${expectedColInfo.generated} but got ${colInfo.generated} for column index ${i}`);
          if (expectedColInfo.accessString !== undefined)
            assert.strictEqual(colInfo.accessString, expectedColInfo.accessString, `Expected access string ${expectedColInfo.accessString} but got ${colInfo.accessString} for column index ${i}`);
          if (expectedColInfo.typeName !== undefined)
            assert.strictEqual(colInfo.typeName, expectedColInfo.typeName, `Expected type name ${expectedColInfo.typeName} but got ${colInfo.typeName} for column index ${i}`);
          if(expectedColInfo.extendedType !== undefined) {
            assert.strictEqual((colInfo as any).extendedType, expectedColInfo.extendedType, `Expected extended type ${expectedColInfo.extendedType} but got ${(colInfo as any).extendedType} for column index ${i}`);
          }
        }
      }

      if (test.expectedResults !== undefined && test.expectedResults.length > resultCount) {
        let expectedResult = test.expectedResults[resultCount];
        // replace props in expected result, TODO: optimize this
        const expectedJson = JSON.stringify(expectedResult);
        const compiledExpectedJson = replacePropsInString(expectedJson, props);
        expectedResult = JSON.parse(compiledExpectedJson);
        expectedResult = buildBinaryData(expectedResult);

        const actualResult = rows[resultCount] // TODO: should we test getValue() as well?
        assert.deepEqual(actualResult, expectedResult, `Expected ${JSON.stringify(expectedResult)} but got ${JSON.stringify(actualResult)}`);
      }
      resultCount++;
    }

    // if (resultCount === 0 && test.stepStatus) {
    //   const stepResultString = DbResult[stepResult];
    //   assert.strictEqual(stepResultString, test.stepStatus, `Expected step status ${test.stepStatus} but got ${stepResultString}`);
    // }

    if (test.expectedResults && test.expectedResults.length !== resultCount) {
      assert.fail(`Expected ${test.expectedResults.length} rows but got ${resultCount}`);
    }


  } finally {
    if(imodel !== undefined)
      imodel.close();
  }
}

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
  console.log(`\x1b[33m${message}\x1b[0m`);
}