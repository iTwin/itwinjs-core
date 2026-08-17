/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import { EOL } from "os";
import {
  _nativeDb, BriefcaseDb, BriefcaseManager, ChannelControl, CloudSqlite, DrawingCategory, IModelDb, SchemaSync, SnapshotDb, SqliteStatement, SqliteValueType,
} from "@itwin/core-backend";
import { HubMock } from "@itwin/core-backend/lib/cjs/internal/HubMock";
import { IModelTestUtils, KnownTestLocations, withEditTxn } from "@itwin/core-backend/lib/cjs/test";
import { AccessToken, DbResult, Guid, GuidString, Id64String } from "@itwin/core-bentley";
import { ChangesetType, Code, ElementProps, GeometricElement2dProps, GeometryStreamProps, IModel, SubCategoryAppearance } from "@itwin/core-common";
import { Arc3d, IModelJson, Point3d } from "@itwin/core-geometry";
import { AzuriteTest } from "./AzuriteTest";

export const schemaSyncStorageType = "azure";

/* ------------------------------------------------------------------------------------------------
 * Schema authoring
 * ---------------------------------------------------------------------------------------------- */

export interface TinySchemaRef {
  name: string;
  ver: string;
  alias: string;
}

export interface TinyPrimitiveProp {
  kind: "primitive";
  name: string;
  type: "string" | "int" | "double" | "long" | "boolean" | "dateTime" | "point2d" | "point3d";
}

export interface TinyStructProp {
  kind: "struct";
  name: string;
  type: string;
}

export interface TinyNavigationProp {
  kind: "navigation";
  name: string;
  relationship: string;
  direction: "Forward" | "Backward";
}

export type TinyProp = TinyPrimitiveProp | TinyStructProp | TinyNavigationProp;

export interface TinyClass {
  /** A mixin is written as an abstract entity class carrying the IsMixin custom attribute. */
  type: "entity" | "struct" | "mixin";
  name: string;
  baseClass?: string;
  /** Required for a mixin, ignored otherwise. */
  appliesTo?: string;
  modifier?: "Abstract" | "Sealed" | "None";
  /** Mixins this entity class implements, written as additional base classes. */
  mixins?: string[];
  props?: TinyProp[];
  /** Written verbatim inside the class element, for anything the builder does not model. */
  rawXml?: string;
}

export interface TinySchema extends TinySchemaRef {
  refs?: TinySchemaRef[];
  classes?: TinyClass[];
  /** Written verbatim inside the schema element, for relationships, enumerations and the like. */
  rawXml?: string[];
  /** Mark the schema dynamic. A dynamic schema may raise its read version, which any deletion needs. */
  dynamic?: boolean;
  /** Defaults to 3.2. Existing tests that were written against 3.1 pass it explicitly. */
  ecXmlVersion?: "3.1" | "3.2";
}

const propToXml = (p: TinyProp, indent: string): string => {
  switch (p.kind) {
    case "primitive":
      return `${indent}<ECProperty propertyName="${p.name}" typeName="${p.type}" />`;
    case "struct":
      return `${indent}<ECStructProperty propertyName="${p.name}" typeName="${p.type}" />`;
    case "navigation":
      return `${indent}<ECNavigationProperty propertyName="${p.name}" relationshipName="${p.relationship}" direction="${p.direction}" />`;
  }
};

