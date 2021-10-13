/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { IDisposable } from "@itwin/core-bentley";
import { RenderMemory } from "./RenderMemory";

/** Abstract representation of an object which can be rendered by a [[RenderSystem]].
 * Two broad classes of graphics exist:
 *  - "Scene" graphics generated on the back-end to represent the contents of the models displayed in a [[Viewport]]; and
 *  - [[Decorations]] created on the front-end to be rendered along with the scene.
 * The latter are produced using a [[GraphicBuilder]].
 * @public
 */
export abstract class RenderGraphic implements IDisposable /* , RenderMemory.Consumer */ {
  public abstract dispose(): void;

  /** @internal */
  public abstract collectStatistics(stats: RenderMemory.Statistics): void;
}

/** A graphic that owns another graphic. By default, every time a [[Viewport]]'s decorations or dynamics graphics change, the previous graphics are disposed of.
 * Use a GraphicOwner to prevent disposal of a graphic that you want to reuse. The graphic owner can be added to decorations and list of dynamics just like any other graphic, but the graphic it owns
 * will never be automatically disposed of. Instead, you assume responsibility for disposing of the owned graphic by calling [[disposeGraphic]] when the owned graphic is no longer in use. Failure
 * to do so will result in leaks of graphics memory or other webgl resources.
 * @public
 */
export abstract class RenderGraphicOwner extends RenderGraphic {
  /** The owned graphic. */
  public abstract get graphic(): RenderGraphic;
  /** Does nothing. To dispose of the owned graphic, use [[disposeGraphic]]. */
  public dispose(): void { }
  /** Disposes of the owned graphic. */
  public disposeGraphic(): void { this.graphic.dispose(); }
  /** @internal */
  public collectStatistics(stats: RenderMemory.Statistics): void { this.graphic.collectStatistics(stats); }
}

/** An array of [[RenderGraphic]]s.
 * @public
 */
export type GraphicList = RenderGraphic[];
