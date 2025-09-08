/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Cesium
 */

import { Id64String } from "@itwin/core-bentley";
import { System } from "./System";
import { CesiumScene } from "./Scene";
import { Decorations, GraphicList, IModelApp, Pixel, RenderPlan, RenderTarget, Scene, ViewRect } from "@itwin/core-frontend";
import { CesiumDecorator } from "./CesiumDecorator";
import { CesiumEntityHelpers } from "./CesiumEntityHelpers";
import { CesiumCameraHelpers } from "./CesiumCameraHelpers";


/** A Target that renders to a canvas on the screen using Cesium.
 * @internal
 */
export class OnScreenTarget extends RenderTarget {
  private readonly _canvas: HTMLCanvasElement;
  private readonly _scene: CesiumScene;
  private _decorator?: CesiumDecorator;
  private _currentIModel?: any;
  private _lastDecorationCount = -1;

  public get renderSystem(): System { return System.instance; }

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

    // Start test decorator if not already started
    this.startDecorator();
    
    
    // Only log when decoration count changes
    const currentCount = (decorations.world?.length || 0) + (decorations.normal?.length || 0) + 
                        (decorations.worldOverlay?.length || 0) + (decorations.viewOverlay?.length || 0);
    
    if (currentCount !== this._lastDecorationCount) {
      this._lastDecorationCount = currentCount;
      
    }
    
    // Get access to the CesiumJS EntityCollection
    const entityCollection = this._scene.entities;
    
    // Only clear decoration entities, not test entities
    CesiumEntityHelpers.clearDecorationEntities(entityCollection);
    
    // Phase 2: Start with basic conversion (now with iModel for real coordinate conversion)
    const currentIModel = IModelApp.viewManager.selectedView?.iModel;
    CesiumEntityHelpers.convertDecorationsToCesiumEntities(decorations.world, 'world', entityCollection, currentIModel);
    CesiumEntityHelpers.convertDecorationsToCesiumEntities(decorations.normal, 'normal', entityCollection, currentIModel);
    CesiumEntityHelpers.convertDecorationsToCesiumEntities(decorations.worldOverlay, 'worldOverlay', entityCollection, currentIModel);
    CesiumEntityHelpers.convertDecorationsToCesiumEntities(decorations.viewOverlay, 'viewOverlay', entityCollection, currentIModel);
    
    // WORKAROUND: Create mock decorations for testing when no real decorations exist
    const totalDecorations = (decorations.world?.length || 0) + (decorations.normal?.length || 0) + 
                           (decorations.worldOverlay?.length || 0) + (decorations.viewOverlay?.length || 0);
    
    // Check if we have any mock decoration entities currently
    const currentMockEntities = entityCollection.values.filter((entity: any) => 
      entity.id && entity.id.startsWith('mock_decoration_')
    ).length;
    
    if (totalDecorations === 0 && !this._decorator && currentMockEntities === 0) {
      console.log('No real decorations and no decorator found - creating mock decorations for testing');
      CesiumEntityHelpers.createMockDecorations(entityCollection);
    } else if (this._decorator && totalDecorations === 0) {
      console.log(`Decorator exists but no decorations detected yet - skipping mock decorations`);
    } else if (currentMockEntities > 0) {
      console.log(`Found ${currentMockEntities} existing mock decoration entities`);
    }
  }

  private startDecorator(): void {
    const currentIModel = IModelApp.viewManager.selectedView?.iModel;
    
    // If we have a decorator but the iModel changed, stop the old one
    if (this._decorator && currentIModel && this._currentIModel !== currentIModel) {
      this._decorator.stop();
      this._decorator = undefined;
    }
    
    // Start new decorator if needed
    if (!this._decorator && currentIModel) {
      this._decorator = CesiumDecorator.start(currentIModel);
      this._currentIModel = currentIModel;
      
      // Listen for iModel close events to clean up
      this.setupIModelCloseListener(currentIModel);
    }
  }
  
  private setupIModelCloseListener(iModel: any): void {
    // Clean up entities when iModel closes
    const closeListener = () => {
      if (this._decorator) {
        this._decorator.stop();
        this._decorator = undefined;
      }
      this._currentIModel = undefined;
      
      if (this._scene?.entities) {
        CesiumEntityHelpers.clearAllCesiumEntities(this._scene.entities);
      }
    };
    
    // Try to add the close listener if the iModel supports it
    if (iModel.onClose && typeof iModel.onClose.addListener === 'function') {
      iModel.onClose.addListener(closeListener);
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

  public updateViewRect() {// force a RenderTarget viewRect to resize if necessary since last draw
    return true; // ###TODO Implement view rectangle update logic for Cesium
  }

  public readPixels(_rect: ViewRect, _selector: Pixel.Selector, _receiver: Pixel.Receiver, _excludeNonLocatable: boolean, _excludedElements?: Iterable<Id64String>) {
    // ###TODO Implement pixel reading logic for Cesium
    // NB: `rect` is specified in *CSS* pixels.
  }
}

/** A Target that renders to an offscreen buffer using Cesium.
 * @internal
 */
export class OffScreenTarget extends RenderTarget {
  private readonly _rect: ViewRect

  public get renderSystem(): System { return System.instance; }

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
    // ###TODO
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

  public updateViewRect() {// force a RenderTarget viewRect to resize if necessary since last draw
    return true; // ###TODO Implement view rectangle update logic for Cesium
  }

  public readPixels(_rect: ViewRect, _selector: Pixel.Selector, _receiver: Pixel.Receiver, _excludeNonLocatable: boolean, _excludedElements?: Iterable<Id64String>) {
    // ###TODO Implement pixel reading logic for Cesium
    // NB: `rect` is specified in *CSS* pixels.
  }
}
