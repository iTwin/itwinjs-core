/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Cesium
 */

import { IModelApp } from "@itwin/core-frontend";
import { Cartesian3, Clock, Color, defined, Ellipsoid, Globe, ImageryLayer, Scene, ScreenSpaceEventHandler } from "cesium";

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
  private _canvasClientWidth: number = 0;
  private _canvasClientHeight: number = 0;
  private _lastDevicePixelRatio: number = 1;

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

    this._scene.imageryLayers.add(ImageryLayer.fromWorldImagery({}));

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

      // ###TODO figure out how to handle the need to call `initializeFrame` in Cesium.
      // That function inside Cesium has the following comment: "Destroy released shaders and textures once every 120 frames to avoid thrashing the cache"
      // That seems important.
      // this._scene.initializeFrame();

      const currentTime = this._clock.tick();
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
