/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ViewDefinition3dProps } from "@itwin/core-common";
import { IModelApp } from "@itwin/core-frontend";
import { Cartesian3, Cesium3DTileset, Clock, Color, createWorldImageryAsync, defined, Ellipsoid, Globe, ImageryLayer, Ion, IonWorldImageryStyle, Matrix4, OrthographicFrustum, PerspectiveFrustum, PointPrimitiveCollection, PolylineCollection, PrimitiveCollection, Scene, ScreenSpaceEventHandler } from "@cesium/engine";
import { createCesiumCameraProps } from "./CesiumCamera.js";

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
  private readonly _pointCollection: PointPrimitiveCollection;
  private readonly _polylineCollection: PolylineCollection;
  private readonly _primitivesCollection: PrimitiveCollection;
  private _canvasClientWidth: number = 0;
  private _canvasClientHeight: number = 0;
  private _lastDevicePixelRatio: number = 1;
  private _splatTileset?: Cesium3DTileset;
  private _splatPlaced = false;
  private _vectorTileset?: Cesium3DTileset;
  private _vectorPlaced = false;

  /** Get access to the underlying CesiumJS Scene for advanced operations */
  public get cesiumScene(): Scene {
    return this._scene;
  }

  /** Get access to the PointPrimitiveCollection for adding point decorations */
  public get pointCollection(): PointPrimitiveCollection {
    return this._pointCollection;
  }

  /** Get access to the PolylineCollection for adding line decorations */
  public get polylineCollection(): PolylineCollection {
    return this._polylineCollection;
  }

  /** Get access to the PrimitiveCollection for adding shape decorations */
  public get primitivesCollection(): PrimitiveCollection {
    return this._primitivesCollection;
  }

  public constructor(args: { canvas: HTMLCanvasElement, sceneOptions?: CesiumSceneOptions }) {
    const sceneOpts = args.sceneOptions ?? {};

    this._canvas = args.canvas;
    this._clock = sceneOpts.clock ?? new Clock();
    this._clock.shouldAnimate = sceneOpts.shouldAnimate ?? false;

    this.configureCanvasSize();

    // ###TODO make this creditContainer actually be shown on screen
    // Converge it with iTwin.js credit display?
    const creditContainer = document.createElement("div") as any;
    creditContainer.style.position = "absolute";
    creditContainer.style.bottom = "0";
    creditContainer.style["text-shadow"] = "0 0 2px #000000";
    creditContainer.style.color = "#ffffff";
    creditContainer.style["font-size"] = "10px";
    creditContainer.style["padding-right"] = "5px";

    // see: https://cesium.com/learn/ion-sdk/ref-doc/Scene.html
    // also see: https://sandcastle.cesium.com/?src=Cesium%20Widget.html
    // source found here: https://github.com/CesiumGS/cesium/blob/main/packages/engine/Source/Widget/CesiumWidget.js

    this._scene = new Scene({
      canvas: this._canvas,
      creditContainer,
      contextOptions : {
        allowTextureFilterAnisotropic : false
      }
    });
    this._scene.camera.constrainedAxis = Cartesian3.UNIT_Z;

    this.configureCameraFrustum();

    this._scene.globe = new Globe(Ellipsoid.default);
    this._scene.backgroundColor = Color.FUCHSIA;
    this._scene.debugShowFramesPerSecond = true;

    const cesiumKey = IModelApp.tileAdmin.cesiumIonKey;
    if (cesiumKey) {
      Ion.defaultAccessToken = cesiumKey;
    }

    const imageryProvider = createWorldImageryAsync({ style: IonWorldImageryStyle.AERIAL_WITH_LABELS });
    const imageryLayer = ImageryLayer.fromProviderAsync(imageryProvider);
    this._scene.imageryLayers.add(imageryLayer);

    // Create PointPrimitiveCollection for direct primitive rendering
    this._pointCollection = new PointPrimitiveCollection();
    this._scene.primitives.add(this._pointCollection);

    // Create PolylineCollection for line rendering
    this._polylineCollection = new PolylineCollection();
    this._scene.primitives.add(this._polylineCollection);

    // Create PrimitiveCollection for shape rendering
    this._primitivesCollection = new PrimitiveCollection();
    this._scene.primitives.add(this._primitivesCollection);

    this._screenSpaceEventHandler = new ScreenSpaceEventHandler(this._canvas);

    // ###TODO Temporary hardcoded gaussian splat tileset for prototyping. Uses the publicly-hosted
    // "tower" sample (KHR_gaussian_splatting + spz_2) from the CesiumGS/cesium repository.
    void this.loadGaussianSplatTileset("https://raw.githubusercontent.com/CesiumGS/cesium/1.135/Specs/Data/Cesium3DTiles/GaussianSplats/tower/tileset.json");
    // void this.loadGaussianSplatTileset(3667783);

    void this.loadVectorTileset(4854512);
    void this.loadVectorTileset(96188);

    const onRenderError = function (_scene: any, error: any) {
      const title =
        "An error occurred while rendering. Rendering has stopped.";
      // eslint-disable-next-line no-console
      console.log(title, error);
    };
    this._scene.renderError.addEventListener(onRenderError);

    IModelApp.viewManager.onBeginRender.addListener(() => {
      this.resize();
      this.placeSplatIfReady();
      this.placeVectorIfReady();

      // ###TODO figure out how to handle the need to call `initializeFrame` in Cesium.
      // That function inside Cesium has the following comment: "Destroy released shaders and textures once every 120 frames to avoid thrashing the cache"
      // That seems important.
      // this._scene.initializeFrame();

      const currentTime = this._clock.tick();
      this._scene.render(currentTime);
    });

    IModelApp.viewManager.onViewOpen.addListener((vp) => {

      vp.onViewChanged.addListener((viewport) => {

        const imodelEcef = viewport.iModel.ecefLocation;
        const cesiumCam = createCesiumCameraProps({
          viewDefinition: viewport.view.toJSON() as ViewDefinition3dProps,
          ecefLoc: imodelEcef
        });

        if (cesiumCam.frustum.fov) {
          this._scene.camera.frustum = new PerspectiveFrustum({
            fov: cesiumCam.frustum.fov,
            aspectRatio: this._canvas.width / this._canvas.height,
          });
        } else {
          this._scene.camera.frustum = new OrthographicFrustum({
            width: cesiumCam.frustum.width,
            aspectRatio: this._canvas.width / this._canvas.height,
          });
        }

        this._scene.camera.setView({
          destination: new Cartesian3(cesiumCam.position.x, cesiumCam.position.y, cesiumCam.position.z),
          orientation: {
            direction: new Cartesian3(cesiumCam.direction.x, cesiumCam.direction.y, cesiumCam.direction.z),
            up: new Cartesian3(cesiumCam.up.x, cesiumCam.up.y, cesiumCam.up.z)
          },
        });
      });
    });
  }

  private async loadGaussianSplatTileset(urlOrId: string | number): Promise<void> {
    try {
      const tileset = await (typeof urlOrId === "string" ? Cesium3DTileset.fromUrl(urlOrId) : Cesium3DTileset.fromIonAssetId(urlOrId));
      // const tileset = await Cesium3DTileset.fromIonAssetId(3667783)
      this._scene.primitives.add(tileset);
      this._splatTileset = tileset;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.log("Failed to load gaussian splat tileset", error);
    }
  }

  private async loadVectorTileset(assetId: number): Promise<void> {
    try {
      const tileset = await Cesium3DTileset.fromIonAssetId(assetId);
      this._scene.primitives.add(tileset);
      this._vectorTileset = tileset;
    } catch (error) {
      console.log(`Failed to load vector tileset ${assetId.toString(10)}`, error);
    }
  }

  // ###TODO Temporary prototype hack: relocate the splat tileset to a fixed spot in front of the
  // initial camera (which is continuously synced to the iTwin.js viewport), scaled up so it is
  // comparable in size to the test decorations (which span hundreds of km). The real tileset is a
  // ~75m tower georeferenced near Philadelphia; unscaled it would be invisible at this range.
  private placeSplatIfReady(): void {
    const tileset = this._splatTileset;
    if (!tileset || this._splatPlaced)
      return;

    /*
    const camera = this._scene.camera;
    const radius = tileset.boundingSphere.radius;
    const scale = 1; // 1000.0;
    const scaledRadius = radius * scale;
    const offset = Cartesian3.multiplyByScalar(camera.directionWC, scaledRadius * 4, new Cartesian3());
    const target = Cartesian3.add(camera.positionWC, offset, new Cartesian3());
    const center = tileset.boundingSphere.center;
    // M = T(target) * S(scale) * T(-center): scale about the bounding sphere center, then move it to target.
    const modelMatrix = Matrix4.fromTranslation(target);
    Matrix4.multiplyByUniformScale(modelMatrix, scale, modelMatrix);
    Matrix4.multiplyByTranslation(modelMatrix, Cartesian3.negate(center, new Cartesian3()), modelMatrix);
    tileset.modelMatrix = modelMatrix;
    */

    // Place it in Exton, PA
    const center = tileset.boundingSphere.center;
    const target = Cartesian3.fromDegrees(-75.686694, 40.065757, 25);
    const modelMatrix = Matrix4.fromTranslation(target);
    Matrix4.multiplyByTranslation(modelMatrix, Cartesian3.negate(center, new Cartesian3()), modelMatrix);
    tileset.modelMatrix = modelMatrix;

    this._splatPlaced = true;
    this._scene.requestRender();
  }

  private placeVectorIfReady(): void {
    const tileset = this._vectorTileset;
    if (!tileset || this._vectorPlaced) {
      return;
    }

    this._vectorPlaced = true;
    this._scene.requestRender();
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
