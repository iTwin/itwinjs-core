/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Content
 */

/**
 * Format of the property value.
 * @public
 */
export enum PropertyValueFormat {
  /** Primitive value */
  Primitive = "Primitive",
  /** Array value */
  Array = "Array",
  /** Struct value */
  Struct = "Struct",
}

/**
 * Data structure for base content field type description. Not
 * meant to be used directly, see `TypeDescription`.
 *
 * @public
 */
export interface BaseTypeDescription {
  /** Value format */
  valueFormat: PropertyValueFormat;
  /** Type name */
  typeName: string;
}

/**
 * Type description for primitive properties.
 * @public
 */
export interface PrimitiveTypeDescription extends BaseTypeDescription {
  /** Primitive format */
  valueFormat: PropertyValueFormat.Primitive;
}

/**
 * Type description for array properties.
 * @public
 */
export interface ArrayTypeDescription extends BaseTypeDescription {
  /** Array format */
  valueFormat: PropertyValueFormat.Array;
  /** Type of array items */
  memberType: TypeDescription;
}

/**
 * A data structure that describes a struct member.
 * @public
 */
export interface StructFieldMemberDescription {
  /** Unique name of a struct member */
  name: string;
  /** Label of the struct member */
  label: string;
  /** Type of the struct member */
  type: TypeDescription;
}

/**
 * Type description for struct properties.
 * @public
 */
export interface StructTypeDescription extends BaseTypeDescription {
  /** Struct format */
  valueFormat: PropertyValueFormat.Struct;
  /** Type descriptions of struct members */
  members: StructFieldMemberDescription[];
}

/**
 * One of content field type descriptions.
 * @public
 */
export type TypeDescription = PrimitiveTypeDescription | ArrayTypeDescription | StructTypeDescription;
