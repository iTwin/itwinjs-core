/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Schema
 */

import { ITwinError } from "@itwin/core-bentley";

/** An error thrown by the schema authoring API for a condition the caller can act on.
 *
 * Authoring operations report bad *data* as {@link SchemaIssue}s and never throw for it - a document
 * is allowed to be invalid. This is thrown only where the caller has to change something about the
 * *call* for it to succeed, most often by putting a schema in the {@link SchemaSet} first. Bugs and
 * misuse (asking an enumeration to narrow to an entity class) throw a plain `Error` instead.
 *
 * @example
 * ```ts
 * try {
 *   const values = attribute.values;
 * } catch (error) {
 *   if (!SchemaAuthoringError.isError(error, "custom-attribute-class-not-found"))
 *     throw error;
 *   // error.itemName is the class that could not be resolved.
 * }
 * ```
 * @alpha
 */
export interface SchemaAuthoringError extends ITwinError {
  /** Full name of the schema, item, or custom attribute class the failure concerns, when one applies. */
  readonly itemName?: string;
  /** Path of the schema element involved, in the same form as {@link SchemaIssue.location}
   * (e.g. `"MyDomain:Pump.SerialNumber"`). */
  readonly location?: string;
}

/** @alpha */
export namespace SchemaAuthoringError {
  export const scope = "itwin-ECSchemaAuthoring";

  /** Identifies which condition was hit. Each is recoverable by the caller:
   * - `custom-attribute-class-not-found` - a custom attribute cannot be materialized because its
   *   class is in no schema the document can reach. Put that schema in the set.
   * - `malformed-custom-attribute-xml` - a custom attribute holds an ECXML body that does not parse.
   *   The source file is broken.
   * - `duplicate-schema-name` - a {@link SchemaSet} already holds a schema of that name. Call
   *   {@link SchemaSet.moveOut} for the incumbent first.
   */
  export type Key =
    "custom-attribute-class-not-found" |
    "malformed-custom-attribute-xml" |
    "duplicate-schema-name";

  /** Determines whether an error is a {@link SchemaAuthoringError}, optionally of one specific kind. */
  export function isError(error: unknown, key?: Key): error is SchemaAuthoringError {
    return ITwinError.isError<SchemaAuthoringError>(error, scope, key);
  }

  /** Instantiates and throws a {@link SchemaAuthoringError}. */
  export function throwError(key: Key, message: string, context?: { itemName?: string, location?: string }): never {
    ITwinError.throwError<SchemaAuthoringError>({ iTwinErrorId: { scope, key }, message, ...context });
  }
}
