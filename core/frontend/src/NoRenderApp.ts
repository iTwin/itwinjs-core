/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { RenderSystem, RenderTarget } from "./rendering";
import { IModelApp } from "./IModelApp";
import { ViewRect } from "./Viewport";

/**
 * A RenderTarget for applications that must run in environments where WebGL is not present.
 * This is typically used in tests.
 */
export class NullTarget extends RenderTarget {
  public get animationFraction(): number { return 0; }
  public set animationFraction(_fraction: number) { }
  public get renderSystem() { return undefined as any; }
  public get cameraFrustumNearScaleLimit(): number { return 0; }
  public get viewRect(): ViewRect { return new ViewRect(); }
  public get wantInvertBlackBackground(): boolean { return false; }
  public onDestroy(): void { }
  public reset(): void { }
  public changeScene(): void { }
  public changeTerrain(): void { }
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
  public readPixels() { return undefined; }
  public readImage() { return undefined; }
}

/**
 * A RenderSystem for applications that must run in environments where WebGL is not present.
 * This is typically used in tests.
 */
export class NullRenderSystem extends RenderSystem {
  public get isValid(): boolean { return false; }
  public createTarget() { return new NullTarget(); }
  public createOffscreenTarget() { return new NullTarget(); }
  public createGraphicBuilder() { return undefined as any; }
  public createGraphicList() { return undefined as any; }
  public createBranch() { return undefined as any; }
  public createBatch() { return undefined as any; }
  public dispose() { }
  public constructor() { super(); }
}

/**
 * An IModelApp for applications that must run in environments where WebGL is not present.
 * This is typically used in tests.
 */
export class NoRenderApp extends IModelApp {
  protected static supplyRenderSystem(): RenderSystem { return new NullRenderSystem(); }
}
