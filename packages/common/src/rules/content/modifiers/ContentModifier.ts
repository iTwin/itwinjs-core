/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
/** @module PresentationRules */

import { PresentationRuleBase } from "../../PresentationRule";
import { CalculatedPropertiesSpecification } from "./CalculatedPropertiesSpecification";
import { PropertiesDisplaySpecification } from "./PropertiesDisplaySpecification";
import { PropertyEditorsSpecification } from "./PropertyEditorsSpecification";
import { RelatedPropertiesSpecification } from "./RelatedPropertiesSpecification";

/** ContentModifier is a rule that allows supplementing content rules with additional specifications for certain ECClass. */
export interface ContentModifier extends PresentationRuleBase {
  /** Schema name of the class which content rules should be supplemented. */
  schemaName?: string;

  /** Class name which content rules should be supplemented. */
  className?: string;

  relatedProperties?: RelatedPropertiesSpecification[];
  propertyDisplaySpecifications?: PropertiesDisplaySpecification[];
  calculatedProperties?: CalculatedPropertiesSpecification[];
  propertyEditors?: PropertyEditorsSpecification[];
}
