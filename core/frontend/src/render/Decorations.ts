/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import type { IDisposable } from "@itwin/core-bentley";
import { dispose, disposeArray } from "@itwin/core-bentley";
import type { CanvasDecorationList } from "./CanvasDecoration";
import type { GraphicList, RenderGraphic } from "./RenderGraphic";

/** A set of [[RenderGraphic]]s and [[CanvasDecoration]]s produced by [[Tool]]s and [[Decorator]]s, used to decorate the contents of a [[Viewport]].
 * @public
 */
export class Decorations implements IDisposable {
  private _skyBox?: RenderGraphic;
  private _viewBackground?: RenderGraphic; // drawn first, view units, with no zbuffer, smooth shading, default lighting. e.g., a skybox
  private _normal?: GraphicList;       // drawn with zbuffer, with scene lighting
  private _world?: GraphicList;        // drawn with zbuffer, with default lighting, smooth shading
  private _worldOverlay?: GraphicList; // drawn in overlay mode, world units
  private _viewOverlay?: GraphicList;  // drawn in overlay mode, view units

  public canvasDecorations?: CanvasDecorationList;

  /** A view decoration created from a [[SkyBox]] rendered behind all other geometry to provide environmental context. */
  public get skyBox(): RenderGraphic | undefined { return this._skyBox; }
  public set skyBox(skyBox: RenderGraphic | undefined) { dispose(this._skyBox); this._skyBox = skyBox; }
  /** A view decoration drawn as the background of the view. @see [[GraphicType.ViewBackground]]. */
  public get viewBackground(): RenderGraphic | undefined { return this._viewBackground; }
  public set viewBackground(viewBackground: RenderGraphic | undefined) { dispose(this._viewBackground); this._viewBackground = viewBackground; }
  /** Decorations drawn as if they were part of the scene. @see [[GraphicType.Scene]]. */
  public get normal(): GraphicList | undefined { return this._normal; }
  public set normal(normal: GraphicList | undefined) { disposeArray(this._normal); this._normal = normal; }
  /** Decorations drawn as if they were part of the world, but ignoring the view's [[ViewFlags]]. @see [[GraphicType.WorldDecoration]]. */
  public get world(): GraphicList | undefined { return this._world; }
  public set world(world: GraphicList | undefined) { disposeArray(this._world); this._world = world; }
  /** Overlay decorations drawn in world coordinates. @see [[GraphicType.WorldOverlay]]. */
  public get worldOverlay(): GraphicList | undefined { return this._worldOverlay; }
  public set worldOverlay(worldOverlay: GraphicList | undefined) { disposeArray(this._worldOverlay); this._worldOverlay = worldOverlay; }
  /** Overlay decorations drawn in view coordinates. @see [[GraphicType.ViewOverlay]]. */
  public get viewOverlay(): GraphicList | undefined { return this._viewOverlay; }
  public set viewOverlay(viewOverlay: GraphicList | undefined) { disposeArray(this._viewOverlay); this._viewOverlay = viewOverlay; }

  public dispose() {
    this.skyBox = undefined;
    this.viewBackground = undefined;
    this.world = undefined;
    this.worldOverlay = undefined;
    this.viewOverlay = undefined;
    this.normal = undefined;
  }
}
