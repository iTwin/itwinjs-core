/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PresentationRules
 */

import type { RelationshipPathSpecification } from "../../RelationshipPathSpecification";
import type { PropertySpecification } from "../PropertySpecification";

/**
 * Meaning of the relationship
 * @public
 */
export enum RelationshipMeaning {
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

/**
 * Special values that can be used in [[RelatedPropertiesSpecification.propertyNames]]
 * @public
 */
export enum RelatedPropertiesSpecialValues {
  /**
   * Used to specify that no properties should be included. Usually
   * used together with [[RelatedPropertiesSpecification.nestedRelatedProperties]]
   */
  None = "_none_",

  /**
   * Used to specify that all properties should be included.
   */
  All = "*",
}

/**
 * Sub-specification to include additional related instance properties.
 *
 * @see [More details]($docs/presentation/Content/RelatedPropertiesSpecification.md)
 * @public
 */
export interface RelatedPropertiesSpecification {
  /**
   * Relationship path from content class to properties' class.
   */
  propertiesSource: RelationshipPathSpecification;

  /**
   * Should the target class specified in [[propertiesSource]] be handled
   * polymorphically. This means properties of not only the target class, but also all its subclasses
   * are loaded.
   *
   * @note There's a difference between loading properties and instances polymorphically. This attribute
   * only controls polymorphism of properties, while instances are always looked up in a polymorphic fashion.
   */
  handleTargetClassPolymorphically?: boolean;

  /**
   * Should field containing related properties be automatically expanded. This only takes effect when
   * content class is related to properties source class through a one-to-many or many-to-many relationship.
   */
  autoExpand?: boolean;

  /**
   * Should this related properties specification be ignored if it duplicates another higher priority specification for the same relationship.
   * @beta
   */
  skipIfDuplicate?: boolean;

  /**
   * Meaning of the relationship which tells how to categorize the related properties. Defaults to [[RelationshipMeaning.RelatedInstance]].
   * @see [More details]($docs/presentation/Content/RelatedPropertiesSpecification.md#relationship-meaning-attribute)
   */
  relationshipMeaning?: RelationshipMeaning;

  /** Specifications for nested related properties */
  nestedRelatedProperties?: RelatedPropertiesSpecification[];

  /**
   * A list of property names or specifications that should be included in the content. All
   * properties are included if this attribute is not specified.
   */
  properties?: Array<string | PropertySpecification> | RelatedPropertiesSpecialValues;
}
