/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @module PresentationRules */

import { ContentInstancesOfSpecificClassesSpecification } from "./ContentInstancesOfSpecificClassesSpecification";
import { ContentRelatedInstancesSpecification } from "./ContentRelatedInstancesSpecification";
import { SelectedNodeInstancesSpecification } from "./SelectedNodeInstancesSpecification";
import { RelatedInstanceSpecification } from "../RelatedInstanceSpecification";
import { ContentModifiersList } from "./modifiers/ContentModifier";

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
export interface ContentSpecificationBase extends ContentModifiersList {
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
