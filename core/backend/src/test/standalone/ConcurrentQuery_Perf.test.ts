/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { DbResult, QueryBinder, QueryOptionsBuilder, QueryRowFormat, QueryStats } from "@itwin/core-common";
import { expect } from "chai";
import { ECSqlStatement } from "../../ECSqlStatement";
import { IModelDb, SnapshotDb } from "../../IModelDb";
import { IModelHost } from "../../IModelHost";
import { IModelJsFs } from "../../IModelJsFs";

/* eslint-disable no-console */
describe.skip("Properties loading", () => {
  let imodel: SnapshotDb;
  before(async () => {
    await IModelHost.startup();
  });
  after(async () => {
    await IModelHost.shutdown();
  });
  beforeEach(() => {
    const testIModelName: string = "D:/temp/test-file.bim";
    imodel = SnapshotDb.openFile(testIModelName);
    expect(imodel).is.not.null;
  }); 291;
  it.skip(`concurrent query ping test`, async function () {
    this.timeout(0);
    // eslint-disable-next-line no-console
    console.log("Round trip time");
    const startTime = new Date().getTime();
    let rowCount = 0;
    const ping = {
      ping: {
        resultSize: 0,
        sleepTime: 0,
      },
    };
    for (let i = 0; i < 246000; ++i) {
      for await (const _row of imodel.query(JSON.stringify(ping), undefined, { rowFormat: QueryRowFormat.UseJsPropertyNames, usePrimaryConn: true })) {
        ++rowCount;
      }
    }
    console.log(`Loaded - ${rowCount} in ${new Date().getTime() - startTime} ms`);
  });
  it.skip("Starting to load properties using ECSQL via ECSqlStatement", async function () {
    this.timeout(0);
    console.log("Starting to load properties using ECSQL via ECSqlStatement");
    const startTime = new Date().getTime();
    const propertiesCount = await new PropertyReaderStressTest(imodel, QueryMethod.WithConcurrentQuery).getElementsPropertiesECSQL(imodel);
    console.log(`Loaded - ${propertiesCount} in ${new Date().getTime() - startTime} ms`);
  });

});
interface TestQueryStats extends QueryStats {
  execs: number;
}
enum QueryMethod {
  WithPreparedStatement,
  WithConcurrentQuery
}
class PropertyReaderStressTest {
  private _queryTimes = new Map<string, TestQueryStats>();
  public constructor(private _imodel: IModelDb, private _method: QueryMethod) {

  }
  public printTime(fileName: string) {
    const allStats: TestQueryStats = { backendCpuTime: 0, backendRowsReturned: 0, backendMemUsed: 0, backendTotalTime: 0, totalTime: 0, retryCount: 0, execs: 0 };
    let doc: string;
    const headerLine = `nativeCpuTime,nativeMemUsed,nativeRowReturned,nativeTotalTime,totalTime,retryCount,execs,ecsql\r\n`;
    doc = headerLine;
    this._queryTimes.forEach((stats: TestQueryStats, ecsql: string) => {
      allStats.backendCpuTime += stats.backendCpuTime;
      allStats.backendMemUsed += stats.backendMemUsed;
      allStats.backendRowsReturned += stats.backendRowsReturned;
      allStats.backendTotalTime += stats.backendTotalTime;
      allStats.totalTime += stats.totalTime;
      allStats.retryCount += stats.retryCount;
      allStats.execs += stats.execs;
      const textLine = `${stats.backendCpuTime},${stats.backendMemUsed},${stats.backendRowsReturned},${stats.backendTotalTime},${stats.totalTime},${stats.retryCount},${stats.execs},"${ecsql.replace(/\n/g, " ").replace(/\r/g, " ").replace(/\s+/g, " ")}"\r\n`;
      doc += textLine;
    });
    const totalLine = `${allStats.backendCpuTime},${allStats.backendMemUsed},${allStats.backendRowsReturned},${allStats.backendTotalTime},${allStats.totalTime},${allStats.retryCount},${allStats.execs},"***"\r\n`;
    doc += totalLine;
    IModelJsFs.writeFileSync(fileName, doc);
  }
  public async queryAll(ecsql: string, params?: QueryBinder) {
    const builder = new QueryOptionsBuilder({ usePrimaryConn: true, abbreviateBlobs: true });
    builder.setConvertClassIdsToNames(true);
    builder.setRowFormat(QueryRowFormat.UseJsPropertyNames);
    const reader = this._imodel.createQueryReader(ecsql, params, builder.getOptions());
    const rows = await reader.toArray();
    const curStats = { ...reader.stats, execs: 1 };
    if (this._queryTimes.has(ecsql)) {
      const stats = this._queryTimes.get(ecsql)!;
      stats.backendCpuTime += curStats.backendCpuTime;
      stats.backendMemUsed += curStats.backendMemUsed;
      stats.backendRowsReturned += curStats.backendRowsReturned;
      stats.backendTotalTime += curStats.backendTotalTime;
      stats.totalTime += curStats.totalTime;
      stats.execs++;
    } else {
      this._queryTimes.set(ecsql, curStats);
    }
    return rows;
  }
  public async getElementsPropertiesECSQL(db: IModelDb) {
    const query = `
      SELECT el.ECInstanceId id,  '[' || schemaDef.Name || '].[' || classDef.Name || ']' className
      FROM bis.Element el
      JOIN meta.ECClassDef classDef ON classDef.ECInstanceId = el.ECClassId
      JOIN meta.ECSchemaDef schemaDef ON schemaDef.ECInstanceId = classDef.Schema.Id`;

    let propertiesCount = 0;
    const startTime = new Date().getTime();
    const blockSize = 3000;
    let startTimeBlock = new Date().getTime();
    for (const row of await this.queryAll(query, undefined)) {
      const properties = await this.loadElementProperties(db, row.className, row.id);
      expect(properties.id).to.be.eq(row.id);
      propertiesCount++;
      if (propertiesCount % blockSize === 0) {
        const blockElapsedTime = ((new Date().getTime() - startTimeBlock) / 1000);
        const overallSpeed = Math.round(propertiesCount / ((new Date().getTime() - startTime) / 1000));
        const blockSpeed = Math.round(propertiesCount / (blockElapsedTime / 1000));
        startTimeBlock = new Date().getTime();
        console.log(`[block= %d] [overall = %d prop/sec] [thisBlock = %d prop/sec] [blockElapsed = %d sec]`, propertiesCount / blockSize, overallSpeed, blockSpeed, blockElapsedTime.toFixed(2));

        // this.printTime("d:/temp/stats.csv");
      }
    }
    return propertiesCount;
  }

