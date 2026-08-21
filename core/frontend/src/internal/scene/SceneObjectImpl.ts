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

class IModelSceneObjectImpl extends IModelSceneObject {
  public override readonly [_implementationProhibited] = undefined;
  public override readonly kind = "iModel";

  readonly #view: ViewState;

  public constructor(view: ViewState) {
    super();
    this.#view = view;
  }

  public get iModel(): IModelConnection {
    return this.#view.iModel;
  }

  public override get isLoadingComplete(): boolean {
    return this.#view.areAllTileTreesLoaded;
  }

  public override draw(context: SceneContext): void {
    this.#view.createScene(context);
  }

  public override decorate(context: DecorateContext): void {
    context.addFromDecorator(this.#view);
  }
}

export function iModelSceneObjectFromView(view: ViewState): IModelSceneObject {
  return new IModelSceneObjectImpl(view);
}
