/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { ClipVector } from "@bentley/geometry-core";
import { AntiAliasPref, SceneLights, ViewFlags, Frustum, Hilite, HiddenLine, ColorDef } from "@bentley/imodeljs-common";
import { Viewport } from "../Viewport";

/**
 * A Render::Plan holds a Frustum and the render settings for displaying a Render::Scene into a Render::Target.
 */
export class Plan {
  constructor(public is3d: boolean,
              public viewFlags: ViewFlags,
              public frustum: Frustum,
              public fraction: number,
              public bgColor: ColorDef,
              public monoColor: ColorDef,
              public hiliteSettings: Hilite.Settings,
              public aaLines: AntiAliasPref,
              public aaText: AntiAliasPref,
              public activeVolume: ClipVector,
              public hline?: HiddenLine.Params,
              public lights?: SceneLights,
              ) {}
  public static fromViewport(vp: Viewport): Plan {
    const view = vp.view;
    const style = view.displayStyle;
    return new Plan(view.is3d(),
                    style.viewFlags,
                    vp.getFrustum()!,
                    vp.frustFraction,
                    view.backgroundColor,
                    style.getMonochromeColor(),
                    vp.hilite,
                    vp.wantAntiAliasLines,
                    vp.wantAntiAliasText,
                    view.getViewClip(),
                    style.is3d() ? style.getHiddenLineParams() : undefined,
                    undefined); // view.is3d() ? view.getLights() : undefined
  }
}
