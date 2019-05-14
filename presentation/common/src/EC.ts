/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Core */

import { Id64String, Id64 } from "@bentley/bentleyjs-core";

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
  /**
   * Compare 2 instance keys
   * @public
   */
  export function compare(lhs: InstanceKey, rhs: InstanceKey): number {
    const classNameCompare = lhs.className.localeCompare(rhs.className);
    if (classNameCompare !== 0)
      return classNameCompare;
    return lhs.id.localeCompare(rhs.id);
  }

  /** @internal */
  export function toJSON(json: InstanceKey): InstanceKeyJSON {
    return { ...json, id: json.id.toString() };
  }

  /**
   * Deserializes [[InstanceKey]] from [[InstanceKeyJSON]]
   * @internal
   */
  export function fromJSON(json: InstanceKeyJSON) {
    return { ...json, id: Id64.fromJSON(json.id) };
  }
}

/**
 * A serialized version of [[InstanceKey]]
 * @internal
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
  /** @internal */
  export function toJSON(info: ClassInfo): ClassInfoJSON {
    return { ...info, id: info.id.toString() };
  }
  /**
   * Deserializes [[ClassInfo]] from [[ClassInfoJSON]]
   * @internal
   */
  export function fromJSON(json: ClassInfoJSON): ClassInfo {
    return { ...json, id: Id64.fromJSON(json.id) };
  }
}

/**
 * A serialized version of [[ClassInfo]]
 * @internal
 */
export interface ClassInfoJSON {
  id: string;
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
   * Current format identifier
   * @alpha Still not entirely clear how kind of quantities will be handled and what data we'll need
   */
  currentFormatId: string;
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
}
/** @public */
export namespace PropertyInfo {
  /** @internal */
  export function toJSON(info: PropertyInfo): PropertyInfoJSON {
    return { ...info, classInfo: ClassInfo.toJSON(info.classInfo) };
  }
  /**
   * Deserializes [[PropertyInfo]] from [[PropertyInfoJSON]]
   * @internal
   */
  export function fromJSON(json: PropertyInfoJSON): PropertyInfo {
    return { ...json, classInfo: ClassInfo.fromJSON(json.classInfo) };
  }
}

/**
 * A serialized version of [[PropertyInfo]]
 * @internal
 */
export interface PropertyInfoJSON {
  classInfo: ClassInfoJSON;
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

  /** Information about the ECRelationship */
  relationshipInfo: ClassInfo;

  /** Should the relationship be followed in a forward direction to access the related class. */
  isForwardRelationship: boolean;

  /** Is the relationship handled polymorphically */
  isPolymorphicRelationship: boolean;
}
/** @public */
export namespace RelatedClassInfo {
  /** @internal */
  export function toJSON(info: RelatedClassInfo): RelatedClassInfoJSON {
    return {
      ...info,
      sourceClassInfo: ClassInfo.toJSON(info.sourceClassInfo),
      targetClassInfo: ClassInfo.toJSON(info.targetClassInfo),
      relationshipInfo: ClassInfo.toJSON(info.relationshipInfo),
    };
  }
  /**
   * Deserializes [[RelatedClassInfo]] from [[RelatedClassInfoJSON]]
   * @internal
   */
  export function fromJSON(json: RelatedClassInfoJSON): RelatedClassInfo {
    return {
      ...json,
      sourceClassInfo: ClassInfo.fromJSON(json.sourceClassInfo),
      targetClassInfo: ClassInfo.fromJSON(json.targetClassInfo),
      relationshipInfo: ClassInfo.fromJSON(json.relationshipInfo),
    };
  }
}

/**
 * A serialized version of [[RelatedClassInfo]]
 * @internal
 */
export interface RelatedClassInfoJSON {
  sourceClassInfo: ClassInfoJSON;
  targetClassInfo: ClassInfoJSON;
  relationshipInfo: ClassInfoJSON;
  isForwardRelationship: boolean;
  isPolymorphicRelationship: boolean;
}

/**
 * A structure that describes a related class path.
 * @public
 */
export type RelationshipPath = RelatedClassInfo[];

/**
 * Serialized [[RelationshipPathInfo]]
 * @internal
 */
export type RelationshipPathJSON = RelatedClassInfoJSON[];
