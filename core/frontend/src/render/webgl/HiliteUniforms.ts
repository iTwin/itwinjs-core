/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { Hilite } from "@bentley/imodeljs-common";
import { FloatRgb } from "./FloatRGBA";
import { UniformHandle } from "./UniformHandle";
import { Matrix3 } from "./Matrix";
import { desync, sync } from "./Sync";

/** Maintains state for uniforms related to hilite and emphasis.
 * @internal
 */
export class HiliteUniforms {
  private readonly _compositeSettings = new Matrix3();
  private readonly _compositeWidths = new Float32Array(2);
  private readonly _featureSettings = new Matrix3();

  private _hiliteSettings = new Hilite.Settings();
  private _emphasisSettings = new Hilite.Settings();
  private readonly _hiliteRgb = FloatRgb.fromColorDef(this.hiliteSettings.color);

  public syncKey = 0;

  public get hiliteSettings() { return this._hiliteSettings; }
  public get emphasisSettings() { return this._emphasisSettings; }
  public get hiliteColor() { return this._hiliteRgb; }

  public update(hilite: Hilite.Settings, emphasis: Hilite.Settings): void {
    if (Hilite.equalSettings(hilite, this._hiliteSettings) && Hilite.equalSettings(emphasis, this._emphasisSettings))
      return;

    desync(this);

    this._hiliteSettings = Hilite.cloneSettings(hilite);
    this._emphasisSettings = Hilite.cloneSettings(emphasis);

    const c = this._compositeSettings;
    const f = this._featureSettings;

    const rgb = this._hiliteRgb;
    rgb.setColorDef(emphasis.color);
    c.data[3] = f.data[3] = rgb.red;
    c.data[4] = f.data[4] = rgb.green;
    c.data[5] = f.data[5] = rgb.blue;

    // NB: Must set to hilite color last - is exposed through getter.
    rgb.setColorDef(hilite.color);
    c.data[0] = f.data[0] = rgb.red;
    c.data[1] = f.data[1] = rgb.green;
    c.data[2] = f.data[2] = rgb.blue;

    c.data[6] = hilite.hiddenRatio;
    c.data[7] = emphasis.hiddenRatio;

    f.data[6] = hilite.visibleRatio;
    f.data[7] = emphasis.visibleRatio;

    this._compositeWidths[0] = hilite.silhouette;
    this._compositeWidths[1] = emphasis.silhouette;
  }

  // mat3:
  // hilite.red     hilite.green hilite.blue
  // emph.red       emph.green   emph.blue
  // hilite.hidden  emph.hidden unused
  public bindCompositeSettings(uniform: UniformHandle): void {
    if (!sync(this, uniform))
      uniform.setMatrix3(this._compositeSettings);
  }

  // vec2:
  // hilite.silhouette emph.silhouette
  public bindCompositeWidths(uniform: UniformHandle): void {
    if (!sync(this, uniform))
      uniform.setUniform2fv(this._compositeWidths);
  }

  // mat3:
  // hilite.red     hilite.green hilite.blue
  // emph.red       emph.green   emph.blue
  // hilite.visible emph.visible unused
  public bindFeatureSettings(uniform: UniformHandle): void {
    if (!sync(this, uniform))
      uniform.setMatrix3(this._featureSettings);
  }
}