  private async loadElementProperties(db: IModelDb, className: string, elementId: string) {
    const elementProperties = await this.loadProperties(db, className, [elementId], true);
    return {
      ...elementProperties[0],
      ...(await this.loadRelatedProperties(db, async () => this.queryGeometricElement3dTypeDefinitions(db, elementId), true)),
      ...(await this.loadRelatedProperties(db, async () => this.queryGeometricElement2dTypeDefinitions(db, elementId), true)),
      ...(await this.loadRelatedProperties(db, async () => this.queryElementLinks(db, elementId), false)),
      ...(await this.loadRelatedProperties(db, async () => this.queryGroupElementLinks(db, elementId), false)),
      ...(await this.loadRelatedProperties(db, async () => this.queryModelLinks(db, elementId), false)),
      ...(await this.loadRelatedProperties(db, async () => this.queryDrawingGraphicElements(db, elementId), false)),
      ...(await this.loadRelatedProperties(db, async () => this.queryGraphicalElement3dElements(db, elementId), false)),
      ...(await this.loadRelatedProperties(db, async () => this.queryExternalSourceRepositories(db, elementId), false)),
      ...(await this.loadRelatedProperties(db, async () => this.queryExternalSourceGroupRepositories(db, elementId), false)),
    };
  }

  private async loadRelatedProperties(db: IModelDb, idsGetter: () => Promise<Map<string, string[]>>, loadAspects: boolean) {
    const idsByClass = await idsGetter();
    const properties: any = {};
    for (const entry of idsByClass) {
      properties[entry[0]] = await this.loadProperties(db, entry[0], entry[1], loadAspects);
    }
    return properties;
  }

