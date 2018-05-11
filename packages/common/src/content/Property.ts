/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as ec from "../EC";

/** Describes one step of property accessor path. */
export interface PropertyAccessor {
  propertyName: string;
  arrayIndex?: number;
}

/** Describes path to a property. */
export type PropertyAccessorPath = PropertyAccessor[];

/** Describes a single ECProperty that's included in a PropertiesField. */
export default interface Property {
  property: Readonly<ec.PropertyInfo>;
  relatedClassPath: Readonly<ec.RelationshipPathInfo>;
}
