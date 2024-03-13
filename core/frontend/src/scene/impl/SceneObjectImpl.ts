/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { GuidString } from "@itwin/core-bentley";
import { DecorateContext, SceneContext } from "../../ViewContext";
import { SceneObject } from "../SceneObject";
import { ViewportScene } from "../ViewportScene";
import { HitDetail } from "../../HitDetail";

export abstract class SceneObjectImpl<Scene extends ViewportScene> implements SceneObject {
  readonly guid: GuidString;
  readonly scene: Scene;
  isDisplayed = true;

  constructor(guid: GuidString, scene: Scene) {
    this.guid = guid;
    this.scene = scene;
  }

  abstract get isLoadingComplete(): boolean;

  decorate(_context: DecorateContext): void { }

  abstract draw(context: SceneContext): void;

  getToolTip(_hit: HitDetail): Promise<HTMLElement | string | undefined> { return Promise.resolve(undefined); }
}
