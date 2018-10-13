/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module PresentationRules */
import { ChildNodeSpecificationBase, DefaultGroupingPropertiesContainer } from "./ChildNodeSpecification";
import { RuleSpecificationTypes } from "../RuleSpecification";
import { SchemasSpecification } from "../SchemasSpecification";

/**
 * Returns all available instance nodes filtered only by the
 * [[supportedSchemas]] properties of the specification or the ruleset.
 */
export interface AllInstanceNodesSpecification extends ChildNodeSpecificationBase, DefaultGroupingPropertiesContainer {
  /** Used for serializing to JSON. */
  specType: RuleSpecificationTypes.AllInstanceNodes;

  /**
   * Specification of schemas whose instances should be returned.
   */
  supportedSchemas?: SchemasSpecification;
}
