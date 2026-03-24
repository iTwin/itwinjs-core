/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module CloudStorage
 */

/** Frontend-safe, serializable subset of cloud-hosted database container properties.
 * Contains only identification and configuration fields suitable for display in user interfaces,
 * without backend-only operational fields like access tokens, lock timeouts, or sync behavior.
 * @public
 */
export interface DbCloudContainerInfo {
  /** The unique identifier of the container. */
  readonly containerId: string;
  /** The base URI for the container's cloud storage.
   * @note This value is intended to be frontend-safe. It must not contain credentials, signed query parameters (e.g. SAS tokens),
   * or userinfo components. Callers should ensure only HTTPS URIs are used.
   */
  readonly baseUri: string;
  /** The type of cloud storage provider. */
  readonly storageType: "azure" | "google";
  /** The name of the database within the container. */
  readonly dbName?: string;
  /** The range of acceptable versions of the database (semver range, e.g., ">=1.2.0 <2.0.0"). */
  readonly version?: string;
  /** An alias for the container. Defaults to `containerId` if not specified. */
  readonly alias?: string;
  /** A user-friendly description of the container's contents. */
  readonly description?: string;
  /** Whether the container is public (does not require authorization). */
  readonly isPublic?: boolean;
  /** Whether the container is allowed to request a write lock. */
  readonly writeable?: boolean;
}
