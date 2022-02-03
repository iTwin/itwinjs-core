/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Core
 */

import type { Id64String } from "@itwin/core-bentley";
import { assert, Id64 } from "@itwin/core-bentley";
import type { FormatProps } from "@itwin/core-quantity";
import type { PartialBy } from "./Utils";

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
    const classNameCompare = lhs.className.localeCompare(rhs.className);
    if (classNameCompare !== 0)
      return classNameCompare;
    return lhs.id.localeCompare(rhs.id);
  }

  /** Serialize [[InstanceKey]] to JSON */
  export function toJSON(json: InstanceKey): InstanceKeyJSON {
    return { ...json, id: json.id.toString() };
  }

  /** Deserialize [[InstanceKey]] from JSON */
  export function fromJSON(json: InstanceKeyJSON) {
    return { ...json, id: Id64.fromJSON(json.id) };
  }
}

/**
 * A serialized version of [[InstanceKey]]
 * @public
 */
export interface InstanceKeyJSON {
  className: string;
  id: string;
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

/** @public */
export namespace ClassInfo {
  /** Serialize [[ClassInfo]] to JSON */
  export function toJSON(info: ClassInfo): ClassInfoJSON {
    return { ...info, id: info.id.toString() };
  }

  /** Deserialize [[ClassInfo]] from JSON */
  export function fromJSON(json: ClassInfoJSON): ClassInfo {
    return { ...json, id: Id64.fromJSON(json.id) };
  }
}

/**
 * A serialized version of [[ClassInfo]]
 * @public
 */
export interface ClassInfoJSON {
  id: string;
  name: string;
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
  /**
   * Persistence unit identifier.
   * @alpha Still not entirely clear how kind of quantities will be handled and what data we'll need
   */
  persistenceUnit: string;
  /**
   * Active format that was used to format property value.
   * @alpha Still not entirely clear how kind of quantities will be handled and what data we'll need
   */
  activeFormat?: FormatProps;
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
  /**
   * Kind of quantity information, if any.
   * @alpha Still not entirely clear how kind of quantities will be handled and what data we'll need
   */
  kindOfQuantity?: KindOfQuantityInfo;
  /** Extended type name of the ECProperty if it has one */
  extendedType?: string;
}

/** @public */
export namespace PropertyInfo {
  /** Serialize [[PropertyInfo]] to JSON */
  export function toJSON(info: PropertyInfo): PropertyInfoJSON {
    return { ...info, classInfo: ClassInfo.toJSON(info.classInfo) };
  }

  /** Serialize [[PropertyInfo]] to compressed JSON */
  export function toCompressedJSON(propertyInfo: PropertyInfo, classesMap: { [id: string]: CompressedClassInfoJSON }): PropertyInfoJSON<string> {
    const { id, ...leftOverInfo } = propertyInfo.classInfo;
    classesMap[id] = leftOverInfo;

    return {
      ...propertyInfo,
      classInfo: propertyInfo.classInfo.id,
    };
  }

  /** Deserialize [[PropertyInfo]] from JSON */
  export function fromJSON(json: PropertyInfoJSON): PropertyInfo {
    return { ...json, classInfo: ClassInfo.fromJSON(json.classInfo) };
  }
}

/**
 * A serialized version of [[PropertyInfo]]
 * @public
 */
export interface PropertyInfoJSON<TClassInfoJSON = ClassInfoJSON> {
  classInfo: TClassInfoJSON;
  name: string;
  type: string;
  enumerationInfo?: EnumerationInfo;
  kindOfQuantity?: KindOfQuantityInfo;
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
  isPolymorphicTargetClass: boolean;

  /** Information about the ECRelationship */
  relationshipInfo: ClassInfo;

  /** Should relationship be followed in a forward direction to access the related class. */
  isForwardRelationship: boolean;

  /** Is relationship handled polymorphically */
  isPolymorphicRelationship: boolean;
}

/** @public */
export namespace RelatedClassInfo {
  /** Serialize [[RelatedClassInfo]] to JSON */
  export function toJSON(info: RelatedClassInfo): RelatedClassInfoJSON {
    return {
      ...info,
      sourceClassInfo: ClassInfo.toJSON(info.sourceClassInfo),
      targetClassInfo: ClassInfo.toJSON(info.targetClassInfo),
      relationshipInfo: ClassInfo.toJSON(info.relationshipInfo),
    };
  }

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

  /** Deserialize [[RelatedClassInfo]] from JSON */
  export function fromJSON(json: RelatedClassInfoJSON): RelatedClassInfo {
    return {
      ...json,
      sourceClassInfo: ClassInfo.fromJSON(json.sourceClassInfo),
      targetClassInfo: ClassInfo.fromJSON(json.targetClassInfo),
      isPolymorphicTargetClass: json.isPolymorphicTargetClass ?? false,
      relationshipInfo: ClassInfo.fromJSON(json.relationshipInfo),
      isPolymorphicRelationship: json.isPolymorphicRelationship ?? false,
    };
  }

