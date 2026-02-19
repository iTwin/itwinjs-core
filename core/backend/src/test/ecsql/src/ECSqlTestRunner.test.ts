/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { DbResult } from "@itwin/core-bentley";
import { ECSqlRowArg, ECSqlStatement, ECSqlSyncReader, SnapshotDb, SynchronousQueryOptions } from "../../../core-backend";
import { KnownTestLocations } from "../../KnownTestLocations";
import { ECSqlReader, ECSqlValueType, QueryBinder, QueryOptions, QueryPropertyMetaData, QueryRowFormat } from "@itwin/core-common";
import { buildBinaryData, ECDbMarkdownTestParser, ECDbTestMode, ECDbTestProps, ECDbTestRowFormat } from "./ECSqlTestParser";
import * as path from "path";
import * as fs from "fs";
import { ECSqlDatasets } from "../dataset/ECSqlDatasets";
import { Point2d, Point3d } from "@itwin/core-geometry";

enum TestDataset {
  AllProperties = "AllProperties.bim"
}

const snapshotDbs: { [key in TestDataset]?: SnapshotDb } = {};

describe("Markdown based ECDb test runner", async () => {
  before(async () => {
    await ECSqlDatasets.generateFiles();
    const datasetFilePath = path.join(KnownTestLocations.outputDir, "ECSqlTests", TestDataset.AllProperties);
    if (!fs.existsSync(datasetFilePath)) {
      throw new Error(`Dataset file ${datasetFilePath} does not exist`);
    }
    snapshotDbs[TestDataset.AllProperties] = SnapshotDb.openFile(datasetFilePath);
  });

  after(() => {
    for (const key in snapshotDbs) {
      if (snapshotDbs.hasOwnProperty(key)) {
        (snapshotDbs[key as keyof typeof snapshotDbs])?.close();
      }
    }
  });
  const tests: ECDbTestProps[] = ECDbMarkdownTestParser.parse();

  //TODO: Mechanism to run a single test, put something like it.only into the test md which causes this loop to only run those tests
  for (const test of tests) {
    if (!test.dataset) {
      logWarning(`Skipping test ${test.title} because it does not have a dataset`);
      continue;
    }

    if (test.dataset.toLowerCase() !== TestDataset.AllProperties.toLowerCase()) {
      logWarning(`Skipping test ${test.title} because dataset ${test.dataset} is not recognized`);
      continue;
    }
    const dataset = TestDataset.AllProperties;

    if (test.mode === ECDbTestMode.Both || test.mode === ECDbTestMode.Statement) {
      if (test.skip)
        it(`${test.fileName}: ${test.title} (Statement) skipped. Reason: ${test.skip}`);
      else if (test.only)
        it.only(`${test.fileName}: ${test.title} (Statement)`, () => {
          runECSqlStatementTest(test, dataset);
        });
      else
        it(`${test.fileName}: ${test.title} (Statement)`, () => {
          runECSqlStatementTest(test, dataset);
        });
    }

    if (test.mode === ECDbTestMode.Both || test.mode === ECDbTestMode.ECSqlReader) {
      if (test.skip) {
        it(`${test.fileName}: ${test.title} (ECSqlReader) skipped. Reason: ${test.skip}`);
        it(`${test.fileName}: ${test.title} (ECSqlSyncReader) skipped. Reason: ${test.skip}`);
      }
      else if (test.only) {
        it.only(`${test.fileName}: ${test.title} (ECSqlReader)`, async () => {
          await runECSqlReaderTest(test, dataset);
        });
        it.only(`${test.fileName}: ${test.title} (ECSqlSyncReader)`, async () => {
          await runECSqlSyncReaderTest(test, dataset);
        });
      }
      else {
        it(`${test.fileName}: ${test.title} (ECSqlReader)`, async () => {
          await runECSqlReaderTest(test, dataset);
        });
        it(`${test.fileName}: ${test.title} (ECSqlSyncReader)`, async () => {
          await runECSqlSyncReaderTest(test, dataset);
        });
      }
    }
  }
});

