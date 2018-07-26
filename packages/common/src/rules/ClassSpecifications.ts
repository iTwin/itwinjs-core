/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
/** @module PresentationRules */

/**
 * Specification for a single ECClass
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
 */
export interface MultiSchemaClassesSpecification {
  /**
   * Name of ECSchema
   *
   * @pattern ^[\w\d]+$
   */
  schemaName: string;

  /**
   * List of ECClass names
   *
   * @pattern ^[\w\d]+$
   */
  classNames: string[];
}
