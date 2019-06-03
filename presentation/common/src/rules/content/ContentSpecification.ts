/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module PresentationRules */

import { ContentInstancesOfSpecificClassesSpecification } from "./ContentInstancesOfSpecificClassesSpecification";
import { ContentRelatedInstancesSpecification } from "./ContentRelatedInstancesSpecification";
import { SelectedNodeInstancesSpecification } from "./SelectedNodeInstancesSpecification";
import { PropertiesDisplaySpecification } from "./modifiers/PropertiesDisplaySpecification";
import { PropertyEditorsSpecification } from "./modifiers/PropertyEditorsSpecification";
import { RelatedPropertiesSpecification } from "./modifiers/RelatedPropertiesSpecification";
import { CalculatedPropertiesSpecification } from "./modifiers/CalculatedPropertiesSpecification";
import { RelatedInstanceSpecification } from "../RelatedInstanceSpecification";

/**
 * Used for serializing array of [[ContentSpecification]]
 * @public
 */
export enum ContentSpecificationTypes {
  ContentInstancesOfSpecificClasses = "ContentInstancesOfSpecificClasses",
  ContentRelatedInstances = "ContentRelatedInstances",
  SelectedNodeInstances = "SelectedNodeInstances",
}

/**
 * Base interface for all [[ContentSpecification]] implementations. Not
 * meant to be used directly, see `ContentSpecification`.
 *
 * @public
 */
export interface ContentSpecificationBase {
  /** Used for serializing to JSON. */
  specType: ContentSpecificationTypes;

  /**
   * Defines the order in which specifications are evaluated and executed. Defaults to `1000`.
   *
   * @type integer
   */
  priority?: number;

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
 *
 * @public
 */
export declare type ContentSpecification = ContentInstancesOfSpecificClassesSpecification
  | ContentRelatedInstancesSpecification | SelectedNodeInstancesSpecification;
