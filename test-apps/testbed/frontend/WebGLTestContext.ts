/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
import { IModelApp, ViewRect } from "@bentley/imodeljs-frontend";
import { RenderSystem, RenderTarget } from "@bentley/imodeljs-frontend/lib/rendering";

export class NullTarget extends RenderTarget {
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
  public queueReset(): void { }
  public onResized(): void { }
  public dispose(): void { }
  public updateViewRect(): boolean { return false; }
  public readPixels() { return undefined; }
  public readImage() { return undefined; }
}

export class NullRenderSystem extends RenderSystem {
  public createTarget() { return new NullTarget(); }
  public createOffscreenTarget() { return new NullTarget(); }
  public createGraphic() { return undefined as any; }
  public createGraphicList() { return undefined as any; }
  public createBranch() { return undefined as any; }
  public createBatch() { return undefined as any; }
  public dispose() { }
  public constructor() { super(undefined as any); }
}

export class MaybeRenderApp extends IModelApp {
  protected static supplyRenderSystem(): RenderSystem {
    try {
      return super.supplyRenderSystem();
    } catch (e) {
      return new NullRenderSystem();
    }
  }
}

export namespace WebGLTestContext {
  export let isInitialized = false;

  export function startup() {
    MaybeRenderApp.startup();
    isInitialized = MaybeRenderApp.hasRenderSystem;
  }

  export function shutdown() {
    MaybeRenderApp.shutdown();
    isInitialized = false;
  }

  const canvasId = "WebGLTestCanvas";

  export function createCanvas(width: number = 300, height: number = 150): HTMLCanvasElement | undefined {
    let canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (null === canvas) {
      canvas = document.createElement("canvas") as HTMLCanvasElement;
      if (null === canvas) return undefined;

      canvas.id = canvasId;
      document.body.appendChild(document.createTextNode("WebGL tests"));
      document.body.appendChild(canvas);
    }

    canvas.width = width;
    canvas.height = height;

    return canvas;
  }
}
