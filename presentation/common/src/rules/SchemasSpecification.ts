/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module PresentationRules */

/**
 * Specification for a list of ECSchemas
 * @public
 */
export interface SchemasSpecification {
  /** ECSchema names */
  schemaNames: string[];

  /**
   * Should schemas specified in [[schemaNames]] be excluded rather than included.
   * Exclusion works by including everything except what's specified in [[schemaNames]].
   */
  isExclude?: boolean;
}
