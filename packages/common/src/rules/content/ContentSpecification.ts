/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
/** @module PresentationRules */

import { PresentationRuleSpecification } from "../PresentationRuleSpecification";
import { ContentInstancesOfSpecificClassesSpecification } from "./ContentInstancesOfSpecificClassesSpecification";
import { ContentRelatedInstancesSpecification } from "./ContentRelatedInstancesSpecification";
import { SelectedNodeInstancesSpecification } from "./SelectedNodeInstancesSpecification";
import { PropertiesDisplaySpecification } from "./modifiers/PropertiesDisplaySpecification";
import { PropertyEditorsSpecification } from "./modifiers/PropertyEditorsSpecification";
import { RelatedPropertiesSpecification } from "./modifiers/RelatedPropertiesSpecification";
import { CalculatedPropertiesSpecification } from "./modifiers/CalculatedPropertiesSpecification";
import { RelatedInstanceSpecification } from "../RelatedInstanceSpecification";

/** Base interface for content rule specifications [[ContentSpecification]]. */
export interface ContentSpecificationBase extends PresentationRuleSpecification {
  showImages?: boolean;
  relatedPropertiesSpecification?: RelatedPropertiesSpecification[];
  propertiesDisplaySpecification?: PropertiesDisplaySpecification[];
  calculatedPropertiesSpecification?: CalculatedPropertiesSpecification[];
  propertyEditorsSpecification?: PropertyEditorsSpecification[];
  relatedInstancesSpecification?: RelatedInstanceSpecification[];
}

/**
 * Content rule specifications.  each type of content specification supports the following sub-specifications:
 * - [[RelatedPropertiesSpecification]]
 * - [[PropertiesDisplaySpecification]]
 * - [[CalculatedPropertiesSpecification]]
 * - [[PropertyEditorsSpecification]]
 * - [[RelatedInstanceSpecification]]
 */
export declare type ContentSpecification = ContentInstancesOfSpecificClassesSpecification
  | ContentRelatedInstancesSpecification | SelectedNodeInstancesSpecification;
