/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import {
  AmbientOcclusion, AnalysisStyle, Atmosphere, ClipStyle, ColorDef, ContourDisplay, Frustum, GlobeMode, HiddenLine, Hilite, LightSettings, MonochromeMode, Npc,
  RenderTexture, ThematicDisplay, ViewFlags, WhiteOnWhiteReversalSettings,
} from "@itwin/core-common";
import { ClipVector, Constant, Matrix3d, Point3d, Vector3d } from "@itwin/core-geometry";
import { FlashSettings } from "../FlashSettings";
import { Viewport } from "../Viewport";
import { ViewState3d } from "../ViewState";

const scratchPoint3a = new Point3d();
const scratchPoint3b = new Point3d();
const scratchPoint3c = new Point3d();

/**
 * @internal
 */
export class RenderPlanEllipsoid {
  public readonly ellipsoidCenter: Point3d;
  public readonly ellipsoidRotation: Matrix3d;
  public readonly ellipsoidRadii: Point3d;

  constructor(ellipsoidCenter: Point3d, ellipsoidRotation: Matrix3d, ellipsoidRadii: Point3d) {
    this.ellipsoidCenter = ellipsoidCenter;
    this.ellipsoidRotation = ellipsoidRotation;
    this.ellipsoidRadii = ellipsoidRadii;
  }

  public equals(other: RenderPlanEllipsoid): boolean {
    if (this.ellipsoidCenter.isAlmostEqual(other.ellipsoidCenter))
      return false;
    if (this.ellipsoidRotation.isAlmostEqual(other.ellipsoidRotation))
      return false;
    if (this.ellipsoidRadii.isAlmostEqual(other.ellipsoidRadii))
      return false;
    return true;
  }
}

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
  readonly contours?: ContourDisplay;
  readonly atmosphere?: Atmosphere.Settings;
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
  readonly ellipsoid?: RenderPlanEllipsoid;
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
  const isGlobeMode3D = GlobeMode.Ellipsoid === view.globeMode;
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
  const contours = (style.is3d() && style.settings.contours.groups.length > 0) ? style.settings.contours : undefined;
  const shouldDisplayAtmosphere = (style.is3d() && GlobeMode.Ellipsoid === view.globeMode && vp.iModel.isGeoLocated && style.viewFlags.backgroundMap) ? (vp.view as ViewState3d).getDisplayStyle3d().environment.displayAtmosphere : false;
  const atmosphere = shouldDisplayAtmosphere ? (vp.view as ViewState3d).getDisplayStyle3d().environment.atmosphere : undefined;

  let upVector;
  if (GlobeMode.Ellipsoid === view.globeMode) {
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

  let ellipsoid: RenderPlanEllipsoid | undefined;
  if (GlobeMode.Ellipsoid === view.globeMode) {
    const mapEcefToDb = view.iModel.getMapEcefToDb(0);
    ellipsoid = new RenderPlanEllipsoid(
      Point3d.fromJSON(mapEcefToDb.origin),
      mapEcefToDb.matrix,
      Point3d.fromJSON({ x: Constant.earthRadiusWGS84.equator, y: Constant.earthRadiusWGS84.equator, z: Constant.earthRadiusWGS84.polar }),
    );
  }

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
    contours,
    atmosphere,
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
    ellipsoid,
  };
}
