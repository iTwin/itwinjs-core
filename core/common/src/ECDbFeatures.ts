/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ECDb
 */

/** Lifecycle status of an ECDb feature.
 * @beta
 */
export type ECDbFeatureStatus = "Experimental" | "Stable" | "Deprecated";

/** Describes a single well-known feature that can be opted into by an ECDb file.
 * @see [[ECDbFeatures]]
 * @beta
 */
export interface ECDbFeatureDescriptor {
  /** Unique string identifier, e.g. `"strict-schema-loading"`. */
  readonly name: string;
  /** Short human-readable label. */
  readonly label: string;
  /** Longer description suitable for error messages and tooling UI. */
  readonly description: string;
  /** Lifecycle status of this feature. */
  readonly status: ECDbFeatureStatus;
  /** If true, the feature is automatically enabled when a new file is created. */
  readonly enabledByDefault: boolean;
  /** If false, the feature cannot be disabled once enabled. */
  readonly toggleable: boolean;
  /** If true, the enabled state is not persisted and only lasts for the current session. */
  readonly ephemeral: boolean;
}

/** Feature information for the currently open ECDb file.
 * @see [IModelDb.getFeatures]($backend)
 * @beta
 */
export interface ECDbFeatures {
  /** Names of features currently enabled in the open file. */
  readonly used: ReadonlyArray<string>;
  /** All features known to this build of the native library. */
  readonly available: ReadonlyArray<ECDbFeatureDescriptor>;
}
