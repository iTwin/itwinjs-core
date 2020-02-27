/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PresentationRules
 */
import { ChildNodeSpecificationBase, ChildNodeSpecificationTypes, DefaultGroupingPropertiesContainer } from "./ChildNodeSpecification";
import { SchemasSpecification } from "../SchemasSpecification";

/**
 * Creates nodes for all available instances filtered only by the
 * [[supportedSchemas]] properties of the specification or the ruleset.
 *
 * @public
 * @deprecated Use `InstanceNodesOfSpecificClassesSpecification`. Will be removed in iModel.js 3.0
 */
export interface DEPRECATED_AllInstanceNodesSpecification extends ChildNodeSpecificationBase, DefaultGroupingPropertiesContainer { // tslint:disable-line: naming-convention class-name
  /** Used for serializing to JSON. */
  specType: ChildNodeSpecificationTypes.DEPRECATED_AllInstanceNodes;

  /**
   * Specification of schemas whose instances should be returned.
   */
  supportedSchemas?: SchemasSpecification;
}
