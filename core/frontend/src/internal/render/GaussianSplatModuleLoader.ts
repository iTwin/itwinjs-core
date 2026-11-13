/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import type * as GaussianSplatModuleExports from "./webgl/GaussianSplatModule";

/** The Gaussian splat implementation, which only render systems that enable Gaussian splats load (see [[loadGaussianSplatModule]]).
 * @internal
 */
export type GaussianSplatModule = typeof GaussianSplatModuleExports;

let loadedModule: GaussianSplatModule | undefined;

/** Load the Gaussian splat implementation. It is imported dynamically so that bundlers put it in a chunk of its own, which
 * applications that do not enable Gaussian splats never download.
 * @internal
 */
export async function loadGaussianSplatModule(): Promise<GaussianSplatModule> {
  return loadedModule ??= await import("./webgl/GaussianSplatModule");
}

/** The Gaussian splat implementation, if it has loaded. Only it creates splat geometry, so wherever there are splats to draw,
 * it has loaded.
 * @internal
 */
export function loadedGaussianSplatModule(): GaussianSplatModule | undefined {
  return loadedModule;
}
