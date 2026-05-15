/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { dispose, disposeArray } from "@itwin/core-bentley";
import { GraphicList } from "../../../render/RenderGraphic";
import { Decorations } from "../../../render/Decorations";
import { CanvasDecorationList } from "../../../render/CanvasDecoration";
import { Scene } from "../../../render/Scene";

/** The various graphics associated with a [[Target]].
 * @internal
 */
export class TargetGraphics {
  public foreground: GraphicList = [];
  public background: GraphicList = [];
  public overlays: GraphicList = [];
  public foregroundDynamics: GraphicList = [];
  public overlayDynamics: GraphicList = [];
  private _decorations?: Decorations;

  public [Symbol.dispose](): void {
    this.foreground.length = this.background.length = this.overlays.length = 0;

    disposeArray(this.foregroundDynamics);
    disposeArray(this.overlayDynamics);

    this._decorations = dispose(this._decorations);
  }

  public get isDisposed(): boolean {
    return 0 === this.foreground.length && 0 === this.background.length && 0 === this.overlays.length
      && 0 === this.foregroundDynamics.length && 0 === this.overlayDynamics.length && !this._decorations;
  }

  public changeScene(scene: Scene): void {
    this.foreground = scene.foreground;
    this.background = scene.background;
    this.overlays = scene.overlay;
  }

  public changeDynamics(foreground: GraphicList | undefined, overlay: GraphicList | undefined) {
    disposeArray(this.foregroundDynamics);
    disposeArray(this.overlayDynamics);

    this.foregroundDynamics = foreground ?? [];
    this.overlayDynamics = overlay ?? [];
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
