/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PresentationRules
 */

import { MultiSchemaClassesSpecification } from "../ClassSpecifications";
import { ContentSpecificationBase } from "./ContentSpecification";

/**
 * This specification creates content for all instances of specific ECClasses.
 *
 * @see [Content instances of specific classes specification reference documentation page]($docs/presentation/content/ContentInstancesOfSpecificClasses.md)
 * @public
 */
export interface ContentInstancesOfSpecificClassesSpecification extends ContentSpecificationBase {
  /** Used for serializing to JSON. */
  specType: "ContentInstancesOfSpecificClasses";

  /**
   * Defines a set of [multi schema classes]($docs/presentation/MultiSchemaClassesSpecification.md) that specify which
   * ECClasses need to be selected to form the result.
   */
  classes: MultiSchemaClassesSpecification | MultiSchemaClassesSpecification[];

  /**
   * Defines a set of [multi schema classes]($docs/presentation/MultiSchemaClassesSpecification.md) that prevents specified
   * ECClasses and subclasses from being selected by [[classes]] attribute.
   */
  excludedClasses?: MultiSchemaClassesSpecification | MultiSchemaClassesSpecification[];

  /**
   * Specifies whether properties of derived [[classes]] should be included in the content.
   */
  handlePropertiesPolymorphically?: boolean;

  /**
   * Specifies an [ECExpression]($docs/presentation/content/ECExpressions.md#instance-filter) for filtering instances
   * of ECClasses specified through the [[classes]] attribute.
   */
  instanceFilter?: string;
}
