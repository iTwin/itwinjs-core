/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Content */

import * as ec from "../EC";

/**
 * Data structure that describes one step of property
 * accessor path.
 */
export interface PropertyAccessor {
  /** Name of ECProperty */
  propertyName: string;
  /** If the property is an array, array index. Otherwise undefined. */
  arrayIndex?: number;
}

/**
 * Describes path to a property.
 */
export type PropertyAccessorPath = PropertyAccessor[];

/**
 * Data structure that describes a single ECProperty that's
 * included in a [[PropertiesField]].
 */
export default interface Property {
  /** ECProperty information */
  property: Readonly<ec.PropertyInfo>;
  /**
   * Relationship path from [Primary instance]($docs/learning/content/Terminology#primary-instance) to
   * this property. This array is not empty only for [Related properties]($docs/learning/content/Terminology#related-properties).
   */
  relatedClassPath: Readonly<ec.RelationshipPathInfo>;
}

/** Serialized [[Property]] */
export interface PropertyJSON {
  property: ec.PropertyInfoJSON;
  relatedClassPath: ec.RelationshipPathInfoJSON;
}

/** Deserializes [[Property]] from [[PropertyJSON]] */
export const propertyFromJSON = (json: PropertyJSON): Property => {
  return {
    property: ec.propertyInfoFromJSON(json.property),
    relatedClassPath: json.relatedClassPath.map((p) => ec.relatedClassInfoFromJSON(p)),
  };
};
