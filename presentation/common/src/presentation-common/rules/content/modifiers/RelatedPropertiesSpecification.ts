/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PresentationRules
 */

import { RelationshipPathSpecification } from "../../RelationshipPathSpecification";
import { PropertySpecification } from "../PropertySpecification";

/**
 * Meaning of the relationship.
 * @public
 */
export enum RelationshipMeaning {
  /**
   * The properties should be displayed as if they belonged to the [primary instance]($docs/presentation/content/Terminology.md#primary-instance).
   * Generally that means they assigned a category, that's nested under the default category.
   */
  SameInstance = "SameInstance",

  /**
   * The properties should be distinguished from properties of the [primary instance]($docs/presentation/content/Terminology.md#primary-instance)
   * and shown separately to make it clear they belong to another instance. Generally that means they're assigned a separate root category.
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
 * This specification allows including related instance properties into the content.
 *
 * @see [Related properties specification specification reference documentation page]($docs/presentation/content/RelatedPropertiesSpecification.md)
 * @public
 */
export interface RelatedPropertiesSpecification {
  /**
   * Specifies a chain of [relationship path specifications]($docs/presentation/RelationshipPathSpecification.md) that
   * forms a path from the content instance to the related instance(s) whose properties should additionally be loaded.
   */
  propertiesSource: RelationshipPathSpecification;

  /**
   * Condition for filtering instances targeted by the [[propertiesSource]] attribute.
   *
   * **See:** [ECExpressions available in instance filter]($docs/presentation/Content/ECExpressions.md#instance-filter)
   */
  instanceFilter?: string;

  /**
   * The attribute tells whether the target class specified through [[propertiesSource]] should be handled
   * polymorphically. This means properties of the concrete class are loaded in addition to properties of the
   * target class itself.
   *
   * @note There's a difference between loading properties and instances polymorphically. This attribute
   * only controls polymorphism of properties, while instances are always looked up in a polymorphic fashion.
   */
  handleTargetClassPolymorphically?: boolean;

  /**
   * Should the field containing related properties be assigned the [[NestedContentField.autoExpand]]
   * attribute. The attribute tells UI components showing the properties that they should be initially displayed in the expanded state.
   */
  autoExpand?: boolean;

  /**
   * Specifies whether the specification should be ignored if another higher priority specification for the same relationship already exists.
   * @beta
   */
  skipIfDuplicate?: boolean;

  /**
   * The attribute describes what the related properties mean to the [primary instance]($docs/presentation/content/Terminology.md#primary-instance)
   * whose properties are displayed.
   * @see RelationshipMeaning
   */
  relationshipMeaning?: `${RelationshipMeaning}`;

  /** The attribute allows loading additional related properties that are related to the target instance of this specification. */
  nestedRelatedProperties?: RelatedPropertiesSpecification[];

  /**
   * List of names or definitions of related class properties that should be included in the content.
   * @see RelatedPropertiesSpecialValues
   */
  properties?: Array<string | PropertySpecification> | `${RelatedPropertiesSpecialValues}`;

  /**
   * List of names or definitions of relationship class properties that should be included in the content.
   * @see RelatedPropertiesSpecialValues
   */
  relationshipProperties?: Array<string | PropertySpecification> | `${RelatedPropertiesSpecialValues}`;

  /**
   * Specifies whether a relationship category should be created regardless of whether any relationship properties were included.
   */
  forceCreateRelationshipCategory?: boolean;
}
