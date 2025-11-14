/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Id64String } from "@itwin/core-bentley";
import { _implementationProhibited, Decorations, GraphicList, IModelApp, Pixel, RenderPlan, RenderTarget, Scene, ViewRect } from "@itwin/core-frontend";
import { CesiumScene } from "./CesiumScene.js";
import { CesiumSystem } from "./System.js";
import { PrimitiveConverterFactory } from "./decorations/PrimitiveConverterFactory.js";
import { CesiumCameraHelpers } from "./decorations/CesiumCameraHelpers.js";

/** A Target that renders to a canvas on the screen using Cesium.
 * @internal
 */
export class CesiumOnScreenTarget extends RenderTarget {
  protected override readonly [_implementationProhibited] = undefined;

  private readonly _canvas: HTMLCanvasElement;
  private readonly _scene: CesiumScene;
  private readonly _lastDecorationCounts = new Map<string, number>();

  public get renderSystem(): CesiumSystem { return CesiumSystem.instance; }

  public get viewRect(): ViewRect {
    // ###TODO consider this a temporary solution until we have a proper ViewRect implementation for Cesium.
    const viewRect = new ViewRect();
    viewRect.init(0, 0, this._canvas.width, this._canvas.height);
    return viewRect;
  }

  public constructor(canvas: HTMLCanvasElement) {
    super();
    this._canvas = canvas;
    this._scene = new CesiumScene({
      canvas: this._canvas,
      sceneOptions: {
      }
    });
    // Add keyboard shortcuts for debugging
    CesiumCameraHelpers.setupKeyboardShortcuts(this._scene);
  }

  // ###TODO getters and setters
  public get wantInvertBlackBackground() { return false; }
  public get analysisFraction() { return 0; }
  public set analysisFraction(_fraction: number) { /* no-op */ }
  public get screenSpaceEffects(): Iterable<string> { return []; }
  public set screenSpaceEffects(_effectNames: Iterable<string>) { /* no-op */ }

  public changeScene(_scene: Scene) {
    // ###TODO Implement scene change logic for Cesium
  }

  public changeDynamics(_foreground: GraphicList | undefined, _overlay: GraphicList | undefined) {
    // ###TODO Implement dynamics change logic for Cesium
  }

  public changeDecorations(decorations: Decorations) {
    // Check if scene is ready before proceeding
    if (!this._scene?.cesiumScene) {
      return;
    }

    const converter = PrimitiveConverterFactory.getConverter();
    if (!converter) {
      return;
    }

    const currentIModel = IModelApp.viewManager.selectedView?.iModel;
    let anyActive = false;

    const processType = (type: string, graphics: GraphicList | undefined, options?: { alwaysRefresh?: boolean }) => {
      const currentCount = graphics?.length ?? 0;
      const prevCount = this._lastDecorationCounts.get(type) ?? 0;
      const alwaysRefresh = options?.alwaysRefresh === true;

      if (currentCount === 0) {
        if (prevCount !== 0) {
          converter.clearDecorationsForType(this._scene, type);
          this._lastDecorationCounts.set(type, 0);
        }
        return;
      }

      anyActive = true;
      const shouldClear = alwaysRefresh || prevCount !== currentCount;
      if (!shouldClear && !alwaysRefresh) {
        this._lastDecorationCounts.set(type, currentCount);
        return;
      }

      converter.convertDecorationType(graphics, type, this._scene, currentIModel, { clear: shouldClear });
      this._lastDecorationCounts.set(type, currentCount);
    };

    processType("world", decorations.world, { alwaysRefresh: false });
    processType("normal", decorations.normal, { alwaysRefresh: false });
    processType("viewBackground", decorations.viewBackground ? [decorations.viewBackground] : undefined, { alwaysRefresh: false });
    processType("worldOverlay", decorations.worldOverlay, { alwaysRefresh: true });
    processType("viewOverlay", decorations.viewOverlay, { alwaysRefresh: true });

    if (!anyActive) {
      converter.clearAllDecorations(this._scene);
    }
  }

  public changeRenderPlan(_plan: RenderPlan) {
    // ###TODO Implement render plan change logic for Cesium
  }

  public drawFrame(_sceneMilSecElapsed?: number) {
    // ###TODO Implement frame drawing logic for Cesium
  }

  public setViewRect(_rect: ViewRect, _temporary: boolean) {
    // ###TODO Implement view rectangle setting logic for Cesium
  }

  public updateViewRect() {
    // Cesium handles resizing
    return false;
  }

  public readPixels(_rect: ViewRect, _selector: Pixel.Selector, _receiver: Pixel.Receiver, _excludeNonLocatable: boolean, _excludedElements?: Iterable<Id64String>) {
    // ###TODO Implement pixel reading logic for Cesium
    // NB: `rect` is specified in *CSS* pixels.
  }
}

/** A Target that renders to an offscreen buffer using Cesium.
 * @internal
 */
export class CesiumOffScreenTarget extends RenderTarget {
  protected override readonly [_implementationProhibited] = undefined;

  private readonly _rect: ViewRect

  public get renderSystem(): CesiumSystem { return CesiumSystem.instance; }

  public get viewRect(): ViewRect {
    return this._rect;
  }

  public constructor(rect: ViewRect) {
    super();
    this._rect = rect;
  }

  // ###TODO getters and setters
  public get wantInvertBlackBackground() { return false; }
  public get analysisFraction() { return 0; }
  public set analysisFraction(_fraction: number) { /* no-op */ }
  public get screenSpaceEffects(): Iterable<string> { return []; }
  public set screenSpaceEffects(_effectNames: Iterable<string>) { /* no-op */ }

  public changeScene(_scene: Scene) {
    // ###TODO Implement scene change logic for Cesium
  }

  public changeDynamics(_foreground: GraphicList | undefined, _overlay: GraphicList | undefined) {
    // ###TODO Implement dynamics change logic for Cesium
  }

  public changeDecorations(_decorations: Decorations) {
    // ###TODO Implement decoration change logic for Cesium
  }

  public changeRenderPlan(_plan: RenderPlan) {
    // ###TODO Implement render plan change logic for Cesium
  }

  public drawFrame(_sceneMilSecElapsed?: number) {
    // ###TODO Implement frame drawing logic for Cesium
  }

  public setViewRect(_rect: ViewRect, _temporary: boolean) {
    // ###TODO Implement view rectangle setting logic for Cesium
  }

  public updateViewRect() {
    // Cesium handles resizing, and an offscreen target also will not resize the view rect
    // See core/frontend/src/internal/render/webgl/Target.ts - OffScreenTarget.updateViewRect()
    return false;
  }

  public readPixels(_rect: ViewRect, _selector: Pixel.Selector, _receiver: Pixel.Receiver, _excludeNonLocatable: boolean, _excludedElements?: Iterable<Id64String>) {
    // ###TODO Implement pixel reading logic for Cesium
    // NB: `rect` is specified in *CSS* pixels.
  }
}
