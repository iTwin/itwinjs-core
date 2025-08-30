/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/* eslint-disable @typescript-eslint/no-deprecated */
/** @packageDocumentation
 * @module PresentationRules
 */

import { MultiSchemaClassesSpecification } from "../ClassSpecifications.js";
import { ChildNodeSpecificationBase, DefaultGroupingPropertiesContainer } from "./ChildNodeSpecification.js";

/**
 * Returns nodes for instances of specific ECClasses.
 *
 * @see [Instance nodes of specific classes specification reference documentation page]($docs/presentation/hierarchies/InstanceNodesOfSpecificClasses.md)
 * @public
 * @deprecated in 5.2. Use the new [@itwin/presentation-hierarchies](https://github.com/iTwin/presentation/blob/master/packages/hierarchies/README.md)
 * package for creating hierarchies.
 */
export interface InstanceNodesOfSpecificClassesSpecification extends ChildNodeSpecificationBase, DefaultGroupingPropertiesContainer {
  /** Used for serializing to JSON. */
  specType: "InstanceNodesOfSpecificClasses";

  /**
   * Defines a set of [multi schema classes]($docs/presentation/MultiSchemaClassesSpecification.md) that
   * specify which ECClasses need to be selected to form the result.
   */
  classes: MultiSchemaClassesSpecification | MultiSchemaClassesSpecification[];

  /**
   * Defines a set of [multi schema classes]($docs/presentation/MultiSchemaClassesSpecification.md) that
   * prevents specified ECClasses and subclasses from being selected by [[classes]] attribute.
   */
  excludedClasses?: MultiSchemaClassesSpecification | MultiSchemaClassesSpecification[];

  /**
   * Specifies an [ECExpression]($docs/presentation/hierarchies/ECExpressions.md#instance-filter) for filtering
   * instances of ECClasses specified through the [[classes]] attribute.
   */
  instanceFilter?: string;
}
