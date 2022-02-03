/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Content
 */

import type { ClassInfoJSON, CompressedClassInfoJSON, PropertyInfoJSON } from "../EC";
import { PropertyInfo } from "../EC";

/**
 * Data structure that describes one step of property
 * accessor path.
 *
 * @public
 */
export interface PropertyAccessor {
  /** Name of ECProperty */
  propertyName: string;
  /** If the property is an array, array index. Otherwise undefined. */
  arrayIndex?: number;
}

/**
 * Describes path to a property.
 * @public
 */
export type PropertyAccessorPath = PropertyAccessor[];

/**
 * Data structure that describes a single ECProperty that's
 * included in a [[PropertiesField]].
 *
 * TODO: Remove?
 *
 * @public
 */
export interface Property {
  /** ECProperty information */
  property: PropertyInfo;
}

/** @public */
export namespace Property {
  /** Serialize [[Property]] to JSON */
  export function toJSON(prop: Property): PropertyJSON {
    return {
      property: PropertyInfo.toJSON(prop.property),
    };
  }

  /** Serialize [[Property]] to compressed JSON */
  export function toCompressedJSON(prop: Property, classesMap: { [id: string]: CompressedClassInfoJSON }): PropertyJSON<string> {
    return {
      property: PropertyInfo.toCompressedJSON(prop.property, classesMap),
    };
  }

  /** Deserializes [[Property]] from JSON */
  export function fromJSON(json: PropertyJSON): Property {
    return {
      property: PropertyInfo.fromJSON(json.property),
    };
  }
}

/**
 * JSON representation of [[Property]]
 * @public
 */
export interface PropertyJSON<TClassInfoJSON = ClassInfoJSON> {
  property: PropertyInfoJSON<TClassInfoJSON>;
}
