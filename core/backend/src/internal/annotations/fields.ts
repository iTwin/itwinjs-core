/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { collectFieldQuantityPairs, FieldFormatterContextSync, FieldPrimitiveValue, FieldPropertyType, FieldRun, FieldValue, formatFieldValueSync, QueryBinder, QueryRowFormat, RelationshipProps, TextBlock, traverseTextBlockComponent } from "@itwin/core-common";
import { IModelDb } from "../../IModelDb";
import { assert, BentleyError, expectDefined, Id64String, Logger } from "@itwin/core-bentley";
import { BackendLoggerCategory } from "../../BackendLoggerCategory";
import { isITextAnnotation } from "../../annotations/ElementDrivesTextAnnotation";
import { AnyClass, EntityClass, PrimitiveType, Property, PropertyType, SchemaFormatsProvider, StructArrayProperty } from "@itwin/ecschema-metadata";
import { BasicUnitsProvider, FormattingSpecArgs, FormattingSpecProvider } from "@itwin/core-quantity";
import { reshapePropertyValue } from "../ECSqlInstanceReshaper";
import type { EditTxn } from "../../EditTxn";
interface FieldStructValue { [key: string]: any }

// An intermediate value obtained while evaluating a FieldPropertyPath.
type FieldValueType = {
  primitive: FieldPrimitiveValue;
  struct?: never;
  primitiveArray?: never;
  structArray?: never;
  deserializedJson?: never;
  deserializedArray?: never;
} | {
  primitive?: never;
  struct: FieldStructValue;
  primitiveArray?: never;
  structArray?: never;
  deserializedJson?: never;
  deserializedArray?: never;
} | {
  primitive?: never;
  struct?: never;
  primitiveArray: FieldPrimitiveValue[];
  structArray?: never;
  deserializedJson?: never;
  deserializedArray?: never;
} | {
  primitive?: never;
  struct?: never;
  primitiveArray?: never;
  structArray: FieldStructValue[];
  deserializedJson?: never;
  deserializedArray?: never;
} | {
  primitive?: never;
  struct?: never;
  primitiveArray?: never;
  structArray?: never;
  deserializedJson: FieldStructValue;
  deserializedArray?: never;
} | {
  primitive?: never;
  struct?: never;
  primitiveArray?: never;
  structArray?: never;
  deserializedJson?: never;
  deserializedArray: FieldStructValue[];
}

export interface UpdateFieldsContext {
  readonly hostElementId: Id64String | undefined;

  getProperty(field: FieldRun): FieldValue | undefined;

  /** Sync registry used by [[updateField]] to route `"quantity"` and `"coordinate"` values
   * through a [FormattingSpecProvider]($core-quantity) registered under the field's
   * [QuantityFieldFormatOptions.formatSet]($common). A missing entry (or an absent map)
   * falls back to [[syncFormatterContext]] and then to the raw-string fallback.
   */
  readonly formattingSpecProviders?: ReadonlyMap<Id64String, FormattingSpecProvider>;

  /** Schema-backed synchronous fallback consulted by [[updateField]] when no registered
   * provider resolves a spec: formats are resolved from the iModel's schemas via
   * [SchemaFormatsProvider.getFormatSync]($ecschema-metadata), and units/conversions from the
   * warmed-up [BasicUnitsProvider]($core-quantity). When the units cache is not yet warm the
   * lookup throws internally and the field falls to the raw string for this evaluation.
   */
  readonly syncFormatterContext?: FieldFormatterContextSync;
}

