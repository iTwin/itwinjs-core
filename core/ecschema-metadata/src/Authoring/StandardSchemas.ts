/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Schema
 */

// Custom attribute property names are real ECSchema identifiers (PascalCase), so the EC naming is
// intentional here.
/* eslint-disable @typescript-eslint/naming-convention */

import { CustomAttributeContainerType, PrimitiveType } from "../ECObjects";
import { CustomAttributeProps, CustomAttributeValues, SchemaDocument, SchemaSet } from "./SchemaDocument";

/**
 * Built-in definitions of the standard custom attribute classes, and typed helpers for applying
 * them.
 *
 * A custom attribute's values can only be converted between ECXML and the document's typed form
 * with its custom attribute class in hand. Requiring `CoreCustomAttributes` and `ECDbMap` to be
 * loaded into a schema set before a `QueryView` query or an `IsMixin` can be read would be chatty
 * for no gain - their shapes are known and stable. So the two schemas ship here as documents
 * carrying just their custom attribute classes and the struct classes and enumerations those refer
 * to, and custom attribute class resolution falls back to them.
 *
 * **Fallback only.** A class the document's own schema set resolves always wins, so a schema that
 * legitimately upgrades or redefines one of these is never shadowed. Labels, descriptions, and
 * everything else that does not affect conversion are left out - these are shapes, not copies.
 * `StandardSchemas.test.ts` asserts they still match the published `@bentley/*-schema` packages.
 */

let standardSchemas: SchemaSet | undefined;

/** The built-in standard schemas, built once on first use.
 * @internal
 */
export function getStandardSchemas(): SchemaSet {
  if (standardSchemas === undefined) {
    standardSchemas = new SchemaSet();
    buildCoreCustomAttributes(standardSchemas);
    buildECDbMap(standardSchemas);
  }
  return standardSchemas;
}

