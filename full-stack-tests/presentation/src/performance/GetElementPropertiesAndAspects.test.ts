/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { join } from "path";
import { ECSqlStatement, ElementAspect, IModelHost, SnapshotDb } from "@itwin/core-backend";
import { DbResult, QueryRowFormat } from "@itwin/core-common";
import { Id64Set } from "@itwin/core-bentley";

const COUNT: number | undefined = undefined; // not fully implemented
// const COUNT: number | undefined = 1;

const STORE_OUTPUT = true; // not fully implemented

const DEBUG = false;

const SHOW_STATISTICS = false;

function createTest(testName: string, func: () => Promise<{ [key: string]: any }>) {
  it(testName, async function () {
    process.stdout.write(`Loading properties...\n`);
    const startTime = new Date().getTime();
    const res = await func();
    const totalTime = (new Date()).getTime() - startTime;

    if (!DEBUG)
      delete res["results"];

    if (SHOW_STATISTICS)
      console.log({ time: totalTime, ...res });

    process.stdout.write(`Loaded ${res.numResults} elements properties in ${totalTime} ms`);
  });
}

async function awaitQueryForEachAndReturn(query: AsyncIterableIterator<any>) {
  let results = [];
  for await (const row of query) {
    results.push(row);
  }
  return results;
}

async function awaitQueryForEach(query: AsyncIterableIterator<any>) {
  // @ts-ignore
  for await (const row of query);
  return [];
}

