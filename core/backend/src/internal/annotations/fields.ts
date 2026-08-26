/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { collectFieldQuantityPairs, FieldPrimitiveValue, FieldPropertyType, FieldRun, FieldValue, formatFieldValue, formatFieldValueWithSpecProvider, QueryBinder, QueryRowFormat, RelationshipProps, TextBlock, traverseTextBlockComponent } from "@itwin/core-common";
import { IModelDb } from "../../IModelDb";
import { Id64String, Logger } from "@itwin/core-bentley";
import { BackendLoggerCategory } from "../../BackendLoggerCategory";
import { isITextAnnotation } from "../../annotations/ElementDrivesTextAnnotation";
import { AnyClass, EntityClass, PrimitiveType, Property, PropertyType } from "@itwin/ecschema-metadata";
import { FormattingSpecArgs } from "@itwin/core-quantity";
import type { FieldFormattingSpecProvider } from "../../annotations/FieldFormattingSpecProvider";
import { reshapePropertyValue } from "../ECSqlInstanceReshaper";
import { specKey } from "./specKey";
import type { EditTxn } from "../../EditTxn";
interface FieldStructValue { [key: string]: any }

/** The scalar leaves `JSON.parse` can produce. Deliberately excludes `null`: a JSON `null` is
 * not a [FieldPrimitiveValue]($common), so a path terminating on one is unresolvable rather
 * than a value to stringify.
 */
type JsonPrimitiveValue = string | number | boolean;

// An intermediate value obtained while evaluating a FieldPropertyPath.
type FieldValueType = {
  primitive: FieldPrimitiveValue;
  struct?: never;
  primitiveArray?: never;
  structArray?: never;
  deserializedJson?: never;
  deserializedArray?: never;
  jsonPrimitive?: never;
} | {
  primitive?: never;
  struct: FieldStructValue;
  primitiveArray?: never;
  structArray?: never;
  deserializedJson?: never;
  deserializedArray?: never;
  jsonPrimitive?: never;
} | {
  primitive?: never;
  struct?: never;
  primitiveArray: FieldPrimitiveValue[];
  structArray?: never;
  deserializedJson?: never;
  deserializedArray?: never;
  jsonPrimitive?: never;
} | {
  primitive?: never;
  struct?: never;
  primitiveArray?: never;
  structArray: FieldStructValue[];
  deserializedJson?: never;
  deserializedArray?: never;
  jsonPrimitive?: never;
} | {
  primitive?: never;
  struct?: never;
  primitiveArray?: never;
  structArray?: never;
  deserializedJson: FieldStructValue;
  deserializedArray?: never;
  jsonPrimitive?: never;
} | {
  primitive?: never;
  struct?: never;
  primitiveArray?: never;
  structArray?: never;
  deserializedJson?: never;
  deserializedArray: FieldStructValue[];
  jsonPrimitive?: never;
} | {
  // A scalar read out of a deserialized JSON blob. Kept distinct from `primitive` because it
  // has no EC property behind it: its type is inferred from the JSON value rather than from
  // schema metadata, and it carries no KindOfQuantity.
  primitive?: never;
  struct?: never;
  primitiveArray?: never;
  structArray?: never;
  deserializedJson?: never;
  deserializedArray?: never;
  jsonPrimitive: JsonPrimitiveValue;
}

/** A (property, containing class) pair identifying where a partially-walked
 * [FieldPropertyPath]($common) currently sits in the EC schema.
 */
interface SchemaCursor {
  readonly ecProp: Property;
  readonly ecClass: AnyClass;
}

export interface UpdateFieldsContext {
  readonly hostElementId: Id64String | undefined;

  getProperty(field: FieldRun): FieldValue | undefined;

