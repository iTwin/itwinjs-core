/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Id64 } from "@bentley/bentleyjs-core";

export type ClassId = Id64;

export type InstanceId = Id64;

export interface InstanceKey {
  className: string;
  id: InstanceId;
}

export interface InstanceKeyJSON {
  className: string;
  id: string;
}

export const instanceKeyFromJSON = (json: InstanceKeyJSON): InstanceKey => {
  return { ...json, id: new Id64(json.id) };
};

export type InstanceKeysList = InstanceKey[];

/** Information about an ECClass. */
export interface ClassInfo {
  id: ClassId;
  name: string;
  label: string;
}

export interface EnumerationChoice {
  label: string;
  value: string | number;
}

export interface EnumerationInfo {
  choices: EnumerationChoice[];
  isStrict: boolean;
}

export interface KindOfQuantityInfo {
  name: string;
  label: string;
  persistenceUnit: string;
  currentFusId: string;
}

export interface PropertyInfo {
  classInfo: ClassInfo;
  name: string;
  type: string;
  enumerationInfo?: EnumerationInfo;
  kindOfQuantity?: KindOfQuantityInfo;
}

/** A structure that describes a related class and the properties of that relationship. */
export interface RelatedClassInfo {
  /** Information about the source ECClass */
  sourceClassInfo: ClassInfo;

  /** Information about the target ECClass */
  targetClassInfo: ClassInfo;

  /** Information about the relationship ECClass */
  relationshipInfo: ClassInfo;

  /** Should the relationship be followed in a forward direction to access the related class. */
  isForwardRelationship: boolean;

  /** Is the relationship handled polymorphically */
  isPolymorphicRelationship: boolean;
}

/** A structure that describes a related class path. */
export type RelationshipPathInfo = RelatedClassInfo[];
