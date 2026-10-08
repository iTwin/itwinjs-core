/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { FieldPrimitiveValue, FieldPropertyType, FieldRun, FieldValue, formatFieldValue, FormatMagnitude, QueryBinder, QueryRowFormat, RelationshipProps, TextBlock, traverseTextBlockComponent } from "@itwin/core-common";
import { IModelDb } from "../../IModelDb";
import { assert, expectDefined, Id64String, Logger } from "@itwin/core-bentley";
import { BackendLoggerCategory } from "../../BackendLoggerCategory";
import { isITextAnnotation } from "../../annotations/ElementDrivesTextAnnotation";
import { AnyClass, EntityClass, PrimitiveType, Property, PropertyType, StructArrayProperty } from "@itwin/ecschema-metadata";
import { reshapePropertyValue } from "../ECSqlInstanceReshaper";
import { FieldFormatting, getFieldFormatting, lookupFieldSpec, ResolvedFieldValue } from "./fieldSpecs";
import type { EditTxn } from "../../EditTxn";
interface FieldStructValue { [key: string]: any }

// An intermediate value obtained while evaluating a FieldPropertyPath.
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
  getProperty(field: FieldRun): ResolvedFieldValue | undefined;

  /** The formats `"quantity"` and `"coordinate"` values resolve through. [[updateField]] builds
   * a [FormatterSpec]($core-quantity) per field from the FormatSet named by
   * [QuantityFieldFormatOptions.formatSet]($common), falling back to the adopted FormatSet and
   * the schemas; a value none of them can format falls back to `value.toString()`.
   * [[createUpdateContext]] always supplies the iModel's formatting; only hand-built contexts in
   * tests that never format a quantity leave it out.
   */
  readonly formatting?: FieldFormatting;
}

