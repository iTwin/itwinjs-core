/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Schema
 */

import { Id64String } from "@itwin/core-bentley";
import { ECSqlReader, QueryBinder } from "@itwin/core-common";
import { CustomAttribute, SchemaView } from "@itwin/ecschema-metadata";

/** The raw object shape produced by the native `XmlCAToJson` ECSql function. The custom attribute's
 * own property values are nested under a key whose name equals `ecClass`; `ecClass` and `ecSchema`
 * are an envelope added by the function and not part of the canonical attribute.
 */
interface XmlCustomAttributeJson {
  ecClass: string;
  ecSchema: string;
  [propName: string]: unknown;
}

/** Converts the native `XmlCAToJson` envelope shape into a canonical [[CustomAttribute]]:
 * `{ className, ...values }` with `className` in `SchemaName.ClassName` form.
 */
function toCustomAttribute(raw: XmlCustomAttributeJson): CustomAttribute {
  // ecSchema may carry a version suffix (e.g. "CoreCustomAttributes.01.00.03"); the schema name is
  // the part before the first dot (schema names never contain dots).
  const schemaName = raw.ecSchema.split(".")[0];
  const values = (raw[raw.ecClass] as Record<string, unknown> | undefined) ?? {};
  return { ...values, className: `${schemaName}.${raw.ecClass}` };
}

/** Parse one `XmlCAToJson` cell into a canonical [[CustomAttribute]], or undefined if the cell is null. */
function parseCustomAttributeCell(raw: unknown): CustomAttribute | undefined {
  if (raw === undefined || raw === null)
    return undefined;
  return toCustomAttribute((typeof raw === "string" ? JSON.parse(raw) : raw) as XmlCustomAttributeJson);
}

/** `ec_` meta-table ECInstanceIds are plain row ids; format as a hex Id64 so an `Id`-typed column
 * comparison (e.g. `ContainerId`) is well-typed.
 */
function toId64(rowId: number): Id64String {
  return `0x${rowId.toString(16)}`;
}

/** Resolves the custom attributes applied to the containers in an `IModelSchemaView` by querying the
 * iModel through ConcurrentQuery.
 *
 * Reads the long-stable `meta.CustomAttribute` class (mapped to the `ec_CustomAttribute` table, split
 * on its `ContainerType` column) rather than the newer per-kind `*CustomAttribute` QueryViews, which
 * are absent on older iModel profiles. The native `XmlCAToJson` ECSql function does the XML-to-JSON
 * conversion in the database, where the custom attribute class is available, yielding correctly typed
 * values.
 *
 * No caching: every call runs a live query. This is intentional - the view is read-only and the data
 * lives in the iModel.
 * @internal
 */
export class IModelCustomAttributeProvider implements SchemaView.AsyncCustomAttributeProvider {
  /** @param _createQueryReader Runs an ECSql query through ConcurrentQuery - typically `IModelDb.createQueryReader`. */
  public constructor(private readonly _createQueryReader: (ecsql: string, params?: QueryBinder) => ECSqlReader) {
  }

  public async getSchemaCustomAttributes(schema: SchemaView.Schema): Promise<CustomAttribute[]> {
    return this._queryAll(schema.ecInstanceId, SchemaView.ECDbCAContainerType.Schema);
  }

  public async getClassCustomAttributes(cls: SchemaView.Class): Promise<CustomAttribute[]> {
    return this._queryAll(cls.ecInstanceId, SchemaView.ECDbCAContainerType.Class);
  }

  public async getPropertyCustomAttributes(property: SchemaView.Property): Promise<CustomAttribute[]> {
    return this._queryAll(property.ecInstanceId, SchemaView.ECDbCAContainerType.Property);
  }

  public async getSchemaCustomAttribute(schema: SchemaView.Schema, caClassFullName: string): Promise<CustomAttribute | undefined> {
    return this._queryOne(schema.ecInstanceId, SchemaView.ECDbCAContainerType.Schema, caClassFullName);
  }

  public async getClassCustomAttribute(cls: SchemaView.Class, caClassFullName: string): Promise<CustomAttribute | undefined> {
    return this._queryOne(cls.ecInstanceId, SchemaView.ECDbCAContainerType.Class, caClassFullName);
  }

  public async getPropertyCustomAttribute(property: SchemaView.Property, caClassFullName: string): Promise<CustomAttribute | undefined> {
    return this._queryOne(property.ecInstanceId, SchemaView.ECDbCAContainerType.Property, caClassFullName);
  }

  public async *findSchemasWithCustomAttribute(caClassFullName: string, options?: SchemaView.FindCustomAttributeOptions): AsyncIterableIterator<SchemaView.SchemaCustomAttributeMatch> {
    const includeData = !options?.identifiersOnly;
    const reader = this._createFindReader(
      `SELECT [s].[Name]${includeData ? this._dataColumn : ""}
       FROM [meta].[CustomAttribute] [ca]
       JOIN [meta].[ECSchemaDef] [s] ON [s].[ECInstanceId] = [ca].[ContainerId]
       WHERE [ca].[ContainerType] = ${SchemaView.ECDbCAContainerType.Schema} AND [ca].[Class].[Id] = ec_classid(?)
       ORDER BY [s].[Name], [ca].[Ordinal]`,
      caClassFullName,
    );
    for await (const row of reader)
      yield { schemaName: row[0], customAttribute: includeData ? parseCustomAttributeCell(row[1]) : undefined };
  }