/** Build the ECSchema XML for a [[TinySchema]]. */
export const tinySchemaToXml = (s: TinySchema): string => {
  const xml: string[] = [];
  const pad = (i: number) => "".padEnd(i * 4, " ");
  xml.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  xml.push(`<ECSchema schemaName="${s.name}" alias="${s.alias}" version="${s.ver}" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.${s.ecXmlVersion ?? "3.2"}">`);
  for (const ref of s.refs ?? [])
    xml.push(`${pad(1)}<ECSchemaReference name="${ref.name}" version="${ref.ver}" alias="${ref.alias}"/>`);

  if (s.dynamic) {
    xml.push(`${pad(1)}<ECSchemaReference name="CoreCustomAttributes" version="01.00.03" alias="CoreCA"/>`);
    xml.push(`${pad(1)}<ECCustomAttributes>`);
    xml.push(`${pad(2)}<DynamicSchema xmlns="CoreCustomAttributes.01.00.03"/>`);
    xml.push(`${pad(1)}</ECCustomAttributes>`);
  }

  for (const c of s.classes ?? []) {
    const classType = c.type === "struct" ? "ECStructClass" : "ECEntityClass";
    const modifier = c.modifier ?? (c.type === "mixin" ? "Abstract" : undefined);
    xml.push(`${pad(1)}<${classType} typeName="${c.name}"${modifier ? ` modifier="${modifier}"` : ""}>`);
    if (c.type === "mixin") {
      if (undefined === c.appliesTo)
        throw new Error(`mixin ${c.name} needs appliesTo`);
      xml.push(`${pad(2)}<ECCustomAttributes>`);
      xml.push(`${pad(3)}<IsMixin xmlns="CoreCustomAttributes.01.00.03">`);
      xml.push(`${pad(4)}<AppliesToEntityClass>${c.appliesTo}</AppliesToEntityClass>`);
      xml.push(`${pad(3)}</IsMixin>`);
      xml.push(`${pad(2)}</ECCustomAttributes>`);
    }
    if (c.baseClass)
      xml.push(`${pad(2)}<BaseClass>${c.baseClass}</BaseClass>`);
    for (const mixin of c.mixins ?? [])
      xml.push(`${pad(2)}<BaseClass>${mixin}</BaseClass>`);
    for (const p of c.props ?? [])
      xml.push(propToXml(p, pad(2)));
    if (c.rawXml)
      xml.push(c.rawXml);
    xml.push(`${pad(1)}</${classType}>`);
  }

  for (const raw of s.rawXml ?? [])
    xml.push(raw);

  xml.push(`</ECSchema>`);
  return xml.join(EOL);
};

/** Import a [[TinySchema]] through the same front door an app uses. */
export const importTinySchema = async (b: BriefcaseDb, s: TinySchema): Promise<void> => {
  await b.importSchemaStrings([tinySchemaToXml(s)]);
};

/* ------------------------------------------------------------------------------------------------
 * Assertions on things that throw
 * ---------------------------------------------------------------------------------------------- */

export async function assertThrowsAsync<T>(test: () => Promise<T>, msg?: string): Promise<void> {
  try {
    await test();
  } catch (e) {
    if (e instanceof Error && msg)
      assert.equal(e.message, msg);
    return;
  }
  throw new Error(`Failed to throw error with message: "${msg}"`);
}

export async function assertThrowsAsyncContaining<T>(test: () => Promise<T>, msg: string): Promise<void> {
  try {
    await test();
  } catch (e) {
    if (e instanceof Error)
      expect(e.message).to.contain(msg);
    return;
  }
  throw new Error(`Failed to throw error containing: "${msg}"`);
}

/* ------------------------------------------------------------------------------------------------
 * iModel, briefcase and container setup
 * ---------------------------------------------------------------------------------------------- */

/** Create an Azurite container and seed it with an empty SchemaSyncDb. */
export async function initializeContainer(containerProps: { containerId: string, isPublic?: boolean, baseUri: string }) {
  await AzuriteTest.Sqlite.createAzContainer(containerProps);
  const accessToken = await CloudSqlite.requestToken({ ...containerProps });
  await SchemaSync.CloudAccess.initializeDb({ ...containerProps, accessToken, storageType: schemaSyncStorageType });
  return { ...containerProps, accessToken, storageType: schemaSyncStorageType } as const;
}

export interface TestIModel {
  iTwinId: GuidString;
  iModelId: GuidString;
}

