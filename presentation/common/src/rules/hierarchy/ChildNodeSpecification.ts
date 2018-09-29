/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module PresentationRules */

import { ChildNodeRule } from "./ChildNodeRule";
import { RuleSpecification } from "../RuleSpecification";
import { AllInstanceNodesSpecification } from "./AllInstanceNodesSpecification";
import { AllRelatedInstanceNodesSpecification } from "./AllRelatedInstanceNodesSpecification";
import { CustomNodeSpecification } from "./CustomNodeSpecification";
import { InstanceNodesOfSpecificClassesSpecification } from "./InstanceNodesOfSpecificClassesSpecification";
import { RelatedInstanceNodesSpecification } from "./RelatedInstanceNodesSpecification";
import { CustomQueryInstanceNodesSpecification } from "./CustomQueryInstanceNodesSpecification";
import { RelatedInstanceSpecification } from "../RelatedInstanceSpecification";

/** Base interface for all [[ChildNodeSpecification]] implementations */
export interface ChildNodeSpecificationBase extends RuleSpecification {
  /**
   * This tells the rules engine that specification always returns nodes.
   *
   * **Note:** setting this flag to `true` improves performance.
   */
  alwaysReturnsChildren?: boolean;

  /**
   * Hide nodes provided by this specification and directly show nodes of its children.
   * This helps if you need to define related instance nodes of particular parent node that is not available in the
   * hierarchy.
   */
  hideNodesInHierarchy?: boolean;

  /**
   * Hide nodes if they don't have children.
   */
  hideIfNoChildren?: boolean;

  /**
   * Set this flag to `true` to suppress default sorting of ECInstances returned by this specification.
   *
   * **Note:** setting this flag to `true` improves performance.
   */
  doNotSort?: boolean;

  /** Specifications of related instances that can be used in content creation. */
  relatedInstances?: RelatedInstanceSpecification[];

  /** [Nested rule]($docs/learning/hierarchies/Terminology.md#nested-rules) specifications. */
  nestedRules?: ChildNodeRule[];
}

/** A container of default grouping properties. Used for specifications that support default grouping */
export interface DefaultGroupingPropertiesContainer {
  /** Group instances by ECClass. Defaults to `true`. */
  groupByClass?: boolean;

  /** Group instances by label. Defaults to `true`. */
  groupByLabel?: boolean;
}

/**
 * Navigation rule specifications that define what content the rule results in.
 */
export type ChildNodeSpecification = AllInstanceNodesSpecification |
  AllRelatedInstanceNodesSpecification |
  CustomNodeSpecification |
  InstanceNodesOfSpecificClassesSpecification |
  RelatedInstanceNodesSpecification |
  CustomQueryInstanceNodesSpecification;
