/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Viewport } from "../../Viewport";
import { SpatialScene, ViewportScene } from "../ViewportScene";
import { ScenePresentation3dImpl } from "./ScenePresentationImpl";
import { SceneVolume3dImpl } from "./SceneVolumeImpl";

export class SpatialSceneImpl implements SpatialScene {
  readonly isSpatial = true;
  readonly volume: SceneVolume3dImpl;
  readonly presentation: ScenePresentation3dImpl;

  readonly realityModels = []; // ###TODO
  readonly iModels = []; // ###TODO
  readonly tiledGraphicsProviders = []; // ###TODO

  constructor(viewport: Viewport) {
    const view = viewport.view;
    if (!view.isSpatialView())
      throw new Error("SpatialScene can only be constructed from a SpatialViewState");
    
    this.volume = new SceneVolume3dImpl(view);
    this.presentation = new ScenePresentation3dImpl(view);
  }
}

export function createViewportScene(viewport: Viewport): ViewportScene {
  if (viewport.view.isSpatialView())
    return new SpatialSceneImpl(viewport);

  throw new Error("###TODO non-spatial scenes");
}