/** Start HubMock and create an empty iModel in it. The caller's suite is responsible for HubMock.shutdown. */
export async function createTestIModel(args: { iModelName: string, accessToken?: AccessToken }): Promise<TestIModel> {
  const iTwinId = Guid.createValue();
  HubMock.startup("test", KnownTestLocations.outputDir);
  const version0 = IModelTestUtils.prepareOutputFile("schemaSync", `${args.iModelName}.bim`);
  SnapshotDb.createEmpty(version0, { rootSubject: { name: args.iModelName } }).close();
  const iModelId = await HubMock.createNewIModel({
    accessToken: args.accessToken ?? "test token",
    iTwinId,
    version0,
    iModelName: args.iModelName,
  });
  return { iTwinId, iModelId };
}

export interface OpenTestBriefcaseArgs extends TestIModel {
  accessToken: AccessToken;
  /** Every briefcase needs its own CloudSqlite cache, or they share the sync db's local copy. Ignored for a readonly briefcase, which cannot store it. */
  cacheName?: string;
  readonly?: boolean;
  /** Defaults to true. Inserting into the dictionary model or a new partition needs the shared channel. */
  allowSharedChannel?: boolean;
}

/** Download a briefcase and open it, ready for schema sync work. */
export async function openTestBriefcase(args: OpenTestBriefcaseArgs): Promise<BriefcaseDb> {
  const props = await BriefcaseManager.downloadBriefcase({ iModelId: args.iModelId, iTwinId: args.iTwinId, accessToken: args.accessToken });
  const b = args.readonly
    ? await BriefcaseDb.open({ fileName: props.fileName, readonly: true })
    : await BriefcaseDb.open(props);
  if (args.cacheName && !args.readonly)
    SchemaSync.setTestCache(b, args.cacheName);
  if (!args.readonly && (args.allowSharedChannel ?? true))
    b.channels.addAllowedChannel(ChannelControl.sharedChannelName);
  return b;
}

/** Reopen a briefcase that is already downloaded, without going back to the hub. */
export async function reopenTestBriefcase(fileName: string, args?: { cacheName?: string, readonly?: boolean, allowSharedChannel?: boolean }): Promise<BriefcaseDb> {
  const b = await BriefcaseDb.open({ fileName, readonly: args?.readonly });
  if (args?.cacheName && !args.readonly)
    SchemaSync.setTestCache(b, args.cacheName);
  if (!args?.readonly && (args?.allowSharedChannel ?? true))
    b.channels.addAllowedChannel(ChannelControl.sharedChannelName);
  return b;
}

/** Seed the container from this briefcase and put the resulting changeset on the timeline. */
export async function enableSchemaSync(b: BriefcaseDb, containerProps: CloudSqlite.ContainerProps): Promise<void> {
  await SchemaSync.initializeForIModel({ iModel: b, containerProps });
  assert.isTrue(SchemaSync.isEnabled(b), "schema sync did not come out enabled");
}

/* ------------------------------------------------------------------------------------------------
 * Reading state back out
 * ---------------------------------------------------------------------------------------------- */

/** The property names an ECClass carries, in declaration order. */
export const queryPropNames = (b: IModelDb, classFullName: string): string[] => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    return Object.getOwnPropertyNames(b.getMetaData(classFullName).properties);
  } catch { return []; }
};

export const queryProfileVer = (db: IModelDb): string => {
  return db.withPreparedSqliteStatement("SELECT StrData FROM be_Prop WHERE Namespace='ec_Db' AND Name='SchemaVersion'", (stmt: SqliteStatement) => {
    return stmt.step() === DbResult.BE_SQLITE_ROW ? stmt.getValue(0).getString() : "";
  });
};

export const querySchemaSyncDataVer = (b: IModelDb): string | undefined => {
  const js = b.queryFilePropertyString({ namespace: "ec_Db", name: "localDbInfo" });
  return js ? JSON.parse(js).dataVer : undefined;
};

