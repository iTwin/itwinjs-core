/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module WebGL
 */

import { PointCloudDisplaySettings, RealityModelDisplaySettings } from "@itwin/core-common";
import { UniformHandle } from "./UniformHandle";
import { desync, sync } from "./Sync";
import { Range3d, Transform, Vector3d } from "@itwin/core-geometry";
import { Target } from "./Target";
import { Plane } from "./FrustumUniforms";

/** A Target keeps track of the current settings for drawing point clouds.
 * Pushing a Branch may *replace* the current settings. Popping the Branch does not reset them. It is expected that every Branch containing
 * a point cloud will also specify the settings for drawing that point cloud.
 * This permits the same point cloud graphics to be rendered differently in different viewports.
 * In future these uniforms will include eye-dome lighting.
 * @internal
 */
export class PointCloudUniforms {
  public syncKey = 0;
  private _settings = PointCloudDisplaySettings.defaults;
  private _scaleFactor = 8.0;
  private _is3d = true;

  // vec3 u_pointSize
  // x = fixed point size in pixels if > 0, else scale applied to voxel size (negated).
  // y = minimum size in pixels if using voxel size.
  // z = maximum size in pixels if using voxel size
  // w = 1.0 if drawing square points, 0.0 if round.
  private readonly _vec4 = new Float32Array(4);

  // x = strength - 0.0 disables EDL
  // y = radius
  // z =
  // w =
  private readonly _edl1 = new Float32Array(4);
  private readonly _edl2 = new Float32Array(4);

  public constructor() {
    this.initialize(this._settings);
  }

  public update(settings: PointCloudDisplaySettings): void {
    if (this._settings.equals(settings))
      return;

    this._settings = settings;
    desync(this);
    this.initialize(settings);
  }

  public updateRange(range: Range3d | undefined, target: Target, xform: Transform, is3d: boolean): void {
    let rangeFactor = 8.0;  // default to min scale factor of 8
    const near = target.uniforms.frustum.nearPlane;
    const far = target.uniforms.frustum.farPlane;
    const viewDepth = far - near;
    if (range !== undefined) {
      const scale = xform.matrix;
      // calculate a "normalized" strength factor based on the size of the point cloud versus the current viewing depth
      //   from the matrix, only care about scaling factor here (entries 0,4,8) to scale the range lengths
      //   then use the largest length component as the reference for the size of the point cloud
      const rangeScale = Vector3d.create(scale.coffs[0] * range.xLength(), scale.coffs[4] * range.xLength(), scale.coffs[8] * range.xLength()).maxAbs();
      // limit the viewDepth/rangeScale ratio to min of 10 to still get reasonable factors when close to and inside the model
      rangeFactor = Math.log (Math.max (10, viewDepth / rangeScale));
    }
    // calculate a second factor to compensate for zoom level
    let zoomFactor;
    if (is3d) {
      zoomFactor = far / near;
    } else {
      const left = target.uniforms.frustum.planes[Plane.kLeft];
      const right = target.uniforms.frustum.planes[Plane.kRight];
      const pixWidth = target.uniforms.viewRect.width;
      zoomFactor = viewDepth * pixWidth / (right - left);
    }
    const scaleFactor = rangeFactor + Math.log (zoomFactor);
    console.log (`sf = ${(scaleFactor * 33.5).toPrecision(7)} rf ${rangeFactor.toPrecision(7)}, vwD ${viewDepth.toPrecision(7)}, n ${near.toPrecision(7)}, f ${far.toPrecision(7)}, zf ${Math.log(zoomFactor).toPrecision(7)}`); // TODO remove this debug
    if (!is3d) {
      const vwWidth = target.uniforms.frustum.planes[3] - target.uniforms.frustum.planes[2];
      console.log (`  Orth: fp width = ${vwWidth.toPrecision(7)} left ${target.uniforms.frustum.planes[2].toPrecision(7)} right ${target.uniforms.frustum.planes[3].toPrecision(7)}`);
    }
    if (this._scaleFactor === scaleFactor && this._is3d === is3d)
      return;
    this._scaleFactor = scaleFactor;
    this._is3d = is3d;
    desync(this);
    this.initialize(this._settings);
  }

  public bind(uniform: UniformHandle): void {
    if (!sync(this, uniform))
      uniform.setUniform4fv(this._vec4);
  }

  public bindEDL1(uniform: UniformHandle): void {
    if (!sync(this, uniform))
      uniform.setUniform4fv(this._edl1);
  }

  public bindEDL2(uniform: UniformHandle): void {
    if (!sync(this, uniform))
      uniform.setUniform4fv(this._edl2);
  }

  private initialize(settings: PointCloudDisplaySettings): void {
    this._vec4[0] = "pixel" === settings.sizeMode ? settings.pixelSize : -settings.voxelScale;
    this._vec4[1] = settings.minPixelsPerVoxel;
    this._vec4[2] = settings.maxPixelsPerVoxel;
    this._vec4[3] = "square" === settings.shape ? 1 : 0;

    this._edl1[0] = settings.edlStrength;
    this._edl1[1] = settings.edlRadius;
    this._edl1[2] = this._scaleFactor;
    this._edl1[3] = this._is3d ? 1 : 0;

    this._edl2[0] = settings?.edlMixWts1 ?? 1.0;
    this._edl2[1] = settings?.edlMixWts2 ?? 0.5;
    this._edl2[2] = settings?.edlMixWts4 ?? 0.25;
    this._edl2[3] = 0;
  }
}

/** Uniforms affecting how reality models are drawn.
 * Pushing a Branch may *replace* the current settings. Popping the Branch does not reset them. It is expected that every Branch containing
 * a reality model will also specify the settings for drawing that reality model.
 * This permits the same reality model graphics to be rendered differently in different viewports.
 * In future these uniforms may include additional settings for reality meshes - currently only the override color ratio applies to them.
 * @internal
 */
export class RealityModelUniforms {
  // ###TODO when we need it: public readonly mesh = new RealityMeshUniforms();
  public readonly pointCloud = new PointCloudUniforms();
  private _overrideColorMix = 0.5;

  public update(settings: RealityModelDisplaySettings): void {
    this._overrideColorMix = settings.overrideColorRatio;
    this.pointCloud.update(settings.pointCloud);
  }

  public bindOverrideColorMix(uniform: UniformHandle): void {
    uniform.setUniform1f(this._overrideColorMix);
  }
}
