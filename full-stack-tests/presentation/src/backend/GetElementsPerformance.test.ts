/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { IModelDb, IModelHost, SnapshotDb } from "@itwin/core-backend";
import { Presentation } from "@itwin/presentation-backend";
import { PagedResponse, PageOptions } from "@itwin/presentation-common";
import { QueryBinder, QueryRowFormat } from "@itwin/core-common";

/* eslint-disable no-console */
const PAGE_SIZE = 1000;

describe("Properties loading", () => {
  let imodel: SnapshotDb;

  before(async () => {
    await IModelHost.startup();
    Presentation.initialize({
      requestTimeout: 0,
      useMmap: true,
    });
  });

  after(async () => {
    await IModelHost.shutdown();
    Presentation.terminate();
  });

  beforeEach(() => {
    const testIModelName: string = "assets/datasets/15gb.bim";
    imodel = SnapshotDb.openFile(testIModelName);
    expect(imodel).is.not.null;
  });

  it("load properties using getElementProperties", async function () {
    this.timeout(0);
    console.log("Starting to load properties");
    const startTime = (new Date()).getTime();
    let propertiesCount = 0;
    while (true) {
      const pagingOptions = { start: propertiesCount, size: PAGE_SIZE };
      const response = await Presentation.getManager().getElementProperties({ imodel, paging: pagingOptions });
      propertiesCount += response.items.length;
      if (response.items.length === 0 && propertiesCount !== response.total) {
        throw Error("0 items returned while total count is not reached");
      }
      if (response.items.length < pagingOptions.size && propertiesCount !== response.total) {
        throw Error(`Some properties were missed in page (${pagingOptions.start}, ${pagingOptions.start + pagingOptions.size}]`);
      }
      console.log(`Loaded ${propertiesCount}/${response.total} properties`);
      if (propertiesCount === response.total)
        break;
    }
    const elapsedTime = (new Date()).getTime() - startTime;
    console.log(`Loaded ${propertiesCount} elements properties in ${elapsedTime} ms`);

  });

  it.only("load properties using ECSQL", async function () {
    this.timeout(0);
    console.log("Starting to load properties using ECSQL");
    const startTime = new Date().getTime();
    const propertiesCount = await getElementsPropertiesECSQL(imodel);
    console.log(`Loaded - ${propertiesCount} in ${new Date().getTime() - startTime} ms`);
  });

});

async function getElementsPropertiesECSQL(db: IModelDb) {
  const query = `
    SELECT el.ECInstanceId id,  '[' || schemaDef.Name || '].[' || classDef.Name || ']' className
    FROM bis.Element el
    JOIN meta.ECClassDef classDef ON classDef.ECInstanceId = el.ECClassId
    JOIN meta.ECSchemaDef schemaDef ON schemaDef.ECInstanceId = classDef.Schema.Id`;

  let propertiesCount = 0;
  for await (const row of db.query(query, undefined, QueryRowFormat.UseJsPropertyNames, { convertClassIdsToClassNames: true })) {
    const properties = await loadElementProperties(db, row.className, row.id);
    expect(properties.id).to.be.eq(row.id);
    propertiesCount++;
    if (propertiesCount % 1000 === 0)
      console.log(`Loaded - ${propertiesCount} properties`);
  }

  return propertiesCount;
}

async function loadElementProperties(db: IModelDb, className: string, elementId: string) {
  const elementProperties = await loadProperties(db, className, [elementId], true);
  return {
    ...elementProperties[0],
    ...(await loadRelatedProperties(db, async () => queryGeometricElement3dTypeDefinitions(db, elementId), true)),
    ...(await loadRelatedProperties(db, async () => queryGeometricElement2dTypeDefinitions(db, elementId), true)),
    ...(await loadRelatedProperties(db, async () => queryElementLinks(db, elementId), false)),
    ...(await loadRelatedProperties(db, async () => queryGroupElementLinks(db, elementId), false)),
    ...(await loadRelatedProperties(db, async () => queryModelLinks(db, elementId), false)),
    ...(await loadRelatedProperties(db, async () => queryDrawingGraphicElements(db, elementId), false)),
    ...(await loadRelatedProperties(db, async () => queryGraphicalElement3dElements(db, elementId), false)),
    ...(await loadRelatedProperties(db, async () => queryExternalSourceRepositories(db, elementId), false)),
    ...(await loadRelatedProperties(db, async () => queryExternalSourceGroupRepositories(db, elementId), false)),
  };
}

async function loadRelatedProperties(db: IModelDb, idsGetter: () => Promise<Map<string, string[]>>, loadAspects: boolean) {
  const idsByClass = await idsGetter();
  const properties: any = {};
  for (const entry of idsByClass) {
    properties[entry[0]] = await loadProperties(db, entry[0], entry[1], loadAspects);
  }
  return properties;
}

