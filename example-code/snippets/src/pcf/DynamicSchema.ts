/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Schema as MetaSchema, SchemaContext, SchemaLoader, SchemaPropsGetter } from "@itwin/ecschema-metadata";
import { ClassRegistry, Element, ElementAspect, IModelDb, Relationship, Schema, Schemas } from "@itwin/core-backend";
import { AnyDiagnostic, ISchemaChanges, ISchemaCompareReporter, SchemaChanges, SchemaComparer, SchemaContextEditor } from "@itwin/ecschema-editing";
import { MutableSchema } from "@itwin/ecschema-metadata/lib/cjs/Metadata/Schema";
import * as pcf from "./pcf";

export interface DynamicEntityMap {
  entities: {
    props: pcf.ECDynamicEntityClassProps;
    registeredClass?: typeof Element | typeof ElementAspect;
  }[];
  relationships: {
    props: pcf.ECDynamicRelationshipClassProps;
    registeredClass?: typeof Relationship;
  }[];
}

export interface DynamicSchemaProps {
  schemaName: string;
  schemaAlias: string;
  dynamicEntityMap: DynamicEntityMap;
}

export interface SchemaVersion {
  readVersion: number;
  writeVersion: number;
  minorVersion: number;
}

export async function tryGetSchema(db: IModelDb, schemaName: string): Promise<MetaSchema | undefined> {
  const loader = new SchemaLoader((name) => db.getSchemaProps(name));
  const schema = loader.tryGetSchema(schemaName);
  return schema;
}

// __PUBLISH_EXTRACT_START__  DynamicSchema-syncDynamicSchema.example-code
export async function syncDynamicSchema(
  db: IModelDb,
  domainSchemaNames: string[],
  props: DynamicSchemaProps,
): Promise<pcf.ItemState> {

  const { schemaName } = props;
  const existingSchema = await tryGetSchema(db, schemaName);

  const version = getSchemaVersion(db, schemaName);
  const latestSchema = await createDynamicSchema(db, version, domainSchemaNames, props);

  let schemaState: pcf.ItemState = pcf.ItemState.New;
  let dynamicSchema = latestSchema;

  if (existingSchema) {
    const reporter = new DynamicSchemaCompareReporter();
    const comparer = new SchemaComparer(reporter);
    await comparer.compareSchemas(latestSchema, existingSchema);
    const schemaIsChanged = reporter.diagnostics.length > 0;

    if (schemaIsChanged) {
      schemaState = pcf.ItemState.Changed;
      version.minorVersion = existingSchema.minorVersion + 1;
      dynamicSchema = await createDynamicSchema(db, version, domainSchemaNames, props);
    } else {
      schemaState = pcf.ItemState.Unchanged;
      dynamicSchema = existingSchema;
    }
  }

  if (schemaState !== pcf.ItemState.Unchanged) {
    const schemaString = await schemaToXmlString(dynamicSchema);
    await db.importSchemaStrings([schemaString]);
    registerDynamicSchema(props);
  }

  return schemaState;
}
// __PUBLISH_EXTRACT_END__

// __PUBLISH_EXTRACT_START__ DynamicSchema-registerDynamicSchema.example-code
function registerDynamicSchema(props: DynamicSchemaProps) {

  const entitiesModule: any = {};
  for (const entity of props.dynamicEntityMap.entities) {
    if (entity.registeredClass) {
      entitiesModule[entity.registeredClass.className] = entity.registeredClass;
    }
  }

  const relationshipsModule: any = {};
  for (const rel of props.dynamicEntityMap.relationships) {
    if (rel.registeredClass) {
      relationshipsModule[rel.registeredClass.className] = rel.registeredClass;
    }
  }

  const dynamicSchemaClass = class BackendDynamicSchema extends Schema {
    public static override get schemaName(): string {
      return props.schemaName;
    }
    public static registerSchema() {
      if (this !== Schemas.getRegisteredSchema(this.schemaName)) {
        Schemas.unregisterSchema(this.schemaName);
        Schemas.registerSchema(this);
        ClassRegistry.registerModule(entitiesModule, this);
        ClassRegistry.registerModule(relationshipsModule, this);
      }
    }
  };
  dynamicSchemaClass.registerSchema();
}