  /** Deserialize [[RelatedClassInfo]] from compressed JSON */
  export function fromCompressedJSON(json: RelatedClassInfoJSON<string>, classesMap: { [id: string]: CompressedClassInfoJSON }): RelatedClassInfo {
    assert(classesMap.hasOwnProperty(json.sourceClassInfo));
    assert(classesMap.hasOwnProperty(json.targetClassInfo));
    assert(classesMap.hasOwnProperty(json.relationshipInfo));
    return {
      ...json,
      sourceClassInfo: ClassInfo.fromJSON({ id: json.sourceClassInfo, ...classesMap[json.sourceClassInfo] }),
      targetClassInfo: ClassInfo.fromJSON({ id: json.targetClassInfo, ...classesMap[json.targetClassInfo] }),
      isPolymorphicTargetClass: json.isPolymorphicTargetClass ?? false,
      relationshipInfo: ClassInfo.fromJSON({ id: json.relationshipInfo, ...classesMap[json.relationshipInfo] }),
      isPolymorphicRelationship: json.isPolymorphicRelationship ?? false,
    };
  }

  /** Check two [[RelatedClassInfo]] or [[StrippedRelatedClassInfo]] for equality */
  export function equals(lhs: RelatedClassInfo | StrippedRelatedClassInfo, rhs: RelatedClassInfo | StrippedRelatedClassInfo): boolean {
    return lhs.isForwardRelationship === rhs.isForwardRelationship
      && getClassName(lhs, "source") === getClassName(rhs, "source")
      && getClassName(lhs, "target") === getClassName(rhs, "target")
      && getClassName(lhs, "relationship") === getClassName(rhs, "relationship");
  }

  function isStripped(info: RelatedClassInfo | StrippedRelatedClassInfo): info is StrippedRelatedClassInfo {
    const maybeStripped = info as StrippedRelatedClassInfo;
    return !!maybeStripped.relationshipName && !!maybeStripped.sourceClassName && !!maybeStripped.targetClassName;
  }

  function getClassName(info: RelatedClassInfo | StrippedRelatedClassInfo, whichClass: "relationship" | "source" | "target"): string {
    switch (whichClass) {
      case "source": return isStripped(info) ? info.sourceClassName : info.sourceClassInfo.name;
      case "target": return isStripped(info) ? info.targetClassName : info.targetClassInfo.name;
      case "relationship": return isStripped(info) ? info.relationshipName : info.relationshipInfo.name;
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
export interface RelatedClassInfoJSON<TClassInfoJSON = ClassInfoJSON> {
  sourceClassInfo: TClassInfoJSON;
  targetClassInfo: TClassInfoJSON;
  isPolymorphicTargetClass?: boolean;
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
export type RelatedClassInfoWithOptionalRelationshipJSON<TClassInfoJSON = ClassInfoJSON> = PartialBy<RelatedClassInfoJSON<TClassInfoJSON>, "relationshipInfo" | "isForwardRelationship" | "isPolymorphicRelationship">;

/** @public */
export namespace RelatedClassInfoWithOptionalRelationship { // eslint-disable-line @typescript-eslint/no-redeclare
  /** Serialize [[RelatedClassInfoWithOptionalRelationship]] to compressed JSON */
  export function toCompressedJSON(classInfo: RelatedClassInfoWithOptionalRelationship, classesMap: { [id: string]: CompressedClassInfoJSON }): RelatedClassInfoWithOptionalRelationshipJSON<string> {
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
  export function fromCompressedJSON(json: RelatedClassInfoWithOptionalRelationshipJSON<string>, classesMap: { [id: string]: CompressedClassInfoJSON }): RelatedClassInfoWithOptionalRelationship {
    const { sourceClassInfo, targetClassInfo, relationshipInfo, ...otherProps } = json;
    assert(classesMap.hasOwnProperty(sourceClassInfo));
    assert(classesMap.hasOwnProperty(targetClassInfo));
    if (relationshipInfo)
      assert(classesMap.hasOwnProperty(relationshipInfo));
    return {
      ...otherProps,
      sourceClassInfo: ClassInfo.fromJSON({ id: sourceClassInfo, ...classesMap[sourceClassInfo] }),
      targetClassInfo: ClassInfo.fromJSON({ id: targetClassInfo, ...classesMap[targetClassInfo] }),
      isPolymorphicTargetClass: json.isPolymorphicTargetClass ?? false,
      ...(relationshipInfo ? { relationshipInfo: ClassInfo.fromJSON({ id: relationshipInfo, ...classesMap[relationshipInfo] }) } : undefined),
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
export type RelationshipPathJSON<TClassInfoJSON = ClassInfoJSON> = RelatedClassInfoJSON<TClassInfoJSON>[];

/** @public */
export namespace RelationshipPath { // eslint-disable-line @typescript-eslint/no-redeclare
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
    return lhs.length === rhs.length
      && lhs.every((lhsPart, i) => RelatedClassInfo.equals(lhsPart, rhs[i]));
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
