/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
/** @module PresentationRules */

import { RelationshipDirection } from "../../RelationshipDirection";

/** Meaning of the relationship */
export enum RelationshipMeaning {
  /** Related instance is part of the primary instance */
  SameInstance = "SameInstance",

  /**
   * Related instance if not part of the primary instance - it should
   * appear as related.
   */
  RelatedInstance = "RelatedInstance",
}

/**
 * This is a sub-specification that allows including additional related instance properties next to primary instance properties.
 *
 * They are defined as child elements to [[ContentSpecification]]
 * or [[ContentModifier]].
 */
export interface RelatedPropertiesSpecification {

  /**
   * Direction that will be followed in the relationship select criteria. Possible options: `Forward`, `Backward`, `Both`.
   * Default value is set to `Both`.
   */
  requiredDirection?: RelationshipDirection;

  /**
   * Names of ECRelationshipClasses separated by comma.
   * Optional if [[relatedClassNames]] is specified.
   */
  relationshipClassNames?: string;

  /**
   * Names of related ECClasses separated by comma.
   * Optional if [[relationshipClassNames]] is specified.
   */
  relatedClassNames?: string;

  /**
   * Names of RelatedClass properties that should be selected and shown for in the content. If this option is not
   * specified all properties will be shown. "_none_" keyword can be used to suppress all properties.
   *
   * **Note:**
   * The "_none_" keyword is usually used together with nested RelatedProperties.
   */
  propertyNames?: string;

  /** Nested related properties to select properties of ECInstances related through multiple relationships. */
  nestedRelatedProperties?: RelatedPropertiesSpecification[];

  /**
   * Should these related properties appear as if they were of primary instance or as if
   * they are related properties
   */
  relationshipMeaning?: RelationshipMeaning;

  /** Should [[relationshipClassNames]] and [[relatedClassNames]] properties be handled polymorphically */
  isPolymorphic?: boolean;
}
