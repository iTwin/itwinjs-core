/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Logging
 */

/** Logger categories used by this package
 * @note All logger categories in this package start with the `telemetry-client` prefix.
 * @see [Logger]($bentley)
 * @public
 */
export enum TelemetryClientLoggerCategory {
  /** The logger category used for Telemetry */
  Telemetry = "telemetry-client.Telemetry",
}