describe("Get Element Properties and Element Aspects (#performance)", () => {
  let imodel: SnapshotDb;
  let numQueries: number;
  let numClassesQueried: number;
  let testIModelName: string;
  let uniqueClasses: Set<string>;

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

    numQueries = 0;
    numClassesQueried = 0;
    uniqueClasses = new Set<string>();
  });

  describe("Get All Element Properties (#performance)", () => {

    createTest("Using Normal Queries with .query", async () => {
      const allClassNamesQuery = `
        SELECT
          ec_classname(ECClassId)
        FROM (
          SELECT DISTINCT
            ECClassId
          FROM
            bis.Element
        )
      `;
      numQueries++;

      let res: any[] = [];
      const classIdAndNameQueryStream = imodel.query(allClassNamesQuery, undefined, { limit: { count: COUNT } });
      for await (const row of classIdAndNameQueryStream) {
        const className = row[0];
        const propertiesQuery = `SELECT * FROM ONLY ${className}`;
        numQueries++;
        const propertiesQueryStream = imodel.query(propertiesQuery, undefined, { limit: { count: COUNT }, rowFormat: QueryRowFormat.UseJsPropertyNames })

        if (STORE_OUTPUT)
          res.push(...(await awaitQueryForEachAndReturn(propertiesQueryStream)));
        else
          await awaitQueryForEach(propertiesQueryStream);
      }

      let ret = {
        results: res,
        numResults: res.length,
        numQueriesRun: numQueries,
        numClassesQueried: numQueries - 1
      }

      return ret;
    });

    createTest("Using Normal Queries with ECSqlReader", async () => {
      const allClassNamesQuery = `
        SELECT
          ec_classname(ECClassId)
        FROM (
          SELECT DISTINCT
            ECClassId
          FROM
            bis.Element
        )
      `;
      numQueries++;

      const res = await imodel.withStatement(allClassNamesQuery, async (classNameStmt: ECSqlStatement) => {
        let aspects: ElementAspect[] = [];
        while (DbResult.BE_SQLITE_ROW === classNameStmt.step()) {
          const className = classNameStmt.getValue(0).getString();
          const propertiesQuery = `SELECT * FROM ONLY ${className}`;
          numQueries++;
          const aspectReader = imodel.createQueryReader(propertiesQuery, undefined, { rowFormat: QueryRowFormat.UseJsPropertyNames });
          aspects = aspects.concat(await aspectReader.toArray());
        }
        return aspects;
      });

      let ret = {
        results: res,
        numResults: res.length,
        numQueriesRun: numQueries,
        numClassesQueried: numQueries - 1
      }

      return ret;
    });

    createTest("Using Instance Queries", async () => {
      const query = `
        SELECT $ FROM bis.Element
      `;
      numQueries++;
      const queryStream = imodel.query(query, undefined, { limit: { count: COUNT }, rowFormat: QueryRowFormat.UseJsPropertyNames });

      let res: any;
      if (STORE_OUTPUT)
        res = await awaitQueryForEachAndReturn(queryStream);
      else
        res = await awaitQueryForEach(queryStream);

      let ret = {
        results: res,
        numResults: res.length,
        numQueriesRun: numQueries,
        numClassesQueried: 1,
        classesQueried: "bis.Element"
      }

      return ret;
    });

    createTest("Using iTwin.js For Each", async () => {
      let offset = 0;
      let currentElementIds: Id64Set;
      let props = [];
      do {
        currentElementIds = await imodel.queryEntityIds({ from: "bis.Element", limit: 10000, offset });
        offset += 10000;
        numQueries++;

        for (const elementId of currentElementIds.values()) {
          const res = await imodel.elements.getElementProps(elementId);
          numQueries++;
          if (STORE_OUTPUT)
            props.push(res);
        }
      } while (currentElementIds.size > 0);

      let ret = {
        results: props,
        numResults: props.length,
        numQueryLikeFunctionCalls: numQueries,
        classesQueried: "bis.Element, and properties using element id"
      }

      return ret;
    });

  });

  describe("Get All ElementAspect Properties (#performance)", () => {

    createTest("Using Normal Queries", async () => {
      const elementIdsQuery = `
        SELECT ECInstanceId FROM bis.Element
      `;
      numQueries++;

      const multiAspectQuery = `
          SELECT ec_classname(ECClassId) FROM (
            SELECT ECClassId FROM bis.ElementMultiAspect WHERE Element.id=:elementId
          )`;
      const uniqueAspectQuery = `
          SELECT ec_classname(ECClassId) FROM (
            SELECT ECClassId FROM bis.ElementUniqueAspect WHERE Element.id=:elementId
          )`;
      imodel.prepareStatement(multiAspectQuery);
      imodel.prepareStatement(uniqueAspectQuery);

      let res: any[] = [];
      const elementIdsQueryStream = imodel.query(elementIdsQuery, undefined, { limit: { count: COUNT } });
      for await (const row of elementIdsQueryStream) {
        const elementId = row[0];

        await getAspectClassesProperites(multiAspectQuery, elementId);
        await getAspectClassesProperites(uniqueAspectQuery, elementId);

        async function getAspectClassesProperites(aspectQuery: string, elementId: any) {
          numQueries++;
          await imodel.withPreparedStatement(aspectQuery, async (aspectStmt: ECSqlStatement) => {
            aspectStmt.bindId("elementId", elementId);
            while (DbResult.BE_SQLITE_ROW === aspectStmt.step()) {
              const className = aspectStmt.getValue(0).getString();
              numQueries++;
              numClassesQueried++;
              uniqueClasses.add(className);
              await imodel.withPreparedStatement(`SELECT * FROM ${className} WHERE Element.id=:elementId`, async (propertiesStmt: ECSqlStatement) => {
                propertiesStmt.bindId("elementId", elementId);
                while (DbResult.BE_SQLITE_ROW === propertiesStmt.step()) {
                  res.push(await propertiesStmt.getRow());
                }
              });
            }
          });
        }
      }

      let ret = {
        results: res,
        numResults: res.length,
        numQueriesRun: numQueries,
        numTimesAspectClassesQueried: numClassesQueried,
        numUniqueAspectClassesQueried: uniqueClasses.size
      }

      return ret;
    });


    createTest("Using Instance Queries", async () => {
      const query = `
        SELECT $ FROM bis.ElementAspect
      `;
      const queryStream = imodel.query(query, undefined, { limit: { count: COUNT } });

      let res: any[] = [];
      for await (const row of queryStream) {
        res.push(row[0]);
      }

      let ret = {
        results: res,
        numResults: res.length,
        numQueriesRun: 1,
        classesQueried: "bis.ElementAspect"
      }

      return ret;
    });

    createTest("Using Instance Queries And Parse Results Into Objects", async () => {
      const query = `
        SELECT $ FROM bis.ElementAspect
      `;
      const queryStream = imodel.query(query, undefined, { limit: { count: COUNT } });

      let res: any[] = [];
      for await (const row of queryStream) {
        res.push(JSON.parse(row[0]));
      }

      let ret = {
        results: res,
        numResults: res.length,
        numQueriesRun: 1,
        classesQueried: "bis.ElementAspect"
      }

      return ret;
    });

    createTest("Using iTwin.js For Each", async () => {
      let offset = 0;
      let currentElementIds: Id64Set;
      let props = [];
      do {
        currentElementIds = await imodel.queryEntityIds({ from: "bis.Element", limit: 10000, offset });
        offset += 10000;
        numQueries++;

        for (const elementId of currentElementIds.values()) {
          const res = await imodel.elements.getAspects(elementId);
          numQueries++;
          if (STORE_OUTPUT)
            props.push(res);
        }
      } while (currentElementIds.size > 0);

      let ret = {
        results: props,
        numResults: props.length,
        numQueryLikeFunctionCalls: numQueries,
        classesQueried: "bis.Element, and aspect properties using element id"
      }

      return ret;
    });

  });

  describe("Get All Element AND ElementAspect Properties (#performance)", () => {

    createTest("Using Normal Queries", async () => {
      let elementPropertiesCount = 0;
      let aspectPropertiesCount = 0;
      let numIndividualResults = 0;

      // Get class names
      const allClassNamesQuery = `
        SELECT
          ec_classname(ECClassId)
        FROM (
          SELECT DISTINCT
            ECClassId
          FROM
            bis.Element
        )
      `;
      numQueries++;
      const allClassNamesQueryReader = imodel.createQueryReader(allClassNamesQuery, undefined, undefined);
      const classNames = await allClassNamesQueryReader.toArray();

      // Prepare statements
      imodel.prepareStatement(`SELECT ec_classname(ECClassId) FROM bis.Element WHERE ECInstanceId=:elementId`);
      for (const className of classNames) {
        imodel.prepareStatement(`SELECT * FROM ${className} WHERE ECInstanceId=:elementId`);
      }
      const multiAspectQuery = `
          SELECT ec_classname(ECClassId) FROM (
            SELECT ECClassId FROM bis.ElementMultiAspect WHERE Element.id=:elementId
          )`;
      const uniqueAspectQuery = `
          SELECT ec_classname(ECClassId) FROM (
            SELECT ECClassId FROM bis.ElementUniqueAspect WHERE Element.id=:elementId
          )`;
      imodel.prepareStatement(multiAspectQuery);
      imodel.prepareStatement(uniqueAspectQuery);

      // Get properties
      const elementIdsQuery = `
        SELECT * FROM bis.Element
      `;
      numQueries++;
      let res: any[] = [];
      const elementIdsQueryStream = imodel.query(elementIdsQuery, undefined, { limit: { count: COUNT } });
      for await (const row of elementIdsQueryStream) {
        const elementId = row[0]; // assumes first value is ECInstanceId

        const classNameQuery = `SELECT ec_classname(ECClassId) FROM bis.Element WHERE ECInstanceId=:elementId`;
        numQueries++;
        const className = await imodel.withPreparedStatement(classNameQuery, async (stmt: ECSqlStatement) => {
          stmt.bindId("elementId", elementId);
          stmt.step();
          return stmt.getValue(0).getString();
        });

        let resultsForId: any[] = [];

        await getElementProperties(className!, elementId);
        await getAspectClassesProperites(multiAspectQuery, elementId);
        await getAspectClassesProperites(uniqueAspectQuery, elementId);

        numIndividualResults += resultsForId.flat(1).length

        res.push(resultsForId);

        async function getElementProperties(className: string, elementId: any) {
          const elementPropertiesQuery = `SELECT * FROM ${className} WHERE ECInstanceId=:elementId`;
          numQueries++;
          await imodel.withPreparedStatement(elementPropertiesQuery, async (stmt: ECSqlStatement) => {
            stmt.bindId("elementId", elementId);
            while (DbResult.BE_SQLITE_ROW === stmt.step()) {
              elementPropertiesCount++;
              resultsForId.push(await stmt.getValue(0).getString());
            }
          });
        }

        async function getAspectClassesProperites(aspectQuery: string, elementId: any) {
          numQueries++;
          await imodel.withPreparedStatement(aspectQuery, async (aspectStmt: ECSqlStatement) => {
            aspectStmt.bindId("elementId", elementId);
            while (DbResult.BE_SQLITE_ROW === aspectStmt.step()) {
              const className = aspectStmt.getValue(0).getString();
              numQueries++;
              numClassesQueried++;
              uniqueClasses.add(className);
              await imodel.withPreparedStatement(`SELECT * FROM ${className} WHERE Element.id=:elementId`, async (propertiesStmt: ECSqlStatement) => {
                propertiesStmt.bindId("elementId", elementId);
                while (DbResult.BE_SQLITE_ROW === propertiesStmt.step()) {
                  aspectPropertiesCount++;
                  resultsForId.push(await propertiesStmt.getRow());
                }
              });
            }
          });
        }
      }

      let ret = {
        results: res,
        numResults: res.length,
        numIndividualResults: numIndividualResults,
        numQueriesRun: numQueries,
        numTimesAspectClassesQueried: numClassesQueried,
        numUniqueAspectClassesQueried: uniqueClasses.size,
        elementPropertiesCount: elementPropertiesCount,
        aspectPropertiesCount: aspectPropertiesCount
      }

      return ret;
    });

    createTest("Using Instance Queries", async () => {
      let elementPropertiesCount = 0;
      let aspectPropertiesCount = 0;

      const elementAspectQuery = `
        SELECT $ aspects FROM (
          SELECT ua.ECInstanceId, ua.ECClassId FROM bis.ElementUniqueAspect ua WHERE ua.Element.id=:elementId
          UNION
          SELECT ma.ECInstanceId, ma.ECClassId FROM bis.ElementMultiAspect ma WHERE ma.Element.id=:elementId
        )`;
      imodel.prepareStatement(elementAspectQuery);

      // Get properties
      const elementPropertiesQuery = `
        SELECT ECInstanceId, $ FROM bis.Element
      `;
      numQueries++;
      numClassesQueried++;
      let res: any[] = [];
      const elementPropertiesQueryStream = imodel.query(elementPropertiesQuery, undefined, { limit: { count: COUNT } });
      for await (const row of elementPropertiesQueryStream) {
        const elementProperties = row[1];
        const elementId: string = row[0];
        elementPropertiesCount++;
        numQueries++;
        numClassesQueried += 2;

        let aspectProperties: any[] = [];
        await imodel.withPreparedStatement(elementAspectQuery, async (aspectStmt: ECSqlStatement) => {
          aspectStmt.bindId("elementId", elementId);
          while (DbResult.BE_SQLITE_ROW === aspectStmt.step()) {
            aspectProperties.push(await aspectStmt.getRow()['aspects']);
          }
        });

        aspectPropertiesCount += aspectProperties.length;

        res.push({
          elementProperties,
          aspectProperties
        })

      }

      let ret = {
        results: res,
        numResults: res.length,
        numQueriesRun: numQueries,
        numClassesQueried: numClassesQueried,
        numTotalAspectClassesQueried: numClassesQueried - 1,
        numUniqueAspectClassesQueried: 2,
        elementPropertiesCount: elementPropertiesCount,
        aspectPropertiesCount: aspectPropertiesCount
      }

      return ret;
    });

    createTest("Using Instance Queries And Parse Results Into Objects", async () => {
      let elementPropertiesCount = 0;
      let aspectPropertiesCount = 0;

      const elementAspectQuery = `
        SELECT $ aspects FROM (
          SELECT ua.ECInstanceId, ua.ECClassId FROM bis.ElementUniqueAspect ua WHERE ua.Element.id=:elementId
          UNION
          SELECT ma.ECInstanceId, ma.ECClassId FROM bis.ElementMultiAspect ma WHERE ma.Element.id=:elementId
        )`;
      imodel.prepareStatement(elementAspectQuery);

      // Get properties
      const elementPropertiesQuery = `
        SELECT ECInstanceId, $ FROM bis.Element
      `;
      numQueries++;
      numClassesQueried++;
      let res: any[] = [];
      const elementPropertiesQueryStream = imodel.query(elementPropertiesQuery, undefined, { limit: { count: COUNT } });
      for await (const row of elementPropertiesQueryStream) {
        const elementProperties = JSON.parse(row[1]);
        const elementId: string = row[0];
        elementPropertiesCount++;
        numQueries++;
        numClassesQueried += 2;

        let aspectProperties: any[] = [];
        await imodel.withPreparedStatement(elementAspectQuery, async (aspectStmt: ECSqlStatement) => {
          aspectStmt.bindId("elementId", elementId);
          while (DbResult.BE_SQLITE_ROW === aspectStmt.step()) {
            aspectProperties.push(JSON.parse(await aspectStmt.getRow()['aspects']));
          }
        });

        aspectPropertiesCount += aspectProperties.length;

        res.push({
          elementProperties,
          aspectProperties
        })

      }

      let ret = {
        results: res,
        numResults: res.length,
        numQueriesRun: numQueries,
        numClassesQueried: numClassesQueried,
        numTotalAspectClassesQueried: numClassesQueried - 1,
        numUniqueAspectClassesQueried: 2,
        elementPropertiesCount: elementPropertiesCount,
        aspectPropertiesCount: aspectPropertiesCount
      }

      return ret;
    });

    createTest("Using Instance Queries And Grouped By json_group_array", async () => {
      let elementPropertiesCount = 0;
      let aspectPropertiesCount = 0;

      const elementAspectQuery = `
        SELECT json_group_array(json($)) aspects FROM (
          SELECT ua.ECInstanceId, ua.ECClassId FROM bis.ElementUniqueAspect ua WHERE ua.Element.id=:elementId
          UNION
          SELECT ma.ECInstanceId, ma.ECClassId FROM bis.ElementMultiAspect ma WHERE ma.Element.id=:elementId
        )`;
      imodel.prepareStatement(elementAspectQuery);

      // Get properties
      const elementPropertiesQuery = `
        SELECT ECInstanceId, $ FROM bis.Element
      `;
      numQueries++;
      numClassesQueried++;
      let res: any[] = [];
      const elementPropertiesQueryStream = imodel.query(elementPropertiesQuery, undefined, { limit: { count: COUNT } });
      for await (const row of elementPropertiesQueryStream) {
        const elementProperties = row[1];
        const elementId: string = row[0];
        elementPropertiesCount++;
        numQueries++;
        numClassesQueried += 2;

        let aspectProperties: any[] = [];
        await imodel.withPreparedStatement(elementAspectQuery, async (aspectStmt: ECSqlStatement) => {
          aspectStmt.bindId("elementId", elementId);
          while (DbResult.BE_SQLITE_ROW === aspectStmt.step()) {
            const aspectRow = await aspectStmt.getRow();
            aspectProperties = aspectRow['aspects'];
          }
        });

        // aspectPropertiesCount += aspectProperties.length;

        res.push({
          elementProperties,
          aspectProperties
        })

      }

      let ret = {
        results: res,
        numResults: res.length,
        numQueriesRun: numQueries,
        numClassesQueried: numClassesQueried,
        numTotalAspectClassesQueried: numClassesQueried - 1,
        numUniqueAspectClassesQueried: 2,
        elementPropertiesCount: elementPropertiesCount,
        aspectPropertiesCount: "not counted"
      }

      return ret;
    });

    createTest("Using Instance Queries And Parse Results Into Objects And Grouped By json_group_array", async () => {
      let elementPropertiesCount = 0;
      let aspectPropertiesCount = 0;

      const elementAspectQuery = `
        SELECT json_group_array(json($)) aspects FROM (
          SELECT ua.ECInstanceId, ua.ECClassId FROM bis.ElementUniqueAspect ua WHERE ua.Element.id=:elementId
          UNION
          SELECT ma.ECInstanceId, ma.ECClassId FROM bis.ElementMultiAspect ma WHERE ma.Element.id=:elementId
        )`;
      imodel.prepareStatement(elementAspectQuery);

      // Get properties
      const elementPropertiesQuery = `
        SELECT ECInstanceId, $ FROM bis.Element
      `;
      numQueries++;
      numClassesQueried++;
      let res: any[] = [];
      const elementPropertiesQueryStream = imodel.query(elementPropertiesQuery, undefined, { limit: { count: COUNT } });
      for await (const row of elementPropertiesQueryStream) {
        const elementProperties = JSON.parse(row[1]);
        const elementId: string = row[0];
        elementPropertiesCount++;
        numQueries++;
        numClassesQueried += 2;

        let aspectProperties: any[] = [];
        await imodel.withPreparedStatement(elementAspectQuery, async (aspectStmt: ECSqlStatement) => {
          aspectStmt.bindId("elementId", elementId);
          while (DbResult.BE_SQLITE_ROW === aspectStmt.step()) {
            aspectProperties = JSON.parse(await aspectStmt.getRow()['aspects']);
          }
        });

        aspectPropertiesCount += aspectProperties.length;

        res.push({
          elementProperties,
          aspectProperties
        })

      }

      let ret = {
        results: res,
        numResults: res.length,
        numQueriesRun: numQueries,
        numClassesQueried: numClassesQueried,
        numTotalAspectClassesQueried: numClassesQueried - 1,
        numUniqueAspectClassesQueried: 2,
        elementPropertiesCount: elementPropertiesCount,
        aspectPropertiesCount: aspectPropertiesCount
      }

      return ret;
    });

    createTest("Using iTwin.js For Each", async () => {
      let elementPropertiesCount = 0;
      let aspectPropertiesCount = 0;

      let offset = 0;
      let currentElementIds: Id64Set;
      let res = [];
      do {
        currentElementIds = await imodel.queryEntityIds({ from: "bis.Element", limit: 10000, offset });
        offset += 10000;
        numQueries++;

        for (const elementId of currentElementIds.values()) {
          const elementProperties = await imodel.elements.getElementProps(elementId);
          const aspectProperties = await imodel.elements.getAspects(elementId);

          elementPropertiesCount++;
          aspectPropertiesCount += aspectProperties.length;

          res.push({
            elementProperties,
            aspectProperties
          });
        }
      } while (currentElementIds.size > 0);

      let ret = {
        results: res,
        numResults: res.length,
        numQueryLikeFunctionCalls: numQueries,
        elementPropertiesCount: elementPropertiesCount,
        aspectPropertiesCount: aspectPropertiesCount
      }

      return ret;
    });

  });

});
