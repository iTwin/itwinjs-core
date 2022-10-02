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
  // vec4 u_pointSize
  // x = mode (1=pixel, 0=voxel) ###TODO could just make size negative to indicate mode.
  // y = size in pixels or voxel scale
  // z = minimum size in pixels in voxel mode
  // w = maximum size in pixels in voxel mode
  private readonly _pointSize = new Float32Array([0, 1, 2, 20]);

  // bool u_squarePoints - true if points should be drawn as squares instead of circles.
  private _squarePoints = false;

  public bindPointSize(uniform: UniformHandle): void {
    // ###TODO sync, desync
    uniform.setUniform4fv(this._pointSize);
  }

  public bindPointShape(uniform: UniformHandle): void {
    // ###TODO sync, desync
    uniform.setUniform1i(this._squarePoints ? 1 : 0);
  }
}
