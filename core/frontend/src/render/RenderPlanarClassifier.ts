/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import {
  Id64String,
  IDisposable,
} from "@bentley/bentleyjs-core";
import { SceneContext } from "../ViewContext";
import { TileTreeReference } from "../tile/internal";

/** An opaque representation of a planar classifier applied to geometry within a [[Viewport]].
 * @internal
 */
export abstract class RenderPlanarClassifier implements IDisposable {
  public abstract dispose(): void;
  public abstract collectGraphics(context: SceneContext, classifiedTree: TileTreeReference, tileTree: TileTreeReference): void;
}

/** @internal */
export type PlanarClassifierMap = Map<Id64String, RenderPlanarClassifier>;
