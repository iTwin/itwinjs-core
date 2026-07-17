/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
// Reimplements `UseJsPropertyNames` value shaping so `@public`/`@beta` output stays the same after it's
// deprecated. not permanent - see https://github.com/iTwin/itwinjs-core/issues/9489.
import { AnyClass, ECClass, PrimitiveType, Property, StructClass } from "@itwin/ecschema-metadata";
import { IModelDb } from "../IModelDb";

/** Maps `SELECT *` system properties/pseudo-columns to their legacy JS property name. `*ClassId` columns
 * also resolve their raw class Id to a dot-separated class name (e.g. "BisCore.PhysicalElement").
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
    // fall back to raw classId instead of throwing if it can't be resolved
    return classId;
  }
}

/** Reshape a struct value's members from `UseECSqlPropertyNames` to `UseJsPropertyNames`, recursively. */
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

/** Reshape a scalar (non-struct, non-array, non-navigation) value. Only Point2d/Point3d change shape
 * (X/Y/Z -> x/y/z); other primitives/enumerations pass through unchanged.
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

/** Reshape a single value from `UseECSqlPropertyNames` to `UseJsPropertyNames`, dispatching on `prop`'s
 * declared type (struct/array/point/navigation) instead of guessing from the value's shape.
 * @internal
 */
export function reshapePropertyValue(value: any, prop: Property, iModel: IModelDb): any {
  // struct classes can't declare navigation properties, so this only applies at the top level
  if (prop.isNavigation()) {
    const result: { id: any, relClassName?: string } = { id: value.Id };
    // omit relClassName entirely if the relationship class Id is unset, rather than set to undefined
    if (undefined !== value.RelECClassId && null !== value.RelECClassId) {
      result.relClassName = classIdToDotClassName(iModel, value.RelECClassId);
    }
    return result;
  }

  if (prop.isArray()) {
    if (!Array.isArray(value)) {
      return value;
    }
    // null/undefined elements are dropped from primitive arrays, but kept as an empty object placeholder
    // in struct arrays, to preserve array length/index
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
 * Reshapes a `SELECT *` row queried with `UseECSqlPropertyNames` into the legacy `UseJsPropertyNames`
 * shape, for a class only known at runtime. Walks `ecClass`'s metadata to rename each property, since a
 * row's runtime shape alone can't tell a struct/point/navigation value apart from a plain object.
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

/** Resolves the runtime [[AnyClass]] metadata for a "Schema:Class" or "Schema.Class" name.
 * @internal
 */
export function getRuntimeClass(iModel: IModelDb, fullClassName: string): AnyClass {
  const schemaItem = iModel.schemaContext.getSchemaItemSync(fullClassName);
  if (undefined === schemaItem || !ECClass.isECClass(schemaItem)) {
    throw new Error(`Class not found: ${fullClassName}`);
  }
  return schemaItem;
}
