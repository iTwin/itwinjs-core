/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module PresentationRules */

import { ChildNodeSpecificationBase, ChildNodeSpecificationTypes, DefaultGroupingPropertiesContainer } from "./ChildNodeSpecification";
import { MultiSchemaClassesSpecification } from "../ClassSpecifications";

/**
 * Creates nodes for all instances of specified ECClasses.
 * @public
 */
export interface InstanceNodesOfSpecificClassesSpecification extends ChildNodeSpecificationBase, DefaultGroupingPropertiesContainer {
  /** Used for serializing to JSON. */
  specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses;

  /**
   * Specifications of ECClasses whose instances should be returned.
   */
  classes: MultiSchemaClassesSpecification | MultiSchemaClassesSpecification[];

  /**
   * Should all [[classes]] be handled polymorphically.
   */
  arePolymorphic?: boolean;

  /**
   * Condition for filtering instances of defined classes.
   *
   * **See:** [ECExpressions Available in InstanceFilter]($docs/learning/hierarchies/ECExpressions.md#instance-filter).
   */
  instanceFilter?: string;
}
