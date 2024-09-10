/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import {
  CivilContourDisplay,
  ColorDef,
} from "@itwin/core-common";
import { UniformHandle } from "./UniformHandle";
import { desync, sync } from "./Sync";
import { Target } from "./Target";

const _maxContourDefs = 5; // number of concurrent contour definitions supported

/** Maintains state for uniforms related to thematic display.
 * @internal
 */
export class ContourUniforms {
  private readonly _contourDefsSize = Math.ceil(_maxContourDefs * 1.5);
  private readonly _contourDefs = new Float32Array(this._contourDefsSize * 4);
  private _contourDisplay?: CivilContourDisplay;

  public syncKey = 0;

  public get contourDefsSize() { return this._contourDefsSize; }
  public get contourDisplay(): CivilContourDisplay | undefined {
    return this._contourDisplay;
  }

  public get wantContourLines(): boolean {
    if (undefined !== this.contourDisplay)
      return true;  // TODO:
    return false;
  }

  // private _scratchVector = new Vector3d();

  private packColor(startNdx: number, majorColor: ColorDef, minorColor: ColorDef) {
    // pack 2 bytes major (upper) minor (lower) into each float
    this._contourDefs[startNdx] = majorColor.colors.r * 256 + minorColor.colors.r;
    this._contourDefs[startNdx+1] = majorColor.colors.g * 256 + minorColor.colors.g;
    this._contourDefs[startNdx+2] = majorColor.colors.b * 256 + minorColor.colors.b;
  }

  private packPatWidth(startNdx: number, majorPattern: number, minorPattern: number, majorWidth: number, minorWidth: number) {
    // pack 2 bytes into this float, which is 4th float of vec4
    //   pack pattern into upper byte (upper nibble -> major, lower -> minor)
    //   width is a 4-bit value that is biased by 1.5 based and has 3-bits value with one fraction bit, so range is 1.5 to 9
    //   pack width into lower byte (upper nibble -> major, lower -> minor)
    const pat = majorPattern * 4096 + minorPattern * 256;
    const majWt = Math.floor((Math.min(9, Math.max(1.5, majorWidth)) - 1.5) * 2 + 0.5);
    const minWt = Math.floor((Math.min(9, Math.max(1.5, minorWidth)) - 1.5) * 2 + 0.5);
    this._contourDefs[startNdx+3] = pat * 256 + majWt * 16 + minWt;
  }

  private packIntervals(startNdx: number, even: boolean, minorInterval: number, majorIntervalCount: number) {
    // minorInterval is a float of interval in meters, majorIntervalCount is an int > 0 count of minor inteverals per major interval
    // minorInterval is stored in r or b (0 or 2) and majorIntervalCount is stored in g or a (1 or 3) depending on even or odd index
    const offset = (even ? 0 : 1) * 2;
    this._contourDefs[startNdx+offset] = minorInterval;
    this._contourDefs[startNdx+offset+1] = Math.floor(majorIntervalCount + 0.5);
  }

  public update(target: Target): void {
    const plan = target.plan;

    if (this.contourDisplay && plan.contours && this.contourDisplay.equals(plan.contours)) {
      return;
    }

    desync(this);

    this._contourDisplay = plan.contours;
    if (!this.contourDisplay)
      return;

    for (let index = 0, len = this.contourDisplay.terrains.length; index < len && index < this._contourDefsSize; ++index) {
      const contourDef = this.contourDisplay.terrains[index].contourDef;
      const even = (index & 1) === 0;
      const colorDefsNdx = even ? index * 1.5 : (index - 1) * 1.5 + 2;
      this.packColor (colorDefsNdx, contourDef.majorColor, contourDef.minorColor);
      this.packPatWidth (colorDefsNdx, contourDef.majorPattern, contourDef.minorPattern, contourDef.majorPixelWidth, contourDef.minorPixelWidth);
      const intervalsPairNdx = Math.floor(index * 0.5) * 3 + 1;
      this.packIntervals (intervalsPairNdx, even, contourDef.minorInterval, contourDef.majorIntervalCount);
    }
  }

  public bindcontourDefs(uniform: UniformHandle): void {
    if (!sync(this, uniform))
      uniform.setUniform4fv(this._contourDefs);
  }
}
