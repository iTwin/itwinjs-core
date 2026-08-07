/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { FieldFormatterContext, FieldFormattingSpecResolver, FieldMissingSpecBehavior, FieldPrimitiveValue, FieldPropertyType, FieldRun, FieldValue, formatFieldValue, formatFieldValueAsync, formatFieldValueWithSpecResolver, QueryBinder, QueryRowFormat, RelationshipProps, TextBlock, traverseTextBlockComponent } from "@itwin/core-common";
import { IModelDb } from "../../IModelDb";
import { assert, expectDefined, Id64String, Logger } from "@itwin/core-bentley";
import { BackendLoggerCategory } from "../../BackendLoggerCategory";
import { isITextAnnotation } from "../../annotations/ElementDrivesTextAnnotation";
import { AnyClass, EntityClass, PrimitiveType, Property, PropertyType, SchemaFormatsProvider, SchemaUnitProvider, StructArrayProperty } from "@itwin/ecschema-metadata";
import { createUnitsProvider, FormatsProvider, FormatterSpec, FormattingSpecArgs, UnitsProvider } from "@itwin/core-quantity";
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

  /** Optional resolver used to select a synchronous [FieldFormattingSpecProvider]($common) per
   * [FieldRun]($common). When present, [[updateField]] formats `"quantity"` and `"coordinate"`
   * values via [[formatFieldValueWithSpecResolver]]; when absent it falls back to `toString()`.
   *
   * The resolver encapsulates the cascading lookup on
   * [QuantityFieldFormatOptions.formatSet]($common):
   *   1. The field's `formatSet` registration.
   *   2. The default registration.
   */
  readonly formattingSpecResolver?: FieldFormattingSpecResolver;

  /** Fallback [[FieldMissingSpecBehavior]] applied when no resolver is present, or the resolver
   * does not attach one of its own. Used by the async path and by callers opting into
   * throw-behavior without registering a provider. Defaults to `"fallback"`.
   */
  readonly onMissingSpec?: FieldMissingSpecBehavior;
}

// Resolve the raw primitive value of the property that a field points to.
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

  // Capture the property's KindOfQuantity and persistence unit so quantity/coordinate fields
  // can be formatted through the standard iTwin.js quantity pipeline. JSON-in-string values
  // have no reliable KoQ association, so skip them.
  let kindOfQuantityFullName: string | undefined;
  let persistenceUnitFullName: string | undefined;
  if (propertyType === "quantity" || propertyType === "coordinate") {
    if (field.formatOptions?.quantity?.persistenceUnit) {
      persistenceUnitFullName = field.formatOptions.quantity.persistenceUnit;
    } else if (!isJsonPath) {
      kindOfQuantityFullName = ecProp.kindOfQuantity?.fullName;
      if (kindOfQuantityFullName) {
        persistenceUnitFullName = ecProp.getKindOfQuantitySync()?.persistenceUnit?.fullName;
      }
    }
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
  formattingSpecResolver?: FieldFormattingSpecResolver,
  onMissingSpec?: FieldMissingSpecBehavior,
): UpdateFieldsContext {
  return {
    hostElementId,
    getProperty: deleted ? () => undefined : (field) => getFieldPropertyValue(field, iModel),
    formattingSpecResolver,
    onMissingSpec,
  };
}

/** Builds a [[FieldFormatterContext]] backed by an iModel's schema context. Either provider may
 * be overridden to plug in an app's [FormattingSpecProvider]($core-quantity) (e.g. FormatSet-backed).
 * @internal
 */
export function createFieldFormatterContext(
  iModel: IModelDb,
  overrides?: { formatsProvider?: FormatsProvider; unitsProvider?: UnitsProvider },
): FieldFormatterContext {
  const unitsProvider = overrides?.unitsProvider ?? createUnitsProvider({ primary: new SchemaUnitProvider(iModel.schemaContext) });
  const formatsProvider = overrides?.formatsProvider ?? new SchemaFormatsProvider(iModel.schemaContext, "metric");
  return {
    unitsProvider,
    formatsProvider,
    specCache: new Map<string, FormatterSpec>(),
  };
}

// Recompute the display value of a single field, return false if it couldn't be evaluated.
export function updateField(field: FieldRun, context: UpdateFieldsContext): boolean {
  if (context.hostElementId && context.hostElementId !== field.propertyHost.elementId) {
    return false;
  }

  const throwOnMiss = context.onMissingSpec === "throw";
  let propValue: FieldValue | undefined;
  try {
    propValue = context.getProperty(field);
  } catch (err) {
    if (throwOnMiss) throw err;
    Logger.logError(BackendLoggerCategory.IModelDb, err);
  }

  let newContent: string | undefined;
  if (undefined !== propValue) {
    // Errors from a resolver-selected provider's own `onMissingSpec: "throw"` always propagate;
    // the context-level `onMissingSpec` only governs the no-resolver fallback path.
    if (context.formattingSpecResolver) {
      newContent = formatFieldValueWithSpecResolver(propValue, field.formatOptions, context.formattingSpecResolver);
    } else {
      newContent = formatFieldValue(propValue, field.formatOptions);
    }
  }

  newContent = newContent ?? FieldRun.invalidContentIndicator;
  if (newContent === field.cachedContent) {
    return false;
  }

  field.setCachedContent(newContent);
  return true;
}

