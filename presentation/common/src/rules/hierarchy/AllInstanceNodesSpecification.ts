/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @module PresentationRules */
import { ChildNodeSpecificationBase, ChildNodeSpecificationTypes, DefaultGroupingPropertiesContainer } from "./ChildNodeSpecification";
import { SchemasSpecification } from "../SchemasSpecification";

/**
 * Creates nodes for all available instances filtered only by the
 * [[supportedSchemas]] properties of the specification or the ruleset.
 *
 * @public
 */
export interface AllInstanceNodesSpecification extends ChildNodeSpecificationBase, DefaultGroupingPropertiesContainer {
  /** Used for serializing to JSON. */
  specType: ChildNodeSpecificationTypes.AllInstanceNodes;

  /**
   * Specification of schemas whose instances should be returned.
   */
  supportedSchemas?: SchemasSpecification;
}
