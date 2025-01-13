/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PresentationRules
 */

import { RelatedInstanceSpecification } from "../RelatedInstanceSpecification";
import { ChildNodeRule } from "./ChildNodeRule";
import { CustomNodeSpecification } from "./CustomNodeSpecification";
import { CustomQueryInstanceNodesSpecification } from "./CustomQueryInstanceNodesSpecification";
import { InstanceNodesOfSpecificClassesSpecification } from "./InstanceNodesOfSpecificClassesSpecification";
import { RelatedInstanceNodesSpecification } from "./RelatedInstanceNodesSpecification";

/**
 * Used for serializing array of [[ChildNodeSpecification]]
 * @public
 */
export enum ChildNodeSpecificationTypes {
  RelatedInstanceNodes = "RelatedInstanceNodes",
  InstanceNodesOfSpecificClasses = "InstanceNodesOfSpecificClasses",
  CustomQueryInstanceNodes = "CustomQueryInstanceNodes",
  CustomNode = "CustomNode",
}

/**
 * Base interface for all [[ChildNodeSpecification]] implementations.
 *
 * @see [Child node specifications reference documentation section]($docs/presentation/hierarchies/ChildNodeRule.md#attribute-specifications)
 * @public
 */
export interface ChildNodeSpecificationBase {
  /**
   * Used for serializing to JSON.
   * @see ChildNodeSpecificationTypes
   */
  specType: `${ChildNodeSpecificationTypes}`;

  /**
   * Controls the order in which specifications are handled — specification with higher priority value is
   * handled first. If priorities are equal, the specifications are handled in the order they appear in the
   * ruleset.
   *
   * @type integer
   */
  priority?: number;

  /**
   * This attribute allows telling the engine that nodes created by this specification always or never have children.
   */
  hasChildren?: "Always" | "Never" | "Unknown";

  /**
   * When `true`, instances nodes produced by this specification are omitted and their children appear one
   * hierarchy level higher.
   */
  hideNodesInHierarchy?: boolean;

  /**
   * Specifies whether nodes created through this specification should be hidden if they have no child nodes.
   */
  hideIfNoChildren?: boolean;

  /**
   * When specified [ECExpression]($docs/presentation/hierarchies/ECExpressions.md#specification) evaluates
   * to `true`, nodes produced by this specification are omitted and their children appear one hierarchy level
   * higher.
   */
  hideExpression?: string;

  /**
   * Suppress sorting of nodes returned by this specification. With this attribute set to `true`, the order
   * of returned nodes is undefined.
   */
  doNotSort?: boolean;

  /**
   * Specifies whether similar ancestor nodes' checking should be suppressed when creating nodes based on this
   * specification. See more in [infinite hierarchies prevention page]($docs/presentation/hierarchies/InfiniteHierarchiesPrevention.md).
   */
  suppressSimilarAncestorsCheck?: boolean;

  /**
   * Specifications of [related instances]($docs/presentation/RelatedInstanceSpecification.md) that can be used
   * when creating the nodes.
   */
  relatedInstances?: RelatedInstanceSpecification[];

  /**
   * Specifications of [nested child node rules]($docs/presentation/hierarchies/Terminology.md#nested-rule) that
   * allow creating child nodes without the need of supplying a condition to match the parent node.
   */
  nestedRules?: ChildNodeRule[];
}

/**
 * A container of default grouping properties. Used for specifications that support
 * default grouping. Not meant to be used directly, see [[ChildNodeSpecification]].
 *
 * @public
 */
export interface DefaultGroupingPropertiesContainer {
  /** Controls whether returned instances should be grouped by ECClass. Defaults to `true`. */
  groupByClass?: boolean;

  /** Controls whether returned instances should be grouped by label. Defaults to `true`. */
  groupByLabel?: boolean;
}

/**
 * Hierarchy rule specifications that define what nodes are going to be returned by the rule.
 *
 * @see [Child node specifications reference documentation section]($docs/presentation/hierarchies/ChildNodeRule.md#attribute-specifications)
 * @public
 */
export type ChildNodeSpecification =
  | CustomNodeSpecification
  | InstanceNodesOfSpecificClassesSpecification
  | RelatedInstanceNodesSpecification
  | CustomQueryInstanceNodesSpecification;