  /** Resolves `"quantity"` and `"coordinate"` values through pre-warmed
   * [FormatterSpec]($core-quantity)s. [[updateField]] narrows this to the bucket matching the
   * field's [QuantityFieldFormatOptions.formatSet]($common); a requirement that was never
   * pre-warmed — or an absent provider entirely — leaves the field on the raw-string fallback
   * via [[formatFieldValue]] and is recorded in
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
    if (rootProp.isPrimitive() && !rootProp.isArray()) {
      if (rootProp.primitiveType === PrimitiveType.DateTime) {
        return { primitive: new Date(rootValue) };
      }

      // If the property is a string holding serialized JSON and the field indexes into it, parse
      // and treat as a deserialized object/array. Without accessors, keep the raw string so the
      // field can display it directly.
      if (rootProp.primitiveType === PrimitiveType.String && typeof rootValue === "string" && accessors && accessors.length > 0) {
        const deserialized = tryDeserializeJson(rootValue);
        if (deserialized) {
          return deserialized;
        }
      }
    }

    return classifyEcValue(rootProp, rootValue);
  }, new QueryBinder().bindId("elementId", host.elementId), { rowFormat: QueryRowFormat.UseECSqlPropertyNames });

  if (undefined === curValue) {
    return undefined;
  }

  let cursor = enterProperty(rootProp, schemaItem);
  if (accessors) {
    for (const accessor of accessors) {
      if (undefined !== curValue.primitive || undefined !== curValue.jsonPrimitive) {
        // Can't index into a primitive.
        return undefined;
      }

      if (curValue.deserializedJson || curValue.deserializedArray) {
        // Inside a deserialized JSON blob there is no EC metadata to consult; index the raw
        // value directly. The schema cursor deliberately stops advancing here.
        const next = indexDeserializedJson(curValue, accessor);
        if (!next) {
          return undefined;
        }

        curValue = next;
        continue;
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
  const jsonLeaf = curValue.jsonPrimitive;
  const propertyType = undefined !== jsonLeaf
    ? inferJsonPrimitiveType(jsonLeaf)
    : (undefined !== curValue.primitive && !ecProp.isPrimitive() ? undefined : determineFieldPropertyType(ecProp));
  if (!propertyType) {
    return undefined;
  }

  // The ultimate result must be a primitive value.
  const value = curValue.primitive ?? jsonLeaf;
  if (undefined === value) {
    return undefined;
  }

  // Property-side KoQ + persistence unit only. Overrides in `formatOptions.quantity` are
  // merged at formatting time (see `collectFieldQuantityPairs`) so these serve as the fallback
  // when the override doesn't resolve. JSON-in-string values have no reliable KoQ, so skip.
  let kindOfQuantityFullName: string | undefined;
  let persistenceUnitFullName: string | undefined;
  if (propertyType === "quantity" || propertyType === "coordinate") {
    const koq = undefined === jsonLeaf && ecProp.kindOfQuantity ? ecProp.getKindOfQuantitySync() : undefined;
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
 *
 * Shared by the value walker in [[getFieldPropertyValue]] and the metadata-only walker in
 * [[resolveFieldTerminalProperty]] so the two cannot disagree about which paths are legal.
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

/** Applies one accessor to a deserialized JSON object or array. */
function indexDeserializedJson(curValue: FieldValueType, accessor: string | number): FieldValueType | undefined {
  if (typeof accessor === "number") {
    const arr = curValue.deserializedArray;
    if (!arr) {
      return undefined;
    }

    const idx = accessor < 0 ? arr.length + accessor : accessor;
    return classifyDeserializedValue(arr[idx]);
  }

  return curValue.deserializedJson ? classifyDeserializedValue(curValue.deserializedJson[accessor]) : undefined;
}

/** Types a JSON-in-string leaf. A numeric leaf is a `"quantity"`: JSON carries no units, so the
 * field is expected to declare a [QuantityFieldFormatOptions.kindOfQuantity]($common) and
 * [QuantityFieldFormatOptions.persistenceUnit]($common) of its own. It costs nothing when it
 * doesn't — `collectFieldQuantityPairs` emits a candidate only when both halves are present, so
 * an incomplete key yields no candidates, records no pre-warm miss, and renders through the same
 * raw `toString()` fallback a `"string"` leaf would have used.
 */
function inferJsonPrimitiveType(value: JsonPrimitiveValue): FieldPropertyType {
  switch (typeof value) {
    case "boolean":
      return "boolean";
    case "number":
      return "quantity";
    default:
      return "string";
  }
}

function tryDeserializeJson(raw: string): FieldValueType | undefined {
  const trimmed = raw.trimStart();
  const firstChar = trimmed.charAt(0);
  if (firstChar !== "{" && firstChar !== "[") {
    return undefined;
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (parsed !== null && typeof parsed === "object") {
      return classifyDeserializedValue(parsed);
    }
  } catch {
    // Not valid JSON; fall through and treat as a normal string.
  }
  return undefined;
}

/** Wraps a value pulled out of a deserialized JSON blob. Returns `undefined` for JSON `null`
 * (and for a missing key), since neither is a [FieldPrimitiveValue]($common) — the path is
 * simply unresolvable, and inventing a value here would hand the formatters something they
 * cannot stringify.
 */
function classifyDeserializedValue(value: unknown): FieldValueType | undefined {
  if (Array.isArray(value)) {
    return { deserializedArray: value };
  }

  if (value !== null && typeof value === "object") {
    return { deserializedJson: value };
  }

  switch (typeof value) {
    case "string":
    case "number":
    case "boolean":
      return { jsonPrimitive: value };
    default:
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
        // assertion that it *is* a measure -- it only decides whether the KoQ/units pipeline is
        // consulted (see formatFieldValueWithProvider). A number that resolves no spec, because
        // neither the property nor the field names a KindOfQuantity, falls back to the exact same
        // `toString()` the "string" formatter would have produced. So counts and identifiers still
        // render bare, while a caller that declares `formatOptions.quantity` on one keeps the
        // documented override escape hatch that doubles already enjoy.
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

/** Recomputes a single field's cached display string synchronously. Returns true iff
 * cachedContent changed.
 *
 * Resolving the property value and formatting it are both fallible — formatting in particular
 * runs [FormatterSpec.applyFormatting]($core-quantity), which can throw on a malformed format.
 * A failure of either is logged and degrades *this* field to
 * [FieldRun.invalidContentIndicator]($common); it never escapes to abandon the sibling fields of
 * the same annotation, which would leave them mutated in memory but unpersisted.
 */
export function updateField(field: FieldRun, context: UpdateFieldsContext): boolean {
  if (context.hostElementId && context.hostElementId !== field.propertyHost.elementId) {
    return false;
  }

  let newContent: string | undefined;
  try {
    const propValue = context.getProperty(field);
    if (undefined !== propValue) {
      const specProvider = context.formattingSpecProvider;
      if (specProvider) {
        const formatSet = field.formatOptions?.quantity?.formatSet;
        newContent = formatFieldValueWithSpecProvider(
          propValue,
          field.formatOptions,
          specProvider.getProviderFor(formatSet),
          (candidates) => specProvider.recordMisses(candidates, formatSet),
        );
      } else {
        newContent = formatFieldValue(propValue, field.formatOptions);
      }
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

/** Sentinel returned by [[resolveFieldTerminalProperty]] for a path that dives into a
 * JSON-in-string property. Such a path has no terminal [Property]($ecschema-metadata) — and so
 * no schema-side [KindOfQuantity]($ecschema-metadata) — but the field may still supply a
 * complete formatting key of its own.
 */
const jsonInStringTerminal = "json-in-string";

type FieldTerminal = Property | typeof jsonInStringTerminal;

/** Resolves a [FieldRun]($common)'s target to its terminal [Property]($ecschema-metadata)
 * using schema metadata only (no ECSQL, no element values). Returns `undefined` when the path
 * cannot be followed, or [[jsonInStringTerminal]] when it dives into a JSON-in-string leaf.
 *
 * Walks with the same [[advanceSchemaCursor]] the value path uses, so the two agree on which
 * paths are legal. It is deliberately more permissive in one direction: it cannot know whether
 * the stored string actually parses as JSON, so a JSON-in-string path may pre-warm a
 * [FormatterSpec]($core-quantity) that evaluation never consults. An unused warmed spec is
 * harmless; a missing one is not.
 */
function resolveFieldTerminalProperty(field: FieldRun, iModel: IModelDb): FieldTerminal | undefined {
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

  if (!accessors || accessors.length === 0) {
    return rootProp;
  }

  // Mirrors getFieldPropertyValue: accessors applied to a non-array String property index into
  // deserialized JSON, so the schema walk stops here.
  if (rootProp.isPrimitive() && !rootProp.isArray() && rootProp.primitiveType === PrimitiveType.String) {
    return jsonInStringTerminal;
  }

  let cursor = enterProperty(rootProp, schemaItem);
  for (const accessor of accessors) {
    const advanced = advanceSchemaCursor(cursor, accessor);
    if (!advanced) {
      return undefined;
    }

    cursor = advanced;
  }

  return cursor.ecProp;
}

/** Returns the [FormattingSpecArgs]($core-quantity) entries the field may consult at
 * formatting time; empty when the EC property is not `"quantity"` / `"coordinate"` or no
 * (KoQ, persistenceUnit) pair can be assembled from the property plus `formatOptions.quantity`
 * overrides. Delegates to `collectFieldQuantityPairs` (`@itwin/core-common` internal) so
 * pre-warm enumerates the same candidates the runtime iterates. See
 * [[QuantityFieldFormatOptions]] for the priority contract and the coordinate/no-KoQ caveat.
 *
 * This is the single source of the `field -> (KoQ, persistenceUnit)` mapping. Pre-warm and
 * evaluation must agree on it exactly: a requirement that differs from the candidate the
 * runtime actually walks does not merely fail to format, it lets the runtime resolve a
 * *different* pair and scale the value by the wrong unit. That agreement is enforced here by
 * construction — both paths share `collectFieldQuantityPairs`, and the metadata walk shares
 * `advanceSchemaCursor` with the runtime value walk — which is why this computation stays in
 * core even though callers choose for themselves which fields to ask about.
 * @internal
 */
export function collectFieldRequirements(field: FieldRun, iModel: IModelDb): FormattingSpecArgs[] {
  const quantityOptions = field.formatOptions?.quantity;

  const terminal = resolveFieldTerminalProperty(field, iModel);
  if (!terminal) {
    return [];
  }

  if (terminal === jsonInStringTerminal) {
    // A JSON leaf has no property-side pair to fall back to, so only the field's own overrides
    // can form a candidate. `collectFieldQuantityPairs` drops an incomplete key, which matches
    // the runtime falling through to the raw `toString()` representation.
    return collectFieldQuantityPairs({
      overrideName: quantityOptions?.kindOfQuantity,
      overridePersistence: quantityOptions?.persistenceUnit,
    });
  }

  const propertyType = determineFieldPropertyType(terminal);
  if (propertyType !== "quantity" && propertyType !== "coordinate") {
    return [];
  }

  const koq = terminal.kindOfQuantity ? terminal.getKindOfQuantitySync() : undefined;
  return collectFieldQuantityPairs({
    overrideName: quantityOptions?.kindOfQuantity,
    overridePersistence: quantityOptions?.persistenceUnit,
    propertyName: koq?.fullName,
    propertyPersistence: koq?.persistenceUnit?.fullName,
  });
}

/** Walks `textBlock` and returns the deduplicated [FormattingSpecArgs]($core-quantity) needed
 * to format its `"quantity"` and `"coordinate"` [FieldRun]($common)s. See
 * [[ElementDrivesTextAnnotation.collectFieldFormattingRequirements]] for the public contract
 * and the pre-warm workflow.
 * @internal
 */
export function collectFieldFormattingRequirements(textBlock: TextBlock, iModel: IModelDb): FormattingSpecArgs[] {
  const seen = new Map<string, FormattingSpecArgs>();
  for (const { child } of traverseTextBlockComponent(textBlock)) {
    if (child.type !== "field") {
      continue;
    }
    for (const args of collectFieldRequirements(child, iModel)) {
      const key = specKey(args);
      if (!seen.has(key)) {
        seen.set(key, args);
      }
    }
  }

  return Array.from(seen.values());
}
