/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module PresentationRules */

import { ChildNodeSpecificationBase, DefaultGroupingPropertiesContainer } from "./ChildNodeSpecification";
import { RuleSpecificationTypes } from "../RuleSpecification";
import { MultiSchemaClassesSpecification } from "../ClassSpecifications";

/** Returns all instance nodes of specified ECClasses. */
export interface InstanceNodesOfSpecificClassesSpecification extends ChildNodeSpecificationBase, DefaultGroupingPropertiesContainer {
  /** Used for serializing to JSON. */
  specType: RuleSpecificationTypes.InstanceNodesOfSpecificClasses;

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
