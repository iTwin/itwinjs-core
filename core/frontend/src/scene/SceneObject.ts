/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { _implementationProhibited } from "../common/internal/Symbols";
import { HitDetail } from "../HitDetail";
import { IModelConnection } from "../IModelConnection";
import { TileTreeReference } from "../tile/internal";
import { DecorateContext, DynamicsContext, SceneContext } from "../ViewContext";
import { ViewportDecorator } from "../Viewport";

// Just using this temporarily to explicitly document the expected shape of all SceneObjects as that shape evolves.
// Might keep it for convenient place to define default behavior and add new methods/properties without breaking API.
export abstract class BaseSceneObject implements ViewportDecorator {
  abstract readonly kind: string;
  abstract readonly isLoadingComplete: boolean;

  draw(_context: SceneContext): void { }
  decorate(_context: DecorateContext): void { }
  addDynamics(_context: DynamicsContext): void { }

  getTileTreeReferences(): Iterable<TileTreeReference> {
    return [];
  }

  async getToolTip(_hit: HitDetail): Promise<HTMLElement | string | undefined> {
    return undefined;
  }
}

export abstract class CustomSceneObject extends BaseSceneObject {
  public readonly kind = "Custom" as const;
  public abstract readonly customKind: string;
}

export abstract class IModelSceneObject extends BaseSceneObject {
  /** @internal */
  readonly [_implementationProhibited]: unknown;

  public readonly kind = "iModel" as const;

  public abstract readonly iModel: IModelConnection;
}

export type SceneObject = CustomSceneObject | IModelSceneObject;

