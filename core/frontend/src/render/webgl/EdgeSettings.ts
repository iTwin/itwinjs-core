/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { ColorDef, HiddenLine, RenderMode, ViewFlags } from "@itwin/core-common";
import { FloatRgba } from "./FloatRGBA";
import { OvrFlags, RenderPass } from "./RenderFlags";
import { LineCode } from "./LineCode";

/** Controls symbology of edges based on ViewFlags and HiddenLine.Settings. Typically these come from the Target's
 * RenderPlan, but a GraphicBranch may override those settings.
 * @internal
 */
export class EdgeSettings {
  /** The color applies to both hidden and visible edges. */
  private readonly _color = FloatRgba.fromColorDef(ColorDef.white);
  private _colorOverridden = false;
  private _visibleLineCode?: number;
  private _visibleWeight?: number;
  private _hiddenLineCode?: number;
  private _hiddenWeight?: number;
  /** Controls how opaque a surface must be to be displayed in SolidFill or HiddenLine modes; or how opaque it must be to
   * block shadow-casting lights in SmoothShade mode.
   */
  private _transparencyThreshold = 0;

  public static create(hline: HiddenLine.Settings | undefined): EdgeSettings {
    const settings = new EdgeSettings();
    settings.init(hline);
    return settings;
  }

  public init(hline: HiddenLine.Settings | undefined): void {
    this.clear();
    if (!hline)
      return;

    // The threshold is HiddenLine.Settings is a transparency value. Convert it to an alpha value and clamp to [0..1].
    let threshold = hline.transparencyThreshold;
    threshold = Math.min(1, Math.max(0, threshold));
    this._transparencyThreshold = 1.0 - threshold;

    const vis = hline.visible;
    if (vis.color) {
      this._colorOverridden = true;
      this._color.setColorDef(vis.color);
    }

    this._visibleLineCode = (undefined !== vis.pattern ? LineCode.valueFromLinePixels(vis.pattern) : undefined);
    this._visibleWeight = vis.width;

    // Hidden edge settings default to matching visible edge settings.
    const hid = hline.hidden;
    this._hiddenLineCode = undefined !== hid.pattern ? LineCode.valueFromLinePixels(hid.pattern) : this._visibleLineCode;

    this._hiddenWeight = undefined !== hid.width ? hid.width : this._visibleWeight;
    if (undefined !== this._hiddenWeight && undefined !== this._visibleWeight) {
      // Hidden edges cannot be wider than visible edges.
      this._hiddenWeight = Math.min(this._visibleWeight, this._hiddenWeight);
    }
  }

  public computeOvrFlags(pass: RenderPass, vf: ViewFlags): OvrFlags {
    // Edge overrides never apply in wireframe mode
    if (!this.isOverridden(vf))
      return OvrFlags.None;

    // Alpha always overridden - transparent edges only supported in wireframe mode.
    let flags = this.getColor(vf) ? OvrFlags.Rgba : OvrFlags.Alpha;

    if (undefined !== this.getLineCode(pass, vf))
      flags |= OvrFlags.LineCode;

    if (undefined !== this.getWeight(pass, vf))
      flags |= OvrFlags.Weight;

    return flags;
  }

  public get transparencyThreshold(): number {
    return this._transparencyThreshold;
  }

  public getColor(vf: ViewFlags): FloatRgba | undefined {
    return this._colorOverridden && this.isOverridden(vf) ? this._color : undefined;
  }

  public getLineCode(pass: RenderPass, vf: ViewFlags): number | undefined {
    if (!this.isOverridden(vf))
      return undefined;

    return RenderPass.HiddenEdge === pass ? this._hiddenLineCode : this._visibleLineCode;
  }

  public getWeight(pass: RenderPass, vf: ViewFlags): number | undefined {
    if (!this.isOverridden(vf))
      return undefined;

    return RenderPass.HiddenEdge === pass ? this._hiddenWeight : this._visibleWeight;
  }

  private clear(): void {
    this._colorOverridden = false;
    this._visibleLineCode = this._visibleWeight = undefined;
    this._hiddenLineCode = this._hiddenWeight = undefined;
    this._transparencyThreshold = 0;
  }

  public wantContrastingColor(renderMode: RenderMode): boolean {
    return !this._colorOverridden && RenderMode.SolidFill === renderMode;
  }

  private isOverridden(vf: ViewFlags): boolean {
    switch (vf.renderMode) {
      case RenderMode.Wireframe:
        return false; // edge overrides don't apply in wireframe mode
      case RenderMode.SmoothShade:
        return vf.visibleEdges;
      default:
        return true; // Edges always displayed in solid fill and hidden line modes
    }
  }
}