function runECSqlStatementTest(test: ECDbTestProps, dataset: TestDataset) {
  const imodel = snapshotDbs[dataset];
  if (!imodel) {
    assert.fail(`Dataset ${dataset} is not loaded`);
  }
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  let stmt: ECSqlStatement | undefined;
  if (test.sql === undefined) {
    assert.fail("Test does not have an ECSql statement");
  }

  try {
    // TODO: statement options should be exposed through the markdown
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    stmt = imodel.prepareStatement(test.sql); // TODO: Wire up logic for tests we expect to fail during prepare
  } catch (error: any) {
    if (test.errorDuringPrepare)
      return;
    else
      assert.fail(`Error during prepare of Statement: ${error.message}`);
  }

  if (test.errorDuringPrepare)
    assert.fail(`Statement is expected to fail during prepare`);

  try {
    if (test.binders !== undefined) {
      for (const binder of test.binders) {
        // eslint-disable-next-line radix
        let id: number | string = Number.parseInt(binder.indexOrName);
        if (isNaN(id))
          id = binder.indexOrName;

        switch (binder.type.toLowerCase()) { // TODO: replace props variables in binder.value
          case "null":
            stmt.bindNull(id);
            break;
          case "string":
            stmt.bindString(id, binder.value);
            break;
          case "int":
            // eslint-disable-next-line radix
            stmt.bindInteger(id, Number.parseInt(binder.value));
            break;
          case "double":
            stmt.bindDouble(id, Number.parseFloat(binder.value));
            break;
          case "id":
            stmt.bindId(id, binder.value);
            break;
          case "idset":
            const values: string[] = binder.value.slice(1, -1).split(",");
            const trimmedValues = values.map((value: string) =>
              value.trim()
            );
            stmt.bindIdSet(id, trimmedValues);
            break;
          case "datetime":
            stmt.bindDateTime(id, binder.value);
            break;
          case "point2d":
            const parsedVal2d = JSON.parse(binder.value);
            stmt.bindPoint2d(id, { x: parsedVal2d.X, y: parsedVal2d.Y });
            break;
          case "point3d":
            const parsedVal3d = JSON.parse(binder.value);
            stmt.bindPoint3d(id, { x: parsedVal3d.X, y: parsedVal3d.Y, z: parsedVal3d.Z });
            break;
          case "blob":
            const arrayValues: string[] = binder.value.slice(1, -1).split(",");
            const numbers = arrayValues.map((value: string) =>
              // eslint-disable-next-line radix
              parseInt(value.trim())
            );
            stmt.bindBlob(id, Uint8Array.of(...numbers));
            break;
          case "navigation":
            stmt.bindNavigation(id, JSON.parse(binder.value));
            break;
          case "array":
            stmt.bindArray(id, JSON.parse(binder.value));
            break;
          case "struct":
            stmt.bindStruct(id, JSON.parse(binder.value));
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
            assert.strictEqual(colInfo.getOriginPropertyName(), expectedColInfo.originPropertyName, `Expected Origin PropertyName ${expectedColInfo.originPropertyName} but got ${colInfo.getOriginPropertyName()} for column index ${i}`);
        }
      }

      if (test.expectedResults !== undefined && test.expectedResults.length > resultCount) {
        let expectedResult = test.expectedResults[resultCount];
        expectedResult = buildBinaryData(expectedResult);
        const rowArgs: ECSqlRowArg = { rowFormat: getRowFormat(test.rowFormat), classIdsToClassNames: test.convertClassIdsToClassNames };
        const actualResult = stmt.getRow(rowArgs);
        checkingExpectedResults(test.rowFormat, actualResult, expectedResult, test.indexesToIncludeInResults);
      }
      resultCount++;
    }
    stmt[Symbol.dispose]();
    stmt = undefined;

    if (resultCount === 0 && test.stepStatus) {
      const stepResultString = DbResult[stepResult];
      assert.strictEqual(stepResultString, test.stepStatus, `Expected step status ${test.stepStatus} but got ${stepResultString}`);
    }

    if (test.expectedResults && test.expectedResults.length !== resultCount) {
      assert.fail(`Expected ${test.expectedResults.length} rows but got ${resultCount}`);
    }
  } finally {
    if (stmt !== undefined)
      stmt[Symbol.dispose]();
  }
}

