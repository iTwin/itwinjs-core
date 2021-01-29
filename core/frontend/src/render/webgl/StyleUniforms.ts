/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { ColorDef } from "@bentley/imodeljs-common";
import { RenderPlan } from "../RenderPlan";
import { ColorInfo } from "./ColorInfo";
import { FloatRgb, FloatRgba } from "./FloatRGBA";
import { UniformHandle } from "./UniformHandle";
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
  private _isWhiteBackground = true;

  public syncKey = 0;

  public update(plan: RenderPlan): void {
    if (this._bgColor.equals(plan.bgColor) && this._monoColor.equals(plan.monoColor))
      return;

    desync(this);

    this._monoColor = plan.monoColor;
    this._monoRgb.setColorDef(plan.monoColor);

    this.updateBackgroundColor(plan.bgColor, true);
  }

  private updateBackgroundColor(bgColor: ColorDef, blackIfTransparent: boolean): void {
    this._bgColor = bgColor;
    this._bgRgba.setColorDef(bgColor);

    // When rendering 3d view attachments, we set alpha to 0 to allow us to discard background pixels.
    // When rendering planar classifiers or texture drapes, we set background color to fully-transparent black - a 0 in alpha channel indicates unclassified regions.
    this._bgRgb.setColorDef((blackIfTransparent && this._bgRgba.alpha === 0) ? ColorDef.black : bgColor);
    this._isWhiteBackground = this._bgRgb.isWhite;
  }

  public changeBackgroundColor(bgColor: ColorDef): void {
    if (bgColor.equals(this._bgColor))
      return;

    desync(this);
    this.updateBackgroundColor(bgColor, false);
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

  public get isWhiteBackground(): boolean {
    return this._isWhiteBackground;
  }

  public get backgroundColorInfo(): ColorInfo {
    return ColorInfo.createUniform(this._bgRgba);
  }
}
