/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PresentationRules
 */

import { RelatedInstanceSpecification } from "../RelatedInstanceSpecification.js";
import { ContentInstancesOfSpecificClassesSpecification } from "./ContentInstancesOfSpecificClassesSpecification.js";
import { ContentRelatedInstancesSpecification } from "./ContentRelatedInstancesSpecification.js";
import { ContentModifiersList } from "./modifiers/ContentModifier.js";
import { SelectedNodeInstancesSpecification } from "./SelectedNodeInstancesSpecification.js";

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
  /**
   * Used for serializing to JSON.
   * @see [[ContentSpecificationTypes]]
   */
  specType: `${ContentSpecificationTypes}`;

  /**
   * Controls the order in which specifications are handled — specification with higher priority value is handled
   * first. If priorities are equal, the specifications are handled in the order they appear in the ruleset.
   *
   * @type integer
   */
  priority?: number;

  /** Specifications of [related instances]($docs/presentation/RelatedInstanceSpecification.md) that can be used when creating the content. */
  relatedInstances?: RelatedInstanceSpecification[];

  /**
   * Specifies whether this specification should be ignored if another specification was handled before as
   * determined by rule and specification priorities. This provides a mechanism for defining a fallback specification.
   */
  onlyIfNotHandled?: boolean;
}

/**
 * Content rule specifications which define what content is returned
 * when rule is used.
 *
 * @public
 */
export declare type ContentSpecification =
  | ContentInstancesOfSpecificClassesSpecification
  | ContentRelatedInstancesSpecification
  | SelectedNodeInstancesSpecification;
