/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { _implementationProhibited } from "../../common/internal/Symbols";
import { IModelConnection } from "../../IModelConnection";
import { IModelSceneObject } from "../../scene/SceneObject";
import { DecorateContext, SceneContext } from "../../ViewContext";
import { ViewState } from "../../ViewState";

class IModelSceneObjectImpl implements IModelSceneObject {
  public readonly [_implementationProhibited] = undefined;
  public readonly kind = "iModel";

  readonly #view: ViewState;

  public constructor(view: ViewState) {
    this.#view = view;
  }

  public get iModel(): IModelConnection {
    return this.#view.iModel;
  }

  public get isLoadingComplete(): boolean {
    return this.#view.areAllTileTreesLoaded;
  }

  public draw(context: SceneContext): void {
    this.#view.createScene(context);
  }

  public decorate(context: DecorateContext): void {
    context.addFromDecorator(this.#view);
  }
}

export function iModelSceneObjectFromView(view: ViewState): IModelSceneObject {
  return new IModelSceneObjectImpl(view);
}
