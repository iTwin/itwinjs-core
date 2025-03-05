/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { ContourDisplay, RgbColor } from "@itwin/core-common";
import { UniformHandle } from "./UniformHandle";
import { desync, sync } from "./Sync";
import { Target } from "./Target";
import { LineCode } from "./LineCode";

/** Maintains state for uniforms related to contour display.
 * @internal
 */
export class ContourUniforms {
  // We use 1.5x ContourDisplay.maxContourGroups of indexable vec4 uniforms, also limited to 14 by the feature lookup texture packing scheme
  private readonly _contourDefsSize = Math.ceil(ContourDisplay.maxContourGroups * 1.5);
  private readonly _contourDefs = new Float32Array(this._contourDefsSize * 4);
  private _contourDisplay?: ContourDisplay;

  public syncKey = 0;

  public get contourDisplay(): ContourDisplay | undefined {
    return this._contourDisplay;
  }

  private packColor(startNdx: number, majorColor: RgbColor, minorColor: RgbColor) {
    // pack 2 bytes major (upper) minor (lower) into each float
    this._contourDefs[startNdx] = majorColor.r * 256 + minorColor.r;
    this._contourDefs[startNdx+1] = majorColor.g * 256 + minorColor.g;
    this._contourDefs[startNdx+2] = majorColor.b * 256 + minorColor.b;
  }

  private packPatWidth(startNdx: number, majorPattern: number, minorPattern: number, majorWidth: number, minorWidth: number, showGeometry: boolean) {
    // pack 2 bytes into this float, which is 4th float of vec4
    //   width is a 4-bit value that is biased by 1.0 and has 3-bits value with one fraction bit, so range is 1.0 to 8.5
    //   pattern is a line code index 0 to 10 (0 is solid)
    //   pack major into upper byte (upper nibble -> pattern, lower nibble -> 4-bit encoded width)
    //   pack minor into lower byte (upper nibble -> pattern, lower nibble -> 4-bit encoded width)
    // NB: showGeometry flag is packed into bit 16 (above major pattern)
    const majWt = Math.floor((Math.min(8.5, Math.max(1.0, majorWidth)) - 1.0) * 2 + 0.5);
    const minWt = Math.floor((Math.min(8.5, Math.max(1.0, minorWidth)) - 1.0) * 2 + 0.5);
    this._contourDefs[startNdx+3] = (showGeometry ? 65536 : 0) + majorPattern * 4096 + majWt * 256 + minorPattern * 16 + minWt;
  }

  private packIntervals(startNdx: number, even: boolean, minorInterval: number, majorIntervalCount: number) {
    // minorInterval is a float of interval in meters, majorIntervalCount is an int > 0 count of minor inteverals per major interval
    // minorInterval is stored in r or b (0 or 2) and majorIntervalCount is stored in g or a (1 or 3) depending on even or odd index
    const offset = (even ? 0 : 1) * 2;
    this._contourDefs[startNdx+offset] = minorInterval <= 0.0 ? 1.0 : minorInterval;
    majorIntervalCount = Math.floor(majorIntervalCount + 0.5);
    this._contourDefs[startNdx+offset+1] = majorIntervalCount < 1.0 ? 1.0 : majorIntervalCount;
  }

  public update(target: Target): void {
    const plan = target.plan;

    if (this.contourDisplay && plan.contours && this.contourDisplay.equals(plan.contours)) {
      return;
    }

    desync(this);

    this._contourDisplay = plan.contours;
    if (undefined === this.contourDisplay)
      return;

    /* uniform packing for contourDefs:
        The line pattern code is put into 4 bits, and the width is packed into 4 bits, so together with the pattern use 8 bits.
        This and the color bytes are then packed 2 bytes per float component, major in upper, as a float (e.g.: majorByte * 256 + minorByte)
        The minorInterval and majorCount each take a full float component, so they are combined with a second entry to use a full vec4
          Because of this, the overal indexing for a given contourDef is a bit different
        E.g.: the first 2 contour definitions (if both used) are packed into the first 3 vec4 uniform indexes like so:
          0.r = majCol[0].r << 8 | minCol[0].r  (0 to 65535 as float)
          0.g = majCol[0].g << 8 | minCol[0].g  (0 to 65535 as float)
          0.r = majCol[0].b << 8 | minCol[0].b  (0 to 65535 as float)
          0.r = (majPat[0] << 12 | majW[0] << 8) | (minPat[0] << 4 | minW[0])  (0 to 65535 as float)
          1.r = minorInterval[0]  (as float)
          1.g = majorCount[0]  (int, as float)
          1.b = minorInterval[1]  (as float)
          1.a = majorCount[1]  (int, as float)
          2.r = majCol[1].r << 8 | minCol[1].r  (0 to 65535 as float)
          2.g = majCol[1].g << 8 | minCol[1].g  (0 to 65535 as float)
          2.r = majCol[1].b << 8 | minCol[1].b  (0 to 65535 as float)
          2.r = (majPat[1] << 12 | majW[1] << 8) | (minPat[1] << 4 | minW[1])  (0 to 65535 as float)
        Then this usage pattern repeats the same way with every 2 contour definitions used taking 3 vec4 uniforms.
           (If just 1 contour def remains then it takes 2 vec4 uniforms, of which 1.5 is actually used.)
    */

    for (let index = 0, len = this.contourDisplay.groups.length; index < len && index < ContourDisplay.maxContourGroups; ++index) {
      const contourDef = this.contourDisplay.groups[index].contourDef;
      const even = (index & 1) === 0;
      const colorDefsNdx = (even ? index * 1.5 : (index - 1) * 1.5 + 2) * 4;
      this.packColor (colorDefsNdx, contourDef.majorStyle.color, contourDef.minorStyle.color);
      this.packPatWidth (colorDefsNdx, LineCode.valueFromLinePixels(contourDef.majorStyle.pattern), LineCode.valueFromLinePixels(contourDef.minorStyle.pattern), contourDef.majorStyle.pixelWidth, contourDef.minorStyle.pixelWidth, contourDef.showGeometry);
      const intervalsPairNdx = (Math.floor(index * 0.5) * 3 + 1) * 4;
      this.packIntervals (intervalsPairNdx, even, contourDef.minorInterval, contourDef.majorIntervalCount);
    }
  }

  public bindcontourDefs(uniform: UniformHandle): void {
    if (!sync(this, uniform))
      uniform.setUniform4fv(this._contourDefs);
  }
}
