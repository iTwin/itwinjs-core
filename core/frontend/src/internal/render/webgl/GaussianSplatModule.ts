/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

// The entry point of the lazily loaded Gaussian splat implementation (see loadGaussianSplatModule). Code outside the
// implementation imports only types from it, and reaches the rest through this module, so that it stays out of the main bundle.

export { readGaussianSplatSource } from "../GaussianSplatData";
export { decodeGaussianSplats } from "../GaussianSplatWorker";
