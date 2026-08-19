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

  private readonly _view: ViewState;

  public constructor(view: ViewState) {
    this._view = view;
  }

  public get iModel(): IModelConnection {
    return this._view.iModel;
  }

  public get isLoadingComplete(): boolean {
    return this._view.areAllTileTreesLoaded;
  }

  public draw(context: SceneContext): void {
    this._view.createScene(context);
  }

  public decorate(context: DecorateContext): void {
    context.addFromDecorator(this._view);
  }
}

export function iModelSceneObjectFromViewState(view: ViewState): IModelSceneObject {
  return new IModelSceneObjectImpl(view);
}
