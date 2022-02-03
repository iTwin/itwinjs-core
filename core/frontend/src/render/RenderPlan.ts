/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import type { ClipVector} from "@itwin/core-geometry";
import { Point3d, Vector3d } from "@itwin/core-geometry";
import type {
  AmbientOcclusion, AnalysisStyle, HiddenLine, LightSettings, RenderTexture,
  ThematicDisplay} from "@itwin/core-common";
import { ClipStyle, ColorDef, Frustum, GlobeMode, Hilite, MonochromeMode, Npc, ViewFlags, WhiteOnWhiteReversalSettings,
} from "@itwin/core-common";
import { FlashSettings } from "../FlashSettings";
import type { Viewport } from "../Viewport";

const scratchPoint3a = new Point3d();
const scratchPoint3b = new Point3d();
const scratchPoint3c = new Point3d();

/** A RenderPlan holds a Frustum and the render settings for displaying a RenderScene into a RenderTarget.
 * @internal
 */
export interface RenderPlan {
  readonly is3d: boolean;
  readonly viewFlags: ViewFlags;
  readonly bgColor: ColorDef;
  readonly monoColor: ColorDef;
  readonly monochromeMode: MonochromeMode;
  readonly hiliteSettings: Hilite.Settings;
  readonly emphasisSettings: Hilite.Settings;
  readonly flashSettings: FlashSettings;
  readonly clip?: ClipVector;
  readonly clipStyle: ClipStyle;
  readonly hline?: HiddenLine.Settings;
  readonly analysisStyle?: AnalysisStyle;
  readonly ao?: AmbientOcclusion.Settings;
  readonly thematic?: ThematicDisplay;
  readonly isFadeOutActive: boolean;
  readonly analysisTexture?: RenderTexture;
  readonly frustum: Frustum;
  readonly fraction: number;
  readonly globalViewTransition: number;
  readonly isGlobeMode3D: boolean;
  readonly backgroundMapOn: boolean;
  readonly upVector: Vector3d;
  readonly lights?: LightSettings;
  readonly whiteOnWhiteReversal: WhiteOnWhiteReversalSettings;
}

/** @internal */
export function createEmptyRenderPlan(): RenderPlan {
  return {
    is3d: true,
    viewFlags: new ViewFlags(),
    bgColor: ColorDef.white,
    monoColor: ColorDef.white,
    monochromeMode: MonochromeMode.Scaled,
    hiliteSettings: new Hilite.Settings(),
    emphasisSettings: new Hilite.Settings(),
    flashSettings: new FlashSettings(),
    clipStyle: ClipStyle.defaults,
    frustum: new Frustum(),
    fraction: 0,
    isFadeOutActive: false,
    globalViewTransition: 0,
    isGlobeMode3D: false,
    backgroundMapOn: false,
    upVector: Vector3d.unitZ(),
    whiteOnWhiteReversal: WhiteOnWhiteReversalSettings.fromJSON(),
  };
}

/** @internal */
export function createRenderPlanFromViewport(vp: Viewport): RenderPlan {
  const view = vp.view;
  const style = view.displayStyle;

  const is3d = view.is3d();

  const globalViewTransition = view.is3d() ? view.globalViewTransition() : 0.0;
  const backgroundMapOn = view.displayStyle.viewFlags.backgroundMap;
  const frustum = vp.viewingSpace.getFrustum();
  const fraction = vp.viewingSpace.frustFraction;
  const viewFlags = style.viewFlags;

  const bgColor = view.backgroundColor;
  const monoColor = style.monochromeColor;
  const monochromeMode = style.settings.monochromeMode;

  const hiliteSettings = vp.hilite;
  const emphasisSettings = vp.emphasisSettings;
  const flashSettings = vp.flashSettings;
  const lights = vp.lightSettings;

  const isFadeOutActive = vp.isFadeOutActive;
  const clip = view.getViewClip();
  const clipStyle = view.displayStyle.settings.clipStyle;
  const hline = style.is3d() ? style.settings.hiddenLineSettings : undefined;
  const ao = style.is3d() ? style.settings.ambientOcclusionSettings : undefined;
  const analysisStyle = style.settings.analysisStyle;
  const thematic = (style.is3d() && view.displayStyle.viewFlags.thematicDisplay) ? style.settings.thematic : undefined;

  let upVector;
  const isGlobeMode3D = (GlobeMode.Ellipsoid === view.globeMode);
  if (isGlobeMode3D) {
    const lb = frustum.getCorner(Npc.LeftBottomRear).interpolate(0.5, frustum.getCorner(Npc.LeftBottomFront), scratchPoint3a);
    const rt = frustum.getCorner(Npc.RightTopRear).interpolate(0.5, frustum.getCorner(Npc.RightTopFront), scratchPoint3b);
    const cntr = lb.interpolate(0.5, rt, scratchPoint3c);
    upVector = view.getUpVector(cntr);
  } else {
    upVector = Vector3d.unitZ();
  }

  let analysisTexture;
  if (analysisStyle?.thematic)
    analysisTexture = vp.target.renderSystem.getGradientTexture(analysisStyle.thematic.gradient, vp.iModel);

  return {
    is3d,
    viewFlags,
    bgColor,
    monoColor,
    monochromeMode,
    hiliteSettings,
    emphasisSettings,
    flashSettings,
    clip,
    clipStyle,
    hline,
    analysisStyle,
    ao,
    thematic,
    isFadeOutActive,
    analysisTexture,
    frustum,
    fraction,
    globalViewTransition,
    isGlobeMode3D,
    backgroundMapOn,
    upVector,
    lights,
    whiteOnWhiteReversal: vp.displayStyle.settings.whiteOnWhiteReversal,
  };
}
