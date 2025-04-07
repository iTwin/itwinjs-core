/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { Id64String } from "@itwin/core-bentley";
import { RenderMemory } from "../../render/RenderMemory.js";
import { SceneContext } from "../../ViewContext.js";

/** An opaque representation of a texture draped on geometry within a [[Viewport]]. */
export abstract class RenderTextureDrape implements Disposable {
  public abstract [Symbol.dispose](): void;

  /** @internal */
  public abstract collectStatistics(stats: RenderMemory.Statistics): void;
  public abstract collectGraphics(context: SceneContext): void;
}

export type TextureDrapeMap = Map<Id64String, RenderTextureDrape>;