export const assertChangesetTypeAndDescr = async (b: BriefcaseDb, changesetType: ChangesetType, description: string): Promise<void> => {
  const cs = await HubMock.getLatestChangeset({ iModelId: b.iModelId });
  expect(cs.changesType).is.eq(changesetType);
  expect(cs.description).is.eq(description);
};

/* ------------------------------------------------------------------------------------------------
 * Oracles: two briefcases that reached the same schema must hold the same file
 * ---------------------------------------------------------------------------------------------- */

const serializeSqliteRow = (stmt: SqliteStatement): string => {
  const parts: string[] = [];
  for (let i = 0; i < stmt.getColumnCount(); ++i) {
    const value = stmt.getValue(i);
    if (value.isNull) {
      parts.push(`${value.columnName}=null`);
    } else if (value.type === SqliteValueType.Blob) {
      parts.push(`${value.columnName}=blob(${Buffer.from(value.getBlob()).toString("base64")})`);
    } else {
      parts.push(`${value.columnName}=${String(value.value)}`);
    }
  }
  return parts.join("|");
};

/** Every row of a table, serialized and sorted so two files can be compared without an ordering assumption. */
export const readTableRows = (db: IModelDb, tableName: string): string[] => {
  const rows: string[] = [];
  db.withPreparedSqliteStatement(`SELECT * FROM [${tableName}]`, (stmt: SqliteStatement) => {
    while (stmt.step() === DbResult.BE_SQLITE_ROW)
      rows.push(serializeSqliteRow(stmt));
  });
  return rows.sort();
};

/** The `ec_` tables a file holds. The derived `ec_cache_` ones are excluded unless asked for. */
export const listMetadataTables = (db: IModelDb, options?: { cacheTablesOnly?: boolean }): string[] => {
  const like = options?.cacheTablesOnly ? "ec\\_cache\\_%" : "ec\\_%";
  const tables: string[] = [];
  db.withPreparedSqliteStatement(`SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '${like}' ESCAPE '\\' ORDER BY name`, (stmt: SqliteStatement) => {
    while (stmt.step() === DbResult.BE_SQLITE_ROW) {
      const name = stmt.getValue(0).getString();
      if (options?.cacheTablesOnly || !name.startsWith("ec_cache_"))
        tables.push(name);
    }
  });
  return tables;
};

const reportRowDifference = (a: string[], b: string[], table: string, context: string, labelA: string, labelB: string): void => {
  const onlyInA = a.filter((row) => !b.includes(row)).slice(0, 5);
  const onlyInB = b.filter((row) => !a.includes(row)).slice(0, 5);
  const detail = [
    `${table} differs ${context}`,
    ...onlyInA.map((row) => `  only in ${labelA}: ${row}`),
    ...onlyInB.map((row) => `  only in ${labelB}: ${row}`),
  ].join(EOL);
  assert.fail(detail);
};

/** Two files that reached the same schema must hold the same `ec_` rows. */
export const expectMetadataTablesIdentical = (a: IModelDb, b: IModelDb, context: string, labels: { a: string, b: string } = { a: "a", b: "b" }): void => {
  const tablesA = listMetadataTables(a);
  const tablesB = listMetadataTables(b);
  assert.deepEqual(tablesA, tablesB, `the two files hold different ec_ tables ${context}`);
  for (const table of tablesA) {
    const rowsA = readTableRows(a, table);
    const rowsB = readTableRows(b, table);
    if (rowsA.length !== rowsB.length || rowsA.some((row, i) => row !== rowsB[i]))
      reportRowDifference(rowsA, rowsB, table, context, labels.a, labels.b);
  }
};

