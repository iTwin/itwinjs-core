/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { AmbientOcclusion, ColorDef, DisplayStyleSettings, SolarShadowSettings, ViewFlags } from "@itwin/core-common";
import { ScenePresentation2d, ScenePresentation3d } from "../ViewportScene";
import { DisplayStyle2dState, DisplayStyle3dState, DisplayStyleState } from "../../DisplayStyleState";
import { ViewState } from "../../ViewState";

export abstract class ScenePresentationImpl {
  protected abstract get style(): DisplayStyleState;

  protected constructor() { }

  get viewFlags() { return this.style.viewFlags; }
  set viewFlags(flags: ViewFlags) { this.style.viewFlags = flags; }

  get backgroundColor() { return this.style.backgroundColor; }
  set backgroundColor(color: ColorDef) { this.style.backgroundColor = color; }
}

export class ScenePresentation2dImpl extends ScenePresentationImpl implements ScenePresentation2d {
  readonly is2d: true = true;

  protected override get style(): DisplayStyle2dState { return this._style; }
  
  constructor(private readonly _style: DisplayStyle2dState) {
    super();
  }
}

export class ScenePresentation3dImpl extends ScenePresentationImpl implements ScenePresentation3d {
  readonly is3d: true = true;

  protected override get style(): DisplayStyle3dState { return this._style; }
  
  constructor(private readonly _style: DisplayStyle3dState) {
    super();
  }

  get ambientOcclusion() { return this._style.settings.ambientOcclusionSettings; }
  set ambientOcclusion(settings: AmbientOcclusion.Settings) { this._style.settings.ambientOcclusionSettings = settings; }

  get solarShadows() { return this._style.solarShadows; }
  set solarShadows(shadows: SolarShadowSettings) { this._style.solarShadows = shadows; }
}
