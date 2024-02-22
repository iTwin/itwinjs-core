/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { AmbientOcclusion, ColorDef, DisplayStyleSettings, SolarShadowSettings, ViewFlags } from "@itwin/core-common";
import { ScenePresentation2d, ScenePresentation3d } from "../ViewportScene";
import { DisplayStyle2dState, DisplayStyle3dState, DisplayStyleState } from "../../DisplayStyleState";
import { ViewState, ViewState2d, ViewState3d } from "../../ViewState";

export abstract class ScenePresentationImpl {
  protected _style: DisplayStyleState;

  protected constructor(view: ViewState) {
    this._style = view.displayStyle;

    view.onDisplayStyleChanged.addListener((style) => this._style = style);
  }

  get viewFlags() { return this._style.viewFlags; }
  set viewFlags(flags: ViewFlags) { this._style.viewFlags = flags; }

  get backgroundColor() { return this._style.backgroundColor; }
  set backgroundColor(color: ColorDef) { this._style.backgroundColor = color; }
}

export class ScenePresentation2dImpl extends ScenePresentationImpl implements ScenePresentation2d {
  readonly is2d: true = true;

  constructor(view: ViewState2d) {
    super(view);
  }
}

export class ScenePresentation3dImpl extends ScenePresentationImpl implements ScenePresentation3d {
  readonly is3d: true = true;

  constructor(view: ViewState3d) {
    super(view);
  }

  private get _style3d() { return this._style as DisplayStyle3dState; }
  
  get ambientOcclusion() { return this._style3d.settings.ambientOcclusionSettings; }
  set ambientOcclusion(settings: AmbientOcclusion.Settings) { this._style3d.settings.ambientOcclusionSettings = settings; }

  get solarShadows() { return this._style3d.solarShadows; }
  set solarShadows(shadows: SolarShadowSettings) { this._style3d.solarShadows = shadows; }
}
