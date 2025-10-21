/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Code, EcefLocation, IModel, ViewDefinition3dProps } from "@itwin/core-common";
import { IModelApp, IModelConnection, SpatialViewState } from "@itwin/core-frontend";
import { Cartesian3, Clock, Color, defined, Ellipsoid, Globe, ImageryLayer, Ion, PerspectiveFrustum, PointPrimitiveCollection, PolylineCollection, PrimitiveCollection, Scene, ScreenSpaceEventHandler, ScreenSpaceEventType } from "@cesium/engine";
import { createCesiumCameraProps } from "./CesiumCamera.js";
import { Angle, YawPitchRollAngles } from "@itwin/core-geometry";

const ecefLocProps = {
  origin: [
    1255641.5519893507,
    -4732698.684827632,
    4073546.2460685894
  ],
  orientation: {
    pitch: -49.005021293968355,
    roll: -11.823580111180991,
    yaw: -90.642664633961
  },
  transform: [
    [
      -0.007357864592832313,
      0.9804561979367872,
      0.19659986204464436,
      1255641.5519893507
    ],
    [
      -0.6559516195525271,
      0.14366280316126617,
      -0.7410050416793829,
      -4732698.684827632
    ],
    [
      -0.75476707309941,
      -0.13441221267127085,
      0.6420747794842614,
      4073546.2460685894
    ]
  ],
  cartographicOrigin: {
    latitude: 0.6972007432483922,
    longitude: -1.311456937133241,
    height: 4.102413240985213
  }
};
const ecefLoc = new EcefLocation(ecefLocProps);

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

    this._scene.imageryLayers.add(ImageryLayer.fromWorldImagery({}));

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

    const onRenderError = function (_scene: any, error: any) {
      const title =
        "An error occurred while rendering.  Rendering has stopped.";
      // eslint-disable-next-line no-console
      console.log(title, error);
    };
    this._scene.renderError.addEventListener(onRenderError);

    IModelApp.viewManager.onBeginRender.addListener(() => {
      this.resize();

      // ###TODO figure out how to handle the need to call `initializeFrame` in Cesium.
      // That function inside Cesium has the following comment: "Destroy released shaders and textures once every 120 frames to avoid thrashing the cache"
      // That seems important.
      // this._scene.initializeFrame();

      const currentTime = this._clock.tick();
      this._scene.render(currentTime);
    });

    IModelApp.viewManager.onViewOpen.addListener((vp) => {

      vp.onViewChanged.addListener((viewport) => {
        const cesiumCam = createCesiumCameraProps({
          viewDefinition: viewport.view.toJSON() as ViewDefinition3dProps,
          ecefLoc
        });
        // console.log("View changed:", cesiumCam.position);

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

    // const cameraOnView = {
    //   cameraOn: true,
    //   origin: [-50.20252266797269, 56.989460084120665, -93.48021229168089],
    //   extents: [224.2601166976935, 165.04873366794442, 249.514861628184],
    //   angles: {
    //     pitch: -26.15946129868821,
    //     roll: -43.25863504612565,
    //     yaw: 25.103938995163002,
    //   },
    //   camera: {
    //     lens: 45.95389015950363,
    //     focusDist: 264.45767738020345,
    //     eye: [-37.863420740019635, -118.27234989806642, 132.40005835408053],
    //   },
    //   code: Code.createEmpty(),
    //   model: "test",
    //   classFullName: "test",
    //   categorySelectorId: "@1",
    //   displayStyleId: "@1",
    // };

    // const cesiumCameraProps = createCesiumCameraProps({ viewDefinition: cameraOnView, ecefLoc });

    // this._scene.camera.frustum = new PerspectiveFrustum({
    //   fov: cesiumCameraProps.frustum.fov,
    //   aspectRatio: canvas.width / canvas.height,
    //   near: cesiumCameraProps.frustum.near,
    //   far: cesiumCameraProps.frustum.far
    // });
    // this._scene.camera.setView({
    //   destination: new Cartesian3(cesiumCameraProps.position.x, cesiumCameraProps.position.y, cesiumCameraProps.position.z),
    //   orientation: {
    //     direction: new Cartesian3(cesiumCameraProps.direction.x, cesiumCameraProps.direction.y, cesiumCameraProps.direction.z),
    //     up: new Cartesian3(cesiumCameraProps.up.x, cesiumCameraProps.up.y, cesiumCameraProps.up.z)
    //   },
    // });

    // const vp = IModelApp.viewManager.selectedView;
    // if (vp) {
    //   const oldView = vp.view;
    //   const yawPitchRoll = new YawPitchRollAngles(
    //     Angle.createDegrees(cameraOnView.angles.yaw),
    //     Angle.createDegrees(cameraOnView.angles.pitch),
    //     Angle.createDegrees(cameraOnView.angles.roll)
    //   );

    //   const newView = SpatialViewState.createBlank(
    //     vp.iModel,
    //     {x: cameraOnView.origin[0], y: cameraOnView.origin[1], z: cameraOnView.origin[2]},
    //     {x: cameraOnView.extents[0], y: cameraOnView.extents[1], z: cameraOnView.extents[2]},
    //     yawPitchRoll.toMatrix3d()
    //   );

    //   if (newView) {
    //     // vp.applyViewState(newView);
    //     vp.changeView(newView);
    //   }

    //   // this._screenSpaceEventHandler.removeInputAction(ScreenSpaceEventType.LEFT_CLICK);
    //   // this._screenSpaceEventHandler.removeInputAction(ScreenSpaceEventType.RIGHT_CLICK);
    // }
  }
}
