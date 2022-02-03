/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import type { IModelDb} from "@itwin/core-backend";
import { IModelHost, SnapshotDb } from "@itwin/core-backend";
import { DbResult, QueryRowFormat } from "@itwin/core-common";
import { Presentation } from "@itwin/presentation-backend";

describe("#performance Element properties loading", () => {
  let imodel: SnapshotDb;

  before(async () => {
    await IModelHost.startup();
    Presentation.initialize({
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

  it("load properties using 'getElementProperties'", async function () {
    const startTime = (new Date()).getTime();
    let propertiesCount = 0;
    const { total, iterator } = await Presentation.getManager().getElementProperties({ imodel });
    process.stdout.write(`Loading properties for ${total} elements.`);
    for await (const items of iterator()) {
      propertiesCount += items.length;
      process.stdout.write(".");
    }
    process.stdout.write(`\nLoaded ${propertiesCount} elements properties in ${(new Date()).getTime() - startTime} ms`);
  });

  it("load properties using ECSQL", async function () {
    const startTime = new Date().getTime();
    process.stdout.write(`Loading properties.`);
    let propertiesCount = 0;
    for await (const _properties of getElementsPropertiesECSQL(imodel)) {
      propertiesCount++;
      if (propertiesCount % 1000 === 0)
        process.stdout.write(".");
    }
    process.stdout.write(`\nLoaded ${propertiesCount} elements properties in ${(new Date()).getTime() - startTime} ms`);
  });

});

async function* getElementsPropertiesECSQL(db: IModelDb) {
  const query = `
    SELECT el.ECInstanceId id,  '[' || schemaDef.Name || '].[' || classDef.Name || ']' className
    FROM bis.Element el
    JOIN meta.ECClassDef classDef ON classDef.ECInstanceId = el.ECClassId
    JOIN meta.ECSchemaDef schemaDef ON schemaDef.ECInstanceId = classDef.Schema.Id`;

  for await (const row of db.query(query, undefined, { abbreviateBlobs: true, rowFormat: QueryRowFormat.UseJsPropertyNames })) {
    const properties = loadElementProperties(db, row.className, row.id);
    expect(properties.id).to.be.eq(row.id);
    yield properties;
  }
}

function loadElementProperties(db: IModelDb, className: string, elementId: string) {
  const elementProperties = loadProperties(db, className, [elementId], true);
  return {
    ...elementProperties[0],
    ...(loadRelatedProperties(db, () => queryGeometricElement3dTypeDefinitions(db, elementId), true)),
    ...(loadRelatedProperties(db, () => queryGeometricElement2dTypeDefinitions(db, elementId), true)),
    ...(loadRelatedProperties(db, () => queryElementLinks(db, elementId), false)),
    ...(loadRelatedProperties(db, () => queryGroupElementLinks(db, elementId), false)),
    ...(loadRelatedProperties(db, () => queryModelLinks(db, elementId), false)),
    ...(loadRelatedProperties(db, () => queryDrawingGraphicElements(db, elementId), false)),
    ...(loadRelatedProperties(db, () => queryGraphicalElement3dElements(db, elementId), false)),
    ...(loadRelatedProperties(db, () => queryExternalSourceRepositories(db, elementId), false)),
    ...(loadRelatedProperties(db, () => queryExternalSourceGroupRepositories(db, elementId), false)),
  };
}

function loadRelatedProperties(db: IModelDb, idsGetter: () => Map<string, string[]>, loadAspects: boolean) {
  const idsByClass = idsGetter();
  const properties: any = {};
  for (const entry of idsByClass) {
    properties[entry[0]] = loadProperties(db, entry[0], entry[1], loadAspects);
  }
  return properties;
}

function loadProperties(db: IModelDb, className: string, ids: string[], loadAspects: boolean) {
  const query = `
    SELECT *
    FROM ${className}
    WHERE ECInstanceId IN (${ids.map((_v, idx) => `:id${idx}`).join(",")})`;

  return db.withPreparedStatement(query, (stmt) => {
    const properties: any[] = [];
    stmt.bindValues(ids);
    while (stmt.step() === DbResult.BE_SQLITE_ROW) {
      const row = stmt.getRow();
      properties.push({
        ...collectProperties(row),
        ...(loadAspects ? loadRelatedProperties(db, () => queryUniqueAspects(db, row.Id), false) : {}),
        ...(loadAspects ? loadRelatedProperties(db, () => queryMultiAspects(db, row.Id), false) : {}),
      });
    }
    return properties;
  });
}

function queryMultiAspects(db: IModelDb, elementId: string) {
  const query = `
    SELECT ma.ECInstanceId id, '[' || schemaDef.Name || '].[' || classDef.Name || ']' className
    FROM bis.ElementMultiAspect ma
    JOIN meta.ECClassDef classDef ON classDef.ECInstanceId = ma.ECClassId
    JOIN meta.ECSchemaDef schemaDef ON schemaDef.ECInstanceId = classDef.Schema.Id
    WHERE ma.Element.Id = :id`;
  return queryRelatedClasses(db, query, { id: elementId });
}

function queryUniqueAspects(db: IModelDb, elementId: string) {
  const query = `
    SELECT ua.ECInstanceId id, '[' || schemaDef.Name || '].[' || classDef.Name || ']' className
    FROM bis.ElementUniqueAspect ua
    JOIN meta.ECClassDef classDef ON classDef.ECInstanceId = ua.ECClassId
    JOIN meta.ECSchemaDef schemaDef ON schemaDef.ECInstanceId = classDef.Schema.Id
    WHERE ua.Element.Id = :id`;
  return queryRelatedClasses(db, query, { id: elementId });
}

function queryGeometricElement3dTypeDefinitions(db: IModelDb, elementId: string) {
  const query = `
    SELECT relType.TargetECInstanceId id, '[' || schemaDef.Name || '].[' || classDef.Name || ']' className
    FROM bis.GeometricElement3dHasTypeDefinition relType
    JOIN meta.ECClassDef classDef ON classDef.ECInstanceId = relType.TargetECClassId
    JOIN meta.ECSchemaDef schemaDef ON schemaDef.ECInstanceId = classDef.Schema.Id
    WHERE relType.SourceECInstanceId = :id`;
  return queryRelatedClasses(db, query, { id: elementId });
}

function queryGeometricElement2dTypeDefinitions(db: IModelDb, elementId: string) {
  const query = `
    SELECT relType.TargetECInstanceId id, '[' || schemaDef.Name || '].[' || classDef.Name || ']' className
    FROM bis.GeometricElement2dHasTypeDefinition relType
    JOIN meta.ECClassDef classDef ON classDef.ECInstanceId = relType.TargetECClassId
    JOIN meta.ECSchemaDef schemaDef ON schemaDef.ECInstanceId = classDef.Schema.Id
    WHERE relType.SourceECInstanceId = :id`;
  return queryRelatedClasses(db, query, { id: elementId });
}

function queryElementLinks(db: IModelDb, elementId: string) {
  const query = `
    SELECT relLink.TargetECInstanceId id, '[' || schemaDef.Name || '].[' || classDef.Name || ']' className
    FROM bis.ElementHasLinks relLink
    JOIN meta.ECClassDef classDef ON classDef.ECInstanceId = relLink.TargetECClassId
    JOIN meta.ECSchemaDef schemaDef ON schemaDef.ECInstanceId = classDef.Schema.Id
    WHERE relLink.SourceECInstanceId = :id`;
  return queryRelatedClasses(db, query, { id: elementId });
}

function queryGroupElementLinks(db: IModelDb, elementId: string) {
  const query = `
    SELECT relLink.TargetECInstanceId id, '[' || schemaDef.Name || '].[' || classDef.Name || ']' className
    FROM bis.ElementHasLinks relLink
    JOIN bis.ElementGroupsMembers relElementGroup ON relElementGroup.SourceECInstanceId = relLink.SourceECInstanceId
    JOIN meta.ECClassDef classDef ON classDef.ECInstanceId = relLink.TargetECClassId
    JOIN meta.ECSchemaDef schemaDef ON schemaDef.ECInstanceId = classDef.Schema.Id
    WHERE relElementGroup.TargetECInstanceId = :id`;
  return queryRelatedClasses(db, query, { id: elementId });
}

function queryModelLinks(db: IModelDb, elementId: string) {
  const query = `
    SELECT relLink.TargetECInstanceId id, '[' || schemaDef.Name || '].[' || classDef.Name || ']' className
    FROM bis.ElementHasLinks relLink
    JOIN bis.ModelModelsElement relModelModels ON relModelModels.TargetECInstanceId = relLink.SourceECInstanceId
    JOIN bis.ModelContainsElements relModelContains ON relModelContains.SourceECInstanceId = relModelModels.SourceECInstanceId
    JOIN meta.ECClassDef classDef ON classDef.ECInstanceId = relLink.TargetECClassId
    JOIN meta.ECSchemaDef schemaDef ON schemaDef.ECInstanceId = classDef.Schema.Id
    WHERE relModelContains.TargetECInstanceId = :id`;
  return queryRelatedClasses(db, query, { id: elementId });
}

function queryDrawingGraphicElements(db: IModelDb, elementId: string) {
  const query = `
    SELECT relRepresents.SourceECInstanceId id, '[' || schemaDef.Name || '].[' || classDef.Name || ']' className
    FROM bis.DrawingGraphicRepresentsElement relRepresents
    JOIN meta.ECClassDef classDef ON classDef.ECInstanceId = relRepresents.SourceECClassId
    JOIN meta.ECSchemaDef schemaDef ON schemaDef.ECInstanceId = classDef.Schema.Id
    WHERE relRepresents.TargetECInstanceId = :id`;
  return queryRelatedClasses(db, query, { id: elementId });
}

function queryGraphicalElement3dElements(db: IModelDb, elementId: string) {
  const query = `
    SELECT relRepresents.SourceECInstanceId id, '[' || schemaDef.Name || '].[' || classDef.Name || ']' className
    FROM bis.GraphicalElement3dRepresentsElement relRepresents
    JOIN meta.ECClassDef classDef ON classDef.ECInstanceId = relRepresents.SourceECClassId
    JOIN meta.ECSchemaDef schemaDef ON schemaDef.ECInstanceId = classDef.Schema.Id
    WHERE relRepresents.TargetECInstanceId = :id`;
  return queryRelatedClasses(db, query, { id: elementId });
}

function queryExternalSourceRepositories(db: IModelDb, elementId: string) {
  const query = `
    SELECT relRepository.TargetECInstanceId id, '[' || schemaDef.Name || '].[' || classDef.Name || ']' className
    FROM bis.ExternalSourceIsInRepository relRepository
    JOIN bis.ElementIsFromSource relFromSource ON relFromSource.TargetECInstanceId = relRepository.SourceECInstanceId
    JOIN bis.ExternalSourceAspect aspect ON aspect.ECInstanceId = relFromSource.SourceECInstanceId
    JOIN meta.ECClassDef classDef ON classDef.ECInstanceId = relRepository.TargetECClassId
    JOIN meta.ECSchemaDef schemaDef ON schemaDef.ECInstanceId = classDef.Schema.Id
    WHERE aspect.Element.Id = :id`;
  return queryRelatedClasses(db, query, { id: elementId });
}

function queryExternalSourceGroupRepositories(db: IModelDb, elementId: string) {
  const query = `
    SELECT relRepository.TargetECInstanceId id, '[' || schemaDef.Name || '].[' || classDef.Name || ']' className
    FROM bis.ExternalSourceIsInRepository relRepository
    JOIN bis.ExternalSourceGroupGroupsSources relGroupSources ON relGroupSources.TargetECInstanceId = relRepository.SourceECInstanceId
    JOIN bis.ElementIsFromSource relFromSource ON relFromSource.TargetECInstanceId = relGroupSources.SourceECInstanceId AND relFromSource.TargetECClassId IS (bis.ExternalSourceGroup)
    JOIN bis.ExternalSourceAspect aspect ON aspect.ECInstanceId = relFromSource.SourceECInstanceId
    JOIN meta.ECClassDef classDef ON classDef.ECInstanceId = relRepository.TargetECClassId
    JOIN meta.ECSchemaDef schemaDef ON schemaDef.ECInstanceId = classDef.Schema.Id
    WHERE aspect.Element.Id = :id`;
  return queryRelatedClasses(db, query, { id: elementId });
}

function queryRelatedClasses(db: IModelDb, query: string, bindings: object) {
  return db.withPreparedStatement(query, (stmt) => {
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