// Async counterpart to updateField. Uses formatFieldValueAsync so "quantity" and "coordinate"
// fields render through the real quantity formatting pipeline.
export async function updateFieldAsync(field: FieldRun, context: UpdateFieldsContext, formatter: FieldFormatterContext): Promise<boolean> {
  if (context.hostElementId && context.hostElementId !== field.propertyHost.elementId) {
    return false;
  }

  const throwOnMiss = context.onMissingSpec === "throw";
  let newContent: string | undefined;
  try {
    const propValue = context.getProperty(field);
    if (undefined !== propValue) {
      newContent = await formatFieldValueAsync(propValue, field.formatOptions, formatter, context.onMissingSpec);
    }
  } catch (err) {
    if (throwOnMiss) throw err;
    Logger.logError(BackendLoggerCategory.IModelDb, err);
  }

  newContent = newContent ?? FieldRun.invalidContentIndicator;
  if (newContent === field.cachedContent) {
    return false;
  }

  field.setCachedContent(newContent);
  return true;
}

// Re-evaluates the display strings for all fields that target the element specified by `context` and returns the number
// of fields whose display strings changed as a result.
export function updateFields(textBlock: TextBlock, context: UpdateFieldsContext): number {
  let numUpdated = 0;
  for (const { child } of traverseTextBlockComponent(textBlock)) {
    if (child.type === "field" && updateField(child, context)) {
      ++numUpdated;
    }
  }

  return numUpdated;
}

// Async counterpart to updateFields.
export async function updateFieldsAsync(textBlock: TextBlock, context: UpdateFieldsContext, formatter: FieldFormatterContext): Promise<number> {
  let numUpdated = 0;
  for (const { child } of traverseTextBlockComponent(textBlock)) {
    if (child.type === "field" && await updateFieldAsync(child, context, formatter)) {
      ++numUpdated;
    }
  }

  return numUpdated;
}

function doUpdateFields(txn: EditTxn, annotationId: Id64String, sourceId: Id64String | undefined, deleted: boolean, resolver: FieldFormattingSpecResolver | undefined): void {
  const iModel = txn.iModel;
  try {
    const target = iModel.elements.getElement(annotationId);
    if (isITextAnnotation(target)) {
      const context = createUpdateContext(sourceId, iModel, deleted, resolver);
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

// Invoked by ElementDrivesTextAnnotation to update fields in target element when source element changes or is deleted.
export function updateElementFields(props: RelationshipProps, txn: EditTxn, deleted: boolean, resolver?: FieldFormattingSpecResolver): void {
  doUpdateFields(txn, props.targetId, props.sourceId, deleted, resolver);
}

export function updateAllFields(annotationElementId: Id64String, txn: EditTxn, resolver?: FieldFormattingSpecResolver): void {
  doUpdateFields(txn, annotationElementId, undefined, false, resolver);
}

// Resolves a FieldRun's target down to its terminal EC Property using schema metadata only
// (no ECSQL, no element values). Returns undefined when the path cannot be followed in the
// schema — notably when it dives into a JSON-in-string leaf, since such paths have no reliable
// ECProperty/KoQ association.
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

// Returns a FormattingSpecArgs entry for a single field, or undefined if the field needs no
// prepared spec.
function computeFieldFormattingRequirement(field: FieldRun, iModel: IModelDb): FormattingSpecArgs | undefined {
  const quantityOptions = field.formatOptions?.quantity;

  const ecProp = resolveFieldTerminalProperty(field, iModel);
  if (!ecProp) {
    return undefined;
  }

  const propertyType = determineFieldPropertyType(ecProp);
  if (propertyType !== "quantity" && propertyType !== "coordinate") {
    return undefined;
  }

  // KoQ name: explicit kindOfQuantity override > property KoQ.
  const koq = ecProp.kindOfQuantity ? ecProp.getKindOfQuantitySync() : undefined;
  const name = quantityOptions?.kindOfQuantity ?? koq?.fullName;
  if (!name) {
    return undefined;
  }

  // Persistence unit: explicit persistenceUnit override > KoQ persistence unit.
  const persistenceUnitName = quantityOptions?.persistenceUnit ?? koq?.persistenceUnit?.fullName;
  if (!persistenceUnitName) {
    return undefined;
  }

  const args: FormattingSpecArgs = { name, persistenceUnitName };
  return args;
}

/** Walks the [FieldRun]($common)s in `textBlock` and returns a deduplicated list of the
 * [FormattingSpecArgs]($core-quantity) their `"quantity"` and `"coordinate"` values need to be
 * formatted through the standard iTwin.js quantity pipeline.
 *
 * Intended for an app-supplied [FormattingSpecProvider]($core-quantity) to pre-warm its cache
 * before an annotation is inserted, updated, or re-evaluated. Fields carrying an inline
 * [QuantityFieldFormatOptions.format]($common) override are excluded — they need no lookup.
 * @internal
 */
export function collectFieldFormattingRequirements(textBlock: TextBlock, iModel: IModelDb): FormattingSpecArgs[] {
  const seen = new Map<string, FormattingSpecArgs>();
  for (const { child } of traverseTextBlockComponent(textBlock)) {
    if (child.type !== "field") {
      continue;
    }
    const args = computeFieldFormattingRequirement(child, iModel);
    if (!args) {
      continue;
    }
    const key = `${args.name}|${args.persistenceUnitName}`;
    if (!seen.has(key)) {
      seen.set(key, args);
    }
  }
  return Array.from(seen.values());
}
