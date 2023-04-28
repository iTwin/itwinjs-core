/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PresentationRules
 */

import { SingleSchemaClassSpecification } from "../../ClassSpecifications";
import { RuleBase } from "../../Rule";
import { PropertySpecification } from "../PropertySpecification";
import { CalculatedPropertiesSpecification } from "./CalculatedPropertiesSpecification";
import { PropertyCategorySpecification } from "./PropertyCategorySpecification";
import { RelatedPropertiesSpecification } from "./RelatedPropertiesSpecification";

/**
 * Contains various rule attributes that allow modifying returned content.
 *
 * This is not expected to be used directly - use through either [[ContentModifier]]
 * or [[ContentSpecification]].
 *
 * @see [Content modifier rule reference documentation page]($docs/presentation/content/ContentModifier.md)
 * @public
 */
export interface ContentModifiersList {
  /**
   * Specifications of [related properties]($docs/presentation/content/RelatedPropertiesSpecification.md) which are
   * included in the generated content.
   */
  relatedProperties?: RelatedPropertiesSpecification[];

  /**
   * Specifications of [calculated properties]($docs/presentation/content/CalculatedPropertiesSpecification.md) whose values are
   * generated using provided [ECExpressions]($docs/presentation/advanced/ECExpressions.md).
   */
  calculatedProperties?: CalculatedPropertiesSpecification[];

  /**
   * Specifications for [custom categories]($docs/presentation/content/PropertyCategorySpecification.md). Simply defining the categories does
   * nothing - they have to be referenced from [property specification]($docs/presentation/content/PropertySpecification.md) defined in
   * [[propertyOverrides]] by `id`.
   */
  propertyCategories?: PropertyCategorySpecification[];

  /**
   * Specifications for various [property overrides]($docs/presentation/content/PropertySpecification.md) that allow customizing property display.
   */
  propertyOverrides?: PropertySpecification[];
}

/**
 * Content modifiers are used to modify how instances of specified ECClasses are displayed in content which is
 * produced using [content rules]($docs/presentation/content/ContentRule.md). They do not produce any content
 * by themselves.
 *
 * @see [Content modifier rule reference documentation page]($docs/presentation/content/ContentModifier.md)
 * @public
 */
export interface ContentModifier extends RuleBase, ContentModifiersList {
  /** Used for serializing to JSON. */
  ruleType: "ContentModifier";

  /**
   * Specification of ECClass whose content should be modified. The modifier is applied to all content
   * if this attribute is not specified.
   */
  class?: SingleSchemaClassSpecification;

  /**
   * Specifies whether [`calculatedProperties`]($docs/presentation/content/CalculatedPropertiesSpecification.md) and
   * [`relatedProperties`]($docs/presentation/content/RelatedPropertiesSpecification.md) specifications should also be applied on
   * [nested content]($docs/presentation/content/Terminology.md#nested-content).
   * @beta
   */
  applyOnNestedContent?: boolean;
}
