/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module ECSQL */

import { assert, Id64String } from "@bentley/bentleyjs-core";

/** Describes the different data types an ECSQL value can be of.
 *
 * See also [ECSQL]($docs/learning/ECSQL).
 */
export enum ECSqlValueType {
  // do not change the values of the enum as it must match its counterpart in the addon
  Blob = 1,
  Boolean = 2,
  DateTime = 3,
  Double = 4,
  Geometry = 5,
  Id = 6,
  Int = 7,
  Int64 = 8,
  Point2d = 9,
  Point3d = 10,
  String = 11,
  Navigation = 12,
  Struct = 13,
  PrimitiveArray = 14,
  StructArray = 15,
  Guid = 16,
}

/** An ECSQL Navigation value.
 *
 * It is returned from ECSQL SELECT statements for navigation properties.
 *
 * See also [ECSQL]($docs/learning/ECSQL).
 */
export interface NavigationValue {
  /** ECInstanceId of the related instance */
  id: Id64String;
  /** Fully qualified class name of the relationship backing the Navigation property */
  relClassName?: string;
}

/** An ECSqlTypedString is used to decorate a string value with type information.
 *  This is necessary, when binding parameters to an ECSQL statement so that
 *  iModel.js can figure out the right EC type from the string value.
 *
 *  See also [iModel.js Types used in ECSQL Parameter Bindings]($docs/learning/ECSQLParameterTypes).
 */
export interface ECSqlTypedString {
  type: ECSqlStringType;
  value: string;
}

/** Type of an [ECSqlTypedString]($common) */
export enum ECSqlStringType {
  /** The string represents a BLOB value, formatted as Base64 string. */
  Blob,
  /** The string represents a DateTime value, formatted as ISO8601 string. */
  DateTime,
  /** The string represents a GUID value, formatted as GUID string (see [Guid]($bentleyjs-core)). */
  Guid,
  /** The string represents an Id value, formatted as hexadecimal string (see [Id64]($bentleyjs-core)). */
  Id,
  /** The string is not specifically typed. */
  String,
}

/** An ECSQL Navigation value which can be bound to a navigation property ECSQL parameter
 *
 * See also [ECSQL]($docs/learning/ECSQL).
 */
export interface NavigationBindingValue {
  /** ECInstanceId of the related instance */
  id: ECSqlTypedString | Id64String;
  /** Fully qualified class name of the relationship backing the Navigation property */
  relClassName?: string;
  /** Table space where the relationship's schema is persisted. This is only required
   * if other ECDb files are attached to the primary one. In case a schema exists in more than one of the files,
   * pass the table space to disambiguate.
   */
  relClassTableSpace?: string;
}

/** Equivalent of the ECEnumeration OpCode in the **ECDbChange** ECSchema.
 *
 * The enum can be used when programmatically binding values to the InstanceChange.OpCode property of
 * the ECDbChange ECSchema.
 *
 *  See also
 *  - [ChangeSummary Overview]($docs/learning/ChangeSummaries)
 */
export enum ChangeOpCode {
  Insert = 1,
  Update = 2,
  Delete = 4,
}

/** The enum represents the values for the ChangedValueState argument of the ECSQL function
 *  **Changes**.
 *
 * The enum can be used when programmatically binding values to the ChangedValueState argument
 * in an ECSQL using the **Changes** ECSQL function.
 *
 *  See also
 *  - [ChangeSummary Overview]($docs/learning/ChangeSummaries)
 */
export enum ChangedValueState {
  AfterInsert = 1,
  BeforeUpdate = 2,
  AfterUpdate = 3,
  BeforeDelete = 4,
}

/** Defines the ECSQL system properties.
 *
 * See also [ECSQL]($docs/learning/ECSQL).
 */
export enum ECSqlSystemProperty {
  ECInstanceId,
  ECClassId,
  SourceECInstanceId,
  SourceECClassId,
  TargetECInstanceId,
  TargetECClassId,
  NavigationId,
  NavigationRelClassId,
  PointX,
  PointY,
  PointZ,
}

/** Utility to format ECProperty names according to the iModel.js formatting rules.
 *
 *  See also [ECSQL Row Format]($docs/learning/ECSQLRowFormat).
 */
export class ECJsNames {