// __PUBLISH_EXTRACT_END__

//  __PUBLISH_EXTRACT_START__ DynamicSchema-createDynamicSchema.example-code
// Generates an in-memory [Dynamic EC Schema](https://www.itwinjs.org/bis/intro/schema-customization/) from user-defined DMO.
async function createDynamicSchema(
  db: IModelDb,
  version: SchemaVersion,
  domainSchemaNames: string[],
  props: DynamicSchemaProps,
): Promise<MetaSchema> {

  const map = props.dynamicEntityMap;
  const context = new SchemaContext();
  const editor = new SchemaContextEditor(context);

  const createEntityClass = async (schema: MetaSchema) => {
    for (const entity of map.entities) {
      const entityResult = await editor.entities.createFromProps(schema.schemaKey, entity.props);
      if (!entityResult.itemKey)
        throw new Error(`Failed to create EC Entity Class - ${entityResult.errorMessage}`);

      if (entity.props.properties) {
        for (const prop of entity.props.properties) {
          const propResult = await editor.entities.createPrimitiveProperty(entityResult.itemKey, prop.name, prop.type as any);
          if (!propResult.itemKey)
            throw new Error(`Failed to create EC Property - ${propResult.errorMessage}`);
        }
      }
    }
  };

  const createRelClasses = async (schema: MetaSchema) => {
    for (const rel of map.relationships) {
      const result = await editor.relationships.createFromProps(schema.schemaKey, rel.props);
      if (!result.itemKey)
        throw new Error(`Failed to create EC Relationship Class - ${result.errorMessage}`);
    }
  };

  const { schemaName, schemaAlias } = props;
  const newSchema = new MetaSchema(context, schemaName, schemaAlias, version.readVersion, version.writeVersion, version.minorVersion);

  const loader = new SchemaLoader(db as unknown as SchemaPropsGetter);
  const bisSchema = loader.getSchema("BisCore");
  await context.addSchema(newSchema);
  await context.addSchema(bisSchema);
  await (newSchema as MutableSchema).addReference(bisSchema); // TODO remove this hack later

  for (const currSchemaName of domainSchemaNames) {
    const schema = loader.getSchema(currSchemaName);
    await context.addSchema(schema);
    await (newSchema as MutableSchema).addReference(schema);
  }

  await createEntityClass(newSchema);
  await createRelClasses(newSchema);

  return newSchema;
}

// __PUBLISH_EXTRACT_END__

function getSchemaVersion(db: IModelDb, schemaName: string): SchemaVersion {
  const versionStr = db.querySchemaVersion(schemaName);
  if (!versionStr)
    return { readVersion: 1, writeVersion: 0, minorVersion: 0 };
  const [readVersion, writeVersion, minorVersion] = versionStr.split(".").map((v: string) => parseInt(v, 10));
  return { readVersion, writeVersion, minorVersion };
}

async function schemaToXmlString(schema: MetaSchema): Promise<string> {
  let xmlDoc = new DOMParser().parseFromString(`<?xml version="1.0" encoding="UTF-8"?>`, "application/xml");
  xmlDoc = await schema.toXml(xmlDoc);
  const xmlString = new XMLSerializer().serializeToString(xmlDoc);
  return xmlString;
}

class DynamicSchemaCompareReporter implements ISchemaCompareReporter {
  public changes: SchemaChanges[] = [];

  public report(schemaChanges: ISchemaChanges): void {
    this.changes.push(schemaChanges as SchemaChanges);
  }

  public get diagnostics(): AnyDiagnostic [] {
    let diagnostics: AnyDiagnostic [] = [];
    for (const changes of this.changes) {
      diagnostics = diagnostics.concat(changes.allDiagnostics);
    }
    return diagnostics;
  }
}
