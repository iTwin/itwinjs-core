/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PresentationRules
 */

import { RelatedInstanceSpecification } from "../RelatedInstanceSpecification";
import { DEPRECATED_AllInstanceNodesSpecification } from "./AllInstanceNodesSpecification";
import { DEPRECATED_AllRelatedInstanceNodesSpecification } from "./AllRelatedInstanceNodesSpecification";
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
  // hierarchy specifications
  DEPRECATED_AllInstanceNodes = "AllInstanceNodes", // tslint:disable-line: naming-convention
  DEPRECATED_AllRelatedInstanceNodes = "AllRelatedInstanceNodes", // tslint:disable-line: naming-convention
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
   */
  hideExpression?: string;

  /**
   * Set this flag to `true` to suppress default sorting of ECInstances returned by this specification.
   *
   * **Note:** setting this flag to `true` improves performance.
   */
  doNotSort?: boolean;

  /**
   * Suppress similar ancestor nodes' checking when creating nodes based on this specification.
   *
   * By default we stop creating hierarchy at the node that has a similar ancestor representing
   * the same ECInstance and created using the same specification to prevent creating infinite
   * hierarchies. With this flag enabled, we allow up to 10 similar ancestors before we consider
   * the hierarchy infinite.
   *
   * @beta
   */
  suppressSimilarAncestorsCheck?: boolean;

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
export type ChildNodeSpecification = DEPRECATED_AllInstanceNodesSpecification | // tslint:disable-line:deprecation
  DEPRECATED_AllRelatedInstanceNodesSpecification | // tslint:disable-line:deprecation
  CustomNodeSpecification |
  InstanceNodesOfSpecificClassesSpecification |
  RelatedInstanceNodesSpecification |
  CustomQueryInstanceNodesSpecification;
