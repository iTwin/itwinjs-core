import { RenderSystem, RenderTarget } from "./rendering";
import { IModelApp } from "./IModelApp";
import { ViewRect } from "./Viewport";

/**
 * Sub class of RenderTarget used by applications that do not really care about rendering the
 * iModel in a browser. This is typically used by non-interactive test applications.
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
  public drawFrame(_sceneSecondsElapsed?: number): void { }
  public overrideFeatureSymbology(): void { }
  public setHiliteSet(): void { }
  public setFlashed(): void { }
  public setViewRect(): void { }
  public queueReset(): void { }
  public onResized(): void { }
  public updateViewRect(): boolean { return false; }
  public readPixels() { return undefined; }
}

/**
 * Sub class of RenderSystem used by applications that do not really care about rendering the
 * iModel in a browser. This is typically used by non-interactive test applications.
 */
export class NullRenderSystem extends RenderSystem {
  public createTarget() { return new NullTarget(); }
  public createOffscreenTarget() { return new NullTarget(); }
  public createGraphic() { return undefined as any; }
  public createGraphicList() { return undefined as any; }
  public createBranch() { return undefined as any; }
  public createBatch() { return undefined as any; }
  public constructor() { super(undefined as any); }
}

/**
 * Sub class of IModelApp used by applications that do not really care about rendering the
 * iModel in a browser. This is typically used by non-interactive test applications.
 */
export class NoRenderApp extends IModelApp {
  protected static supplyRenderSystem(): RenderSystem { return new NullRenderSystem(); }
}
