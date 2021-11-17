/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PresentationRules
 */

/**
 * Specification for a single ECClass
 * @public
 */
export interface SingleSchemaClassSpecification {
  /**
   * Name of ECSchema
   *
   * @pattern ^[\w\d]+$
   */
  schemaName: string;

  /**
   * Name of ECClass
   *
   * @pattern ^[\w\d]+$
   */
  className: string;
}

/**
 * Specification for multiple ECClasses that belong to
 * the same ECSchema.
 *
 * @public
 */
export interface MultiSchemaClassesSpecification {
  /**
   * Name of ECSchema
   *
   * @pattern ^[\w\d]+$
   */
  schemaName: string;

  /**
   * List of ECClass names.
   */
  classNames: string[];

  /**
   * Should all classes specified in [[classNames]] array be handled polymorphically.
   */
  arePolymorphic?: boolean;
}
