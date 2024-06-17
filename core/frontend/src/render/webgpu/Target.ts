/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGPU
 */

import { ViewRect } from "../../common/ViewRect";
import { RenderTarget } from "../RenderTarget";
import { RenderSystem } from "../RenderSystem";
import { WebGPUSystem } from "./System";
import { Scene } from "../Scene";
import { GraphicList } from "../RenderGraphic";
import { Decorations } from "../Decorations";
import { RenderPlan } from "../RenderPlan";
import { Pixel } from "../Pixel";

export class WebGPUTarget extends RenderTarget {
  private _system: WebGPUSystem;

  public constructor(system: WebGPUSystem) {
    super();
    this._system = system;
  }

  public get renderSystem(): RenderSystem {
    return this._system;
  }

  /** NB: *Device pixels*, not CSS pixels! */
  public get viewRect(): ViewRect {
    return new ViewRect(0, 0, 1, 1);
  }

  public get wantInvertBlackBackground(): boolean { return false; }

  public get analysisFraction(): number { return 0; }
  public set analysisFraction(_fraction: number) { }

  public changeScene(_scene: Scene): void {}
  public changeDynamics(_dynamics?: GraphicList): void {}
  public changeDecorations(_decorations: Decorations): void {}
  public changeRenderPlan(_plan: RenderPlan): void {}
  public drawFrame(_sceneMilSecElapsed?: number): void {}

  public setViewRect(_rect: ViewRect, _temporary: boolean): void {}
  public updateViewRect(): boolean { return false; }
  public readPixels(_rect: ViewRect, _selector: Pixel.Selector, _receiver: Pixel.Receiver, _excludeNonLocatable: boolean): void { }

  public get screenSpaceEffects(): Iterable<string> { return []; }
  public set screenSpaceEffects(_effectNames: Iterable<string>) { }
}
