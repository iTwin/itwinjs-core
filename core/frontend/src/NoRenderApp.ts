/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { RenderSystem, RenderTarget, AnimationBranchStates } from "./rendering";
import { IModelApp, IModelAppOptions } from "./IModelApp";
import { ViewRect } from "./Viewport";

/**
 * A RenderTarget for applications that must run in environments where WebGL is not present.
 * This is typically used in tests.
 * @internal
 */
export class NullTarget extends RenderTarget {
  public get animationFraction(): number { return 0; }
  public set animationFraction(_fraction: number) { }
  public get renderSystem() { return undefined as any; }
  public get cameraFrustumNearScaleLimit(): number { return 0; }
  public get viewRect(): ViewRect { return new ViewRect(); }
  public get wantInvertBlackBackground(): boolean { return false; }
  public get animationBranches(): AnimationBranchStates | undefined { return undefined; }
  public set animationBranches(_branches: AnimationBranchStates | undefined) { }
  public onDestroy(): void { }
  public reset(): void { }
  public changeScene(): void { }
  public changeDynamics(): void { }
  public changeDecorations(): void { }
  public changeRenderPlan(): void { }
  public drawFrame(_sceneMilSecElapsed?: number): void { }
  public overrideFeatureSymbology(): void { }
  public setHiliteSet(): void { }
  public setFlashed(): void { }
  public setViewRect(): void { }
  public onResized(): void { }
  public dispose(): void { }
  public updateViewRect(): boolean { return false; }
  public readPixels(): void { }
  public readImage() { return undefined; }

}

/**
 * A RenderSystem for applications that must run in environments where WebGL is not present.
 * This is typically used in tests.
 * @internal
 */
export class NullRenderSystem extends RenderSystem {
  public get isValid(): boolean { return false; }
  public createTarget() { return new NullTarget(); }
  public createOffscreenTarget() { return new NullTarget(); }
  public createGraphicBuilder() { return undefined as any; }
  public createGraphicList() { return undefined as any; }
  public createGraphicBranch() { return undefined as any; }
  public createBatch() { return undefined as any; }
  public dispose() { }
  public constructor() { super(); }
}

/**
 * A class for applications that must run in environments where WebGL is not present.
 * This is typically used in tests.
 * @internal
 */
export class NoRenderApp {
  public static startup(opts?: IModelAppOptions) {
    opts = opts ? opts : {};
    opts.renderSys = new NullRenderSystem();
    IModelApp.startup(opts);

  }
}
