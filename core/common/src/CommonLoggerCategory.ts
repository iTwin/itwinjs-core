/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Logging */

/** Logger categories used by this package
 * @see [Logger]($bentley)
 * @public
 */
export enum CommonLoggerCategory {
  /** The logger category used by common classes relating to ElementProps. */
  ElementProps = "imodeljs-common.ElementProps",
  /** The logger category used by the portions of the RpcInterface framework that run on the backend. */
  RpcInterfaceBackend = "imodeljs-backend.RpcInterface",
  /** The logger category used by the portions of the RpcInterface framework that run on the frontend. */
  RpcInterfaceFrontend = "imodeljs-frontend.RpcInterface",
}
