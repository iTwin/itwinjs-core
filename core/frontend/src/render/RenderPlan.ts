/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { Id64String } from "@bentley/bentleyjs-core";
import { ClipVector } from "@bentley/geometry-core";
import {
  AmbientOcclusion,
  AnalysisStyle,
  ColorDef,
  Frustum,
  Gradient,
  HiddenLine,
  Hilite,
  RenderTexture,
  ViewFlags,
} from "@bentley/imodeljs-common";
import { Viewport } from "../Viewport";

/** A RenderPlan holds a Frustum and the render settings for displaying a RenderScene into a RenderTarget.
 * @internal
 */
export class RenderPlan {
  public readonly is3d: boolean;
  public readonly viewFlags: ViewFlags;
  public readonly bgColor: ColorDef;
  public readonly monoColor: ColorDef;
  public readonly hiliteSettings: Hilite.Settings;
  public readonly emphasisSettings: Hilite.Settings;
  public readonly activeVolume?: ClipVector;
  public readonly hline?: HiddenLine.Settings;
  public readonly analysisStyle?: AnalysisStyle;
  public readonly ao?: AmbientOcclusion.Settings;
  public readonly isFadeOutActive: boolean;
  public readonly analysisTexture?: RenderTexture;
  public readonly classificationTextures?: Map<Id64String, RenderTexture>;
  public readonly frustum: Frustum;
  public readonly fraction: number;

  public static createFromViewport(vp: Viewport): RenderPlan {
    return new RenderPlan(vp);
  }

  public static createEmpty(): RenderPlan {
    return new RenderPlan();
  }

  private constructor(vp?: Viewport) {
    if (undefined !== vp) {
      const view = vp.view;
      const style = view.displayStyle;

      this.is3d = view.is3d();
      this.frustum = vp.viewingSpace.getFrustum();
      this.fraction = vp.viewingSpace.frustFraction;
      this.viewFlags = style.viewFlags;
      this.bgColor = view.backgroundColor;
      this.monoColor = style.monochromeColor;
      this.hiliteSettings = vp.hilite;
      this.emphasisSettings = vp.emphasisSettings;
      this.isFadeOutActive = vp.isFadeOutActive;
      this.activeVolume = view.getViewClip();
      this.hline = style.is3d() ? style.settings.hiddenLineSettings : undefined;
      this.ao = style.is3d() ? style.settings.ambientOcclusionSettings : undefined;
      this.analysisStyle = style.analysisStyle;

      if (undefined !== this.analysisStyle && undefined !== this.analysisStyle.scalarThematicSettings)
        this.analysisTexture = vp.target.renderSystem.getGradientTexture(Gradient.Symb.createThematic(this.analysisStyle.scalarThematicSettings), vp.iModel);
    } else {
      this.is3d = true;
      this.viewFlags = new ViewFlags();
      this.bgColor = ColorDef.white.clone();
      this.monoColor = ColorDef.white.clone();
      this.hiliteSettings = new Hilite.Settings();
      this.emphasisSettings = new Hilite.Settings();
      this.frustum = new Frustum();
      this.fraction = 0;
      this.isFadeOutActive = false;
    }
  }
}
