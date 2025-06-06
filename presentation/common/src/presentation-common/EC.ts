/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Core
 */

import { assert, Id64String } from "@itwin/core-bentley";
import { FormatProps } from "@itwin/core-quantity";
import { parseFullClassName } from "@itwin/presentation-shared";
import { PartialBy } from "./Utils.js";

/**
 * Type of an ECClass ID.
 * @public
 */
export type ClassId = Id64String;

/**
 * Type of an ECInstance ID.
 * @public
 */
export type InstanceId = Id64String;

/**
 * A key that uniquely identifies an instance in an iModel
 * @public
 */
export interface InstanceKey {
  /** Full class name in format `SchemaName:ClassName` */
  className: string;
  /** ECInstance ID */
  id: InstanceId;
}

/** @public */
export namespace InstanceKey {
  /** Compare 2 instance keys */
  export function compare(lhs: InstanceKey, rhs: InstanceKey): number {
    const lhsClass = parseFullClassName(lhs.className);
    const rhsClass = parseFullClassName(rhs.className);
    const schemaNameCompare = lhsClass.schemaName.toLowerCase().localeCompare(rhsClass.schemaName.toLowerCase());
    if (schemaNameCompare !== 0) {
      return schemaNameCompare;
    }
    const classNameCompare = lhsClass.className.toLowerCase().localeCompare(rhsClass.className.toLowerCase());
    if (classNameCompare !== 0) {
      return classNameCompare;
    }
    return lhs.id.toLowerCase().localeCompare(rhs.id.toLowerCase());
  }
}

/**
 * Information about an ECClass
 * @public
 */
export interface ClassInfo {
  /** ECClass ID */
  id: ClassId;
  /** Full class name in format `SchemaName:ClassName` */
  name: string;
  /** ECClass label */
  label: string;
}

/**
 * A serialized and compressed version of [[ClassInfo]]
 * @public
 */
export interface CompressedClassInfoJSON {
  name: string;
  label: string;
}

/**
 * A single choice in enumeration
 * @public
 */
export interface EnumerationChoice {
  /** Label of the choice */
  label: string;
  /** Value of the choice */
  value: string | number;
}

/**
 * Enumeration information
 * @public
 */
export interface EnumerationInfo {
  /** Available enumeration choices */
  choices: EnumerationChoice[];
  /** Is the enumeration strict (values only allowed from `choices` list) */
  isStrict: boolean;
}

/**
 * Kind of quantity information
 * @public
 */
export interface KindOfQuantityInfo {
  /** Full name of KindOfQuantity in format `SchemaName:KindOfQuantityName` */
  name: string;
  /** Label of KindOfQuantity */
  label: string;
  /** Persistence unit full class name in format `SchemaName:UnitName`. */
  persistenceUnit: string;
  /** Active format that was used to format property value. */
  activeFormat?: FormatProps;
}

/**
 * A data structure for storing navigation property information.
 * @public
 */
export interface NavigationPropertyInfo {
  /** Information about ECProperty's relationship class */
  classInfo: ClassInfo;
  /** Is the direction of the relationship forward */
  isForwardRelationship: boolean;
  /** Information about ECProperty's target class */
  targetClassInfo: ClassInfo;
  /** Is ECProperty's target class polymorphic */
  isTargetPolymorphic: boolean;
}

/**
 * Contains utilities for working with objects of [[NavigationPropertyInfo]] type.
 * @public
 */
export namespace NavigationPropertyInfo {
  /** Serialize [[NavigationPropertyInfo]] to compressed JSON */
  export function toCompressedJSON(
    navigationPropertyInfo: NavigationPropertyInfo,
    classesMap: { [id: string]: CompressedClassInfoJSON },
  ): NavigationPropertyInfoJSON<string> {
    const { id: relationshipId, ...relationshipLeftOverInfo } = navigationPropertyInfo.classInfo;
    const { id: targetId, ...targetLeftOverInfo } = navigationPropertyInfo.targetClassInfo;
    classesMap[relationshipId] = relationshipLeftOverInfo;
    classesMap[targetId] = targetLeftOverInfo;

    return {
      ...navigationPropertyInfo,
      classInfo: relationshipId,
      targetClassInfo: targetId,
    };
  }

