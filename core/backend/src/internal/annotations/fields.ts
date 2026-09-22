/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { FieldPrimitiveValue, FieldPropertyType, FieldRun, FieldValue, formatFieldValue, FormatMagnitude, QueryBinder, QueryRowFormat, RelationshipProps, TextBlock, traverseTextBlockComponent } from "@itwin/core-common";
import { IModelDb } from "../../IModelDb";
import { Id64String, Logger } from "@itwin/core-bentley";
import { BackendLoggerCategory } from "../../BackendLoggerCategory";
import { isITextAnnotation } from "../../annotations/ElementDrivesTextAnnotation";
import { AnyClass, EntityClass, PrimitiveType, Property, PropertyType } from "@itwin/ecschema-metadata";
import type { FieldFormattingSpecProvider } from "../../annotations/FieldFormattingSpecProvider";
import { reshapePropertyValue } from "../ECSqlInstanceReshaper";
import { lookupFieldSpec } from "./fieldSpecs";
import type { EditTxn } from "../../EditTxn";
interface FieldStructValue { [key: string]: any }

// An intermediate value obtained while walking a FieldPropertyPath through the EC schema.
type FieldValueType = {
  primitive: FieldPrimitiveValue;
  struct?: never;
  primitiveArray?: never;
  structArray?: never;
} | {
  primitive?: never;
  struct: FieldStructValue;
  primitiveArray?: never;
  structArray?: never;
} | {
  primitive?: never;
  struct?: never;
  primitiveArray: FieldPrimitiveValue[];
  structArray?: never;
} | {
  primitive?: never;
  struct?: never;
  primitiveArray?: never;
  structArray: FieldStructValue[];
}

/** A (property, containing class) pair identifying where a partially-walked
 * [FieldPropertyPath]($common) currently sits in the EC schema.
 */
interface SchemaCursor {
  readonly ecProp: Property;
  readonly ecClass: AnyClass;
}

/** The per-evaluation state [[updateField]] needs: which element's fields to recompute, how to
 * read a field's property value, and how to format quantities.
 */
export interface UpdateFieldsContext {
  /** When set, only fields whose [FieldPropertyHost.elementId]($common) matches are recomputed —
   * an edit to one source element leaves the annotation's other fields untouched.
   */
  readonly hostElementId: Id64String | undefined;

  /** Reads the value a field points at, or `undefined` if it cannot be resolved — including
   * every field when the source element was deleted.
   */
  getProperty(field: FieldRun): FieldValue | undefined;

  /** Resolves `"quantity"` and `"coordinate"` values through already-built
   * [FormatterSpec]($core-quantity)s. [[updateField]] narrows this to the formats of the
   * FormatSet named by [QuantityFieldFormatOptions.formatSet]($common); anything un-built falls
   * back to `value.toString()` and is recorded in
   * [FieldFormattingSpecProvider.misses]($backend).
   */
  readonly formattingSpecProvider?: FieldFormattingSpecProvider;
}

