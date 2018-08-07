/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
/** @module PresentationRules */

import { RelationshipDirection } from "../../RelationshipDirection";
import { MultiSchemaClassesSpecification } from "../../ClassSpecifications";

/** Meaning of the relationship */
export const enum RelationshipMeaning {
  /**
   * Related instance is part of the primary instance. Related properties
   * with this meaning are displayed in UI as if they belonged to the
   * primary instance.
   */
  SameInstance = "SameInstance",

  /**
   * Related instance if not part of the primary instance - it should
   * appear as related. UI components may display related instance properties
   * differently, e.g. put them under a different category, etc.
   */
  RelatedInstance = "RelatedInstance",
}

/** Special values that can be used in [[RelatedPropertiesSpecification.propertyNames]] */
export const enum RelatedPropertiesSpecialValues {
  /**
   * Used to specify that no properties should be included. Usually
   * used together with [[RelatedPropertiesSpecification.nestedRelatedProperties]]
   */
  None = "_none_",
}

/**
 * Sub-specification to include additional related instance properties
 */
export interface RelatedPropertiesSpecification {
  /**
   * Specifications of ECRelationshipClasses. Optional if [[relatedClasses]] is specified.
   */
  relationships?: MultiSchemaClassesSpecification | MultiSchemaClassesSpecification[];

  /**
   * Specifications of related ECClasses. Optional if [[relationships]] is specified.
   */
  relatedClasses?: MultiSchemaClassesSpecification | MultiSchemaClassesSpecification[];

  /**
   * Should [[relationships]] and [[relatedClasses]] be handled polymorphically.
   */
  isPolymorphic?: boolean;

  /**
   * Direction that will be followed in the relationship select criteria.
   * Defaults to [[RelationshipDirection.Both]].
   */
  requiredDirection?: RelationshipDirection;

  /** Meaning of the relationship. Defaults to [[RelationshipMeaning.RelatedInstance]] */
  relationshipMeaning?: RelationshipMeaning;

  /**
   * List of names of related class properties that should be included in the content.
   * All properties are included if not specified.
   */
  propertyNames?: string[] | RelatedPropertiesSpecialValues;

  /** Specifications for nested related properties */
  nestedRelatedProperties?: RelatedPropertiesSpecification[];
}
