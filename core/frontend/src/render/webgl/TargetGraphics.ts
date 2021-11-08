/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { dispose, disposeArray } from "@itwin/core-bentley";
import { GraphicList } from "../RenderGraphic";
import { Decorations } from "../Decorations";
import { CanvasDecorationList } from "../CanvasDecoration";
import { Scene } from "../Scene";

/** The various graphics associated with a [[Target]].
 * @internal
 */
export class TargetGraphics {
  public foreground: GraphicList = [];
  public background: GraphicList = [];
  public overlays: GraphicList = [];
  private _dynamics?: GraphicList;
  private _decorations?: Decorations;

  public dispose(): void {
    this.foreground.length = this.background.length = this.overlays.length = 0;
    this._dynamics = disposeArray(this._dynamics);
    this._decorations = dispose(this._decorations);
  }

  public get isDisposed(): boolean {
    return 0 === this.foreground.length && 0 === this.background.length && 0 === this.overlays.length
      && undefined === this._dynamics && undefined === this._decorations;
  }

  public changeScene(scene: Scene): void {
    this.foreground = scene.foreground;
    this.background = scene.background;
    this.overlays = scene.overlay;
  }

  public get dynamics(): GraphicList | undefined { return this._dynamics; }
  public set dynamics(dynamics: GraphicList | undefined) {
    disposeArray(this._dynamics);
    this._dynamics = dynamics;
  }

  public get decorations(): Decorations | undefined { return this._decorations; }
  public set decorations(decorations: Decorations | undefined) {
    dispose(this._decorations);
    this._decorations = decorations;
  }

  public get canvasDecorations(): CanvasDecorationList | undefined {
    return this._decorations?.canvasDecorations;
  }
}