/** The cache tables are regenerated locally and their ids are positional, so two files must still agree. */
export const expectCacheTablesIdentical = (a: IModelDb, b: IModelDb, context: string, labels: { a: string, b: string } = { a: "a", b: "b" }): void => {
  const tablesA = listMetadataTables(a, { cacheTablesOnly: true });
  const tablesB = listMetadataTables(b, { cacheTablesOnly: true });
  assert.deepEqual(tablesA, tablesB, `the two files hold different ec_cache_ tables ${context}`);
  assert.isNotEmpty(tablesA, `no ec_cache_ tables to compare ${context}`);
  for (const table of tablesA) {
    const rowsA = readTableRows(a, table);
    const rowsB = readTableRows(b, table);
    if (rowsA.length !== rowsB.length || rowsA.some((row, i) => row !== rowsB[i]))
      reportRowDifference(rowsA, rowsB, table, context, labels.a, labels.b);
  }
};

/** The only oracle that sees foreign keys, indexes and triggers. */
export const expectPhysicalSchemaIdentical = (a: IModelDb, b: IModelDb, context: string): void => {
  const read = (db: IModelDb) => {
    const objects: string[] = [];
    db.withPreparedSqliteStatement("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_stat%' ORDER BY type,name", (stmt: SqliteStatement) => {
      while (stmt.step() === DbResult.BE_SQLITE_ROW)
        objects.push(serializeSqliteRow(stmt));
    });
    return objects;
  };
  const objectsA = read(a);
  const objectsB = read(b);
  const onlyInA = objectsA.filter((o) => !objectsB.includes(o));
  const onlyInB = objectsB.filter((o) => !objectsA.includes(o));
  if (onlyInA.length > 0 || onlyInB.length > 0) {
    assert.fail([
      `the two files have a different physical schema ${context}`,
      ...onlyInA.slice(0, 5).map((o) => `  only in a: ${o}`),
      ...onlyInB.slice(0, 5).map((o) => `  only in b: ${o}`),
    ].join(EOL));
  }
};

export const expectNoForeignKeyViolations = (db: IModelDb, context: string): void => {
  const violations: string[] = [];
  db.withPreparedSqliteStatement("PRAGMA foreign_key_check", (stmt: SqliteStatement) => {
    while (stmt.step() === DbResult.BE_SQLITE_ROW)
      violations.push(serializeSqliteRow(stmt));
  });
  assert.isEmpty(violations, `foreign key violations ${context}: ${violations.slice(0, 5).join(EOL)}`);
};

/* ------------------------------------------------------------------------------------------------
 * Data, written and read the way a consumer does
 * ---------------------------------------------------------------------------------------------- */

export interface DrawingModelAndCategory {
  drawingModelId: Id64String;
  drawingCategoryId: Id64String;
}

/** Create a drawing partition, its model and one category, taking the locks each step needs. */
export async function insertDrawingModelAndCategory(b: BriefcaseDb, name: string): Promise<DrawingModelAndCategory> {
  await b.locks.acquireLocks({ shared: IModel.dictionaryId });
  const codeProps = Code.createEmpty();
  codeProps.value = `${name}Model`;
  const [, drawingModelId] = withEditTxn(b, (txn) => IModelTestUtils.createAndInsertDrawingPartitionAndModel(txn, codeProps, true));
  const existing = DrawingCategory.queryCategoryIdByName(b, IModel.dictionaryId, `${name}Category`);
  const drawingCategoryId = existing ?? withEditTxn(b, (txn) => DrawingCategory.insert(txn, IModel.dictionaryId, `${name}Category`, new SubCategoryAppearance()));
  await b.locks.acquireLocks({ shared: drawingModelId });
  return { drawingModelId, drawingCategoryId };
}

/** An arc geometry stream, so inserted elements look like real ones. */
export const makeGeometryStream = (): GeometryStreamProps => {
  const geometry = [
    Arc3d.createXY(Point3d.create(0, 0), 5),
    Arc3d.createXY(Point3d.create(5, 5), 2),
  ];
  return geometry.map((g) => IModelJson.Writer.toIModelJson(g));
};

/** An element's properties, plus whatever the test's own schema added. */
export type TestElementProps = GeometricElement2dProps & { [propertyName: string]: any };