  /** Deserialize [[NavigationPropertyInfo]] from compressed JSON */
  export function fromCompressedJSON(
    compressedNavigationPropertyInfoJSON: NavigationPropertyInfoJSON<string>,
    classesMap: { [id: string]: CompressedClassInfoJSON },
  ): NavigationPropertyInfo {
    return {
      ...compressedNavigationPropertyInfoJSON,
      classInfo: { id: compressedNavigationPropertyInfoJSON.classInfo, ...classesMap[compressedNavigationPropertyInfoJSON.classInfo] },
      targetClassInfo: { id: compressedNavigationPropertyInfoJSON.targetClassInfo, ...classesMap[compressedNavigationPropertyInfoJSON.targetClassInfo] },
    };
  }
}

/**
 * A serialized version of [[NavigationPropertyInfo]]
 * @public
 */
export interface NavigationPropertyInfoJSON<TClassInfoJSON = ClassInfo> {
  classInfo: TClassInfoJSON;
  isForwardRelationship: boolean;
  targetClassInfo: TClassInfoJSON;
  isTargetPolymorphic: boolean;
}

/**
 * A structure that describes an ECProperty
 * @public
 */
export interface PropertyInfo {
  /** Information about ECProperty class */
  classInfo: ClassInfo;
  /** Name of the ECProperty */
  name: string;
  /** Type name of the ECProperty */
  type: string;
  /** Enumeration info if the property is enumerable */
  enumerationInfo?: EnumerationInfo;
  /** Kind of quantity information, if any. */
  kindOfQuantity?: KindOfQuantityInfo;
  /** Extended type name of the ECProperty if it has one */
  extendedType?: string;
  /** Navigation property info if the field is navigation type */
  navigationPropertyInfo?: NavigationPropertyInfo;
  /** Constraints for values of ECProperty */
  constraints?: PropertyValueConstraints;
}

/**
 * Constraints for values of ECProperty
 * @public
 */
export type PropertyValueConstraints = StringPropertyValueConstraints | ArrayPropertyValueConstraints | NumericPropertyValueConstraints;

/**
 * Describes constraints for `string` type ECProperty values
 * @public
 */
export interface StringPropertyValueConstraints {
  minimumLength?: number;
  maximumLength?: number;
}

/**
 * Describes constraints for `int` | `double` | `float` type ECProperty values
 * @public
 */
export interface NumericPropertyValueConstraints {
  minimumValue?: number;
  maximumValue?: number;
}

/**
 * Describes constraints for `array` type ECProperty values
 * @public
 */
export interface ArrayPropertyValueConstraints {
  minOccurs?: number;
  maxOccurs?: number;
}

/** @public */
export namespace PropertyInfo {
  /** Serialize [[PropertyInfo]] to compressed JSON */
  export function toCompressedJSON(propertyInfo: PropertyInfo, classesMap: { [id: string]: CompressedClassInfoJSON }): PropertyInfoJSON<string> {
    const { navigationPropertyInfo, ...leftOverPropertyInfo } = propertyInfo;
    const { id, ...leftOverInfo } = propertyInfo.classInfo;
    classesMap[id] = leftOverInfo;

    return {
      ...leftOverPropertyInfo,
      classInfo: propertyInfo.classInfo.id,
      ...(navigationPropertyInfo ? { navigationPropertyInfo: NavigationPropertyInfo.toCompressedJSON(navigationPropertyInfo, classesMap) } : undefined),
    };
  }
}

/**
 * A serialized version of [[PropertyInfo]]
 * @public
 */
export interface PropertyInfoJSON<TClassInfoJSON = ClassInfo> {
  classInfo: TClassInfoJSON;
  name: string;
  type: string;
  enumerationInfo?: EnumerationInfo;
  kindOfQuantity?: KindOfQuantityInfo;
  navigationPropertyInfo?: NavigationPropertyInfoJSON<TClassInfoJSON>;
}

/**
 * A structure that describes a related class and the properties of that relationship.
 * @public
 */
export interface RelatedClassInfo {
  /** Information about the source ECClass */
  sourceClassInfo: ClassInfo;

  /** Information about the target ECClass */
  targetClassInfo: ClassInfo;

  /** Is target class handled polymorphically */
  isPolymorphicTargetClass?: boolean;

  /** Optionally, IDs of specific target class instances. */
  targetInstanceIds?: Id64String[];

  /** Information about the ECRelationship */
  relationshipInfo: ClassInfo;

  /** Should relationship be followed in a forward direction to access the related class. */
  isForwardRelationship: boolean;

  /** Is relationship handled polymorphically */
  isPolymorphicRelationship?: boolean;
}

