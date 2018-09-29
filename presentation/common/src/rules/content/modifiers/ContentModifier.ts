/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module PresentationRules */

import { RuleBase, RuleTypes } from "../../Rule";
import { SingleSchemaClassSpecification } from "../../ClassSpecifications";
import { CalculatedPropertiesSpecification } from "./CalculatedPropertiesSpecification";
import { PropertiesDisplaySpecification } from "./PropertiesDisplaySpecification";
import { PropertyEditorsSpecification } from "./PropertyEditorsSpecification";
import { RelatedPropertiesSpecification } from "./RelatedPropertiesSpecification";

/**
 * Rule that allows supplementing content with additional
 * specifications for certain ECClasses.
 */
export interface ContentModifier extends RuleBase {
  /** Used for serializing to JSON. */
  ruleType: RuleTypes.ContentModifier;

  /**
   * Specification of ECClass whose content should be supplemented.
   * The modifier is applied to all ECClasses if this property
   * is not specified.
   */
  class?: SingleSchemaClassSpecification;

  /** Specifications for including properties of related instances */
  relatedProperties?: RelatedPropertiesSpecification[];

  /** Specifications for including calculated properties */
  calculatedProperties?: CalculatedPropertiesSpecification[];

  /** Specifications for customizing property display by hiding / showing them */
  propertiesDisplay?: PropertiesDisplaySpecification[];

  /** Specifications for assigning property editors */
  propertyEditors?: PropertyEditorsSpecification[];
}
