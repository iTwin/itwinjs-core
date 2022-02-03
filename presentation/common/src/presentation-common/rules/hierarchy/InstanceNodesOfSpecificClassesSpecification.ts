/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PresentationRules
 */

import type { MultiSchemaClassesSpecification } from "../ClassSpecifications";
import type { ChildNodeSpecificationBase, ChildNodeSpecificationTypes, DefaultGroupingPropertiesContainer } from "./ChildNodeSpecification";

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
   * Specifications of ECClasses whose instances should be excluded.
   */
  excludedClasses?: MultiSchemaClassesSpecification | MultiSchemaClassesSpecification[];

  /**
   * Whether to get instances from derived `classes`.
   * Acts as default value for [[classes.arePolymorphic]] and [[excludedClasses.arePolymorphic]].
   * @deprecated Specify polymorphism value inside [[classes.arePolymorphic]] or [[excludedClasses.arePolymorphic]].
   */
  arePolymorphic?: boolean;

  /**
   * Condition for filtering instances of defined classes.
   *
   * **See:** [ECExpressions Available in InstanceFilter]($docs/presentation/Hierarchies/ECExpressions.md#instance-filter).
   */
  instanceFilter?: string;
}
