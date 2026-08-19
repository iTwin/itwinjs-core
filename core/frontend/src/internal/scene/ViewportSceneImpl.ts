/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { _implementationProhibited } from "../../common/internal/Symbols";
import { SceneContent } from "../../scene/SceneContent";
import { ScenePresentation } from "../../scene/ScenePresentation";
import { SceneVolume } from "../../scene/SceneVolume";
import { ViewportScene } from "../../scene/ViewportScene";
import { ViewState } from "../../ViewState";
import { sceneContentFromView } from "./SceneContentImpl";

class ViewportSceneImpl implements ViewportScene {
  public readonly [_implementationProhibited] = undefined;

  public readonly content: SceneContent;
  public readonly volume: SceneVolume = { [_implementationProhibited]: undefined };
  public readonly presentation: ScenePresentation = { [_implementationProhibited]: undefined  };

  public constructor(view: ViewState) {
    this.content = sceneContentFromView(view);
  }
}

export function viewportSceneFromView(view: ViewState): ViewportScene {
  return new ViewportSceneImpl(view);
}
