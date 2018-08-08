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
   * List of ECClass names.
   *
   * Each class name may be prefixed with:
   * - `E:` to exclude class from results
   * - `PE:` to exclude class and all its sublasses from results
   * So generally the list may contain `["base_class_name", "PE:derived_class_name"]` to
   * include all instances of `base_class_name` except all polymorphic instances of
   * `derived_class_name`.
   *
   * @pattern ^(E:|PE:)?[\w\d]+$
   */
  classNames: string[];
}
