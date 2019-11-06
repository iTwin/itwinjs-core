/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module PresentationRules */

import { RuleBase, RuleTypes } from "../../Rule";
import { SingleSchemaClassSpecification } from "../../ClassSpecifications";
import { CalculatedPropertiesSpecification } from "./CalculatedPropertiesSpecification";
import { PropertiesDisplaySpecification } from "./PropertiesDisplaySpecification";
import { PropertyEditorsSpecification } from "./PropertyEditorsSpecification";
import { RelatedPropertiesSpecification } from "./RelatedPropertiesSpecification";
import { PropertySpecification } from "../PropertySpecification";
import { PropertyCategorySpecification } from "./PropertyCategorySpecification";

/**
 * Contains various rule attributes that allow modifying returned content.
 *
 * This is not expected to be used directly - use through either `ContentModifier` or `ContentSpecification`.
 *
 * @public
 */
export interface ContentModifiersList {
  /** Specifications for including properties of related instances */
  relatedProperties?: RelatedPropertiesSpecification[];

  /** Specifications for including calculated properties */
  calculatedProperties?: CalculatedPropertiesSpecification[];

  /**
   * Specifications for customizing property display by hiding / showing them
   * @deprecated Use `propertyOverrides` attribute instead.
   */
  propertiesDisplay?: PropertiesDisplaySpecification[];

  /**
   * Specifications for assigning property editors
   * @deprecated Use `propertyOverrides` attribute instead.
   */
  propertyEditors?: PropertyEditorsSpecification[];

  /**
   * Specifications for custom categories. Simply defining the categories does
   * nothing - they have to be referenced from `PropertySpecification` defined in
   * `propertyOverrides` by `id`.
   *
   * @beta
   */
  propertyCategories?: PropertyCategorySpecification[];

  /**
   * Specifications for various property overrides.
   * @beta
   */
  propertyOverrides?: PropertySpecification[];
}

/**
 * Rule that allows supplementing content with additional
 * specifications for certain ECClasses.
 *
 * @public
 */
export interface ContentModifier extends RuleBase, ContentModifiersList {
  /** Used for serializing to JSON. */
  ruleType: RuleTypes.ContentModifier;

  /**
   * Specification of ECClass whose content should be supplemented.
   * The modifier is applied to all ECClasses if this property
   * is not specified.
   */
  class?: SingleSchemaClassSpecification;
}
