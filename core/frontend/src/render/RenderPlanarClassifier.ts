/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { Id64String, IDisposable } from "@bentley/bentleyjs-core";
import { PlanarModelMask } from "../PlanarModelMask";
import { TileTreeReference } from "../tile/internal";
import { SceneContext } from "../ViewContext";

/** An opaque representation of a planar classifier applied to geometry within a [[Viewport]].
 * @internal
 */
export abstract class RenderPlanarClassifier implements IDisposable {
  public abstract dispose(): void;
  public abstract collectGraphics(context: SceneContext, classifiedTree: TileTreeReference, classifierTree?: TileTreeReference, planarModelMask?: PlanarModelMask): void;
}

/** @internal */
export type PlanarClassifierMap = Map<Id64String, RenderPlanarClassifier>;