// Resolves the property a field points at into a [[FieldValue]] — primitive value plus, for
// `"quantity"` / `"coordinate"` types, the property-side KoQ and persistence unit.
function getFieldPropertyValue(field: FieldRun, iModel: IModelDb): FieldValue | undefined {
  const host = field.propertyHost;
  const schemaItem = iModel.schemaContext.getSchemaItemSync(host.schemaName, host.className);
  if (!EntityClass.isEntityClass(schemaItem)) {
    return undefined;
  }

  const { propertyName, accessors } = field.propertyPath;
  const rootProp = schemaItem.getPropertySync(propertyName);
  if (!rootProp) {
    return undefined;
  }

  const isAspect = schemaItem.isSync("ElementAspect", "BisCore");
  const where = ` WHERE ${isAspect ? "Element.Id" : "ECInstanceId"}=:elementId`;
  // `propertyName` may itself be a struct/array/point/navigation property, so its value can't be
  // decomposed into scalar sub-columns ahead of time. Query using the non-deprecated
  // UseECSqlPropertyNames format and reshape the value into the legacy UseJsPropertyNames shape using
  // ECSchema metadata (see ECSqlInstanceReshaper for why a naive, non-schema-aware rename isn't safe here).
  let curValue: FieldValueType | undefined = iModel.withQueryReader(`SELECT ${propertyName} FROM ${host.schemaName}.${host.className} ${where}`, (reader): FieldValueType | undefined => {
    if (!reader.step()) {
      return undefined;
    }

    const rawRootValue = reader.current[0];
    if (isNullish(rawRootValue)) {
      return undefined;
    }

    const rootValue = reshapePropertyValue(rawRootValue, rootProp, iModel);
    if (rootProp.isPrimitive() && !rootProp.isArray() && rootProp.primitiveType === PrimitiveType.DateTime) {
      return { primitive: new Date(rootValue) };
    }

    return classifyEcValue(rootProp, rootValue);
  }, new QueryBinder().bindId("elementId", host.elementId), { rowFormat: QueryRowFormat.UseECSqlPropertyNames });

  if (undefined === curValue) {
    return undefined;
  }

  // Indexed JSON strings are handled by `readJsonLeaf`. An un-indexed string stays on the EC path, where it resolves to
  // itself.
  if (accessors && accessors.length > 0 && isIndexableJsonString(rootProp, curValue)) {
    return readJsonLeaf(curValue.primitive, accessors);
  }

  let cursor = enterProperty(rootProp, schemaItem);
  if (accessors) {
    for (const accessor of accessors) {
      if (undefined !== curValue.primitive) {
        // Can't index into a primitive.
        return undefined;
      }

      const advanced = advanceSchemaCursor(cursor, accessor);
      if (!advanced) {
        return undefined;
      }

      if (typeof accessor === "number") {
        const array: FieldPrimitiveValue[] | FieldStructValue[] | undefined = curValue.primitiveArray ?? curValue.structArray;
        if (!array) {
          return undefined;
        }

        const index: number = accessor < 0 ? (array.length + accessor) : accessor;
        const item: FieldPrimitiveValue | FieldStructValue = array[index];
        if (isNullish(item)) {
          return undefined;
        }

        // `advanced.ecProp` is still the array property (see advanceSchemaCursor), so the
        // element's shape comes from the array kind rather than from classifyEcValue.
        curValue = curValue.primitiveArray ? { primitive: item as FieldPrimitiveValue } : { struct: item as FieldStructValue };
      } else {
        if (undefined === curValue.struct) {
          return undefined;
        }

        const item: any = curValue.struct[accessor];
        if (isNullish(item)) {
          return undefined;
        }

        const classified = classifyEcValue(advanced.ecProp, item);
        if (!classified) {
          return undefined;
        }

        curValue = classified;
      }

      cursor = advanced;
    }
  }

  const { ecProp } = cursor;
  const propertyType = undefined !== curValue.primitive && !ecProp.isPrimitive() ? undefined : determineFieldPropertyType(ecProp);
  if (!propertyType) {
    return undefined;
  }

  // The ultimate result must be a primitive value.
  const value = curValue.primitive;
  if (undefined === value) {
    return undefined;
  }

  // Property-side KoQ + persistence unit only. Overrides in `formatOptions.quantity` are
  // merged at formatting time (see `collectFieldQuantityPairs`) so these serve as the fallback
  // when the override doesn't resolve.
  let kindOfQuantityFullName: string | undefined;
  let persistenceUnitFullName: string | undefined;
  if (propertyType === "quantity" || propertyType === "coordinate") {
    const koq = ecProp.kindOfQuantity ? ecProp.getKindOfQuantitySync() : undefined;
    kindOfQuantityFullName = koq?.fullName;
    persistenceUnitFullName = koq?.persistenceUnit?.fullName;
  }

  return { value, type: propertyType, kindOfQuantityFullName, persistenceUnitFullName };
}

function isNullish(value: unknown): value is null | undefined {
  return undefined === value || null === value;
}

/** Positions a schema cursor on `prop`. Entering a non-array struct moves the class context to
 * the struct's class so that subsequent named accessors resolve against its members.
 */
function enterProperty(prop: Property, containingClass: AnyClass): SchemaCursor {
  return { ecProp: prop, ecClass: prop.isStruct() && !prop.isArray() ? prop.structClass : containingClass };
}

/** Advances a schema cursor by one [FieldPropertyPath]($common) accessor, or returns `undefined`
 * when the accessor doesn't apply to the current property.
 */
function advanceSchemaCursor(cursor: SchemaCursor, accessor: string | number): SchemaCursor | undefined {
  const { ecProp, ecClass } = cursor;
  if (typeof accessor === "number") {
    if (!ecProp.isArray()) {
      return undefined;
    }

    // A struct array's element type is its struct class; a primitive array's element type is
    // already described by `ecProp`. Either way the property itself doesn't advance.
    return ecProp.isStruct() ? { ecProp, ecClass: ecProp.structClass } : cursor;
  }

  // Named accessors require a struct context. A String primitive with further accessors is a
  // JSON-in-string path, which callers handle before reaching here.
  if (!ecProp.isStruct()) {
    return undefined;
  }

  const next = ecClass.getPropertySync(accessor);
  return next ? enterProperty(next, ecClass) : undefined;
}

