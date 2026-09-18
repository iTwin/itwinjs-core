/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "vitest";
import { Angle, DeepCompare, Geometry, Matrix3d, Point3d, Range3d, Vector3d, YawPitchRollAngles } from "@itwin/core-geometry";
import {
  AmbientOcclusion, BackgroundMapType, BaseMapLayerSettings, ColorDef, HiddenLine, RenderMode, SpatialViewDefinitionProps, ViewDefinitionProps,
} from "@itwin/core-common";
import {
  AuxCoordSystemSpatialState, CategorySelectorState, DrawingModelState, DrawingViewState, IModelConnection, LookAtOrthoArgs, MarginPercent,
  ModelSelectorState, SheetModelState, SheetViewState, SpatialModelState, SpatialViewState, StandardView,
  StandardViewId, ViewState, ViewState3d, ViewStatus,
} from "@itwin/core-frontend";
import { TestRpcInterface } from "../../common/RpcInterfaces";
import { Mutable, ProcessDetector } from "@itwin/core-bentley";
import { TestUtility } from "../TestUtility";
import { TestSnapshotConnection } from "../TestSnapshotConnection";

const describeChrome = ProcessDetector.isElectronAppFrontend ? describe.skip : describe;
describeChrome("ViewState", () => {
  let imodel: IModelConnection;
  let imodel2: IModelConnection;
  let imodel3: IModelConnection;
  let viewState: SpatialViewState;
  let unitTestRpcImp: TestRpcInterface;

  beforeAll(async () => {
    await TestUtility.shutdownFrontend();
    await TestUtility.startFrontend(TestUtility.iModelAppOptions, true);
    imodel = await TestSnapshotConnection.openFile("test.bim"); // relative path resolved by BackendTestAssetResolver
    const viewRows: ViewDefinitionProps[] = await imodel.views.queryProps({ from: SpatialViewState.classFullName });
    expect(viewRows).toEqual(expect.anything());
    viewState = await imodel.views.load(viewRows[0].id!) as SpatialViewState;

    imodel2 = await TestSnapshotConnection.openFile("CompatibilityTestSeed.bim"); // relative path resolved by BackendTestAssetResolver
    imodel3 = await TestSnapshotConnection.openFile("ReadWriteTest.bim");

    unitTestRpcImp = TestRpcInterface.getClient();
  });

  afterAll(async () => {
    await imodel?.close();
    await imodel2?.close();
    await imodel3?.close();
    await TestUtility.shutdownFrontend();
  });

  const compareView = (v1: SpatialViewState, v2: SpatialViewDefinitionProps, str: string) => {
    const compare = new DeepCompare();
    const v2State = new SpatialViewState(v2, v1.iModel, v1.categorySelector, v1.displayStyle, v1.modelSelector);
    const v1State = new SpatialViewState(v1.toJSON(), v1.iModel, v1.categorySelector, v1.displayStyle, v1.modelSelector);

    const val = compare.compare(JSON.parse(JSON.stringify(v1State)), JSON.parse(JSON.stringify(v2State)));
    if (!val)
      expect(compare.errorTracker, str).toBeUndefined();
    expect(val).toBe(true);
  };

  it("should be able to create ViewState from SpatialViewDefinition", async () => {
    expect(viewState.code.value, "Code value is A Views - View 1").toBe("A Views - View 1");
    expect(viewState.displayStyle.id, "Display Style Id is 0x36").toBe("0x36");
    expect(viewState.categorySelector.id, "Category Id is 0x37").toBe("0x37");
    expect(viewState.isCameraOn).toBe(false);
    expect(viewState.extents.isAlmostEqual(new Vector3d(429.6229727570776, 232.24786876266097, 0.1017680889917761))).toBe(true);
    expect(viewState.origin.isAlmostEqual(new Point3d(-87.73958171815832, -108.96514044887601, -0.0853709702222105))).toBe(true);
    expect(viewState.rotation.isIdentity).toBe(true);
    expect(viewState.details.gridOrientation, "Grid orientation as expected").toBe(0);
    expect(viewState.details.gridSpacing.x, "GridSpaceX as expected").toBe(0.001);

    expect(viewState.displayStyle).toBeDefined();
    expect(viewState.categorySelector).toBeInstanceOf(CategorySelectorState);
    expect(viewState.categorySelector.categories.size).toBe(4);
    expect(viewState.modelSelector).toBeInstanceOf(ModelSelectorState);
    expect(viewState.modelSelector.models.size).toBe(5);
    expect(viewState.origin.isAlmostEqual(new Point3d(-87.73958171815832, -108.96514044887601, -0.0853709702222105))).toBe(true);

    const v2 = viewState.clone();
    compareView(viewState, v2.toJSON(), "v2 clone");

    expect(v2.origin).not.toBe(viewState.origin); // make sure we're really looking at a copy
    expect(v2.extents).not.toBe(viewState.extents);
    expect(v2.camera).not.toBe(viewState.camera);
    expect(v2.jsonProperties).not.toBe(viewState.jsonProperties);
    expect(v2.rotation).not.toBe(viewState.rotation);
    const stat = v2.lookAt({ eyePoint: new Point3d(1, 2, 3), targetPoint: new Point3d(100, 100, 100), upVector: new Vector3d(0, 1, 0) });
    expect(stat).toBe(ViewStatus.Success);
    expect(v2).not.toEqual(viewState);

    const acs = v2.createAuxCoordSystem("test");
    expect(acs).toBeInstanceOf(AuxCoordSystemSpatialState);
    acs.setOrigin({ x: 1, y: 1 });
    expect(acs.getOrigin().isExactEqual({ x: 1, y: 1, z: 0 })).toBe(true);
    acs.setRotation(StandardView.iso);
    expect(acs.getRotation().isExactEqual(StandardView.iso)).toBe(true);
  });

  it("should be able to propagate viewFlags and displayStyle changes when cloning ViewState", async () => {
    const vs0 = viewState.clone();

    expect(vs0.is3d()).toBe(true);

    // query and change various viewFlags and displayStyle settings and ensure the changes propagate when cloning the state

    const vf = vs0.viewFlags;
    vs0.viewFlags = vf.copy({
      acsTriad: !vf.acsTriad,
      ambientOcclusion: !vf.ambientOcclusion,
      backgroundMap: !vf.backgroundMap,
      lighting: !vf.lighting,
      clipVolume: !vf.clipVolume,
      constructions: !vf.constructions,
      dimensions: !vf.dimensions,
      fill: !vf.fill,
      grid: !vf.grid,
      hiddenEdges: !vf.hiddenEdges,
      materials: !vf.materials,
      monochrome: !vf.monochrome,
      patterns: !vf.patterns,
      renderMode: vf.renderMode === RenderMode.HiddenLine ? RenderMode.SmoothShade : RenderMode.HiddenLine,
      shadows: !vf.shadows,
      styles: !vf.styles,
      textures: !vf.textures,
      transparency: !vf.transparency,
      visibleEdges: !vf.visibleEdges,
      weights: !vf.weights,
    });

    const vs0DisplayStyle3d = (vs0 as ViewState3d).getDisplayStyle3d();

    const oldAOSettings = vs0DisplayStyle3d.settings.ambientOcclusionSettings;
    const vs0AOSettings = AmbientOcclusion.Settings.fromJSON({
      bias: oldAOSettings.bias / 2.0,
      zLengthCap: oldAOSettings.zLengthCap / 2.0,
      intensity: oldAOSettings.intensity / 2.0,
      texelStepSize: oldAOSettings.texelStepSize / 2.0,
      blurDelta: oldAOSettings.blurDelta / 2.0,
      blurSigma: oldAOSettings.blurSigma / 2.0,
      blurTexelStepSize: oldAOSettings.blurTexelStepSize / 2.0,
    });
    vs0DisplayStyle3d.settings.ambientOcclusionSettings = vs0AOSettings;

    const vs0BackgroundColor = ColorDef.from(32, 1, 99);
    vs0DisplayStyle3d.backgroundColor = vs0BackgroundColor;

    const oldBackgroundMap = vs0DisplayStyle3d.settings.backgroundMap.toPersistentJSON();
    if (undefined !== oldBackgroundMap) {
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      const mt = oldBackgroundMap.providerData?.mapType === BackgroundMapType.Aerial ? BackgroundMapType.Hybrid : BackgroundMapType.Hybrid;
      vs0DisplayStyle3d.changeBackgroundMapProvider({
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        name: oldBackgroundMap.providerName === "BingProvider" ? "MapBoxProvider" : "BingProvider",
        type: mt,
      });
      vs0DisplayStyle3d.changeBackgroundMapProps({ useDepthBuffer: !oldBackgroundMap.useDepthBuffer });
    } else {
      vs0DisplayStyle3d.changeBackgroundMapProvider({
        name: "BingProvider",
        type: BackgroundMapType.Aerial,
      });
      vs0DisplayStyle3d.changeBackgroundMapProps({ useDepthBuffer: true });
    }
    const vs0BackgroundMap = vs0DisplayStyle3d.settings.backgroundMap;

    const oldHLSettings = vs0DisplayStyle3d.settings.hiddenLineSettings.toJSON();
    vs0DisplayStyle3d.settings.hiddenLineSettings = HiddenLine.Settings.fromJSON({
      transThreshold: oldHLSettings.transThreshold !== undefined && oldHLSettings.transThreshold > 0.0 ? 0.0 : 0.2,
    });
    const vs0HLSettings = vs0DisplayStyle3d.settings.hiddenLineSettings;

    const vs0MonochromeColor = ColorDef.from(32, 1, 99);
    vs0DisplayStyle3d.settings.monochromeColor = vs0MonochromeColor;

    // clone the state and check if the changes persisted

    const vs1 = vs0.clone();
    const vs1DisplayStyle3d = (vs1 as ViewState3d).getDisplayStyle3d();

    const vs1AOSettings = vs1DisplayStyle3d.settings.ambientOcclusionSettings;
    const vs1BackgroundColor = vs1DisplayStyle3d.settings.backgroundColor;
    const vs1BackgroundMap = vs1DisplayStyle3d.settings.backgroundMap;
    const vs1HLSettings = vs1DisplayStyle3d.settings.hiddenLineSettings;
    const vs1MonochromeColor = vs1DisplayStyle3d.settings.monochromeColor;

    expect(vs0.viewFlags.acsTriad, "clone should copy viewFlags.acsTriad").toBe(vs1.viewFlags.acsTriad);
    expect(vs0.viewFlags.ambientOcclusion, "clone should copy viewFlags.ambientOcclusion").toBe(vs1.viewFlags.ambientOcclusion);
    expect(vs0.viewFlags.backgroundMap, "clone should copy viewFlags.backgroundMap").toBe(vs1.viewFlags.backgroundMap);
    expect(vs0.viewFlags.lighting).toBe(vs1.viewFlags.lighting);
    expect(vs0.viewFlags.clipVolume, "clone should copy viewFlags.clipVolume").toBe(vs1.viewFlags.clipVolume);
    expect(vs0.viewFlags.constructions, "clone should copy viewFlags.constructions").toBe(vs1.viewFlags.constructions);
    expect(vs0.viewFlags.dimensions, "clone should copy viewFlags.dimensions").toBe(vs1.viewFlags.dimensions);
    // This flag is hidden - expect(vs0.viewFlags.edgeMask, "clone should copy viewFlags.edgeMask").toBe(vs1.viewFlags.edgeMask); //
    expect(vs0.viewFlags.fill, "clone should copy viewFlags.fill").toBe(vs1.viewFlags.fill);
    expect(vs0.viewFlags.grid, "clone should copy viewFlags.grid").toBe(vs1.viewFlags.grid);
    expect(vs0.viewFlags.hiddenEdges, "clone should copy viewFlags.hiddenEdges").toBe(vs1.viewFlags.hiddenEdges);
    expect(vs0.viewFlags.materials, "clone should copy viewFlags.materials").toBe(vs1.viewFlags.materials);
    expect(vs0.viewFlags.monochrome, "clone should copy viewFlags.monochrome").toBe(vs1.viewFlags.monochrome);
    // This flag test will fail because the backend doesn't do anything with it - expect(vs0.viewFlags.noGeometryMap, "clone should copy viewFlags.noGeometryMap").toBe(vs1.viewFlags.noGeometryMap);
    expect(vs0.viewFlags.patterns, "clone should copy viewFlags.patterns").toBe(vs1.viewFlags.patterns);
    expect(vs0.viewFlags.renderMode, "clone should copy viewFlags.renderMode").toBe(vs1.viewFlags.renderMode);
    expect(vs0.viewFlags.shadows, "clone should copy viewFlags.shadows").toBe(vs1.viewFlags.shadows);
    expect(vs0.viewFlags.styles, "clone should copy viewFlags.styles").toBe(vs1.viewFlags.styles);
    expect(vs0.viewFlags.textures, "clone should copy viewFlags.textures").toBe(vs1.viewFlags.textures);
    expect(vs0.viewFlags.transparency, "clone should copy viewFlags.transparency").toBe(vs1.viewFlags.transparency);
    expect(vs0.viewFlags.visibleEdges, "clone should copy viewFlags.visibleEdges").toBe(vs1.viewFlags.visibleEdges);
    expect(vs0.viewFlags.weights, "clone should copy viewFlags.weights").toBe(vs1.viewFlags.weights);
    expect(vs0AOSettings.bias, "clone should copy displayStyle.ambientOcclusionSettings.bias").toBe(vs1AOSettings.bias);
    expect(vs0AOSettings.zLengthCap, "clone should copy displayStyle.ambientOcclusionSettings.zLengthCap").toBe(vs1AOSettings.zLengthCap);
    expect(vs0AOSettings.intensity, "clone should copy displayStyle.ambientOcclusionSettings.intensity").toBe(vs1AOSettings.intensity);
    expect(vs0AOSettings.texelStepSize, "clone should copy displayStyle.ambientOcclusionSettings.texelStepSize").toBe(vs1AOSettings.texelStepSize);
    expect(vs0AOSettings.blurDelta, "clone should copy displayStyle.ambientOcclusionSettings.blurDelta").toBe(vs1AOSettings.blurDelta);
    expect(vs0AOSettings.blurSigma, "clone should copy displayStyle.ambientOcclusionSettings.blurSigma").toBe(vs1AOSettings.blurSigma);
    expect(vs0AOSettings.blurTexelStepSize, "clone should copy displayStyle.ambientOcclusionSettings.blurTexelStepSize").toBe(vs1AOSettings.blurTexelStepSize);
    expect(vs0BackgroundColor.equals(vs1BackgroundColor)).toBe(true);

    const vs0BackgroundBase = vs0.displayStyle.settings.mapImagery.backgroundBase as BaseMapLayerSettings;
    expect(vs0BackgroundBase).toBeInstanceOf(BaseMapLayerSettings);
    const vs1BackgroundBase = vs1.displayStyle.settings.mapImagery.backgroundBase as BaseMapLayerSettings;
    expect(vs1BackgroundBase).toBeInstanceOf(BaseMapLayerSettings);

    expect(vs0BackgroundBase.provider).not.toBeUndefined();
    expect(vs1BackgroundBase.provider!.equals(vs0BackgroundBase.provider!)).toBe(true);

    expect(vs0BackgroundMap.useDepthBuffer).not.toBe(oldBackgroundMap?.useDepthBuffer ?? false);
    expect(vs1BackgroundMap.useDepthBuffer).toBe(vs0BackgroundMap.useDepthBuffer);

    expect(vs0HLSettings.transparencyThreshold, "clone should copy displayStyle.hiddenLineSettings.transparencyThreshold").toBe(vs1HLSettings.transparencyThreshold);
    expect(vs0MonochromeColor.equals(vs1MonochromeColor)).toBe(true);
  });

  it("view volume adjustments", async () => {
    const testParams: any = {
      margin: new MarginPercent(0, 0, 0, 0),
      aspectRatio: 1,
      view: viewState,
      volume: Range3d.createXYZXYZ(10, 20, 0.5, 35, 21, 2),
    };

    viewState.setOrigin(Point3d.create(-5, -5, 0));
    viewState.setExtents(Vector3d.create(10, 10, 1));
    viewState.setRotation(Matrix3d.createIdentity());
    viewState.setLensAngle(Angle.createDegrees(50));
    viewState.setFocusDistance(49);
    viewState.setEyePoint(Point3d.create(5, 5, 50));

    let cppView: SpatialViewDefinitionProps = await unitTestRpcImp.executeTest(imodel.getRpcProps(), "lookAtVolume", testParams);
    viewState.lookAtVolume(testParams.volume, testParams.aspectRatio, { marginPercent: testParams.margin });
    compareView(viewState, cppView, "LookAtVolume 1");

    // LookAtVolume test #3
    viewState.setOrigin(Point3d.create(100, 1000, -2));
    viewState.setExtents(Vector3d.create(314, 1, -.00001));
    viewState.setRotation(YawPitchRollAngles.createDegrees(25, 25, 0.1).toMatrix3d());
    viewState.setLensAngle(Angle.createDegrees(108));
    viewState.setFocusDistance(89);
    viewState.setEyePoint(Point3d.create(1, 1000, 2));
    testParams.volume = Range3d.createXYZXYZ(1000, -10, 6, -5, 0, 0);
    testParams.margin = new MarginPercent(.01, .02, .03, .04);
    testParams.aspectRatio = 1.2;
    cppView = await unitTestRpcImp.executeTest(imodel.getRpcProps(), "lookAtVolume", testParams);
    viewState.lookAtVolume(testParams.volume, testParams.aspectRatio, { marginPercent: testParams.margin });
    compareView(viewState, cppView, "LookAtVolume 3");

    // LookAtVolume test #2
    viewState.setOrigin(Point3d.create(100, 1000, -2));
    viewState.setExtents(Vector3d.create(314, 1, -.00001));
    viewState.setStandardRotation(StandardViewId.RightIso);
    viewState.setLensAngle(Angle.createDegrees(72));
    viewState.setFocusDistance(100);
    viewState.setEyePoint(Point3d.create(1, 100, 2));
    testParams.volume = Range3d.createXYZXYZ(10, 20, 0.5, 35, 21, 2);
    testParams.aspectRatio = 1.0;
    testParams.margin = new MarginPercent(0, 0, 0, 0);
    cppView = await unitTestRpcImp.executeTest(imodel.getRpcProps(), "lookAtVolume", testParams);
    viewState.lookAtVolume(testParams.volume, testParams.aspectRatio, { marginPercent: testParams.margin });
    compareView(viewState, cppView, "LookAtVolume 2");

    expect(viewState.getOrigin().isAlmostEqual({ x: 15.16944341639925, y: 14.830556583600767, z: -10.838886832798472 })).toBe(true);
    expect(viewState.getExtents().isAlmostEqual({ x: 18.384776310850253, y: 18.384776310850253, z: 15.877132402714713 })).toBe(true);
    viewState.adjustAspectRatio(2);
    expect(viewState.getOrigin().isAlmostEqual({ x: 8.66944341639924, y: 8.33055658360076, z: -10.838886832798472 })).toBe(true);
    expect(viewState.getExtents().isAlmostEqual({ x: 36.769552621700505, y: 18.384776310850253, z: 15.877132402714713 })).toBe(true);
  });

  // Changes were made in TypeScript to the near/far plane adjustment. The native code hasn't been adjusted to match.
  function compareToCppView(tsView: SpatialViewState, cppView: SpatialViewDefinitionProps, expectedZExtent: number, name: string): void {
    const expectAlmostEqual = (a: number, b: number, tolerance?: number) => {
      if (undefined === tolerance)
        tolerance = Geometry.smallMetricDistance;

      expect(Math.abs(a - b)).most(tolerance);
    };

    expectAlmostEqual(tsView.extents.z, expectedZExtent);

    const cppOrigin = Point3d.fromJSON(cppView.origin);
    expectAlmostEqual(tsView.origin.x, cppOrigin.x, 0.5);
    expectAlmostEqual(tsView.origin.y, cppOrigin.y, 0.4);
    expectAlmostEqual(tsView.origin.z, cppOrigin.z, 0.4);

    const zExtent = tsView.extents.z;
    const origin = tsView.origin.clone();

    const cppExtents = Point3d.fromJSON(cppView.extents);
    tsView.extents.z = cppExtents.z;
    cppOrigin.clone(tsView.origin);
    compareView(tsView, cppView, name);

    tsView.extents.z = zExtent;
    origin.clone(tsView.origin);
  }

  it("rotateCameraLocal should work", async () => {
    const testParams: any = {
      view: viewState,
      angle: 1.28,
      axis: Vector3d.create(2, 5, 7),
      about: undefined,
    };

    viewState.setOrigin(Point3d.create(-5, -5, 0));
    viewState.setExtents(Vector3d.create(10, 10, 1));
    viewState.setRotation(Matrix3d.createIdentity());
    viewState.setLensAngle(Angle.createDegrees(50));
    viewState.setFocusDistance(49);
    viewState.setEyePoint(Point3d.create(5, 5, 50));
    const cppView: SpatialViewDefinitionProps = await unitTestRpcImp.executeTest(imodel.getRpcProps(), "rotateCameraLocal", testParams);
    viewState.rotateCameraLocal(Angle.createRadians(testParams.angle), testParams.axis, testParams.about);
    compareToCppView(viewState, cppView, 49.5035, "RotateCameraLocal 1");
  });

  it("lookAtUsingLensAngle should work", async () => {
    const testParams: any = {
      view: viewState,
      eye: Point3d.create(8, 6, 7),
      target: Point3d.create(100, -67, 5),
      up: Vector3d.create(1.001, 2.200, -3.999),
      lens: Angle.createDegrees(27.897),
      front: 100.89,
      back: 101.23,
    };

    viewState.setOrigin(Point3d.create(100, 23, -18));
    viewState.setExtents(Vector3d.create(55, 40.01, 23));
    viewState.setRotation(YawPitchRollAngles.createDegrees(23, 65, 2).toMatrix3d());
    viewState.setLensAngle(Angle.createDegrees(65));
    viewState.setFocusDistance(191);
    viewState.setEyePoint(Point3d.create(-64, 120, 500));
    const cppView: SpatialViewDefinitionProps = await unitTestRpcImp.executeTest(imodel.getRpcProps(), "lookAtUsingLensAngle", testParams);
    viewState.lookAt({ eyePoint: testParams.eye, targetPoint: testParams.target, upVector: testParams.up, lensAngle: testParams.lens, frontDistance: testParams.front, backDistance: testParams.back });
    compareToCppView(viewState, cppView, 116.961632, "lookAtUsingLensAngle");

    // changing the focus distance shouldn't change the viewing frustum
    const oldFrust = viewState.calculateFrustum()!;
    viewState.changeFocusDistance(200);
    expect(oldFrust.isSame(viewState.calculateFrustum()!)).toBe(true);
    expect(200).toBe(viewState.camera.focusDist);
  });

  it("lookAt should work", async () => {
    const testParams: any = {
      view: viewState,
      eye: Point3d.create(8, 6, 7),
      target: Point3d.create(100, -67, 5),
      up: Vector3d.create(1.001, 2.200, -3.999),
      lens: Angle.createDegrees(27.897),
      front: 100.89,
      back: 101.23,
    };

    viewState.setOrigin(Point3d.create(100, 23, -18));
    viewState.setExtents(Vector3d.create(55, 40.01, 23));
    viewState.setRotation(YawPitchRollAngles.createDegrees(23, 65, 2).toMatrix3d());
    viewState.setLensAngle(Angle.createDegrees(65));
    viewState.setFocusDistance(117.46063170271135);
    viewState.setEyePoint(Point3d.create(-64, 120, 500));
    const viewState2 = viewState.clone();
    const viewState3 = viewState.clone();
    viewState.lookAt({ eyePoint: testParams.eye, targetPoint: testParams.target, upVector: testParams.up, lensAngle: testParams.lens, frontDistance: testParams.front, backDistance: testParams.back });
    const extents = viewState.getExtents();

    const perspectiveArgs = {
      eyePoint: testParams.eye,
      targetPoint: testParams.target,
      upVector: testParams.up,
      newExtents: extents,
      frontDistance: testParams.front,
      backDistance: testParams.back,
    };
    let status = viewState2.lookAt(perspectiveArgs);
    expect(ViewStatus.Success === status, "lookAt should return status of Success").toBe(true);
    expect(viewState2.isCameraOn, "Camera should be on").toBe(true);
    compareView(viewState, viewState2.toJSON(), "lookAt");

    perspectiveArgs.upVector = Vector3d.createZero();
    status = viewState2.lookAt(perspectiveArgs);
    expect(ViewStatus.InvalidUpVector === status, "lookAt should return status of InvalidUpVector").toBe(true);
    perspectiveArgs.upVector = testParams.up;

    viewState2.setAllow3dManipulations(false);
    status = viewState2.lookAt(perspectiveArgs);
    expect(ViewStatus.NotCameraView === status, "lookAt should return status of NotCameraView").toBe(true);
    viewState2.setAllow3dManipulations(true);

    perspectiveArgs.targetPoint = testParams.eye;
    status = viewState2.lookAt(perspectiveArgs);
    expect(ViewStatus.InvalidTargetPoint === status, "lookAt should return status of InvalidTargetPoint").toBe(true);
    perspectiveArgs.targetPoint = testParams.target;

    const viewDirection = Vector3d.createStartEnd(testParams.eye, testParams.target);
    const orthoArgs: Mutable<LookAtOrthoArgs> = {
      eyePoint: testParams.eye,
      viewDirection,
      newExtents: extents,
      upVector: testParams.up,
      frontDistance: testParams.front,
      backDistance: testParams.back,
    };
    status = viewState3.lookAt(orthoArgs);
    expect(ViewStatus.Success === status, "lookAt should return status of Success").toBe(true);
    expect(viewState3.isCameraOn, "Camera should not be on").toBe(false);

    viewState.turnCameraOff();
    compareView(viewState, viewState3.toJSON(), "lookAt");

    orthoArgs.viewDirection = Vector3d.createZero();
    status = viewState3.lookAt(orthoArgs);
    expect(ViewStatus.InvalidDirection === status, "lookAt should return status of InvalidDirection").toBe(true);
    orthoArgs.viewDirection = viewDirection;
  });

  it("should ignore 2d models in model selector", async () => {
    const view = await imodel2.views.load("0x46") as SpatialViewState;
    expect(view).not.toBeUndefined();
    expect(view).toBeInstanceOf(SpatialViewState);

    const numSpatialModels = view.modelSelector.models.size;
    expect(numSpatialModels).toBeGreaterThan(0);

    // Add 2d models to selector
    view.modelSelector.addModels(["0x24", "0x28"]);
    await imodel2.models.load(view.modelSelector.models);
    expect(imodel2.models.loaded.get("0x24")).toBeInstanceOf(DrawingModelState);
    expect(imodel2.models.loaded.get("0x28")).toBeInstanceOf(SheetModelState);
    expect(view.modelSelector.models.size).toBe(numSpatialModels + 2);

    let numModelsVisited = 0;
    view.forEachModel((model) => {
      expect(model).toBeInstanceOf(SpatialModelState);
      ++numModelsVisited;
    });

    expect(numModelsVisited).toBe(numSpatialModels);
  });

  it("should enforce extent limits", async () => {
    const view = await imodel2.views.load("0x46") as SpatialViewState;
    const defaultLimits = view.defaultExtentLimits;
    expect(view.extentLimits.min).toBe(defaultLimits.min);
    expect(view.extentLimits.max).toBe(defaultLimits.max);

    const origin = new Point3d(0, 0, 0);
    const rot = Matrix3d.identity;
    // Default limits are accepted
    const delta = new Vector3d(defaultLimits.min, defaultLimits.min, defaultLimits.min);
    expect(view.adjustViewDelta(delta, origin, rot)).toBe(ViewStatus.Success);
    delta.set(defaultLimits.max, defaultLimits.max, defaultLimits.max);
    expect(view.adjustViewDelta(delta, origin, rot)).toBe(ViewStatus.Success);
    delta.scale(0.5, delta);
    expect(view.adjustViewDelta(delta, origin, rot)).toBe(ViewStatus.Success);

    // Outside default limits rejected
    delta.scale(5.0, delta);
    expect(view.adjustViewDelta(delta, origin, rot)).toBe(ViewStatus.MaxWindow);
    delta.scale(0.0, delta);
    expect(view.adjustViewDelta(delta, origin, rot)).toBe(ViewStatus.MinWindow);

    // Override default limits
    view.extentLimits = { min: 20, max: 100 };
    expect(view.extentLimits.min).toBe(20);
    expect(view.extentLimits.max).toBe(100);
    delta.set(20, 20, 20);
    expect(view.adjustViewDelta(delta, origin, rot)).toBe(ViewStatus.Success);
    delta.set(100, 100, 100);
    expect(view.adjustViewDelta(delta, origin, rot)).toBe(ViewStatus.Success);
    delta.set(10, 10, 10);
    expect(view.adjustViewDelta(delta, origin, rot)).toBe(ViewStatus.MinWindow);
    delta.set(110, 110, 110);
    expect(view.adjustViewDelta(delta, origin, rot)).toBe(ViewStatus.MaxWindow);

    delta.set(0, 21, 50);
    expect(view.adjustViewDelta(delta, origin, rot, 2)).toBe(ViewStatus.MinWindow);
    expect(delta.isAlmostEqual({ x: 42, y: 21, z: 50 })).toBe(true);

    delta.set(0, 0, 50);
    expect(view.adjustViewDelta(delta, origin, rot, .5)).toBe(ViewStatus.MinWindow);
    expect(delta.isAlmostEqual({ x: 20, y: 40, z: 50 })).toBe(true);

    // Cloning preserved extent overrides
    const view2 = view.clone();
    expect(view2.extentLimits.min).toBe(view.extentLimits.min);
    expect(view2.extentLimits.max).toBe(view.extentLimits.max);

    // Can reset default extent limits
    view.resetExtentLimits();
    expect(view.extentLimits.min).toBe(defaultLimits.min);
    expect(view.extentLimits.max).toBe(defaultLimits.max);
    expect(view2.extentLimits.min).not.toBe(view.extentLimits.min);
    expect(view2.extentLimits.max).not.toBe(view.extentLimits.max);
  });

  it("should preserve 3d manipulations flag", async () => {
    const view = await imodel2.views.load("0x46") as SpatialViewState;
    expect(view.allow3dManipulations()).toBe(true);

    view.setAllow3dManipulations(true);
    expect(view.allow3dManipulations()).toBe(true);
    expect(view.details.allow3dManipulations).toBe(true);
    expect(view.details.getJSON().disable3dManipulations).toBeUndefined();

    view.setAllow3dManipulations(false);
    expect(view.allow3dManipulations()).toBe(false);
    expect(view.details.getJSON().disable3dManipulations).toBe(true);

    const clone = view.clone();
    expect(clone.allow3dManipulations()).toBe(false);

    const fromJSON = new SpatialViewState(view.toJSON(), view.iModel, view.categorySelector, view.getDisplayStyle3d(), view.modelSelector);
    expect(fromJSON.allow3dManipulations()).toBe(false);
  });

  it("detects if two views share a coordinate system", async () => {
    function expectCompatibility(view1: ViewState, view2: ViewState, expectCompatible: boolean): void {
      expect(view1.hasSameCoordinates(view1)).toBe(true);
      expect(view2.hasSameCoordinates(view2)).toBe(true);
      expect(view1.hasSameCoordinates(view1.clone())).toBe(true);
      expect(view2.hasSameCoordinates(view2.clone())).toBe(true);
      expect(view1.hasSameCoordinates(view2)).toBe(expectCompatible);
      expect(view2.hasSameCoordinates(view1)).toBe(expectCompatible);
    }

    const sheet = await imodel3.views.load("0x1000000002e");
    const drawing = await imodel3.views.load("0x10000000020") as DrawingViewState;
    const spatial = viewState.clone();
    const spatialNoModels = viewState.clone();
    spatialNoModels.modelSelector.models.clear();
    const spatialOtherIModel = await imodel2.views.load("0x46") as SpatialViewState;

    expectCompatibility(sheet, drawing, false);
    expectCompatibility(sheet, spatial, false);
    expectCompatibility(drawing, spatial, false);
    expectCompatibility(spatial, spatialNoModels, true);
    expectCompatibility(spatial, spatialOtherIModel, false);

    spatialOtherIModel.modelSelector.models.clear();
    expectCompatibility(spatial, spatialOtherIModel, false);

    spatialOtherIModel.modelSelector.models = spatial.modelSelector.models;
    expectCompatibility(spatial, spatialOtherIModel, false);

    spatial.modelSelector.models.add(drawing.baseModelId);
    expectCompatibility(spatial, drawing, false);

    const blank = SpatialViewState.createBlank(imodel3, new Point3d(0, 0, 0), new Point3d(1, 1, 1));
    blank.modelSelector.models.add(drawing.baseModelId);
    expectCompatibility(blank, drawing, false);
  });
});