export interface InsertElementArgs extends DrawingModelAndCategory {
  classFullName: string;
  /** The class' own properties. */
  props?: { [name: string]: any };
  userLabel?: string;
}

/** Insert a GeometricElement2d subclass instance, taking the shared lock on its model. */
export async function insertGeometricElement2d(b: BriefcaseDb, args: InsertElementArgs): Promise<Id64String> {
  await b.locks.acquireLocks({ shared: args.drawingModelId });
  const props: TestElementProps = {
    classFullName: args.classFullName,
    model: args.drawingModelId,
    category: args.drawingCategoryId,
    code: Code.createEmpty(),
    userLabel: args.userLabel,
    geom: makeGeometryStream(),
    ...args.props,
  };
  return withEditTxn(b, (txn) => txn.insertElement(props));
}

/** Update an element the way an app does: read the props, merge, write back. */
export async function updateElementProps(b: BriefcaseDb, id: Id64String, props: { [name: string]: any }): Promise<void> {
  await b.locks.acquireLocks({ exclusive: id });
  withEditTxn(b, (txn) => {
    txn.updateElement({ ...b.elements.getElementProps(id), ...props });
  });
}

export async function deleteElementById(b: BriefcaseDb, id: Id64String): Promise<void> {
  await b.locks.acquireLocks({ exclusive: id });
  withEditTxn(b, (txn) => txn.deleteElement(id));
}

/** The value of one property on one element, or undefined if the element is gone. */
export const readElementProp = (db: IModelDb, id: Id64String, propName: string): any => {
  try {
    return db.elements.getElementProps<TestElementProps>(id)[propName];
  } catch { return undefined; }
};

/* ------------------------------------------------------------------------------------------------
 * Census: did a schema change lose data
 * ---------------------------------------------------------------------------------------------- */

/** Every instance of the named classes, keyed by class and element id. */
export interface ElementCensus {
  [classFullName: string]: { [id: string]: ElementProps };
}

/** Read every instance of each class, so the same read after a schema change can be compared against it. */
export async function takeElementCensus(db: IModelDb, classFullNames: string[]): Promise<ElementCensus> {
  const census: ElementCensus = {};
  for (const classFullName of classFullNames) {
    const rows = await db.createQueryReader(`SELECT ECInstanceId FROM ONLY ${classFullName}`).toArray();
    const instances: { [id: string]: ElementProps } = {};
    for (const row of rows) {
      const id = row[0] as Id64String;
      instances[id] = db.elements.getElementProps(id);
    }
    census[classFullName] = instances;
  }
  return census;
}

export interface CensusComparison {
  /** Properties the schema change was meant to remove. Their disappearance is not reported. */
  removedProperties?: string[];
}

/**
 * Assert that every instance the earlier census held still exists with the same values.
 *
 * Properties that appeared read as undefined in the earlier census and are ignored, so a test that
 * adds a property needs no bookkeeping. Properties that disappeared are reported unless named in
 * `removedProperties`.
 */
export function expectCensusPreserved(before: ElementCensus, after: ElementCensus, context: string, options?: CensusComparison): void {
  const removed = new Set(options?.removedProperties ?? []);
  for (const [classFullName, instances] of Object.entries(before)) {
    const afterInstances = after[classFullName];
    assert.isDefined(afterInstances, `every instance of ${classFullName} is gone ${context}`);
    for (const [id, props] of Object.entries(instances)) {
      const afterProps = afterInstances[id] as TestElementProps;
      assert.isDefined(afterProps, `${classFullName} instance ${id} is gone ${context}`);
      for (const [propName, value] of Object.entries(props as TestElementProps)) {
        if (removed.has(propName))
          continue;
        const afterValue = afterProps[propName];
        if (undefined === afterValue && undefined !== value) {
          assert.fail(`${classFullName}.${propName} disappeared on instance ${id} ${context}`);
        }
        assert.deepEqual(afterValue, value, `${classFullName}.${propName} changed on instance ${id} ${context}`);
      }
    }
  }
}
