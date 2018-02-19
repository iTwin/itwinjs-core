/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

/** Format of the property value. */
export enum PropertyValueFormat {
  Primitive,
  Array,
  Struct,
}

/** Base interface for content field type descriptions. */
export interface TypeDescription {
  valueFormat: PropertyValueFormat;
  typeName: string;
}

/** Type description for primitive properties */
// tslint:disable-next-line:no-empty-interface
export interface PrimitiveTypeDescription extends TypeDescription {
}

/** Type description for array properties. */
export interface ArrayTypeDescription extends TypeDescription {
  memberType: TypeDescription;
}

/** An interface for struct member type description. */
export interface StructFieldMemberDescription {
  name: string;
  label: string;
  type: TypeDescription;
}

/** Type description for struct properties. */
export interface StructTypeDescription extends TypeDescription {
  members: StructFieldMemberDescription[];
}

/** Checks if this is a primitive type description */
export const isPrimitiveDescription = (d: TypeDescription): d is PrimitiveTypeDescription => {
  return d.valueFormat === PropertyValueFormat.Primitive;
};

/** Checks if this is an array type description */
export const isArrayDescription = (d: TypeDescription): d is ArrayTypeDescription => {
  return d.valueFormat === PropertyValueFormat.Array;
};

/** Checks if this is a struct type description */
export const isStructDescription = (d: TypeDescription): d is StructTypeDescription => {
  return d.valueFormat === PropertyValueFormat.Struct;
};