// Resolves the property a field points at into a [[ResolvedFieldValue]] — primitive value plus, for
// `"quantity"` / `"coordinate"` types, the property-side KoQ and persistence unit.
function getFieldPropertyValue(field: FieldRun, iModel: IModelDb): ResolvedFieldValue | undefined {
  const host = field.propertyHost;
  const schemaItem = iModel.schemaContext.getSchemaItemSync(host.schemaName, host.className);
  if (!EntityClass.isEntityClass(schemaItem)) {
    return undefined;
  }

  let ecClass: AnyClass = schemaItem;
  const { propertyName, accessors, jsonAccessors } = field.propertyPath;
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
      return {
        primitive: ecProp.primitiveType === PrimitiveType.DateTime ? new Date(rootValue) : rootValue,
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

  // The ultimate result must be a primitive value.
  if (undefined === curValue.primitive) {
    return undefined;
  }

  // `jsonAccessors` continue the walk inside a serialized JSON string. There is no schema behind a JSON blob, so the
  // property must declare itself as JSON via its extended type; an un-indexed JSON property resolves to the raw string.
  if (jsonAccessors && jsonAccessors.length > 0) {
    if (!isJsonProperty(ecProp) || typeof curValue.primitive !== "string") {
      return undefined;
    }

    return readJsonLeaf(curValue.primitive, jsonAccessors);
  }

  const propertyType = determineFieldPropertyType(ecProp);
  if (!propertyType) {
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

  return { value: curValue.primitive, type: propertyType, kindOfQuantityFullName, persistenceUnitFullName };
}

function isJsonProperty(prop: Property): boolean {
  return prop.isPrimitive() && !prop.isArray() && prop.primitiveType === PrimitiveType.String && prop.extendedTypeName === "Json";
}

/** Applies [FieldPropertyPath.jsonAccessors]($common) to a string property holding serialized JSON,
 * as a walk entirely separate from the EC one: there is no schema behind a JSON blob, so no EC
 * metadata is consulted.
 *
 * Returns `undefined` when `raw` is not JSON, when an accessor does not resolve, or when the path
 * stops anywhere but a scalar — including on a JSON `null`, which is not a
 * [FieldPrimitiveValue]($common).
 */
function readJsonLeaf(raw: string, accessors: ReadonlyArray<string | number>): FieldValue | undefined {
  let cur: any;
  try {
    cur = JSON.parse(raw);
  } catch {
    // Not valid JSON; treat as a normal string.
    return undefined;
  }

  for (const accessor of accessors) {
    // A number indexes an array and a string keys an object; anything else doesn't resolve.
    const isIndex = typeof accessor === "number";
    if (typeof cur !== "object" || null === cur || Array.isArray(cur) !== isIndex) {
      return undefined;
    }

    if (isIndex) {
      cur = cur[accessor < 0 ? cur.length + accessor : accessor];
    } else {
      // Own keys only, so a key missing from the JSON can't resolve through Object.prototype.
      cur = Object.hasOwn(cur, accessor) ? cur[accessor] : undefined;
    }
  }

  // JSON carries no type metadata, so the leaf's JavaScript type decides the field property type.
  // A numeric leaf is typed `"quantity"` but has no property-side KoQ, so only the field's own
  // `kindOfQuantity` + `persistenceUnit` overrides can name a format for it.
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

export function createUpdateContext(hostElementId: string | undefined, iModel: IModelDb, deleted: boolean): UpdateFieldsContext {
  return {
    hostElementId,
    getProperty: deleted ? () => undefined : (field) => getFieldPropertyValue(field, iModel),
    formatting: getFieldFormatting(iModel),
  };
}

/** Resolves the [FormatterSpec]($core-quantity) this field should render its magnitudes through,
 * returning a callback bound to it, or `undefined` when not a quantity or coordinate, no formats
 * were supplied, or no format resolves for any of the (KindOfQuantity, persistence unit) pairs the
 * field may format through. In that last case the shortfall is logged: a persistence unit or
 * format unit outside the bundled BIS set, a KindOfQuantity with no presentation format, or a
 * format whose units belong to a different phenomenon than the persisted value. A
 * `persistenceUnit` override that disagrees with the property's own unit is ignored and logged
 * too; the property's unit is what the stored magnitude means.
 */
function resolveFormatMagnitude(value: ResolvedFieldValue, field: FieldRun, context: UpdateFieldsContext): FormatMagnitude | undefined {
  const formatting = context.formatting;
  if (!formatting || (value.type !== "quantity" && value.type !== "coordinate")) {
    return undefined;
  }

  const quantityOptions = field.formatOptions?.quantity;
  const { spec, candidates, ignoredPersistenceUnit } = lookupFieldSpec(quantityOptions, value, formatting);
  if (ignoredPersistenceUnit) {
    Logger.logWarning(BackendLoggerCategory.IModelDb, "Ignoring persistenceUnit override that disagrees with the property's own persistence unit", () => ({
      elementId: field.propertyHost.elementId,
      propertyName: field.propertyPath.propertyName,
      persistenceUnit: ignoredPersistenceUnit,
      propertyPersistenceUnit: value.persistenceUnitFullName,
    }));
  }
  if (!spec) {
    if (candidates.length > 0) {
      Logger.logWarning(BackendLoggerCategory.IModelDb, "No format resolved for text annotation field; rendering raw value", () => ({
        elementId: field.propertyHost.elementId,
        propertyName: field.propertyPath.propertyName,
        formatSet: quantityOptions?.formatSet,
        tried: candidates.map((c) => `${c.name} in ${c.persistenceUnitName}`),
      }));
    }
    return undefined;
  }

  return (magnitude) => spec.applyFormatting(magnitude);
}

/** Recomputes a single field's cached display string synchronously. Returns true iff
 * cachedContent changed.
 *
 * Resolving the property value and formatting it are both fallible. A failure of either is
 * logged and degrades *this* field to [FieldRun.invalidContentIndicator]($common); other
 * fields in the same block are unaffected.
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

function doUpdateFields(txn: EditTxn, annotationId: Id64String, sourceId: Id64String | undefined, deleted: boolean): void {
  const iModel = txn.iModel;
  try {
    const target = iModel.elements.getElement(annotationId);
    if (isITextAnnotation(target)) {
      const context = createUpdateContext(sourceId, iModel, deleted);
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
export function updateElementFields(props: RelationshipProps, txn: EditTxn, deleted: boolean): void {
  doUpdateFields(txn, props.targetId, props.sourceId, deleted);
}

/** Re-evaluates every field of the given annotation element against its current property
 * values. Invoked from [[ElementDrivesTextAnnotation.updateFieldDependencies]] when
 * establishing / refreshing relationships.
 */
export function updateAllFields(annotationElementId: Id64String, txn: EditTxn): void {
  doUpdateFields(txn, annotationElementId, undefined, false);
}
