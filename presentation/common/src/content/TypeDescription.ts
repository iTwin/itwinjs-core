/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Content */

/**
 * Format of the property value.
 */
export enum PropertyValueFormat {
  Primitive = "Primitive",
  Array = "Array",
  Struct = "Struct",
}

/**
 * Data structure for base content field type description.
 */
export interface BaseTypeDescription {
  valueFormat: PropertyValueFormat;
  typeName: string;
}

/**
 * Type description for primitive properties.
 */
export interface PrimitiveTypeDescription extends BaseTypeDescription {
  valueFormat: PropertyValueFormat.Primitive;
}

/**
 * Type description for array properties.
 */
export interface ArrayTypeDescription extends BaseTypeDescription {
  valueFormat: PropertyValueFormat.Array;
  memberType: TypeDescription;
}

/**
 * A data structure that describes a struct member
 */
export interface StructFieldMemberDescription {
  name: string;
  label: string;
  type: TypeDescription;
}

/**
 * Type description for struct properties.
 */
export interface StructTypeDescription extends BaseTypeDescription {
  valueFormat: PropertyValueFormat.Struct;
  members: StructFieldMemberDescription[];
}

/** One of content field type descriptions. */
export type TypeDescription = PrimitiveTypeDescription | ArrayTypeDescription | StructTypeDescription;
