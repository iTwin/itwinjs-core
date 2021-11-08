/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Logging
 */

/** Logger categories used by this package
 * @see [Logger]($bentley)
 * @public
 */
export enum CommonLoggerCategory {
  /** The logger category used by common classes relating to ElementProps. */
  ElementProps = "core-common.ElementProps",
  /** The logger category used by common classes relating to Geometry. */
  Geometry = "core-common.Geometry",
  /** The logger category used by the portions of the RpcInterface framework that run on the backend. */
  RpcInterfaceBackend = "core-backend.RpcInterface",
  /** The logger category used by the portions of the RpcInterface framework that run on the frontend. */
  RpcInterfaceFrontend = "core-frontend.RpcInterface",
}
