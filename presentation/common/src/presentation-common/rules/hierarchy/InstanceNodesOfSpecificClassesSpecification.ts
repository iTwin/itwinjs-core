/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PresentationRules
 */

import { MultiSchemaClassesSpecification } from "../ClassSpecifications";
import { ChildNodeSpecificationBase, ChildNodeSpecificationTypes, DefaultGroupingPropertiesContainer } from "./ChildNodeSpecification";

/**
 * Creates nodes for all instances of specified ECClasses.
 *
 * @see [More details]($docs/presentation/Hierarchies/InstanceNodesOfSpecificClasses.md)
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
   * **See:** [ECExpressions Available in InstanceFilter]($docs/presentation/Hierarchies/ECExpressions.md#instance-filter).
   */
  instanceFilter?: string;
}