function buildCoreCustomAttributes(set: SchemaSet): SchemaDocument {
  const doc = set.createSchema("CoreCustomAttributes", "CoreCA", 1, 0, 4);

  const dateTimeKind = doc.createEnumeration("DateTimeKind", "string");
  for (const value of ["Unspecified", "Utc", "Local"])
    dateTimeKind.createEnumerator(value, value);
  const dateTimeComponent = doc.createEnumeration("DateTimeComponent", "string");
  for (const value of ["DateTime", "Date", "TimeOfDay"])
    dateTimeComponent.createEnumerator(value, value);
  const productionStatusValue = doc.createEnumeration("ProductionStatusValue", "string");
  for (const value of ["NotForProduction", "FieldTesting", "Production", "Deprecated"])
    productionStatusValue.createEnumerator(value, value);

  const schemaNameAndPurpose = doc.createStructClass("SchemaNameAndPurpose");
  schemaNameAndPurpose.createPrimitive("SchemaName", PrimitiveType.String);
  schemaNameAndPurpose.createPrimitive("Purpose", PrimitiveType.String);

  const schemaReference = doc.createStructClass("SchemaReference");
  schemaReference.createPrimitive("SchemaName", PrimitiveType.String);
  schemaReference.createPrimitive("MajorVersion", PrimitiveType.Integer);
  schemaReference.createPrimitive("MinorVersion", PrimitiveType.Integer);
  schemaReference.createPrimitive("WriteVersion", PrimitiveType.Integer);

  doc.createCustomAttributeClass("DynamicSchema", CustomAttributeContainerType.Schema);
  doc.createCustomAttributeClass("PartialSchema", CustomAttributeContainerType.Schema);
  doc.createCustomAttributeClass("Localizable", CustomAttributeContainerType.PrimitiveProperty);

  doc.createCustomAttributeClass("SupplementalProvenance", CustomAttributeContainerType.Schema)
    .createStructArray("SupplementalSchemaNamesAndPurposes", "SchemaNameAndPurpose");

  const supplementalSchema = doc.createCustomAttributeClass("SupplementalSchema", CustomAttributeContainerType.Schema);
  supplementalSchema.createStruct("PrimarySchemaReference", "SchemaReference");
  supplementalSchema.createPrimitive("Precedence", PrimitiveType.Integer);
  supplementalSchema.createPrimitive("Purpose", PrimitiveType.String);

  const dateTimeInfo = doc.createCustomAttributeClass("DateTimeInfo", CustomAttributeContainerType.PrimitiveProperty | CustomAttributeContainerType.PrimitiveArrayProperty);
  dateTimeInfo.createEnumeration("DateTimeKind", "DateTimeKind");
  dateTimeInfo.createEnumeration("DateTimeComponent", "DateTimeComponent");

  doc.createCustomAttributeClass("ClassHasCurrentTimeStampProperty", CustomAttributeContainerType.EntityClass)
    .createPrimitive("PropertyName", PrimitiveType.String);
  doc.createCustomAttributeClass("IsMixin", CustomAttributeContainerType.EntityClass)
    .createPrimitive("AppliesToEntityClass", PrimitiveType.String);
  doc.createCustomAttributeClass("NotSubclassableInReferencingSchemas", CustomAttributeContainerType.AnyClass)
    .createPrimitiveArray("Exceptions", PrimitiveType.String);
  doc.createCustomAttributeClass("HiddenSchema", CustomAttributeContainerType.Schema)
    .createPrimitive("ShowClasses", PrimitiveType.Boolean);
  doc.createCustomAttributeClass("HiddenClass", CustomAttributeContainerType.AnyClass)
    .createPrimitive("Show", PrimitiveType.Boolean);
  doc.createCustomAttributeClass("HiddenProperty", CustomAttributeContainerType.AnyProperty)
    .createPrimitive("Show", PrimitiveType.Boolean);
  doc.createCustomAttributeClass("Deprecated", CustomAttributeContainerType.Any)
    .createPrimitive("Description", PrimitiveType.String);
  doc.createCustomAttributeClass("Extension", CustomAttributeContainerType.AnyProperty)
    .createPrimitive("Origin", PrimitiveType.String);

  const productionStatus = doc.createCustomAttributeClass("ProductionStatus", CustomAttributeContainerType.Schema);
  productionStatus.createEnumeration("SupportedUse", "ProductionStatusValue");
  productionStatus.createPrimitive("Checksum", PrimitiveType.String);

  return doc;
}