  private async loadProperties(db: IModelDb, className: string, ids: string[], loadAspects: boolean) {
    const query = `
      SELECT ECInstanceId
      FROM ${className}
      WHERE ECInstanceId IN (${ids.map((_v, idx) => `:id${idx}`).join(",")})`;
    const properties: any[] = [];
    for (const row of await this.queryAll(query, QueryBinder.from(ids))) {
      properties.push({
        ...this.collectProperties(row),
        ...(loadAspects ? await this.loadRelatedProperties(db, async () => this.queryUniqueAspects(db, row.Id), false) : {}),
        ...(loadAspects ? await this.loadRelatedProperties(db, async () => this.queryMultiAspects(db, row.Id), false) : {}),
      });
    }
    return properties;
  }

  private async queryMultiAspects(db: IModelDb, elementId: string) {
    const query = `
      SELECT ma.ECInstanceId id, '[' || schemaDef.Name || '].[' || classDef.Name || ']' className
      FROM bis.ElementMultiAspect ma
      JOIN meta.ECClassDef classDef ON classDef.ECInstanceId = ma.ECClassId
      JOIN meta.ECSchemaDef schemaDef ON schemaDef.ECInstanceId = classDef.Schema.Id
      WHERE ma.Element.Id = :id`;
    return this.queryRelatedClasses(db, query, QueryBinder.from({ id: elementId }));
  }

  private async queryUniqueAspects(db: IModelDb, elementId: string) {
    const query = `
      SELECT ua.ECInstanceId id, '[' || schemaDef.Name || '].[' || classDef.Name || ']' className
      FROM bis.ElementUniqueAspect ua
      JOIN meta.ECClassDef classDef ON classDef.ECInstanceId = ua.ECClassId
      JOIN meta.ECSchemaDef schemaDef ON schemaDef.ECInstanceId = classDef.Schema.Id
      WHERE ua.Element.Id = :id`;
    return this.queryRelatedClasses(db, query, QueryBinder.from({ id: elementId }));
  }

  private async queryGeometricElement3dTypeDefinitions(db: IModelDb, elementId: string) {
    const query = `
      SELECT relType.TargetECInstanceId id, '[' || schemaDef.Name || '].[' || classDef.Name || ']' className
      FROM bis.GeometricElement3dHasTypeDefinition relType
      JOIN meta.ECClassDef classDef ON classDef.ECInstanceId = relType.TargetECClassId
      JOIN meta.ECSchemaDef schemaDef ON schemaDef.ECInstanceId = classDef.Schema.Id
      WHERE relType.SourceECInstanceId = :id`;
    return this.queryRelatedClasses(db, query, QueryBinder.from({ id: elementId }));
  }

  private async queryGeometricElement2dTypeDefinitions(db: IModelDb, elementId: string) {
    const query = `
      SELECT relType.TargetECInstanceId id, '[' || schemaDef.Name || '].[' || classDef.Name || ']' className
      FROM bis.GeometricElement2dHasTypeDefinition relType
      JOIN meta.ECClassDef classDef ON classDef.ECInstanceId = relType.TargetECClassId
      JOIN meta.ECSchemaDef schemaDef ON schemaDef.ECInstanceId = classDef.Schema.Id
      WHERE relType.SourceECInstanceId = :id`;
    return this.queryRelatedClasses(db, query, QueryBinder.from({ id: elementId }));
  }