/** Wraps an EC-schema-backed value in the [[FieldValueType]] variant matching its property. */
function classifyEcValue(prop: Property, value: any): FieldValueType | undefined {
  if (prop.isArray()) {
    return prop.isStruct() ? { structArray: value } : { primitiveArray: value };
  }

  if (prop.isStruct()) {
    return { struct: value };
  }

  return prop.isPrimitive() ? { primitive: value } : undefined;
}

/** Whether `curValue` is a string property the field can index into, i.e. possibly a serialized
 * JSON blob. Narrows `curValue.primitive` to `string` for the caller.
 */
function isIndexableJsonString(rootProp: Property, curValue: FieldValueType): curValue is { primitive: string } {
  return rootProp.isPrimitive() && !rootProp.isArray() && rootProp.primitiveType === PrimitiveType.String
    && typeof curValue.primitive === "string";
}

/** Resolves a [FieldPropertyPath]($common) that indexes into a string property holding serialized
 * JSON, as a walk entirely separate from the EC one: there is no schema behind a JSON blob,
 * so no EC metadata is consulted.
 *
 * Returns `undefined` when `raw` is not JSON, when an accessor does not resolve, or when the path
 * stops anywhere but a scalar — including on a JSON `null`, which is not a
 * [FieldPrimitiveValue]($common).
 */
function readJsonLeaf(raw: string, accessors: ReadonlyArray<string | number>): FieldValue | undefined {
  let cur = parseJsonContainer(raw);
  if (undefined === cur) {
    return undefined;
  }

  for (const accessor of accessors) {
    if (typeof cur !== "object" || null === cur) {
      // Can't index into a scalar.
      return undefined;
    }

    if (typeof accessor === "number") {
      if (!Array.isArray(cur)) {
        return undefined;
      }

      cur = cur[accessor < 0 ? cur.length + accessor : accessor];
    } else {
      cur = Array.isArray(cur) ? undefined : (cur as FieldStructValue)[accessor];
    }

    if (undefined === cur) {
      return undefined;
    }
  }

  // A numeric leaf is typed `"quantity"`: JSON carries no units, so only the field's own
  // `kindOfQuantity` + `persistenceUnit` overrides can name a format. Supplying only one of the
  // two renders through the same `toString()` a `"string"` leaf would have used.
  switch (typeof cur) {
    case "number":
      return { value: cur, type: "quantity" };
    case "boolean":
      return { value: cur, type: "boolean" };
    case "string":
      return { value: cur, type: "string" };
    default:
      return undefined;
  }
}

/** Parses `raw` if it looks like a JSON object or array, else `undefined` -- in which case the
 * string is just a string, and a field indexing into it resolves to nothing.
 */
function parseJsonContainer(raw: string): unknown {
  const trimmed = raw.trimStart();
  const firstChar = trimmed.charAt(0);
  if (firstChar !== "{" && firstChar !== "[") {
    return undefined;
  }

  try {
    const parsed: unknown = JSON.parse(trimmed);
    return (parsed !== null && typeof parsed === "object") ? parsed : undefined;
  } catch {
    // Not valid JSON; treat as a normal string.
    return undefined;
  }
}

function determineFieldPropertyType(prop: Property): FieldPropertyType | undefined {
  if (prop.isEnumeration()) {
    switch (prop.propertyType) {
      case PropertyType.Integer_Enumeration:
        return "int-enum";
      case PropertyType.String_Enumeration:
        return "string-enum";
      default:
        return undefined;
    }
  }

  if (prop.isPrimitive()) {
    switch (prop.primitiveType) {
      case PrimitiveType.Boolean:
        return "boolean";
      case PrimitiveType.String:
        return prop.extendedTypeName === "DateTime" ? "datetime" : "string";
      case PrimitiveType.DateTime:
        return "datetime";
      case PrimitiveType.Double:
      case PrimitiveType.Integer:
      case PrimitiveType.Long:
        // Any numeric property is a potential quantity. Classifying one as "quantity" is not an
        // assertion that it *has* units -- it only decides whether the KoQ/units pipeline is
        // consulted. A number that resolves no spec falls back to the same `toString()` the
        // "string" formatter would have produced, so counts and identifiers still render bare.
        return "quantity";
      case PrimitiveType.Point2d:
      case PrimitiveType.Point3d:
        return "coordinate";
      case PrimitiveType.Binary:
        return prop.extendedTypeName === "BeGuid" ? "string" : undefined;
      default:
        return undefined;
    }
  }

  return undefined;
}

export function createUpdateContext(
  hostElementId: string | undefined,
  iModel: IModelDb,
  deleted: boolean,
  formattingSpecProvider?: FieldFormattingSpecProvider,
): UpdateFieldsContext {
  return {
    hostElementId,
    getProperty: deleted ? () => undefined : (field) => getFieldPropertyValue(field, iModel),
    formattingSpecProvider,
  };
}

