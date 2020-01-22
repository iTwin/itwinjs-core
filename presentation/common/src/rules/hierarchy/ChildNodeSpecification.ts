/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PresentationRules
 */

import { ChildNodeRule } from "./ChildNodeRule";
import { AllInstanceNodesSpecification } from "./AllInstanceNodesSpecification";
import { AllRelatedInstanceNodesSpecification } from "./AllRelatedInstanceNodesSpecification";
import { CustomNodeSpecification } from "./CustomNodeSpecification";
import { InstanceNodesOfSpecificClassesSpecification } from "./InstanceNodesOfSpecificClassesSpecification";
import { RelatedInstanceNodesSpecification } from "./RelatedInstanceNodesSpecification";
import { CustomQueryInstanceNodesSpecification } from "./CustomQueryInstanceNodesSpecification";
import { RelatedInstanceSpecification } from "../RelatedInstanceSpecification";

/**
 * Used for serializing array of [[ChildNodeSpecification]]
 * @public
 */
export enum ChildNodeSpecificationTypes {
  // hierarchy specifications
  AllInstanceNodes = "AllInstanceNodes",
  AllRelatedInstanceNodes = "AllRelatedInstanceNodes",
  RelatedInstanceNodes = "RelatedInstanceNodes",
  InstanceNodesOfSpecificClasses = "InstanceNodesOfSpecificClasses",
  CustomQueryInstanceNodes = "CustomQueryInstanceNodes",
  CustomNode = "CustomNode",
}

/**
 * Base interface for all [[ChildNodeSpecification]] implementations. Not
 * meant to be used directly, see `ChildNodeSpecification`.
 *
 * @public
 */
export interface ChildNodeSpecificationBase {
  /** Used for serializing to JSON. */
  specType: ChildNodeSpecificationTypes;

  /**
   * Defines the order in which specifications are evaluated and executed. Defaults to `1000`.
   *
   * @type integer
   */
  priority?: number;

  /**
   * This tells the rules engine that nodes produced using this
   * specification always or never have children. Defaults to `Unknown`.
   *
   * **Note:** setting this flag to `Always` or `Never` improves performance.
   */
  hasChildren?: "Always" | "Never" | "Unknown";

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
   * An [ECExpression]($docs/learning/presentation/Hierarchies/ECExpressions.md#specification) which
   * indicates whether a node should be hidden or not.
   *
   * @note While the attribute provides much flexibility, it also has performance implications - it's
   * strongly suggested to first consider using `instanceFilter`, `hideNodesInHierarchy` or `hideIfNoChildren`
   * and only use `hideExpression` if none of them are sufficient.
   *
   * @beta
   */
  hideExpression?: string;

  /**
   * Set this flag to `true` to suppress default sorting of ECInstances returned by this specification.
   *
   * **Note:** setting this flag to `true` improves performance.
   */
  doNotSort?: boolean;

  /** Specifications of related instances that can be used in content creation. */
  relatedInstances?: RelatedInstanceSpecification[];

  /** [Nested rule]($docs/learning/presentation/Hierarchies/Terminology.md#nested-rules) specifications. */
  nestedRules?: ChildNodeRule[];
}

/**
 * A container of default grouping properties. Used for specifications that support
 * default grouping. Not meant to be used directly, see `ChildNodeSpecification`.
 *
 * @public
 */
export interface DefaultGroupingPropertiesContainer {
  /** Group instances by ECClass. Defaults to `true`. */
  groupByClass?: boolean;

  /** Group instances by label. Defaults to `true`. */
  groupByLabel?: boolean;
}

/**
 * Navigation rule specifications that define what content the rule results in.
 * @public
 */
export type ChildNodeSpecification = AllInstanceNodesSpecification |
  AllRelatedInstanceNodesSpecification |
  CustomNodeSpecification |
  InstanceNodesOfSpecificClassesSpecification |
  RelatedInstanceNodesSpecification |
  CustomQueryInstanceNodesSpecification;
