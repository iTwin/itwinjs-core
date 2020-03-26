/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { Id64String } from "@bentley/bentleyjs-core";
import { Vector3d, Point3d } from "@bentley/geometry-core";
import {
  AmbientOcclusion,
  AnalysisStyle,
  ColorDef,
  Frustum,
  GlobeMode,
  Gradient,
  HiddenLine,
  Hilite,
  Npc,
  RenderTexture,
  ViewFlags,
} from "@bentley/imodeljs-common";
import { Viewport } from "../Viewport";
import { ViewState3d } from "../ViewState";
import { ViewClipSettings, createViewClipSettings } from "./ViewClipSettings";

const scratchPoint3a = new Point3d();
const scratchPoint3b = new Point3d();
const scratchPoint3c = new Point3d();

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
  public readonly activeClipSettings?: ViewClipSettings;
  public readonly hline?: HiddenLine.Settings;
  public readonly analysisStyle?: AnalysisStyle;
  public readonly ao?: AmbientOcclusion.Settings;
  public readonly isFadeOutActive: boolean;
  public readonly analysisTexture?: RenderTexture;
  public readonly classificationTextures?: Map<Id64String, RenderTexture>;
  public readonly frustum: Frustum;
  public readonly fraction: number;
  public readonly terrainTransparency: number;
  public readonly globalViewTransition: number;
  public readonly isGlobeMode3D: boolean;
  public readonly backgroundMapOn: boolean;
  public readonly upVector: Vector3d;

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
      this.terrainTransparency = this.is3d ? (view as ViewState3d).getDisplayStyle3d().backgroundMapSettings.transparency || 0.0 : 0.0;
      this.globalViewTransition = this.is3d ? (view as ViewState3d).globalViewTransition() : 0.0;
      this.backgroundMapOn = view.displayStyle.viewFlags.backgroundMap;
      this.frustum = vp.viewingSpace.getFrustum();
      this.fraction = vp.viewingSpace.frustFraction;
      this.viewFlags = style.viewFlags;
      this.bgColor = view.backgroundColor;
      this.monoColor = style.monochromeColor;
      this.hiliteSettings = vp.hilite;
      this.emphasisSettings = vp.emphasisSettings;
      this.isFadeOutActive = vp.isFadeOutActive;
      this.activeClipSettings = createViewClipSettings(view.getViewClip(), vp.outsideClipColor, vp.insideClipColor);
      this.hline = style.is3d() ? style.settings.hiddenLineSettings : undefined;
      this.ao = style.is3d() ? style.settings.ambientOcclusionSettings : undefined;
      this.analysisStyle = style.settings.analysisStyle;
      this.isGlobeMode3D = (GlobeMode.Ellipsoid === view.globeMode);
      if (this.isGlobeMode3D) {
        const lb = this.frustum.getCorner(Npc.LeftBottomRear).interpolate(0.5, this.frustum.getCorner(Npc.LeftBottomFront), scratchPoint3a);
        const rt = this.frustum.getCorner(Npc.RightTopRear).interpolate(0.5, this.frustum.getCorner(Npc.RightTopFront), scratchPoint3b);
        const cntr = lb.interpolate(0.5, rt, scratchPoint3c);
        this.upVector = view.getUpVector(cntr);
      } else
        this.upVector = Vector3d.unitZ();

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
      this.terrainTransparency = 1.0;
      this.globalViewTransition = 0.0;
      this.isGlobeMode3D = false;
      this.backgroundMapOn = false;
      this.upVector = Vector3d.unitZ();
    }
  }
}
