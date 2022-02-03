/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import type { RgbColor } from "@itwin/core-common";
import { ColorDef, LightSettings } from "@itwin/core-common";
import { FloatRgb } from "./FloatRGBA";
import type { UniformHandle } from "./UniformHandle";
import { desync, sync } from "./Sync";

/** Maintains state of uniforms associated with a DisplayStyle3dState's LightSettings.
 * A single float array stored as:
 *  0  float solar intensity
 *  1  vec3 ambient color
 *  4  float ambient intensity
 *  5  vec3 hemi lower color
 *  8  vec3 hemi upper color
 *  11 float hemi intensity
 *  12 float portrait intensity
 *  13 float specular intensity
 *  14 float num cels
 *  15 fresnel intensity (negative if fresnel is to be inverted)
 * Note solar direction is handled separately in TargetUniforms.
 * @internal
 */
export class LightingUniforms {
  public syncKey = 0;

  // CPU state
  private _settings = LightSettings.fromJSON();
  private _initialized = false;

  // GPU state.
  private readonly _data = new Float32Array(16);

  // Working state
  private readonly _rgb = new FloatRgb();

  private setRgb(rgb: RgbColor, index: number): void {
    this._rgb.setTbgr(ColorDef.computeTbgrFromComponents(rgb.r, rgb.g, rgb.b));
    this._data[index + 0] = this._rgb.red;
    this._data[index + 1] = this._rgb.green;
    this._data[index + 2] = this._rgb.blue;
  }

  public update(settings: LightSettings): void {
    if (this._initialized && this._settings.equals(settings))
      return;

    this._initialized = true;
    this._settings = settings;
    desync(this);

    const data = this._data;
    data[0] = settings.solar.intensity;

    this.setRgb(settings.ambient.color, 1);
    data[4] = settings.ambient.intensity;

    this.setRgb(settings.hemisphere.lowerColor, 5);
    this.setRgb(settings.hemisphere.upperColor, 8);
    data[11] = settings.hemisphere.intensity;

    data[12] = settings.portraitIntensity;
    data[13] = settings.specularIntensity;
    data[14] = settings.numCels;

    const fresnel = settings.fresnel.intensity;
    data[15] = settings.fresnel.invert ? -fresnel : fresnel;
  }

  public bind(uniform: UniformHandle): void {
    if (!sync(this, uniform))
      uniform.setUniform1fv(this._data);
  }
}