function getRowFormat(rowFormat: ECDbTestRowFormat): QueryRowFormat {
  switch (rowFormat) {
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

/** Builds a QueryBinder from the test's binder definitions. Returns undefined when the test has no binders. */
function buildQueryBinder(test: ECDbTestProps): QueryBinder | undefined {
  if (test.binders === undefined)
    return undefined;

  const params = new QueryBinder();
  for (const binder of test.binders) {
    // eslint-disable-next-line radix
    let id: number | string = Number.parseInt(binder.indexOrName);
    if (isNaN(id))
      id = binder.indexOrName;

    switch (binder.type.toLowerCase()) { // TODO: replace props variables in binder.value
      case "null":
        params.bindNull(id);
        break;
      case "string":
        params.bindString(id, binder.value);
        break;
      case "int":
        // eslint-disable-next-line radix
        params.bindInt(id, Number.parseInt(binder.value));
        break;
      case "long":
        // eslint-disable-next-line radix
        params.bindLong(id, Number.parseInt(binder.value));
        break;
      case "double":
        params.bindDouble(id, Number.parseFloat(binder.value));
        break;
      case "id":
        params.bindId(id, binder.value);
        break;
      case "idset":
        const values: string[] = binder.value.slice(1, -1).split(",");
        const trimmedValues = values.map((value: string) =>
          value.trim()
        );
        params.bindIdSet(id, trimmedValues);
        break;
      case "point2d":
        const parsedVal2d = JSON.parse(binder.value);
        params.bindPoint2d(id, new Point2d(parsedVal2d.X, parsedVal2d.Y));
        break;
      case "point3d":
        const parsedVal3d = JSON.parse(binder.value);
        params.bindPoint3d(id, new Point3d(parsedVal3d.X, parsedVal3d.Y, parsedVal3d.Z));
        break;
      case "blob":
        const arrayValues: string[] = binder.value.slice(1, -1).split(",");
        const numbers = arrayValues.map((value: string) =>
          // eslint-disable-next-line radix
          parseInt(value.trim())
        );
        params.bindBlob(id, Uint8Array.of(...numbers));
        break;
      case "struct":
        params.bindStruct(id, JSON.parse(binder.value));
        break;
      default:
        assert.fail(`Unsupported binder type ${binder.type}`);
    } // switch binder.type
  } // for binder
  return params;
}

/** Builds the common query options object from the test configuration. */
function buildReaderQueryOptions(test: ECDbTestProps): QueryOptions {
  const queryOptions: QueryOptions = {};
  queryOptions.rowFormat = getRowFormat(test.rowFormat);
  if (test.abbreviateBlobs)
    queryOptions.abbreviateBlobs = true;
  if (test.convertClassIdsToClassNames) {
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    queryOptions.convertClassIdsToClassNames = true;
  }
  return queryOptions;
}

/**
 * Shared assertion logic for QueryReader tests that operates on the result rows and column metadata.
 * Used by both ECSqlReader and ECSqlSyncReader test paths.
 */
function runResultAssertions(test: ECDbTestProps, rows: any, colMetaData: QueryPropertyMetaData[]) {
  let resultCount = 0;
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
        if (expectedColInfo.className !== undefined)
          assert.strictEqual(colInfo.className, expectedColInfo.className, `Expected class name ${expectedColInfo.className} but got ${colInfo.className} for column index ${i}`);
        assert.strictEqual(colInfo.extendedType, expectedColInfo.extendedType, `Expected extended type ${expectedColInfo.extendedType} but got ${colInfo.extendedType} for column index ${i}`);
        assert.strictEqual(colInfo.extendType, expectedColInfo.extendedType === undefined ? "" : expectedColInfo.extendedType, `Expected extend type ${expectedColInfo.extendedType === undefined ? "" : expectedColInfo.extendedType} but got ${colInfo.extendType} for column index ${i}`);  // eslint-disable-line @typescript-eslint/no-deprecated
      }
    }

    if (test.expectedResults !== undefined && test.expectedResults.length > resultCount) {
      let expectedResult = test.expectedResults[resultCount];
      // replace props in expected result, TODO: optimize this
      expectedResult = buildBinaryData(expectedResult);

      const actualResult = rows[resultCount]; // TODO: should we test getValue() as well?
      checkingExpectedResults(test.rowFormat, actualResult, expectedResult, test.indexesToIncludeInResults);
    }
    resultCount++;
  }

  if (test.expectedResults && test.expectedResults.length !== resultCount) {
    assert.fail(`Expected ${test.expectedResults.length} rows but got ${resultCount}`);
  }
}

