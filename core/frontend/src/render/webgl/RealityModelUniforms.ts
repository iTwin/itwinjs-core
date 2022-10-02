/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module WebGL
 */

import { UniformHandle } from "./UniformHandle";

/** A Target keeps track of the current settings for drawing point clouds.
 * Pushing a Branch may *replace* the current settings. Popping the Branch does not reset them. It is expected that every Branch containing
 * a point cloud will also specify the settings for drawing that point cloud.
 * This permits the same point cloud graphics to be rendered differently in different viewports.
 * In future these uniforms will include eye-dome lighting.
 * @internal
 */
export class PointCloudUniforms {
  // vec3 u_pointSize
  // x = fixed point size in pixels if > 0, else scale applied to voxel size.
  // y = minimum size in pixels if using voxel size.
  // z = maximum size in pixels if using voxel size
  // w = 1.0 if drawing square points instead of round.
  private readonly _vec4 = new Float32Array([-1, 2, 20, 0]);

  public bind(uniform: UniformHandle): void {
    // ###TODO sync, desync
    uniform.setUniform4fv(this._vec4);
  }
}