  private async queryElementLinks(db: IModelDb, elementId: string) {
    const query = `
      SELECT relLink.TargetECInstanceId id, '[' || schemaDef.Name || '].[' || classDef.Name || ']' className
      FROM bis.ElementHasLinks relLink
      JOIN meta.ECClassDef classDef ON classDef.ECInstanceId = relLink.TargetECClassId
      JOIN meta.ECSchemaDef schemaDef ON schemaDef.ECInstanceId = classDef.Schema.Id
      WHERE relLink.SourceECInstanceId = :id`;
    return this.queryRelatedClasses(db, query, QueryBinder.from({ id: elementId }));
  }

  private async queryGroupElementLinks(db: IModelDb, elementId: string) {
    const query = `
      SELECT relLink.TargetECInstanceId id, '[' || schemaDef.Name || '].[' || classDef.Name || ']' className
      FROM bis.ElementHasLinks relLink
      JOIN bis.ElementGroupsMembers relElementGroup ON relElementGroup.SourceECInstanceId = relLink.SourceECInstanceId
      JOIN meta.ECClassDef classDef ON classDef.ECInstanceId = relLink.TargetECClassId
      JOIN meta.ECSchemaDef schemaDef ON schemaDef.ECInstanceId = classDef.Schema.Id
      WHERE relElementGroup.TargetECInstanceId = :id`;
    return this.queryRelatedClasses(db, query, QueryBinder.from({ id: elementId }));
  }

  private async queryModelLinks(db: IModelDb, elementId: string) {
    const query = `
      SELECT relLink.TargetECInstanceId id, '[' || schemaDef.Name || '].[' || classDef.Name || ']' className
      FROM bis.ElementHasLinks relLink
      JOIN bis.ModelModelsElement relModelModels ON relModelModels.TargetECInstanceId = relLink.SourceECInstanceId
      JOIN bis.ModelContainsElements relModelContains ON relModelContains.SourceECInstanceId = relModelModels.SourceECInstanceId
      JOIN meta.ECClassDef classDef ON classDef.ECInstanceId = relLink.TargetECClassId
      JOIN meta.ECSchemaDef schemaDef ON schemaDef.ECInstanceId = classDef.Schema.Id
      WHERE relModelContains.TargetECInstanceId = :id`;
    return this.queryRelatedClasses(db, query, QueryBinder.from({ id: elementId }));
  }

  private async queryDrawingGraphicElements(db: IModelDb, elementId: string) {
    const query = `
      SELECT relRepresents.SourceECInstanceId id, '[' || schemaDef.Name || '].[' || classDef.Name || ']' className
      FROM bis.DrawingGraphicRepresentsElement relRepresents
      JOIN meta.ECClassDef classDef ON classDef.ECInstanceId = relRepresents.SourceECClassId
      JOIN meta.ECSchemaDef schemaDef ON schemaDef.ECInstanceId = classDef.Schema.Id
      WHERE relRepresents.TargetECInstanceId = :id`;
    return this.queryRelatedClasses(db, query, QueryBinder.from({ id: elementId }));
  }

  private async queryGraphicalElement3dElements(db: IModelDb, elementId: string) {
    const query = `
      SELECT relRepresents.SourceECInstanceId id, '[' || schemaDef.Name || '].[' || classDef.Name || ']' className
      FROM bis.GraphicalElement3dRepresentsElement relRepresents
      JOIN meta.ECClassDef classDef ON classDef.ECInstanceId = relRepresents.SourceECClassId
      JOIN meta.ECSchemaDef schemaDef ON schemaDef.ECInstanceId = classDef.Schema.Id
      WHERE relRepresents.TargetECInstanceId = :id`;
    return this.queryRelatedClasses(db, query, QueryBinder.from({ id: elementId }));
  }