/** @public */
export namespace RelatedClassInfo {
  /** Serialize [[RelatedClassInfo]] to compressed JSON */
  export function toCompressedJSON(classInfo: RelatedClassInfo, classesMap: { [id: string]: CompressedClassInfoJSON }): RelatedClassInfoJSON<string> {
    const { id: sourceId, ...sourceLeftOverInfo } = classInfo.sourceClassInfo;
    const { id: targetId, ...targetLeftOverInfo } = classInfo.targetClassInfo;
    const { id: relationshipId, ...relationshipLeftOverInfo } = classInfo.relationshipInfo;

    classesMap[sourceId] = sourceLeftOverInfo;
    classesMap[targetId] = targetLeftOverInfo;
    classesMap[relationshipId] = relationshipLeftOverInfo;

    return {
      ...classInfo,
      sourceClassInfo: sourceId,
      targetClassInfo: targetId,
      relationshipInfo: relationshipId,
    };
  }

  /** Deserialize [[RelatedClassInfo]] from compressed JSON */
  export function fromCompressedJSON(json: RelatedClassInfoJSON<string>, classesMap: { [id: string]: CompressedClassInfoJSON }): RelatedClassInfo {
    assert(classesMap.hasOwnProperty(json.sourceClassInfo));
    assert(classesMap.hasOwnProperty(json.targetClassInfo));
    assert(classesMap.hasOwnProperty(json.relationshipInfo));
    return {
      ...json,
      sourceClassInfo: { id: json.sourceClassInfo, ...classesMap[json.sourceClassInfo] },
      targetClassInfo: { id: json.targetClassInfo, ...classesMap[json.targetClassInfo] },
      relationshipInfo: { id: json.relationshipInfo, ...classesMap[json.relationshipInfo] },
    };
  }

  /** Check two [[RelatedClassInfo]] or [[StrippedRelatedClassInfo]] for equality */
  export function equals(lhs: RelatedClassInfo | StrippedRelatedClassInfo, rhs: RelatedClassInfo | StrippedRelatedClassInfo): boolean {
    return (
      lhs.isForwardRelationship === rhs.isForwardRelationship &&
      getClassName(lhs, "source") === getClassName(rhs, "source") &&
      getClassName(lhs, "target") === getClassName(rhs, "target") &&
      getClassName(lhs, "relationship") === getClassName(rhs, "relationship")
    );
  }

  function isStripped(info: RelatedClassInfo | StrippedRelatedClassInfo): info is StrippedRelatedClassInfo {
    const maybeStripped = info as StrippedRelatedClassInfo;
    return !!maybeStripped.relationshipName && !!maybeStripped.sourceClassName && !!maybeStripped.targetClassName;
  }

  function getClassName(info: RelatedClassInfo | StrippedRelatedClassInfo, whichClass: "relationship" | "source" | "target"): string {
    switch (whichClass) {
      case "source":
        return isStripped(info) ? info.sourceClassName : info.sourceClassInfo.name;
      case "target":
        return isStripped(info) ? info.targetClassName : info.targetClassInfo.name;
      case "relationship":
        return isStripped(info) ? info.relationshipName : info.relationshipInfo.name;
    }
  }

  /** Strip given [[RelatedClassInfo]] to [[StrippedRelatedClassInfo]] */
  export function strip(full: RelatedClassInfo): StrippedRelatedClassInfo {
    return {
      sourceClassName: full.sourceClassInfo.name,
      targetClassName: full.targetClassInfo.name,
      relationshipName: full.relationshipInfo.name,
      isForwardRelationship: full.isForwardRelationship,
    };
  }
}

/**
 * A serialized version of [[RelatedClassInfo]]
 * @public
 */
export interface RelatedClassInfoJSON<TClassInfoJSON = ClassInfo> {
  sourceClassInfo: TClassInfoJSON;
  targetClassInfo: TClassInfoJSON;
  isPolymorphicTargetClass?: boolean;
  targetInstanceIds?: Id64String[];
  relationshipInfo: TClassInfoJSON;
  isForwardRelationship: boolean;
  isPolymorphicRelationship?: boolean;
}

/**
 * A structure that describes a relationship between source and target classes where
 * an actual ECRelationship between them is optional.
 * @public
 */
export type RelatedClassInfoWithOptionalRelationship = PartialBy<RelatedClassInfo, "relationshipInfo" | "isForwardRelationship" | "isPolymorphicRelationship">;

/** @public */
export type RelatedClassInfoWithOptionalRelationshipJSON<TClassInfoJSON = ClassInfo> = PartialBy<
  RelatedClassInfoJSON<TClassInfoJSON>,
  "relationshipInfo" | "isForwardRelationship" | "isPolymorphicRelationship"