// Resolves the property a field points at into a [[FieldValue]] — primitive value plus, for
// `"quantity"` / `"coordinate"` types, the property-side KoQ and persistence unit.
function getFieldPropertyValue(field: FieldRun, iModel: IModelDb): FieldValue | undefined {
  const host = field.propertyHost;
  const schemaItem = iModel.schemaContext.getSchemaItemSync(host.schemaName, host.className);
  if (!EntityClass.isEntityClass(schemaItem)) {
    return undefined;
  }

  let ecClass: AnyClass = schemaItem;
  const { propertyName, accessors } = field.propertyPath;
  let ecProp = ecClass.getPropertySync(propertyName);
  if (!ecProp) {
    return undefined;
  }

  const isAspect = ecClass.isSync("ElementAspect", "BisCore");
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
    if (undefined === rawRootValue) {
      return undefined;
    }

    ecProp = expectDefined(ecProp);
    const rootValue = reshapePropertyValue(rawRootValue, ecProp, iModel);
    if (ecProp.isArray()) {
      return ecProp.isStruct() ? { structArray: rootValue } : { primitiveArray: rootValue };
    }

    if (ecProp.isStruct()) {
      ecClass = ecProp.structClass;
      return { struct: rootValue };
    }

    if (ecProp.isPrimitive()) {
      if (ecProp.primitiveType === PrimitiveType.DateTime) {
        return { primitive: new Date(rootValue) };
      }

      // If the property is a string holding serialized JSON and the field indexes into it, parse
      // and treat as a deserialized object/array. Without accessors, keep the raw string so the
      // field can display it directly.
      if (ecProp.primitiveType === PrimitiveType.String && typeof rootValue === "string" && accessors && accessors.length > 0) {
        const deserialized = tryDeserializeJson(rootValue);
        if (deserialized) {
          return deserialized;
        }
      }

      return {
        primitive: rootValue,
      };
    }

    return undefined;
  }, new QueryBinder().bindId("elementId", host.elementId), { rowFormat: QueryRowFormat.UseECSqlPropertyNames });

  if (undefined === curValue) {
    return undefined;
  }

  if (accessors) {
    for (const accessor of accessors) {
      if (undefined !== curValue.primitive) {
        // Can't index into a primitive.
        return undefined;
      }

      if (typeof accessor === "number") {
        // Deserialized JSON array: index without consulting the EC schema.
        if (curValue.deserializedArray) {
          const arr = curValue.deserializedArray;
          const idx = accessor < 0 ? arr.length + accessor : accessor;
          const value: any = arr[idx];
          if (undefined === value) {
            return undefined;
          }
          curValue = classifyDeserializedValue(value);
          continue;
        }

        const array: FieldPrimitiveValue[] | FieldStructValue[] | undefined = curValue.primitiveArray ?? curValue.structArray;
        if (!array) {
          return undefined;
        }

        const index: number = accessor < 0 ? (array.length + accessor) : accessor;
        const item: FieldPrimitiveValue | FieldStructValue = array[index];
        if (undefined === item) {
          return undefined;
        } else if (curValue.primitiveArray) {
          curValue = { primitive: curValue.primitiveArray[index] };
        } else {
          assert(undefined !== curValue.structArray);
          assert(ecProp instanceof StructArrayProperty);

          ecClass = ecProp.structClass;
          curValue = { struct: curValue.structArray[index] };
        }
      } else {
        // Deserialized JSON object: index without consulting the EC schema.
        if (curValue.deserializedJson) {
          const value: any = curValue.deserializedJson[accessor];
          if (undefined === value) {
            return undefined;
          }
          curValue = classifyDeserializedValue(value);
          continue;
        }

        if (undefined === curValue.struct) {
          return undefined;
        }

        const item: any = curValue.struct[accessor];
        if (undefined === item) {
          return undefined;
        }

        ecProp = ecClass.getPropertySync(accessor);
        if (!ecProp) {
          return undefined;
        }

        if (ecProp.isArray()) {
          curValue = ecProp.isStruct() ? { structArray: item } : { primitiveArray: item };
        } else if (ecProp.isStruct()) {
          ecClass = ecProp.structClass;
          curValue = { struct: item };
        } else if (ecProp.isPrimitive()) {
          curValue = { primitive: item };
        } else {
          return undefined;
        }
      }
    }
  }

  const isJsonPath = isJsonLeafPrimitive(curValue.primitive) && ecProp.isPrimitive() && ecProp.primitiveType === PrimitiveType.String && accessors && accessors.length > 0;
  const propertyType = curValue.primitive !== undefined && !ecProp.isPrimitive()
    ? undefined
    : (isJsonPath
      ? inferJsonPrimitiveType(curValue.primitive)
      : determineFieldPropertyType(ecProp));
  if (!propertyType) {
    return undefined;
  }

  // The ultimate result must be a primitive value.
  if (undefined === curValue.primitive) {
    return undefined;
  }

  // Property-side KoQ + persistence unit only. Overrides in `formatOptions.quantity` are
  // merged at formatting time (see `collectFieldQuantityPairs`) so these serve as the fallback
  // when the override doesn't resolve. JSON-in-string values have no reliable KoQ, so skip.
  let kindOfQuantityFullName: string | undefined;
  let persistenceUnitFullName: string | undefined;
  if (propertyType === "quantity" || propertyType === "coordinate") {
    const koq = !isJsonPath && ecProp.kindOfQuantity ? ecProp.getKindOfQuantitySync() : undefined;
    kindOfQuantityFullName = koq?.fullName;
    persistenceUnitFullName = koq?.persistenceUnit?.fullName;
  }

  return { value: curValue.primitive, type: propertyType, kindOfQuantityFullName, persistenceUnitFullName };
}

