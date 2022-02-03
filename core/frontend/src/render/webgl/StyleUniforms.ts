/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { ColorDef, WhiteOnWhiteReversalSettings } from "@itwin/core-common";
import type { RenderPlan } from "../RenderPlan";
import { ColorInfo } from "./ColorInfo";
import { FloatRgb, FloatRgba } from "./FloatRGBA";
import type { UniformHandle } from "./UniformHandle";
import { desync, sync } from "./Sync";

/** Maintains state of uniforms associated with the DisplayStyleState.
 * @internal
 */
export class StyleUniforms {
  private _bgColor = ColorDef.white;
  private readonly _bgRgba = FloatRgba.fromColorDef(this._bgColor);
  private readonly _bgRgb = FloatRgb.fromColorDef(this._bgColor);
  private _monoColor = ColorDef.white;
  private readonly _monoRgb = FloatRgb.fromColorDef(this._monoColor);
  private _wantWoWReversal = true;
  private _wowReversalSettings = WhiteOnWhiteReversalSettings.fromJSON();
  private _bgIntensity = 0;

  public syncKey = 0;

  public update(plan: RenderPlan): void {
    if (this._bgColor.equals(plan.bgColor) && this._monoColor.equals(plan.monoColor) && this._wowReversalSettings.equals(plan.whiteOnWhiteReversal))
      return;

    desync(this);

    this._monoColor = plan.monoColor;
    this._monoRgb.setColorDef(plan.monoColor);
    this._wowReversalSettings = plan.whiteOnWhiteReversal;

    this.updateBackgroundColor(plan.bgColor);
  }

  private updateBackgroundColor(bgColor: ColorDef): void {
    this._bgColor = bgColor;
    this._bgRgba.setColorDef(bgColor);
    this._bgRgb.setColorDef(bgColor);
    this._wantWoWReversal = this._wowReversalSettings.ignoreBackgroundColor || this._bgRgb.isWhite;
    this._bgIntensity = this._bgRgb.red * 0.3 + this._bgRgb.green * 0.59 + this._bgRgb.blue * 0.11;
  }

  public changeBackgroundColor(bgColor: ColorDef): void {
    if (bgColor.equals(this._bgColor))
      return;

    desync(this);
    this.updateBackgroundColor(bgColor);
  }

  // vec4
  public bindBackgroundRgba(uniform: UniformHandle): void {
    if (!sync(this, uniform))
      this._bgRgba.bind(uniform);
  }

  //  vec3
  public bindBackgroundRgb(uniform: UniformHandle): void {
    if (!sync(this, uniform))
      this._bgRgb.bind(uniform);
  }

  // vec3
  public bindMonochromeRgb(uniform: UniformHandle): void {
    if (!sync(this, uniform))
      this._monoRgb.bind(uniform);
  }

  public get backgroundIntensity(): number {
    return this._bgIntensity;
  }

  public get backgroundTbgr(): number {
    return this._bgColor.tbgr;
  }

  public get backgroundHexString(): string {
    return this._bgColor.toHexString();
  }

  public get backgroundAlpha(): number {
    return this._bgRgba.alpha;
  }

  public get backgroundColor() {
    return this._bgColor;
  }

  public cloneBackgroundRgba(result: FloatRgba): void {
    this._bgRgba.clone(result);
  }

  public get wantWoWReversal(): boolean {
    return this._wantWoWReversal;
  }

  public get backgroundColorInfo(): ColorInfo {
    return ColorInfo.createUniform(this._bgRgba);
  }
}
