/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
/** @module PresentationRules */
import { ChildNodeSpecificationBase } from "./ChildNodeSpecification";
import { PresentationRuleSpecificationTypes } from "../PresentationRuleSpecification";

/**
 * Returns all available instance nodes filtered only by the
 * supportedSchemas properties of the specification or the ruleset.
 */
export interface AllInstanceNodesSpecification extends ChildNodeSpecificationBase {
  /** Used for serializing to JSON. */
  type: PresentationRuleSpecificationTypes.AllInstanceNodesSpecification;

  /** Groups instances by ECClass. By default is set to true. */
  groupByClass?: boolean;

  /** Groups instances by display label. By default is set to true. */
  groupByLabel?: boolean;

  /**
   * List of schemas that should be used while building the query for gathering all instances.
   * Schema names should be separated by comma (","). In order to define excluded schemas "E:" prefix can be used.
   * By default is set to empty string.
   */
  supportedSchemas?: string;
}
