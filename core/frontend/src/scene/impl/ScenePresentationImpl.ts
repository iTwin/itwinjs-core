/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { AmbientOcclusion, ColorDef, DisplayStyleSettings, SolarShadowSettings, ViewFlags } from "@itwin/core-common";
import { ScenePresentation2d, ScenePresentation3d } from "../ScenePresentation";
import { DisplayStyle2dState, DisplayStyle3dState, DisplayStyleState } from "../../DisplayStyleState";
import { ViewState, ViewState2d, ViewState3d } from "../../ViewState";
import { SceneObject } from "../SceneObject";
import { SceneObjectImpl } from "./SceneObjectImpl";
import { ViewportScene } from "../ViewportScene";
import { DecorateContext, SceneContext } from "../../ViewContext";
import { GuidString } from "@itwin/core-bentley";

export abstract class BaseScenePresentationImpl {
  protected _style: DisplayStyleState;

  protected constructor(view: ViewState) {
    this._style = view.displayStyle;

    // ###TODO raise events when this happens. At minimum, need viewport.invalidateController.
    // But eg UI widgets that want to know when viewFlags or backgroundColor change probably want those discrete events, or
    // at least an event telling them any of them may have changed.
    view.onDisplayStyleChanged.addListener((style) => this._style = style);
  }

  get viewFlags() { return this._style.viewFlags; }
  set viewFlags(flags: ViewFlags) { this._style.viewFlags = flags; }

  get backgroundColor() { return this._style.backgroundColor; }
  set backgroundColor(color: ColorDef) { this._style.backgroundColor = color; }
}

export class ScenePresentation2dImpl extends BaseScenePresentationImpl implements ScenePresentation2d {
  readonly is2d: true = true;

  constructor(view: ViewState2d) {
    super(view);
  }
}

export class ScenePresentation3dImpl extends BaseScenePresentationImpl implements ScenePresentation3d {
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

export type ScenePresentationImpl = ScenePresentation2dImpl | ScenePresentation3dImpl;

export class PresentationSceneObjectImpl<T extends ScenePresentationImpl, Scene extends ViewportScene> extends SceneObjectImpl<Scene> {
  public readonly presentation: T;

  constructor(presentation: T, guid: GuidString, scene: Scene) {
    super(guid, scene);
    this.presentation = presentation;
  }

  override draw(_context: SceneContext) {
    // ###TODO
  }

  override decorate(_context: DecorateContext) {
    // ###TODO
  }

  override get isLoadingComplete() {
    return true; // ###TODO
  }
}
