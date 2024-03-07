/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ViewState } from "../../ViewState";
import { Viewport } from "../../Viewport";
import { SpatialScene, ViewportScene } from "../ViewportScene";
import { ScenePresentation3dImpl, ScenePresentationImpl } from "./ScenePresentationImpl";
import { SceneVolume3dImpl, SceneVolumeImpl } from "./SceneVolumeImpl";

/*
export abstract class ViewportSceneImpl {
  private readonly _view: ViewState;
  readonly viewport: Viewport;

  get view(): ViewState { return this._view; }

  abstract get presentation(): ScenePresentationImpl;
  abstract get volume(): SceneVolumeImpl;
  
  protected constructor(view: ViewState, viewport: Viewport) {
    this._view = view;
    this.viewport = viewport;
  }
}
*/

export class SpatialSceneImpl implements SpatialScene {
  readonly isSpatial = true;
  readonly volume: SceneVolume3dImpl;
  readonly presentation: ScenePresentation3dImpl;
  readonly viewport: Viewport;

  readonly realityModels = []; // ###TODO
  readonly iModels = []; // ###TODO
  readonly tiledGraphicsProviders = []; // ###TODO

  constructor(viewport: Viewport) {
    const view = viewport.view;
    if (!view.isSpatialView())
      throw new Error("SpatialScene can only be constructed from a SpatialViewState");
    
    this.viewport = viewport;
    this.volume = new SceneVolume3dImpl(view);
    this.presentation = new ScenePresentation3dImpl(view);
  }
}

export function createViewportScene(viewport: Viewport): ViewportScene {
  if (viewport.view.isSpatialView())
    return new SpatialSceneImpl(viewport);

  throw new Error("###TODO non-spatial scenes");
}
