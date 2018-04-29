/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** Format of the property value. */
export enum PropertyValueFormat {
  Primitive = "Primitive",
  Array = "Array",
  Struct = "Struct",
}

/** Base interface for content field type descriptions. */
export interface BaseTypeDescription {
  valueFormat: PropertyValueFormat;
  typeName: string;
}

/** Type description for primitive properties */
// tslint:disable-next-line:no-empty-interface
export interface PrimitiveTypeDescription extends BaseTypeDescription {
  valueFormat: PropertyValueFormat.Primitive;
}

/** Type description for array properties. */
export interface ArrayTypeDescription extends BaseTypeDescription {
  valueFormat: PropertyValueFormat.Array;
  memberType: TypeDescription;
}

/** An interface for struct member type description. */
export interface StructFieldMemberDescription {
  name: string;
  label: string;
  type: TypeDescription;
}

/** Type description for struct properties. */
export interface StructTypeDescription extends BaseTypeDescription {
  valueFormat: PropertyValueFormat.Struct;
  members: StructFieldMemberDescription[];
}

/** One of content field type descriptions. */
export type TypeDescription = PrimitiveTypeDescription | ArrayTypeDescription | StructTypeDescription;