  private async queryExternalSourceRepositories(db: IModelDb, elementId: string) {
    const query = `
      SELECT relRepository.TargetECInstanceId id, '[' || schemaDef.Name || '].[' || classDef.Name || ']' className
      FROM bis.ExternalSourceIsInRepository relRepository
      JOIN bis.ElementIsFromSource relFromSource ON relFromSource.TargetECInstanceId = relRepository.SourceECInstanceId
      JOIN bis.ExternalSourceAspect aspect ON aspect.ECInstanceId = relFromSource.SourceECInstanceId
      JOIN meta.ECClassDef classDef ON classDef.ECInstanceId = relRepository.TargetECClassId
      JOIN meta.ECSchemaDef schemaDef ON schemaDef.ECInstanceId = classDef.Schema.Id
      WHERE aspect.Element.Id = :id`;
    return this.queryRelatedClasses(db, query, QueryBinder.from({ id: elementId }));
  }

  private async queryExternalSourceGroupRepositories(db: IModelDb, elementId: string) {
    const query = `
      SELECT relRepository.TargetECInstanceId id, '[' || schemaDef.Name || '].[' || classDef.Name || ']' className
      FROM bis.ExternalSourceIsInRepository relRepository
      JOIN bis.ExternalSourceGroupGroupsSources relGroupSources ON relGroupSources.TargetECInstanceId = relRepository.SourceECInstanceId
      JOIN bis.ElementIsFromSource relFromSource ON relFromSource.TargetECInstanceId = relGroupSources.SourceECInstanceId AND relFromSource.TargetECClassId IS (bis.ExternalSourceGroup)
      JOIN bis.ExternalSourceAspect aspect ON aspect.ECInstanceId = relFromSource.SourceECInstanceId
      JOIN meta.ECClassDef classDef ON classDef.ECInstanceId = relRepository.TargetECClassId
      JOIN meta.ECSchemaDef schemaDef ON schemaDef.ECInstanceId = classDef.Schema.Id
      WHERE aspect.Element.Id = :id`;
    return this.queryRelatedClasses(db, query, QueryBinder.from({ id: elementId }));
  }
  private async queryRelatedClasses(db: IModelDb, query: string, bindings: object) {
    if (this._method === QueryMethod.WithConcurrentQuery) {
      return this.queryRelatedClassesWithConcurrentQuery(query, bindings);
    }
    return this.queryRelatedClassesWithECSqlStatement(db, query, bindings);
  }
  private async queryRelatedClassesWithConcurrentQuery(query: string, bindings: object) {
    const relatedClasses = new Map<string, string[]>();
    for (const row of await this.queryAll(query, QueryBinder.from(bindings))) {
      const className = row.className ?? row.targetClassName ?? row.sourceClassName;
      const relatedIds = relatedClasses.get(className);
      if (!relatedIds) {
        relatedClasses.set(className, [row.id]);
        continue;
      }
      relatedIds.push(row.id);
    }
    return relatedClasses;
  }
  private queryRelatedClassesWithECSqlStatement(db: IModelDb, query: string, bindings: object) {
    return db.withPreparedStatement(query, (stmt: ECSqlStatement) => {
      stmt.bindValues(bindings);
      const relatedClasses = new Map<string, string[]>();
      while (stmt.step() === DbResult.BE_SQLITE_ROW) {
        const row = stmt.getRow();
        const className = row.className;
        const relatedIds = relatedClasses.get(className);
        if (!relatedIds) {
          relatedClasses.set(className, [row.id]);
          continue;
        }
        relatedIds.push(row.id);
      }
      return relatedClasses;
    });
  }
  private _excludedProperties = new Set<string>(["element", "jsonProperties", "geometryStream"]);
  private collectProperties(row: any) {
    const element: any = {};
    for (const prop in row) {
      if (this._excludedProperties.has(prop))
        continue;
      element[prop] = row[prop];
    }
    return element;
  }
}