async function loadProperties(db: IModelDb, className: string, ids: string[], loadAspects: boolean) {
  const query = `
    SELECT *
    FROM ${className}
    WHERE ECInstanceId IN (${ids.map((_v, idx) => `:id${idx}`).join(",")})`;

  const properties: any[] = [];
  for await (const row of db.query(query, QueryBinder.from(ids), QueryRowFormat.UseJsPropertyNames)) {
    properties.push({
      ...collectProperties(row),
      ...(loadAspects ? await loadRelatedProperties(db, async () => queryUniqueAspects(db, row.Id), false) : {}),
      ...(loadAspects ? await loadRelatedProperties(db, async () => queryMultiAspects(db, row.Id), false) : {}),
    });
  }
  return properties;
}

async function queryMultiAspects(db: IModelDb, elementId: string) {
  const query = `
    SELECT ma.ECInstanceId id, '[' || schemaDef.Name || '].[' || classDef.Name || ']' className
    FROM bis.ElementMultiAspect ma
    JOIN meta.ECClassDef classDef ON classDef.ECInstanceId = ma.ECClassId
    JOIN meta.ECSchemaDef schemaDef ON schemaDef.ECInstanceId = classDef.Schema.Id
    WHERE ma.Element.Id = :id`;
  return queryRelatedClasses(db, query, QueryBinder.from({ id: elementId }));
}

async function queryUniqueAspects(db: IModelDb, elementId: string) {
  const query = `
    SELECT ua.ECInstanceId id, '[' || schemaDef.Name || '].[' || classDef.Name || ']' className
    FROM bis.ElementUniqueAspect ua
    JOIN meta.ECClassDef classDef ON classDef.ECInstanceId = ua.ECClassId
    JOIN meta.ECSchemaDef schemaDef ON schemaDef.ECInstanceId = classDef.Schema.Id
    WHERE ua.Element.Id = :id`;
  return queryRelatedClasses(db, query, QueryBinder.from({ id: elementId }));
}

async function queryGeometricElement3dTypeDefinitions(db: IModelDb, elementId: string) {
  const query = `
    SELECT relType.TargetECInstanceId id, '[' || schemaDef.Name || '].[' || classDef.Name || ']' className
    FROM bis.GeometricElement3dHasTypeDefinition relType
    JOIN meta.ECClassDef classDef ON classDef.ECInstanceId = relType.TargetECClassId
    JOIN meta.ECSchemaDef schemaDef ON schemaDef.ECInstanceId = classDef.Schema.Id
    WHERE relType.SourceECInstanceId = :id`;
  return queryRelatedClasses(db, query, QueryBinder.from({ id: elementId }));
}

async function queryGeometricElement2dTypeDefinitions(db: IModelDb, elementId: string) {
  const query = `
    SELECT relType.TargetECInstanceId id, '[' || schemaDef.Name || '].[' || classDef.Name || ']' className
    FROM bis.GeometricElement2dHasTypeDefinition relType
    JOIN meta.ECClassDef classDef ON classDef.ECInstanceId = relType.TargetECClassId
    JOIN meta.ECSchemaDef schemaDef ON schemaDef.ECInstanceId = classDef.Schema.Id
    WHERE relType.SourceECInstanceId = :id`;
  return queryRelatedClasses(db, query, QueryBinder.from({ id: elementId }));
}

async function queryElementLinks(db: IModelDb, elementId: string) {
  const query = `
    SELECT relLink.TargetECInstanceId id, '[' || schemaDef.Name || '].[' || classDef.Name || ']' className
    FROM bis.ElementHasLinks relLink
    JOIN meta.ECClassDef classDef ON classDef.ECInstanceId = relLink.TargetECClassId
    JOIN meta.ECSchemaDef schemaDef ON schemaDef.ECInstanceId = classDef.Schema.Id
    WHERE relLink.SourceECInstanceId = :id`;
  return queryRelatedClasses(db, query, QueryBinder.from({ id: elementId }));
}

async function queryGroupElementLinks(db: IModelDb, elementId: string) {
  const query = `
    SELECT relLink.TargetECInstanceId id, '[' || schemaDef.Name || '].[' || classDef.Name || ']' className
    FROM bis.ElementHasLinks relLink
    JOIN bis.ElementGroupsMembers relElementGroup ON relElementGroup.SourceECInstanceId = relLink.SourceECInstanceId
    JOIN meta.ECClassDef classDef ON classDef.ECInstanceId = relLink.TargetECClassId
    JOIN meta.ECSchemaDef schemaDef ON schemaDef.ECInstanceId = classDef.Schema.Id
    WHERE relElementGroup.TargetECInstanceId = :id`;
  return queryRelatedClasses(db, query, QueryBinder.from({ id: elementId }));
}