function isJsonLeafPrimitive(value: FieldPrimitiveValue | undefined): boolean {
  const t = typeof value;
  return t === "string" || t === "number" || t === "boolean";
}

function inferJsonPrimitiveType(value: FieldPrimitiveValue | undefined): FieldPropertyType | undefined {
  switch (typeof value) {
    case "boolean": return "boolean";
    case "number": return "quantity";
    case "string": return "string";
    default: return undefined;
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

function classifyDeserializedValue(value: any): FieldValueType {
  if (Array.isArray(value)) {
    return { deserializedArray: value };
  }
  if (value !== null && typeof value === "object") {
    return { deserializedJson: value };
  }
  return { primitive: value };
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
        return "quantity";
      case PrimitiveType.Long:
        // Long properties represent quantities only when they carry a KindOfQuantity
        // (many Longs are identifiers, not measures). Without one, format as a string.
        return prop.kindOfQuantity ? "quantity" : "string";
      case PrimitiveType.Point2d:
      case PrimitiveType.Point3d:
        return "coordinate";
      case PrimitiveType.Binary:
        return prop.extendedTypeName === "BeGuid" ? "string" : undefined;
      case PrimitiveType.Integer:
        return "string";
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
  formattingSpecProviders?: ReadonlyMap<Id64String, FormattingSpecProvider>,
): UpdateFieldsContext {
  // Fire-and-forget: warms the bundled units cache so the schema-backed sync fallback can
  // resolve on subsequent evaluations. The first txn after process start may render raw.
  if (!BasicUnitsProvider.isWarmedUp) {
    void BasicUnitsProvider.warmup().catch((err) => Logger.logError(BackendLoggerCategory.IModelDb, BentleyError.getErrorMessage(err)));
  }

  return {
    hostElementId,
    getProperty: deleted ? () => undefined : (field) => getFieldPropertyValue(field, iModel),
    formattingSpecProviders,
    syncFormatterContext: createFieldFormatterContextSync(iModel),
  };
}

/** Builds a [[FieldFormatterContextSync]] backed by `iModel`'s schema context for formats and
 * the bundled BIS units for units/conversions. The formats provider is locked to the
 * `"metric"` unit system; app-owned formatting is injected through a
 * [FormattingSpecProvider]($core-quantity) registered for the field's `formatSet` instead.
 * @internal
 */
export function createFieldFormatterContextSync(iModel: IModelDb): FieldFormatterContextSync {
  return {
    unitsProvider: new BasicUnitsProvider(),
    formatsProvider: new SchemaFormatsProvider(iModel.schemaContext, "metric"),
  };
}

/** Recomputes a single field's cached display string synchronously. Returns true iff
 * cachedContent changed.
 */
export function updateField(field: FieldRun, context: UpdateFieldsContext): boolean {
  if (context.hostElementId && context.hostElementId !== field.propertyHost.elementId) {
    return false;
  }

  let propValue: FieldValue | undefined;
  try {
    propValue = context.getProperty(field);
  } catch (err) {
    Logger.logError(BackendLoggerCategory.IModelDb, err);
  }

  let newContent: string | undefined;
  if (undefined !== propValue) {
    const formatSet = field.formatOptions?.quantity?.formatSet;
    const provider = formatSet ? context.formattingSpecProviders?.get(formatSet) : undefined;
    // Unified sync chain: registered provider spec → schema-backed sync construction → raw.
    newContent = formatFieldValueSync(propValue, field.formatOptions, { provider, context: context.syncFormatterContext });
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

function doUpdateFields(txn: EditTxn, annotationId: Id64String, sourceId: Id64String | undefined, deleted: boolean, formattingSpecProviders: ReadonlyMap<Id64String, FormattingSpecProvider> | undefined): void {
  const iModel = txn.iModel;
  try {
    const target = iModel.elements.getElement(annotationId);
    if (isITextAnnotation(target)) {
      const context = createUpdateContext(sourceId, iModel, deleted, formattingSpecProviders);
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
export function updateElementFields(props: RelationshipProps, txn: EditTxn, deleted: boolean, formattingSpecProviders?: ReadonlyMap<Id64String, FormattingSpecProvider>): void {
  doUpdateFields(txn, props.targetId, props.sourceId, deleted, formattingSpecProviders);
}

/** Re-evaluates every field of the given annotation element against its current property
 * values. Invoked from [[ElementDrivesTextAnnotation.updateFieldDependencies]] when
 * establishing / refreshing relationships.
 */
export function updateAllFields(annotationElementId: Id64String, txn: EditTxn, formattingSpecProviders?: ReadonlyMap<Id64String, FormattingSpecProvider>): void {
  doUpdateFields(txn, annotationElementId, undefined, false, formattingSpecProviders);
}

/** Resolves a [FieldRun]($common)'s target to its terminal [Property]($ecschema-metadata)
 * using schema metadata only (no ECSQL, no element values). Returns `undefined` when the path
 * cannot be followed — notably when it dives into a JSON-in-string leaf, since such paths
 * have no reliable ECProperty/KoQ association.
 */
function resolveFieldTerminalProperty(field: FieldRun, iModel: IModelDb): Property | undefined {
  const host = field.propertyHost;
  const schemaItem = iModel.schemaContext.getSchemaItemSync(host.schemaName, host.className);
  if (!EntityClass.isEntityClass(schemaItem)) {
    return undefined;
  }

  let ecClass: AnyClass = schemaItem;
  const { propertyName, accessors } = field.propertyPath;
  let ecProp = ecClass.getPropertySync(propertyName);
  if (!ecProp) {
    return undefined;
  }

  if (!accessors || accessors.length === 0) {
    return ecProp;
  }

  // Mirror the descent getFieldPropertyValue performs at query time: on entering a non-array
  // struct at the root, subsequent named accessors are looked up on the struct's class.
  if (ecProp.isStruct() && !ecProp.isArray()) {
    ecClass = ecProp.structClass;
  }

  for (const accessor of accessors) {
    if (typeof accessor === "number") {
      if (!ecProp.isArray()) {
        return undefined;
      }
      if (ecProp.isStruct()) {
        ecClass = ecProp.structClass;
      }
      // For primitive arrays, ecProp already represents the element type — nothing to advance.
    } else {
      // Named accessors require a struct context. A String primitive with further accessors is
      // a JSON-in-string path, which has no schema-driven KoQ.
      if (!ecProp.isStruct()) {
        return undefined;
      }
      const next: Property | undefined = ecClass.getPropertySync(accessor);
      if (!next) {
        return undefined;
      }
      ecProp = next;
      if (ecProp.isStruct() && !ecProp.isArray()) {
        ecClass = ecProp.structClass;
      }
    }
  }

  return ecProp;
}

/** Returns the [FormattingSpecArgs]($core-quantity) entries the field may consult at
 * formatting time; empty when the EC property is not `"quantity"` / `"coordinate"` or no
 * (KoQ, persistenceUnit) pair can be assembled from the property plus `formatOptions.quantity`
 * overrides. Delegates to `collectFieldQuantityPairs` (`@itwin/core-common` internal) so
 * pre-warm enumerates the same candidates the runtime iterates. See
 * [[QuantityFieldFormatOptions]] for the priority contract and the coordinate/no-KoQ caveat.
 */
function computeFieldFormattingRequirement(field: FieldRun, iModel: IModelDb): FormattingSpecArgs[] {
  const quantityOptions = field.formatOptions?.quantity;

  const ecProp = resolveFieldTerminalProperty(field, iModel);
  if (!ecProp) {
    return [];
  }

  const propertyType = determineFieldPropertyType(ecProp);
  if (propertyType !== "quantity" && propertyType !== "coordinate") {
    return [];
  }

  const koq = ecProp.kindOfQuantity ? ecProp.getKindOfQuantitySync() : undefined;
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
    for (const args of computeFieldFormattingRequirement(child, iModel)) {
      const key = `${args.name}|${args.persistenceUnitName}`;
      if (!seen.has(key)) {
        seen.set(key, args);
      }
    }
  }
  return Array.from(seen.values());
}