function buildECDbMap(set: SchemaSet): SchemaDocument {
  const doc = set.createSchema("ECDbMap", "ecdbmap", 2, 0, 4);

  const dbIndex = doc.createStructClass("DbIndex");
  dbIndex.createPrimitive("Name", PrimitiveType.String);
  dbIndex.createPrimitive("IsUnique", PrimitiveType.Boolean);
  dbIndex.createPrimitiveArray("Properties", PrimitiveType.String, { minOccurs: 1 });
  dbIndex.createPrimitive("Where", PrimitiveType.String);

  const classAndRelationship = CustomAttributeContainerType.EntityClass | CustomAttributeContainerType.RelationshipClass;

  doc.createCustomAttributeClass("SchemaMap", CustomAttributeContainerType.Schema)
    .createPrimitive("TablePrefix", PrimitiveType.String);

  const classMap = doc.createCustomAttributeClass("ClassMap", classAndRelationship);
  classMap.createPrimitive("MapStrategy", PrimitiveType.String);
  classMap.createPrimitive("TableName", PrimitiveType.String);
  classMap.createPrimitive("ECInstanceIdColumn", PrimitiveType.String);

  doc.createCustomAttributeClass("JoinedTablePerDirectSubclass", CustomAttributeContainerType.EntityClass);
  doc.createCustomAttributeClass("ForeignKeyView", CustomAttributeContainerType.RelationshipClass);

  const shareColumns = doc.createCustomAttributeClass("ShareColumns", classAndRelationship);
  shareColumns.createPrimitive("ApplyToSubclassesOnly", PrimitiveType.Boolean);
  shareColumns.createPrimitive("MaxSharedColumnsBeforeOverflow", PrimitiveType.Integer);

  doc.createCustomAttributeClass("DbIndexList", classAndRelationship)
    .createStructArray("Indexes", "DbIndex", { minOccurs: 1 });

  const propertyMap = doc.createCustomAttributeClass("PropertyMap", CustomAttributeContainerType.PrimitiveProperty);
  propertyMap.createPrimitive("ColumnName", PrimitiveType.String);
  propertyMap.createPrimitive("IsNullable", PrimitiveType.Boolean);
  propertyMap.createPrimitive("IsUnique", PrimitiveType.Boolean);
  propertyMap.createPrimitive("Collation", PrimitiveType.String);

  const foreignKeyConstraint = doc.createCustomAttributeClass("ForeignKeyConstraint", CustomAttributeContainerType.NavigationProperty);
  foreignKeyConstraint.createPrimitive("OnDeleteAction", PrimitiveType.String);
  foreignKeyConstraint.createPrimitive("OnUpdateAction", PrimitiveType.String);

  const linkTable = doc.createCustomAttributeClass("LinkTableRelationshipMap", CustomAttributeContainerType.RelationshipClass);
  linkTable.createPrimitive("SourceECInstanceIdColumn", PrimitiveType.String);
  linkTable.createPrimitive("TargetECInstanceIdColumn", PrimitiveType.String);
  linkTable.createPrimitive("CreateForeignKeyConstraints", PrimitiveType.Boolean);
  linkTable.createPrimitive("AllowDuplicateRelationships", PrimitiveType.Boolean);

  doc.createCustomAttributeClass("ImportRequiresVersion", CustomAttributeContainerType.Schema)
    .createPrimitive("ECDbRuntimeVersion", PrimitiveType.String);

  const useRequiresVersion = doc.createCustomAttributeClass("UseRequiresVersion", CustomAttributeContainerType.AnyClass);
  useRequiresVersion.createPrimitive("ECDbRuntimeVersion", PrimitiveType.String);
  useRequiresVersion.createPrimitive("ECSqlVersion", PrimitiveType.String);

  doc.createCustomAttributeClass("QueryView", CustomAttributeContainerType.EntityClass)
    .createPrimitive("Query", PrimitiveType.String);

  return doc;
}

/** Drops the values a caller left out, so an attribute carries only what was actually set. */
function values(entries: Record<string, string | number | boolean | undefined>): CustomAttributeValues {
  const result: CustomAttributeValues = {};
  for (const [name, value] of Object.entries(entries)) {
    if (value !== undefined)
      result[name] = value;
  }
  return result;
}

/** Typed constructors for the custom attributes of `CoreCustomAttributes`. Each returns the shape
 * {@link CustomAttributeSet.add} takes, with the property names and value types checked at compile
 * time rather than at serialization time:
 *
 * ```ts
 * pump.customAttributes.add(CoreCustomAttributes.hiddenClass({ show: false }));
 * ```
 * @alpha
 */
