/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Cesium
 */

import { IModelApp } from "@itwin/core-frontend";
import { Cartesian3, Clock, Color, CustomDataSource, DataSourceCollection, DataSourceDisplay, defined, Ellipsoid, EntityCollection, Globe, ImageryLayer, Ion, Scene, ScreenSpaceEventHandler } from "cesium";

/** Options to configure a Cesium scene.
 * @internal
 **/
export interface CesiumSceneOptions {
  clock?: Clock; // Optional clock to control time in the scene. Default: new Clock()
  shouldAnimate?: boolean; // Whether the scene should advance the simulation time. Default: false
}

/** A helper class, similar to CesiumWidget, which initializes a Cesium scene for use by iTwin.js.
 * @internal
 * */
export class CesiumScene {
  private readonly _canvas: HTMLCanvasElement;
  private readonly _scene: Scene;
  private readonly _clock: Clock;
  private readonly _screenSpaceEventHandler: ScreenSpaceEventHandler;
  private readonly _dataSourceCollection: DataSourceCollection;
  private readonly _dataSourceDisplay: DataSourceDisplay;
  private readonly _entities: EntityCollection;
  private _canvasClientWidth: number = 0;
  private _canvasClientHeight: number = 0;
  private _lastDevicePixelRatio: number = 1;

  /** Get access to the underlying CesiumJS Scene for advanced operations */
  public get cesiumScene(): Scene {
    return this._scene;
  }
  
  /** Get access to the EntityCollection for adding decorations */
  public get entities(): EntityCollection {
    return this._entities;
  }

  public constructor(args: { canvas: HTMLCanvasElement, sceneOptions?: CesiumSceneOptions }) {
    const sceneOpts = args.sceneOptions ?? {};

    this._canvas = args.canvas;
    this._clock = sceneOpts.clock ?? new Clock();
    this._clock.shouldAnimate = sceneOpts.shouldAnimate ?? false;

    this.configureCanvasSize();

    // see: https://cesium.com/learn/ion-sdk/ref-doc/Scene.html
    // also see: https://sandcastle.cesium.com/?src=Cesium%20Widget.html
    // source found here: https://github.com/CesiumGS/cesium/blob/main/packages/engine/Source/Widget/CesiumWidget.js

    this._scene = new Scene({
      canvas: this._canvas,
      contextOptions : {
        allowTextureFilterAnisotropic : false
      }
    });
    this._scene.camera.constrainedAxis = Cartesian3.UNIT_Z;

    this.configureCameraFrustum();

    this._scene.globe = new Globe(Ellipsoid.default);
    this._scene.backgroundColor = Color.FUCHSIA;
    this._scene.debugShowFramesPerSecond = true;


    const cesiumKey = process.env.IMJS_CESIUM_ION_KEY;
    if (cesiumKey) {
      Ion.defaultAccessToken = cesiumKey;
    }
    this._scene.imageryLayers.add(ImageryLayer.fromWorldImagery({}));

    // Create DataSourceCollection and DataSourceDisplay for entity rendering
    this._dataSourceCollection = new DataSourceCollection();
    this._dataSourceDisplay = new DataSourceDisplay({
      scene: this._scene,
      dataSourceCollection: this._dataSourceCollection
    });

    // Create CustomDataSource and connect to entities
    const dataSource = new CustomDataSource('iTwin-Decorations');
    void this._dataSourceCollection.add(dataSource);
    this._entities = dataSource.entities;
    

    this._screenSpaceEventHandler = new ScreenSpaceEventHandler(this._canvas);

    const onRenderError = function (_scene: any, error: any) {
      const title =
        "An error occurred while rendering.  Rendering has stopped.";
      // eslint-disable-next-line no-console
      console.log(title, error);
    };
    this._scene.renderError.addEventListener(onRenderError);

    IModelApp.viewManager.onBeginRender.addListener(() => {
      // console.log("cesium scene render");

      this.resize();

      const currentTime = this._clock.tick();
      
      // Update DataSourceDisplay to render entities
      this._dataSourceDisplay.update(currentTime);
      
      this._scene.render(currentTime);
    });
  }

  private configurePixelRatio() {
    const pixelRatio = window.devicePixelRatio;
    // ###TODO pixelRatio is private on Scene!
    // this._scene.pixelRatio = pixelRatio;
    return pixelRatio;
  }

  private configureCanvasSize() {
    const canvas = this._canvas;
    let width = canvas.clientWidth;
    let height = canvas.clientHeight;
    const pixelRatio = this.configurePixelRatio();

    this._canvasClientWidth = width;
    this._canvasClientHeight = height;

    width *= pixelRatio;
    height *= pixelRatio;

    canvas.width = width;
    canvas.height = height;

    this._lastDevicePixelRatio = window.devicePixelRatio;
  }

  private resize() {
    const canvas = this._canvas;
    if (
      this._canvasClientWidth === canvas.clientWidth &&
      this._canvasClientHeight === canvas.clientHeight &&
      this._lastDevicePixelRatio === window.devicePixelRatio
    ) {
      return;
    }

    this.configureCanvasSize();
    this.configureCameraFrustum();

    this._scene.requestRender();
  };

  // ###TODO -- do we need better typing in Cesium for frustum properties? I needed to cast frustum as any, below, because Cesium relies on the defined() macro to check for existence of properties like aspectRatio, right, top, etc.
  private configureCameraFrustum() {
    const canvas = this._canvas;
    const width = canvas.width;
    const height = canvas.height;
    if (width !== 0 && height !== 0) {
      const frustum = this._scene.camera.frustum as any;
      if (defined(frustum.aspectRatio)) {
        frustum.aspectRatio = width / height;
      } else {
        frustum.top = frustum.right * (height / width);
        frustum.bottom = -frustum.top;
      }
    }
  }
}