async function queryModelLinks(db: IModelDb, elementId: string) {
  const query = `
    SELECT relLink.TargetECInstanceId id, '[' || schemaDef.Name || '].[' || classDef.Name || ']' className
    FROM bis.ElementHasLinks relLink
    JOIN bis.ModelModelsElement relModelModels ON relModelModels.TargetECInstanceId = relLink.SourceECInstanceId
    JOIN bis.ModelContainsElements relModelContains ON relModelContains.SourceECInstanceId = relModelModels.SourceECInstanceId
    JOIN meta.ECClassDef classDef ON classDef.ECInstanceId = relLink.TargetECClassId
    JOIN meta.ECSchemaDef schemaDef ON schemaDef.ECInstanceId = classDef.Schema.Id
    WHERE relModelContains.TargetECInstanceId = :id`;
  return queryRelatedClasses(db, query, QueryBinder.from({ id: elementId }));
}

async function queryDrawingGraphicElements(db: IModelDb, elementId: string) {
  const query = `
    SELECT relRepresents.SourceECInstanceId id, '[' || schemaDef.Name || '].[' || classDef.Name || ']' className
    FROM bis.DrawingGraphicRepresentsElement relRepresents
    JOIN meta.ECClassDef classDef ON classDef.ECInstanceId = relRepresents.SourceECClassId
    JOIN meta.ECSchemaDef schemaDef ON schemaDef.ECInstanceId = classDef.Schema.Id
    WHERE relRepresents.TargetECInstanceId = :id`;
  return queryRelatedClasses(db, query, QueryBinder.from({ id: elementId }));
}

async function queryGraphicalElement3dElements(db: IModelDb, elementId: string) {
  const query = `
    SELECT relRepresents.SourceECInstanceId id, '[' || schemaDef.Name || '].[' || classDef.Name || ']' className
    FROM bis.GraphicalElement3dRepresentsElement relRepresents
    JOIN meta.ECClassDef classDef ON classDef.ECInstanceId = relRepresents.SourceECClassId
    JOIN meta.ECSchemaDef schemaDef ON schemaDef.ECInstanceId = classDef.Schema.Id
    WHERE relRepresents.TargetECInstanceId = :id`;
  return queryRelatedClasses(db, query, QueryBinder.from({ id: elementId }));
}

async function queryExternalSourceRepositories(db: IModelDb, elementId: string) {
  const query = `
    SELECT relRepository.TargetECInstanceId id, '[' || schemaDef.Name || '].[' || classDef.Name || ']' className
    FROM bis.ExternalSourceIsInRepository relRepository
    JOIN bis.ElementIsFromSource relFromSource ON relFromSource.TargetECInstanceId = relRepository.SourceECInstanceId
    JOIN bis.ExternalSourceAspect aspect ON aspect.ECInstanceId = relFromSource.SourceECInstanceId
    JOIN meta.ECClassDef classDef ON classDef.ECInstanceId = relRepository.TargetECClassId
    JOIN meta.ECSchemaDef schemaDef ON schemaDef.ECInstanceId = classDef.Schema.Id
    WHERE aspect.Element.Id = :id`;
  return queryRelatedClasses(db, query, QueryBinder.from({ id: elementId }));
}

async function queryExternalSourceGroupRepositories(db: IModelDb, elementId: string) {
  const query = `
    SELECT relRepository.TargetECInstanceId id, '[' || schemaDef.Name || '].[' || classDef.Name || ']' className
    FROM bis.ExternalSourceIsInRepository relRepository
    JOIN bis.ExternalSourceGroupGroupsSources relGroupSources ON relGroupSources.TargetECInstanceId = relRepository.SourceECInstanceId
    JOIN bis.ElementIsFromSource relFromSource ON relFromSource.TargetECInstanceId = relGroupSources.SourceECInstanceId AND relFromSource.TargetECClassId IS (bis.ExternalSourceGroup)
    JOIN bis.ExternalSourceAspect aspect ON aspect.ECInstanceId = relFromSource.SourceECInstanceId
    JOIN meta.ECClassDef classDef ON classDef.ECInstanceId = relRepository.TargetECClassId
    JOIN meta.ECSchemaDef schemaDef ON schemaDef.ECInstanceId = classDef.Schema.Id
    WHERE aspect.Element.Id = :id`;
  return queryRelatedClasses(db, query, QueryBinder.from({ id: elementId }));
}

async function queryRelatedClasses(db: IModelDb, query: string, bindings: QueryBinder) {
  const relatedClasses = new Map<string, string[]>();
  for await (const row of db.query(query, bindings, QueryRowFormat.UseJsPropertyNames)) {
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

const excludedProperties = new Set<string>(["element", "jsonProperties", "geometryStream"]);
function collectProperties(row: any) {
  const element: any = {};
  for (const prop in row) {
    if (excludedProperties.has(prop))
      continue;
    element[prop] = row[prop];
  }
  return element;
}
