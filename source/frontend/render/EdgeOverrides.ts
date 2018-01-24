/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { LinePixels, HiddenLine } from "../../common/Render";
import { FloatPreMulRgba } from "./FloatRGBA";
import { OvrFlags } from "./RenderFlags";

// Describes one of the pre-defined line patterns.
// See Render::LinePixels.
export class LineCode {
  public value: number;
  public static count: number = 10;
  constructor(pixels: LinePixels = LinePixels.Solid) {
    this.value = LineCode.valueFromLinePixels(pixels);
  }
  public static valueFromLinePixels(pixels: LinePixels): number {
    switch (pixels) {
        case LinePixels.Code0: return 0;
        case LinePixels.Code1: return 1;
        case LinePixels.Code2: return 2;
        case LinePixels.Code3: return 3;
        case LinePixels.Code4: return 4;
        case LinePixels.Code5: return 5;
        case LinePixels.Code6: return 6;
        case LinePixels.Code7: return 7;
        case LinePixels.HiddenLine: return 8;
        case LinePixels.Invisible: return 9;
        default: return 0;
    }
  }
}

export class EdgeOverrides {
  public color: FloatPreMulRgba;
  public lineCode: LineCode;
  public weight: number;
  public flags: OvrFlags = OvrFlags.None;
  public anyOverridden(): boolean { return OvrFlags.None !== this.flags; }
  public isOverridden(flags: OvrFlags): boolean { return flags === this.flags; }
  public init(style: HiddenLine.Style, forceOpaque: boolean): void {
    this.flags = OvrFlags.None;
    if (style.ovrColor) {
      this.flags = OvrFlags.Rgba;
      this.color.initFromColorDef(style.color);
    }
    if (style.width !== 0) {
      this.flags = OvrFlags.Weight;
      this.weight = style.width;
    }
    if (style.pattern !== LinePixels.Invalid) {
      this.flags = OvrFlags.LineCode;
      this.lineCode = new LineCode(style.pattern);
    }
    if (forceOpaque)
        this.flags = OvrFlags.Alpha;
  }
}
