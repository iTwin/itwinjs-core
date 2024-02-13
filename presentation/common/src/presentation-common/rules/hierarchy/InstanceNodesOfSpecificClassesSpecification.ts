/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PresentationRules
 */

import { MultiSchemaClassesSpecification } from "../ClassSpecifications";
import { ChildNodeSpecificationBase, DefaultGroupingPropertiesContainer } from "./ChildNodeSpecification";

/**
 * Returns nodes for instances of specific ECClasses.
 *
 * @see [Instance nodes of specific classes specification reference documentation page]($docs/presentation/hierarchies/InstanceNodesOfSpecificClasses.md)
 * @public
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
   * Tells whether selecting instances from ECClasses specified in [[classes]] and [[excludedClasses]]
   * attributes should be polymorphic or not.
   *
   * @deprecated in 3.x. The attribute was replaced by `arePolymorphic` attribute specified individually for each class definition
   * under [[classes]] and [[excludedClasses]] attributes. At the moment, to keep backwards compatibility, this attribute acts
   * as a fallback value in case the flag is not specified individually for a class definition.
   */
  arePolymorphic?: boolean;

  /**
   * Specifies an [ECExpression]($docs/presentation/hierarchies/ECExpressions.md#instance-filter) for filtering
   * instances of ECClasses specified through the [[classes]] attribute.
   */
  instanceFilter?: string;
}
