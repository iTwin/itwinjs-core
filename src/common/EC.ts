/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

export type ClassId = string;
export interface InstanceKey {
  classId: string;
  instanceId: string;
}
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

export interface PropertyInfo {
  classInfo: ClassInfo;
  name: string;
  type: string;
  enumerationInfo?: EnumerationInfo;
  // KindOfQuantity?: ui.IECKindOfQuantityInfo;
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
}

/** A structure that describes a related class path. */
export type RelationshipPathInfo = RelatedClassInfo[];