export namespace CoreCustomAttributes {
  /** Marks a schema as generated at runtime rather than authored. */
  export function dynamicSchema(): CustomAttributeProps {
    return { className: "CoreCustomAttributes.DynamicSchema", values: {} };
  }
  /** Marks a schema as one part of a schema split across several files. */
  export function partialSchema(): CustomAttributeProps {
    return { className: "CoreCustomAttributes.PartialSchema", values: {} };
  }
  /** Marks a class as a mixin, naming the entity class it may be applied to. */
  export function isMixin(props: { appliesToEntityClass: string }): CustomAttributeProps {
    return { className: "CoreCustomAttributes.IsMixin", values: { AppliesToEntityClass: props.appliesToEntityClass } };
  }
  /** Hides a schema's classes from UI. `showClasses` set to `true` explicitly shows them. */
  export function hiddenSchema(props?: { showClasses?: boolean }): CustomAttributeProps {
    return { className: "CoreCustomAttributes.HiddenSchema", values: values({ ShowClasses: props?.showClasses }) };
  }
  /** Hides a class from UI. `show` set to `true` explicitly shows it. */
  export function hiddenClass(props?: { show?: boolean }): CustomAttributeProps {
    return { className: "CoreCustomAttributes.HiddenClass", values: values({ Show: props?.show }) };
  }
  /** Hides a property from UI. `show` set to `true` explicitly shows it. */
  export function hiddenProperty(props?: { show?: boolean }): CustomAttributeProps {
    return { className: "CoreCustomAttributes.HiddenProperty", values: values({ Show: props?.show }) };
  }
  /** Marks anything as deprecated, with an optional explanation. */
  export function deprecated(props?: { description?: string }): CustomAttributeProps {
    return { className: "CoreCustomAttributes.Deprecated", values: values({ Description: props?.description }) };
  }
  /** Declares how a `dateTime` property's values are to be interpreted. */
  export function dateTimeInfo(props?: { dateTimeKind?: "Unspecified" | "Utc" | "Local", dateTimeComponent?: "DateTime" | "Date" | "TimeOfDay" }): CustomAttributeProps {
    return { className: "CoreCustomAttributes.DateTimeInfo", values: values({ DateTimeKind: props?.dateTimeKind, DateTimeComponent: props?.dateTimeComponent }) };
  }
  /** Names the property an entity class stamps with the current time on every change. */
  export function classHasCurrentTimeStampProperty(props: { propertyName: string }): CustomAttributeProps {
    return { className: "CoreCustomAttributes.ClassHasCurrentTimeStampProperty", values: { PropertyName: props.propertyName } };
  }
  /** Forbids subclassing outside this schema, except by the listed classes. */
  export function notSubclassableInReferencingSchemas(props?: { exceptions?: string[] }): CustomAttributeProps {
    return { className: "CoreCustomAttributes.NotSubclassableInReferencingSchemas", values: props?.exceptions === undefined ? {} : { Exceptions: [...props.exceptions] } };
  }
  /** Declares a schema's fitness for production use. */
  export function productionStatus(props?: { supportedUse?: "NotForProduction" | "FieldTesting" | "Production" | "Deprecated", checksum?: string }): CustomAttributeProps {
    return { className: "CoreCustomAttributes.ProductionStatus", values: values({ SupportedUse: props?.supportedUse, Checksum: props?.checksum }) };
  }
  /** Marks a property as translatable. */
  export function localizable(): CustomAttributeProps {
    return { className: "CoreCustomAttributes.Localizable", values: {} };
  }
}

/** Typed constructors for the custom attributes of `ECDbMap`, which control how a schema's classes
 * and properties are mapped into an ECDb file.
 *
 * ```ts
 * pump.customAttributes.add(ECDbMap.dbIndexList({ indexes: [{ name: "ix_pump_serial", properties: ["SerialNumber"], isUnique: true }] }));
 * ```
 * @alpha
 */
