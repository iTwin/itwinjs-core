/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
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
   * **See:** [ECExpressions Available in InstanceFilter]($docs/learning/presentation/Hierarchies/ECExpressions.md#instance-filter).
   */
  instanceFilter?: string;
}
