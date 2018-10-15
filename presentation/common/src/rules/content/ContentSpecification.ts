/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module PresentationRules */

import { RuleSpecification } from "../RuleSpecification";
import { ContentInstancesOfSpecificClassesSpecification } from "./ContentInstancesOfSpecificClassesSpecification";
import { ContentRelatedInstancesSpecification } from "./ContentRelatedInstancesSpecification";
import { SelectedNodeInstancesSpecification } from "./SelectedNodeInstancesSpecification";
import { PropertiesDisplaySpecification } from "./modifiers/PropertiesDisplaySpecification";
import { PropertyEditorsSpecification } from "./modifiers/PropertyEditorsSpecification";
import { RelatedPropertiesSpecification } from "./modifiers/RelatedPropertiesSpecification";
import { CalculatedPropertiesSpecification } from "./modifiers/CalculatedPropertiesSpecification";
import { RelatedInstanceSpecification } from "../RelatedInstanceSpecification";

/** Base interface for all [[ContentSpecification]] implementations. */
export interface ContentSpecificationBase extends RuleSpecification {
  /** Should each content record be assigned an image id */
  showImages?: boolean;

  /** Specifications for including properties of related instances */
  relatedProperties?: RelatedPropertiesSpecification[];

  /** Specifications for including calculated properties */
  calculatedProperties?: CalculatedPropertiesSpecification[];

  /** Specifications for customizing property display by hiding / showing them */
  propertiesDisplay?: PropertiesDisplaySpecification[];

  /** Specifications for assigning property editors */
  propertyEditors?: PropertyEditorsSpecification[];

  /** Specifications for joining related instances */
  relatedInstances?: RelatedInstanceSpecification[];
}

/**
 * Content rule specifications which define what content is returned
 * when rule is used.
 */
export declare type ContentSpecification = ContentInstancesOfSpecificClassesSpecification
  | ContentRelatedInstancesSpecification | SelectedNodeInstancesSpecification;
