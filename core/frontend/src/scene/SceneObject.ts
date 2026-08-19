/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { _implementationProhibited } from "../common/internal/Symbols";
import { IModelConnection } from "../IModelConnection";
import { DecorateContext, SceneContext } from "../ViewContext";

export interface CustomSceneObject {
  readonly kind: "Custom";
  readonly customKind: string;

  readonly isLoadingComplete: boolean;

  draw(context: SceneContext): void;
  decorate(context: DecorateContext): void;
}

export interface IModelSceneObject {
  /** @internal */
  readonly [_implementationProhibited]: unknown;

  readonly kind: "imodel";
  readonly isLoadingComplete: boolean;

  draw(context: SceneContext): void;
  decorate(context: DecorateContext): void;

  readonly iModel: IModelConnection;
}

export type SceneObject = CustomSceneObject | IModelSceneObject;