export namespace ECDbMap {
  /** One entry of {@link ECDbMap.dbIndexList}. */
  export interface DbIndex {
    name: string;
    properties: string[];
    isUnique?: boolean;
    where?: string;
  }
  /** Prefixes the tables this schema is mapped to. */
  export function schemaMap(props: { tablePrefix: string }): CustomAttributeProps {
    return { className: "ECDbMap.SchemaMap", values: { TablePrefix: props.tablePrefix } };
  }
  /** Chooses how a class is mapped to tables. */
  export function classMap(props: { mapStrategy?: string, tableName?: string, ecInstanceIdColumn?: string }): CustomAttributeProps {
    return { className: "ECDbMap.ClassMap", values: values({ MapStrategy: props.mapStrategy, TableName: props.tableName, ECInstanceIdColumn: props.ecInstanceIdColumn }) };
  }
  /** Maps each direct subclass to its own joined table. */
  export function joinedTablePerDirectSubclass(): CustomAttributeProps {
    return { className: "ECDbMap.JoinedTablePerDirectSubclass", values: {} };
  }
  /** Maps the properties of a class and its subclasses onto shared columns. */
  export function shareColumns(props?: { applyToSubclassesOnly?: boolean, maxSharedColumnsBeforeOverflow?: number }): CustomAttributeProps {
    return { className: "ECDbMap.ShareColumns", values: values({ ApplyToSubclassesOnly: props?.applyToSubclassesOnly, MaxSharedColumnsBeforeOverflow: props?.maxSharedColumnsBeforeOverflow }) };
  }
  /** Declares the database indexes to create for a class. */
  export function dbIndexList(props: { indexes: DbIndex[] }): CustomAttributeProps {
    return {
      className: "ECDbMap.DbIndexList",
      values: {
        Indexes: props.indexes.map((index) => {
          const entry: CustomAttributeValues = { Name: index.name, Properties: [...index.properties] };
          if (index.isUnique !== undefined)
            entry.IsUnique = index.isUnique;
          if (index.where !== undefined)
            entry.Where = index.where;
          return entry;
        }),
      },
    };
  }
  /** Controls the column a primitive property is mapped to. */
  export function propertyMap(props?: { columnName?: string, isNullable?: boolean, isUnique?: boolean, collation?: string }): CustomAttributeProps {
    return { className: "ECDbMap.PropertyMap", values: values({ ColumnName: props?.columnName, IsNullable: props?.isNullable, IsUnique: props?.isUnique, Collation: props?.collation }) };
  }
  /** Controls the foreign key constraint a navigation property is mapped to. */
  export function foreignKeyConstraint(props?: { onDeleteAction?: string, onUpdateAction?: string }): CustomAttributeProps {
    return { className: "ECDbMap.ForeignKeyConstraint", values: values({ OnDeleteAction: props?.onDeleteAction, OnUpdateAction: props?.onUpdateAction }) };
  }
  /** Maps a relationship class to a link table. */
  export function linkTableRelationshipMap(props?: { sourceECInstanceIdColumn?: string, targetECInstanceIdColumn?: string, createForeignKeyConstraints?: boolean, allowDuplicateRelationships?: boolean }): CustomAttributeProps {
    return {
      className: "ECDbMap.LinkTableRelationshipMap",
      values: values({
        SourceECInstanceIdColumn: props?.sourceECInstanceIdColumn,
        TargetECInstanceIdColumn: props?.targetECInstanceIdColumn,
        CreateForeignKeyConstraints: props?.createForeignKeyConstraints,
        AllowDuplicateRelationships: props?.allowDuplicateRelationships,
      }),
    };
  }
  /** Makes an entity class a read-only view over an ECSQL query. */
  export function queryView(props: { query: string }): CustomAttributeProps {
    return { className: "ECDbMap.QueryView", values: { Query: props.query } };
  }
  /** Makes a relationship class a view derived from navigation properties. */
  export function foreignKeyView(): CustomAttributeProps {
    return { className: "ECDbMap.ForeignKeyView", values: {} };
  }
  /** The minimum ECDb runtime version required to import this schema. */
  export function importRequiresVersion(props: { ecdbRuntimeVersion: string }): CustomAttributeProps {
    return { className: "ECDbMap.ImportRequiresVersion", values: { ECDbRuntimeVersion: props.ecdbRuntimeVersion } };
  }
  /** The minimum ECDb runtime and ECSQL versions required to use this class. */
  export function useRequiresVersion(props?: { ecdbRuntimeVersion?: string, ecsqlVersion?: string }): CustomAttributeProps {
    return { className: "ECDbMap.UseRequiresVersion", values: values({ ECDbRuntimeVersion: props?.ecdbRuntimeVersion, ECSqlVersion: props?.ecsqlVersion }) };
  }
}
