/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { RenderSystem, RenderTarget } from "./rendering";
import { IModelApp } from "./IModelApp";
import { ViewRect } from "./Viewport";

/**
 * A RenderTarget for applications that must run in environments where WebGL is not present.
 * This is typically used in tests.
 */
export class NullTarget extends RenderTarget {
  public get renderSystem() { return undefined as any; }
  public get cameraFrustumNearScaleLimit(): number { return 0; }
  public get viewRect(): ViewRect { return new ViewRect(); }
  public get wantInvertBlackBackground(): boolean { return false; }
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
  public queueReset(): void { }
  public onResized(): void { }
  protected doDispose(): void { }
  public updateViewRect(): boolean { return false; }
  public readPixels() { return undefined; }
}

/**
 * A RenderSystem for applications that must run in environments where WebGL is not present.
 * This is typically used in tests.
 */
export class NullRenderSystem extends RenderSystem {
  public createTarget() { return new NullTarget(); }
  public createOffscreenTarget() { return new NullTarget(); }
  public createGraphic() { return undefined as any; }
  public createGraphicList() { return undefined as any; }
  public createBranch() { return undefined as any; }
  public createBatch() { return undefined as any; }
  protected doDispose() { }
  public constructor() { super(undefined as any); }
}

/**
 * An IModelApp for applications that must run in environments where WebGL is not present.
 * This is typically used in tests.
 */
export class NoRenderApp extends IModelApp {
  protected static supplyRenderSystem(): RenderSystem { return new NullRenderSystem(); }
}
