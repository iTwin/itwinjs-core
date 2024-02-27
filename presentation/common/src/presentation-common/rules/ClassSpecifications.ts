/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PresentationRules
 */

/**
 * This specification is used to point to specific ECClass.
 *
 * @see [Single schema class specification reference documentation page]($docs/presentation/SingleSchemaClassSpecification.md)
 * @public
 */
export interface SingleSchemaClassSpecification {
  /**
   * Specifies name of the schema which contains the target class.
   *
   * @pattern ^[\w\d]+$
   */
  schemaName: string;

  /**
   * Specifies name of the target class.
   *
   * @pattern ^[\w\d]+$
   */
  className: string;
}

/**
 * This specification lists ECClasses which should be targeted when creating content or hierarchy nodes.
 *
 * @see [Multi schema classes specification reference documentation page]($docs/presentation/MultiSchemaClassesSpecification.md)
 * @public
 */
export interface MultiSchemaClassesSpecification {
  /**
   * Specifies the schema which contains the target classes.
   *
   * @pattern ^[\w\d]+$
   */
  schemaName: string;

  /**
   * An array of target ECClass names.
   */
  classNames: string[];

  /**
   * Defines whether the derived ECClasses should be included in the result.
   */
  arePolymorphic?: boolean;
}
