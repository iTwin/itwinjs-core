/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { LinePixels, HiddenLine } from "@bentley/imodeljs-common";
import { FloatPreMulRgba } from "./FloatRGBA";
import { OvrFlags } from "./RenderFlags";

// Describes one of the pre-defined line patterns.
// See Render.LinePixels.
export namespace LineCode {
  export function valueFromLinePixels(pixels: LinePixels): number {
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

  export const solid = 0;
}

export class EdgeOverrides {
  public readonly color = new FloatPreMulRgba();
  public lineCode = 0;
  public weight = 0;
  public flags: OvrFlags = OvrFlags.None;
  public anyOverridden(): boolean { return this.flags !== OvrFlags.None; }
  public isOverridden(flags: OvrFlags): boolean { return (flags & this.flags) === flags; }
  public init(style: HiddenLine.Style, forceOpaque: boolean): void {
    this.flags &= OvrFlags.None;
    this.weight = style.width;
    if (style.ovrColor) {
      this.flags |= OvrFlags.Rgba;
      this.color.initFromColorDef(style.color);
    }
    if (style.width !== 0) {
      this.flags |= OvrFlags.Weight;
    }
    if (style.pattern !== LinePixels.Invalid) {
      this.flags |= OvrFlags.LineCode;
      this.lineCode = LineCode.valueFromLinePixels(style.pattern);
    } else {
      this.lineCode = 0;
    }
    if (forceOpaque)
      this.flags |= OvrFlags.Alpha;
  }
}