/** Resolves the [FormatterSpec]($core-quantity) this field should render its magnitudes through,
 * returning a callback bound to it, or `undefined` when not a quantity or coordinate, no provider is
 * registered, or no format was built for any of the (KindOfQuantity, persistence unit) pairs the
 * field may resolve through. In that last case the unresolved pairs are recorded on the provider.
 */
function resolveFormatMagnitude(value: FieldValue, field: FieldRun, context: UpdateFieldsContext): FormatMagnitude | undefined {
  const specProvider = context.formattingSpecProvider;
  if (!specProvider || (value.type !== "quantity" && value.type !== "coordinate")) {
    return undefined;
  }

  const formatSet = field.formatOptions?.quantity?.formatSet;
  const bucket = specProvider.getProviderFor(formatSet);
  const { spec, candidates } = lookupFieldSpec(field.formatOptions?.quantity, value, bucket);
  if (!spec) {
    if (candidates.length > 0) {
      specProvider.recordMisses(candidates, formatSet);
    }
    return undefined;
  }

  return (magnitude) => bucket.formatQuantity(magnitude, spec);
}

/** Recomputes a single field's cached display string synchronously. Returns true iff
 * cachedContent changed.
 *
 * Resolving the property value and formatting it are both fallible. A failure of either is
 * logged and degrades *this* field to [FieldRun.invalidContentIndicator]($common);
 */
export function updateField(field: FieldRun, context: UpdateFieldsContext): boolean {
  if (context.hostElementId && context.hostElementId !== field.propertyHost.elementId) {
    return false;
  }

  let newContent: string | undefined;
  try {
    const propValue = context.getProperty(field);
    if (undefined !== propValue) {
      newContent = formatFieldValue({
        value: propValue,
        options: field.formatOptions,
        formatMagnitude: resolveFormatMagnitude(propValue, field, context),
      });
    }
  } catch (err) {
    Logger.logError(BackendLoggerCategory.IModelDb, err);
  }

  newContent = newContent ?? FieldRun.invalidContentIndicator;
  if (newContent === field.cachedContent) {
    return false;
  }

  field.setCachedContent(newContent);
  return true;
}

/** Re-evaluates every [FieldRun]($common) in `textBlock` synchronously and returns the number
 * whose cached display string changed. Fields targeting an element other than
 * `context.hostElementId` (when set) are skipped.
 */
export function updateFields(textBlock: TextBlock, context: UpdateFieldsContext): number {
  let numUpdated = 0;
  for (const { child } of traverseTextBlockComponent(textBlock)) {
    if (child.type === "field" && updateField(child, context)) {
      ++numUpdated;
    }
  }

  return numUpdated;
}

function doUpdateFields(txn: EditTxn, annotationId: Id64String, sourceId: Id64String | undefined, deleted: boolean, formattingSpecProvider: FieldFormattingSpecProvider | undefined): void {
  const iModel = txn.iModel;
  try {
    const target = iModel.elements.getElement(annotationId);
    if (isITextAnnotation(target)) {
      const context = createUpdateContext(sourceId, iModel, deleted, formattingSpecProvider);
      const updatedBlocks = [];
      for (const block of target.getTextBlocks()) {
        if (updateFields(block.textBlock, context)) {
          updatedBlocks.push(block);
        }
      }

      if (updatedBlocks.length > 0) {
        target.updateTextBlocks(updatedBlocks);
        target.update(txn);
      }
    }
  } catch (err) {
    Logger.logError(BackendLoggerCategory.IModelDb, err);
  }
}

/** Re-evaluates the fields of the `props.targetId` annotation in response to a source-element
 * change (`deleted=false`) or delete (`deleted=true`). Invoked from
 * [[ElementDrivesTextAnnotation.onRootChangedArg]] / `onDeletedDependencyArg`.
 */
export function updateElementFields(props: RelationshipProps, txn: EditTxn, deleted: boolean, formattingSpecProvider?: FieldFormattingSpecProvider): void {
  doUpdateFields(txn, props.targetId, props.sourceId, deleted, formattingSpecProvider);
}

/** Re-evaluates every field of the given annotation element against its current property
 * values. Invoked from [[ElementDrivesTextAnnotation.updateFieldDependencies]] when
 * establishing / refreshing relationships.
 */
export function updateAllFields(annotationElementId: Id64String, txn: EditTxn, formattingSpecProvider?: FieldFormattingSpecProvider): void {
  doUpdateFields(txn, annotationElementId, undefined, false, formattingSpecProvider);
}
