/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RPC
 */

import { Id64String } from "@itwin/core-bentley";

/**
 * Data structure for storing element properties information in a simplified format.
 * @see [[Content]] for a format that stores all available element property data.
 * @public
 */
export interface ElementProperties {
  /** Label of element's ECClass. */
  class: string;
  /** Element's ID. */
  id: Id64String;
  /** Element's label. */
  label: string;
  /** Container of property values */
  items: { [label: string]: ElementPropertiesItem };
}

/**
 * Base type for all [[ElementPropertiesItem]] types.
 * @public
 */
export interface ElementPropertiesItemBase {
  /** Type of the properties item. */
  type: "category" | ElementPropertiesPropertyValueType;
}

/**
 * Definition for a category. A category can nest other property items, including categories.
 * @public
 */
export interface ElementPropertiesCategoryItem extends ElementPropertiesItemBase {
  /** Type of the properties item. */
  type: "category";
  /** Container of property values */
  items: { [label: string]: ElementPropertiesItem };
}

/**
 * Base type for all [[ElementPropertiesPropertyItem]] types.
 * @public
 */
export interface ElementPropertiesPropertyItemBase extends ElementPropertiesItemBase {
  /** Type of the properties item. */
  type: ElementPropertiesPropertyValueType;
}

/**
 * Definition for a primitive property value.
 * @public
 */
export interface ElementPropertiesPrimitivePropertyItem extends ElementPropertiesPropertyItemBase {
  /** Type of the properties item. */
  type: "primitive";
  /** Display value of the property. */
  value: string;
}

/**
 * Base type for all [[ElementPropertiesArrayPropertyItem]] types.
 * @public
 */
export interface ElementPropertiesArrayPropertyItemBase extends ElementPropertiesPropertyItemBase {
  /** Type of the properties item. */
  type: "array";
  /** Type of values contained in this array. */
  valueType: "primitive" | "struct";
}

/**
 * Definition for a primitives' array property value.
 * @public
 */
export interface ElementPropertiesPrimitiveArrayPropertyItem extends ElementPropertiesArrayPropertyItemBase {
  /** Type of values contained in this array. */
  valueType: "primitive";
  /** Array of display values. */
  values: string[];
}

/**
 * Definition for a structs' array property value.
 * @public
 */
export interface ElementPropertiesStructArrayPropertyItem extends ElementPropertiesArrayPropertyItemBase {
  /** Type of values contained in this array. */
  valueType: "struct";
  /** Array of structs. */
  values: Array<{ [memberLabel: string]: ElementPropertiesPropertyItem }>;
}

/**
 * Definition for an array property value.
 * @public
 */
export type ElementPropertiesArrayPropertyItem = ElementPropertiesPrimitiveArrayPropertyItem | ElementPropertiesStructArrayPropertyItem;

/**
 * Definition for an struct property value.
 * @public
 */
export interface ElementPropertiesStructPropertyItem extends ElementPropertiesPropertyItemBase {
  /** Type of the properties item. */
  type: "struct";
  /** Container of struct members. */
  members: { [memberLabel: string]: ElementPropertiesPropertyItem };
}

/**
 * Available element property types.
 * @public
 */
export type ElementPropertiesPropertyValueType = "primitive" | "array" | "struct";

/**
 * Definition of a property value.
 * @public
 */
export type ElementPropertiesPropertyItem = ElementPropertiesPrimitivePropertyItem | ElementPropertiesArrayPropertyItem | ElementPropertiesStructPropertyItem;

/**
 * Definition of a property item, including a property category.
 * @public
 */
export type ElementPropertiesItem = ElementPropertiesCategoryItem | ElementPropertiesPropertyItem;