/**
 * Shared assertion logic that operates on an already-created ECSqlReader.
 * Used by ECSqlReader test paths.
 */
async function runAssertionsOnReader(test: ECDbTestProps, reader: ECSqlReader, label: string): Promise<void> {
  let rows;
  try {
    rows = await reader.toArray();
  }
  catch (error: any) {
    if (test.errorDuringPrepare)
      return;
    else
      assert.fail(`Error during execution of ${label}: ${error.message}`);
  }

  if (test.errorDuringPrepare)
    assert.fail(`Statement is expected to fail during prepare`);

  const colMetaData = await reader.getMetaData();
  runResultAssertions(test, rows, colMetaData);
}

/**
 * Shared assertion logic that operates on an already-created ECSqlReader.
 * Used by ECSqlSyncReader test paths.
 */
function runAssertionsOnSyncReader(test: ECDbTestProps, reader: ECSqlSyncReader, label: string): void {
  let rows;
  try {
    rows = reader.toArray();
  }
  catch (error: any) {
    if (test.errorDuringPrepare)
      return;
    else
      assert.fail(`Error during execution of ${label}: ${error.message}`);
  }

  if (test.errorDuringPrepare)
    assert.fail(`Statement is expected to fail during prepare`);

  const colMetaData = reader.getMetaData();
  runResultAssertions(test, rows, colMetaData);
}

async function runECSqlReaderTest(test: ECDbTestProps, dataset: TestDataset): Promise<void> {
  const imodel = snapshotDbs[dataset];
  if (!imodel) {
    assert.fail(`Dataset ${dataset} is not loaded`);
  }

  if (test.sql === undefined) {
    assert.fail("Test does not have an ECSql statement");
  }

  const params = buildQueryBinder(test);
  const queryOptions = buildReaderQueryOptions(test);

  let reader: ECSqlReader;
  try {
    reader = imodel.createQueryReader(test.sql, params, queryOptions);
  } catch (error: any) {
    if (test.errorDuringPrepare)
      return;
    else
      assert.fail(`Error during creating ECSqlReader: ${error.message}`);
  }

  await runAssertionsOnReader(test, reader, "ECSqlReader");
}

async function runECSqlSyncReaderTest(test: ECDbTestProps, dataset: TestDataset): Promise<void> {
  const imodel = snapshotDbs[dataset];
  if (!imodel) {
    assert.fail(`Dataset ${dataset} is not loaded`);
  }

  if (test.sql === undefined) {
    assert.fail("Test does not have an ECSql statement");
  }

  const params = buildQueryBinder(test);
  const queryOptions = buildReaderQueryOptions(test);

  try {
    imodel.withQueryReader(test.sql, reader => {
      runAssertionsOnSyncReader(test, reader, "ECSqlSyncReader");
    }, params, queryOptions as SynchronousQueryOptions);
  } catch (error: any) {
    if (test.errorDuringPrepare)
      return;
    else
      assert.fail(`Error during creating ECSqlSyncReader: ${error.message}`);
  }
}

function checkingExpectedResults(rowFormat: ECDbTestRowFormat, actualResult: any, expectedResult: any, indexesToInclude?: number[]) {
  if (rowFormat === ECDbTestRowFormat.ECSqlIndexes && indexesToInclude) {
    let i: any = 0;
    for (const key of Object.keys(expectedResult)) {
      assert.deepEqual(actualResult[indexesToInclude[i]], expectedResult[key], `Expected ${JSON.stringify(expectedResult[key])} but got ${JSON.stringify(actualResult[indexesToInclude[i]])}`);
      i++;
    }
  }
  else {
    for (const key of Object.keys(expectedResult)) {
      assert.deepEqual(actualResult[key], expectedResult[key], `Expected ${JSON.stringify(expectedResult[key])} but got ${JSON.stringify(actualResult[key])}`);
    }
  }
}
function logWarning(message: string) {
  // eslint-disable-next-line no-console
  console.log(`\x1b[33m${message}\x1b[0m`);
}