describeChrome("ViewState2d", () => {
  let imodel: IModelConnection;

  beforeAll(async () => {
    await TestUtility.startFrontend(undefined, true);
    imodel = await TestSnapshotConnection.openFile("ReadWriteTest.bim");
  });

  afterAll(async () => {
    if (imodel)
      await imodel.close();

    await TestUtility.shutdownFrontend();
  });

  it("should have valid viewed extents", async () => {
    const sheetView = await imodel.views.load("0x1000000002e") as SheetViewState;
    expect(sheetView).toBeInstanceOf(SheetViewState);
    const sheetViewExtents = sheetView.getViewedExtents();
    expect(sheetViewExtents.isNull).toBe(false);

    // The sheet's viewed extents are based on the *sheet size* property, not the model range.
    // In this case, somebody scribbled outside of the sheet boundaries.
    const sheetModelExtents = Range3d.fromJSON((await imodel.models.queryModelRanges(sheetView.baseModelId))[0]);
    expect(sheetViewExtents.containsRange(sheetModelExtents)).toBe(false);

    const drawingView = await imodel.views.load("0x10000000020") as DrawingViewState;
    expect(drawingView).toBeInstanceOf(DrawingViewState);
    const drawingViewExtents = drawingView.getViewedExtents();
    expect(drawingViewExtents.isNull).toBe(false);

    const drawingModelExtents = Range3d.fromJSON((await imodel.models.queryModelRanges(drawingView.baseModelId))[0]);
    expect(drawingModelExtents.isAlmostEqual(drawingViewExtents)).toBe(true);
  });
});
