/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { _implementationProhibited } from "../../common/internal/Symbols";
import { SceneContent } from "../../scene/SceneContent";
import { IModelSceneObject, SceneObject } from "../../scene/SceneObject";
import { ViewState } from "../../ViewState";
import { iModelSceneObjectFromView } from "./SceneObjectImpl";

class SceneContentImpl implements SceneContent {
  readonly [_implementationProhibited]: unknown;

  public readonly root: IModelSceneObject;

  public constructor(root: IModelSceneObject) {
    this.root = root;
  }


  public * [Symbol.iterator](): Iterator<SceneObject> {
    yield this.root;
  }
}

export function sceneContentFromView(view: ViewState): SceneContent {
  const root = iModelSceneObjectFromView(view);
  return new SceneContentImpl(root);
}