  public async *findClassesWithCustomAttribute(caClassFullName: string, options?: SchemaView.FindCustomAttributeOptions): AsyncIterableIterator<SchemaView.ClassCustomAttributeMatch> {
    const includeData = !options?.identifiersOnly;
    const reader = this._createFindReader(
      `SELECT [s].[Name], [c].[Name]${includeData ? this._dataColumn : ""}
       FROM [meta].[CustomAttribute] [ca]
       JOIN [meta].[ECClassDef] [c] ON [c].[ECInstanceId] = [ca].[ContainerId]
       JOIN [meta].[ECSchemaDef] [s] ON [s].[ECInstanceId] = [c].[Schema].[Id]
       WHERE [ca].[ContainerType] = ${SchemaView.ECDbCAContainerType.Class} AND [ca].[Class].[Id] = ec_classid(?)
       ORDER BY [s].[Name], [c].[Name], [ca].[Ordinal]`,
      caClassFullName,
    );
    for await (const row of reader)
      yield { schemaName: row[0], className: row[1], customAttribute: includeData ? parseCustomAttributeCell(row[2]) : undefined };
  }

  public async *findPropertiesWithCustomAttribute(caClassFullName: string, options?: SchemaView.FindCustomAttributeOptions): AsyncIterableIterator<SchemaView.PropertyCustomAttributeMatch> {
    const includeData = !options?.identifiersOnly;
    const reader = this._createFindReader(
      `SELECT [s].[Name], [c].[Name], [p].[Name]${includeData ? this._dataColumn : ""}
       FROM [meta].[CustomAttribute] [ca]
       JOIN [meta].[ECPropertyDef] [p] ON [p].[ECInstanceId] = [ca].[ContainerId]
       JOIN [meta].[ECClassDef] [c] ON [c].[ECInstanceId] = [p].[Class].[Id]
       JOIN [meta].[ECSchemaDef] [s] ON [s].[ECInstanceId] = [c].[Schema].[Id]
       WHERE [ca].[ContainerType] = ${SchemaView.ECDbCAContainerType.Property} AND [ca].[Class].[Id] = ec_classid(?)
       ORDER BY [s].[Name], [c].[Name], [p].[Name], [ca].[Ordinal]`,
      caClassFullName,
    );
    for await (const row of reader)
      yield { schemaName: row[0], className: row[1], propertyName: row[2], customAttribute: includeData ? parseCustomAttributeCell(row[3]) : undefined };
  }

  /** The trailing `XmlCAToJson` projection, prefixed with a comma, appended to a `find*` SELECT when
   * the caller wants the attribute value (not just identifiers). */
  private readonly _dataColumn = `, XmlCAToJson([ca].[Class].[Id], [ca].[Instance])`;

  private async _queryAll(containerId: number, containerType: SchemaView.ECDbCAContainerType): Promise<CustomAttribute[]> {
    const binder = new QueryBinder();
    binder.bindId(1, toId64(containerId));
    binder.bindInt(2, containerType);

    const reader = this._createQueryReader(
      `SELECT XmlCAToJson([ca].[Class].[Id], [ca].[Instance])
       FROM [meta].[CustomAttribute] [ca]
       WHERE [ca].[ContainerId] = ? AND [ca].[ContainerType] = ?
       ORDER BY [ca].[Ordinal]`,
      binder,
    );

    const result: CustomAttribute[] = [];
    for await (const row of reader) {
      const ca = parseCustomAttributeCell(row[0]);
      if (ca !== undefined)
        result.push(ca);
    }
    return result;
  }

  private async _queryOne(containerId: number, containerType: SchemaView.ECDbCAContainerType, caClassFullName: string): Promise<CustomAttribute | undefined> {
    const binder = new QueryBinder();
    binder.bindId(1, toId64(containerId));
    binder.bindInt(2, containerType);
    binder.bindString(3, caClassFullName);

    // A custom attribute class can be applied at most once per container, so LIMIT 1 is exact.
    const reader = this._createQueryReader(
      `SELECT XmlCAToJson([ca].[Class].[Id], [ca].[Instance])
       FROM [meta].[CustomAttribute] [ca]
       WHERE [ca].[ContainerId] = ? AND [ca].[ContainerType] = ? AND [ca].[Class].[Id] = ec_classid(?)
       LIMIT 1`,
      binder,
    );
    for await (const row of reader)
      return parseCustomAttributeCell(row[0]);
    return undefined;
  }

  private _createFindReader(ecsql: string, caClassFullName: string): ECSqlReader {
    const binder = new QueryBinder();
    binder.bindString(1, caClassFullName);
    return this._createQueryReader(ecsql, binder);
  }
}