>;

/** @public */
// eslint-disable-next-line @typescript-eslint/no-redeclare
export namespace RelatedClassInfoWithOptionalRelationship {
  /** Serialize [[RelatedClassInfoWithOptionalRelationship]] to compressed JSON */
  export function toCompressedJSON(
    classInfo: RelatedClassInfoWithOptionalRelationship,
    classesMap: { [id: string]: CompressedClassInfoJSON },
  ): RelatedClassInfoWithOptionalRelationshipJSON<string> {
    const { sourceClassInfo, targetClassInfo, relationshipInfo, ...otherProps } = classInfo;
    const { id: sourceId, ...sourceLeftOverInfo } = sourceClassInfo;
    const { id: targetId, ...targetLeftOverInfo } = targetClassInfo;

    classesMap[sourceId] = sourceLeftOverInfo;
    classesMap[targetId] = targetLeftOverInfo;

    if (relationshipInfo) {
      const { id: relationshipId, ...relationshipLeftOverInfo } = relationshipInfo;
      classesMap[relationshipId] = relationshipLeftOverInfo;
    }

    return {
      ...otherProps,
      sourceClassInfo: sourceId,
      targetClassInfo: targetId,
      ...(relationshipInfo ? { relationshipInfo: relationshipInfo.id } : undefined),
    };
  }

  /** Deserialize [[RelatedClassInfoWithOptionalRelationship]] from compressed JSON */
  export function fromCompressedJSON(
    json: RelatedClassInfoWithOptionalRelationshipJSON<string>,
    classesMap: { [id: string]: CompressedClassInfoJSON },
  ): RelatedClassInfoWithOptionalRelationship {
    const { sourceClassInfo, targetClassInfo, relationshipInfo, ...otherProps } = json;
    assert(classesMap.hasOwnProperty(sourceClassInfo));
    assert(classesMap.hasOwnProperty(targetClassInfo));
    if (relationshipInfo) {
      assert(classesMap.hasOwnProperty(relationshipInfo));
    }
    return {
      ...otherProps,
      sourceClassInfo: { id: sourceClassInfo, ...classesMap[sourceClassInfo] },
      targetClassInfo: { id: targetClassInfo, ...classesMap[targetClassInfo] },
      ...(relationshipInfo ? { relationshipInfo: { id: relationshipInfo, ...classesMap[relationshipInfo] } } : undefined),
    };
  }
}

/**
 * A structure that describes a related class path.
 * @public
 */
export type RelationshipPath = RelatedClassInfo[];

/**
 * Serialized [[RelationshipPath]]
 * @public
 */
export type RelationshipPathJSON<TClassInfoJSON = ClassInfo> = RelatedClassInfoJSON<TClassInfoJSON>[];

/** @public */
// eslint-disable-next-line @typescript-eslint/no-redeclare
export namespace RelationshipPath {
  /** Reverse direction of the given [[RelationshipPath]] */
  export function reverse(path: RelationshipPath): RelationshipPath {
    return [...path].reverse().map((step) => ({
      ...step,
      sourceClassInfo: step.targetClassInfo,
      targetClassInfo: step.sourceClassInfo,
      isForwardRelationship: !step.isForwardRelationship,
    }));
  }

  /** Check two [[RelationshipPath]] or [[StrippedRelationshipPath]] for equality */
  export function equals(lhs: Array<RelatedClassInfo | StrippedRelatedClassInfo>, rhs: Array<RelatedClassInfo | StrippedRelatedClassInfo>): boolean {
    return lhs.length === rhs.length && lhs.every((lhsPart, i) => RelatedClassInfo.equals(lhsPart, rhs[i]));
  }

  /** Strip given [[RelationshipPath]] to [[StrippedRelationshipPath]] */
  export function strip(full: RelationshipPath): StrippedRelationshipPath {
    return full.map(RelatedClassInfo.strip);
  }
}

/**
 * Data structure that contains a subset of [[RelatedClassInfo]] required to
 * identify the relationship.
 * @public
 */
export interface StrippedRelatedClassInfo {
  sourceClassName: string;
  targetClassName: string;
  relationshipName: string;
  isForwardRelationship: boolean;
}

/**
 * Data structure that contains a subset of [[RelationshipPath]] required to
 * identify the relationship path.
 * @public
 */
export type StrippedRelationshipPath = StrippedRelatedClassInfo[];
