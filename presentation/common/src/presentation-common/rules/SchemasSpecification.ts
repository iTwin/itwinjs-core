/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PresentationRules
 */

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

/**
 * This specification is designed for specifying schema requirements for the [[Ruleset]] or specific
 * presentation rules.
 *
 * @see [Required schema specification reference documentation page]($docs/presentation/RequiredSchemaSpecification.md)
 * @public
 */
export interface RequiredSchemaSpecification {
  /** Specifies the schema to whom the requirement is being set. */
  name: string;

  /**
   * Minimum required schema version (inclusive).
   * Format: `{read version}.{write version}.{minor version}`, e.g. `2.1.15`.
   *
   * @pattern ^[\d]+\.[\d]+\.[\d]+$
   */
  minVersion?: string;

  /**
   * Maximum allowed schema version (exclusive).
   * Format: `{read version}.{write version}.{minor version}`, e.g. `2.1.15`.
   *
   * @pattern ^[\d]+\.[\d]+\.[\d]+$
   */
  maxVersion?: string;
}