  /** Formats the specified ECProperty name according to the iModel.js formatting rules.
   *
   *  See [ECSQL Row Format]($docs/learning/ECSQLRowFormat) which describes the formatting rules.
   *
   * @param ecProperty Property name as defined in the ECSchema for regular ECProperties
   *        or the name of an ECSQL system properties
   * @param isSystemProperty if ommitted, the method will try to find out whether the given property
   *        is a system property or not. If true is specified, the method will throw if the property name
   *        is not a known system property. If false is specified, the method will not attempt to recognize
   *        the property name as system property.
   */
  public static toJsName(propName: string, isSystemProperty?: boolean) {
    assert(propName !== undefined, "propName must not be undefined");

    const propTypeUnknown: boolean = isSystemProperty === undefined || isSystemProperty === null;

    const accessStringTokens: string[] = propName.split(".");
    const tokenCount: number = accessStringTokens.length;
    assert(tokenCount > 0);

    if (tokenCount === 1) {
      if (propTypeUnknown || isSystemProperty!) {
        if (propName === "ECInstanceId")
          return ECJsNames.systemPropertyToJsName(ECSqlSystemProperty.ECInstanceId);

        if (propName === "ECClassId")
          return ECJsNames.systemPropertyToJsName(ECSqlSystemProperty.ECClassId);

        if (propName === "SourceECInstanceId")
          return ECJsNames.systemPropertyToJsName(ECSqlSystemProperty.SourceECInstanceId);

        if (propName === "TargetECInstanceId")
          return ECJsNames.systemPropertyToJsName(ECSqlSystemProperty.TargetECInstanceId);

        if (propName === "SourceECClassId")
          return ECJsNames.systemPropertyToJsName(ECSqlSystemProperty.SourceECClassId);

        if (propName === "TargetECClassId")
          return ECJsNames.systemPropertyToJsName(ECSqlSystemProperty.TargetECClassId);

        if (propTypeUnknown)
          return ECJsNames.lowerFirstChar(propName);

        throw new Error(`Property ${propName} is no ECSQL system property.`);
      }

      return ECJsNames.lowerFirstChar(propName);
    }

    // parse access string and convert the leaf tokens if they are system props
    // The first char of the access string is lowered.
    let jsName: string = ECJsNames.lowerFirstChar(accessStringTokens[0] + ".");
    for (let j = 1; j < tokenCount - 1; j++) {
      jsName += accessStringTokens[j] + ".";
    }

    const leafToken: string = accessStringTokens[tokenCount - 1];

    if (propTypeUnknown || isSystemProperty!) {
      if (leafToken === "Id")
        jsName += ECJsNames.systemPropertyToJsName(ECSqlSystemProperty.NavigationId);
      else if (leafToken === "RelECClassId")
        jsName += ECJsNames.systemPropertyToJsName(ECSqlSystemProperty.NavigationRelClassId);
      else if (leafToken === "X")
        jsName += ECJsNames.systemPropertyToJsName(ECSqlSystemProperty.PointX);
      else if (leafToken === "Y")
        jsName += ECJsNames.systemPropertyToJsName(ECSqlSystemProperty.PointY);
      else if (leafToken === "Z")
        jsName += ECJsNames.systemPropertyToJsName(ECSqlSystemProperty.PointZ);
      else if (propTypeUnknown)
        jsName += ECJsNames.lowerFirstChar(leafToken);
      else
        throw new Error(`Property ${leafToken} of access string ${propName} is no ECSQL system property.`);
    } else
      jsName += leafToken;

    return jsName;
  }

  /** Returns the name of the specified ECSQL system property according to the
   *  iModel.js formatting rules.
   *
   *  See [ECSQL Row Format]($docs/learning/ECSQLRowFormat) which describes the formatting rules.
   * @param systemPropertyType System property type
   */
  public static systemPropertyToJsName(systemPropertyType: ECSqlSystemProperty): string {
    switch (systemPropertyType) {
      case ECSqlSystemProperty.ECInstanceId:
      case ECSqlSystemProperty.NavigationId:
        return "id";
      case ECSqlSystemProperty.ECClassId:
        return "className";
      case ECSqlSystemProperty.SourceECInstanceId:
        return "sourceId";
      case ECSqlSystemProperty.SourceECClassId:
        return "sourceClassName";
      case ECSqlSystemProperty.TargetECInstanceId:
        return "targetId";
      case ECSqlSystemProperty.TargetECClassId:
        return "targetClassName";
      case ECSqlSystemProperty.NavigationRelClassId:
        return "relClassName";
      case ECSqlSystemProperty.PointX:
        return "x";
      case ECSqlSystemProperty.PointY:
        return "y";
      case ECSqlSystemProperty.PointZ:
        return "z";
      default:
        throw new Error(`Unknown ECSqlSystemProperty enum value ${systemPropertyType}.`);
    }
  }

  private static lowerFirstChar(name: string): string { return name[0].toLowerCase() + name.substring(1); }
}
