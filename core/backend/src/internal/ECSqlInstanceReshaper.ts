/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { AnyClass, ECClass, PrimitiveType, Property, StructClass } from "@itwin/ecschema-metadata";
import { IModelDb } from "../IModelDb";

// This module reimplements the value-shaping behavior of the deprecated `QueryRowFormat.UseJsPropertyNames`
// row format in order to preserve existing `@public`/`@beta` output shapes. This is a deliberate bridge, not
// a permanent architecture - see https://github.com/iTwin/itwinjs-core/issues/9489 for the follow-up to
// revisit/remove the need for it.

/** Maps the ECSQL system properties/pseudo-columns implicitly included by a bare `SELECT *` to the
 * JavaScript-style property name historically produced by the deprecated `QueryRowFormat.UseJsPropertyNames`
 * row format. `*ClassId` columns require resolving a raw class Id to a fully-qualified, dot-separated
 * class name (e.g. "BisCore.PhysicalElement") to match that legacy shape.
 */
const systemPropertyJsNames = new Map<string, { jsName: string, isClassId?: boolean }>([
  ["ECInstanceId", { jsName: "id" }],
  ["ECClassId", { jsName: "className", isClassId: true }],
  ["SourceECInstanceId", { jsName: "sourceId" }],
  ["SourceECClassId", { jsName: "sourceClassName", isClassId: true }],
  ["TargetECInstanceId", { jsName: "targetId" }],
  ["TargetECClassId", { jsName: "targetClassName", isClassId: true }],
]);

function lowerFirstChar(name: string): string {
  return name.length === 0 ? name : `${name[0].toLowerCase()}${name.substring(1)}`;
}

function classIdToDotClassName(iModel: IModelDb, classId: string): string {
  try {
    return iModel.getClassNameFromId(classId).replace(":", ".");
  } catch {
    // Mirrors the native UseJsPropertyNames row adaptor: if a classId can't be resolved to a class (e.g. a
    // stale or otherwise unresolvable class reference), fall back to the raw classId instead of throwing
    // and aborting the entire row/query.
    return classId;
  }
}

/** Recursively reshape a struct value - each of whose members was queried with the non-deprecated
 * `QueryRowFormat.UseECSqlPropertyNames` row format - into the shape historically produced by the
 * deprecated `QueryRowFormat.UseJsPropertyNames` row format.
 */
function reshapeStruct(value: { [propName: string]: any }, structClass: StructClass, iModel: IModelDb): { [propName: string]: any } {
  const result: { [propName: string]: any } = {};
  for (const key of Object.keys(value)) {
    const memberValue = value[key];
    if (undefined === memberValue || null === memberValue) {
      continue;
    }

    const memberProp = structClass.getPropertySync(key);
    result[lowerFirstChar(key)] = memberProp ? reshapePropertyValue(memberValue, memberProp, iModel) : memberValue;
  }
  return result;
}

/** Reshape a scalar (non-struct, non-array, non-navigation) property value. Point2d/Point3d values are the
 * only scalar values whose member names differ from `UseECSqlPropertyNames` (X/Y/Z) to `UseJsPropertyNames`
 * (x/y/z) - all other primitive/enumeration values are unaffected by row format.
 */
function reshapeScalar(value: any, prop: Property): any {
  if (prop.isPrimitive()) {
    if (prop.primitiveType === PrimitiveType.Point2d) {
      return { x: value.X, y: value.Y };
    }
    if (prop.primitiveType === PrimitiveType.Point3d) {
      return { x: value.X, y: value.Y, z: value.Z };
    }
  }
  return value;
}

/** Recursively reshape a single property value - queried with the non-deprecated
 * `QueryRowFormat.UseECSqlPropertyNames` row format - into the shape historically produced by the
 * deprecated `QueryRowFormat.UseJsPropertyNames` row format, using `prop`'s ECSchema metadata to
 * correctly identify struct, array, point, and navigation values instead of guessing from the value's
 * runtime shape alone.
 * @internal
 */
export function reshapePropertyValue(value: any, prop: Property, iModel: IModelDb): any {
  // ECStructClass cannot declare navigation properties, so this only ever applies to a top-level property.
  if (prop.isNavigation()) {
    const result: { id: any, relClassName?: string } = { id: value.Id };
    // As in the native row adaptor, omit relClassName entirely if the relationship class Id is unset,
    // rather than including it with an unresolvable/undefined value.
    if (undefined !== value.RelECClassId && null !== value.RelECClassId) {
      result.relClassName = classIdToDotClassName(iModel, value.RelECClassId);
    }
    return result;
  }

  if (prop.isArray()) {
    if (!Array.isArray(value)) {
      return value;
    }
    // Matches the native row adaptor: null/undefined elements are dropped from primitive arrays, but
    // preserved as an empty object placeholder in struct arrays (array length/index is kept intact).
    return prop.isStruct()
      ? value.map((element) => (undefined === element || null === element) ? {} : reshapeStruct(element, prop.structClass, iModel))
      : value.filter((element) => undefined !== element && null !== element).map((element) => reshapeScalar(element, prop));
  }

  if (prop.isStruct()) {
    return reshapeStruct(value, prop.structClass, iModel);
  }

  return reshapeScalar(value, prop);
}

/**
 * Recursively reshapes an ECSQL instance row - queried with the non-deprecated
 * [[QueryRowFormat.UseECSqlPropertyNames]] row format from a `SELECT *` (or equivalent) against a class
 * only known at runtime - into the shape historically produced by the deprecated
 * [[QueryRowFormat.UseJsPropertyNames]] row format (first letter of each property name lowercased, and
 * struct/array/point/navigation values recursively renamed to match).
 *
 * `UseJsPropertyNames` isn't just column-name casing: it also governs how struct, Point2d, Point3d, and
 * Navigation property *values* are recursively serialized by the native binding, and there is no
 * independent flag to keep that value serialization while only changing the naming convention. So rather
 * than guessing from naming convention or doing a flat, non-recursive rename (which can corrupt nested
 * struct/point/navigation values), this function walks the runtime class's ECSchema metadata to reshape
 * every nested value consistently with its declared property type.
 * @internal
 */
export function reshapeInstanceRow(row: { [propName: string]: any }, ecClass: AnyClass, iModel: IModelDb): { [propName: string]: any } {
  const result: { [propName: string]: any } = {};
  for (const key of Object.keys(row)) {
    const value = row[key];
    if (undefined === value || null === value) {
      continue;
    }

    const systemProperty = systemPropertyJsNames.get(key);
    if (systemProperty) {
      result[systemProperty.jsName] = systemProperty.isClassId ? classIdToDotClassName(iModel, value) : value;
      continue;
    }

    const prop = ecClass.getPropertySync(key);
    result[lowerFirstChar(key)] = prop ? reshapePropertyValue(value, prop, iModel) : value;
  }
  return result;
}

/** Resolves the runtime [[AnyClass]] metadata for a "Schema:Class" or "Schema.Class" full class name,
 * for use with [[reshapeInstanceRow]].
 * @internal
 */
export function getRuntimeClass(iModel: IModelDb, fullClassName: string): AnyClass {
  const schemaItem = iModel.schemaContext.getSchemaItemSync(fullClassName);
  if (undefined === schemaItem || !ECClass.isECClass(schemaItem)) {
    throw new Error(`Class not found: ${fullClassName}`);
  }
  return schemaItem;
}
