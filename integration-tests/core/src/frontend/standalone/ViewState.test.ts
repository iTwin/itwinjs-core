/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { assert, expect } from "chai";
import { Point3d, Vector3d, YawPitchRollAngles, Range3d, Angle, Matrix3d, DeepCompare } from "@bentley/geometry-core";
import { AmbientOcclusion, BackgroundMapType, ColorDef, HiddenLine, RenderMode, SpatialViewDefinitionProps, ViewDefinitionProps } from "@bentley/imodeljs-common";
import * as path from "path";
import {
  AuxCoordSystemSpatialState,
  CategorySelectorState,
  DisplayStyle3dState,
  DrawingModelState,
  IModelConnection,
  MarginPercent,
  MockRender,
  ModelSelectorState,
  SheetModelState,
  SpatialModelState,
  SpatialViewState,
  StandardView,
  StandardViewId,
  SubCategoriesCache,
  ViewState3d,
  ViewStatus,
} from "@bentley/imodeljs-frontend";
import { TestRpcInterface } from "../../common/RpcInterfaces";

const iModelLocation = path.join(process.env.IMODELJS_CORE_DIRNAME!, "core/backend/lib/test/assets/test.bim");
const iModelLocation2 = path.join(process.env.IMODELJS_CORE_DIRNAME!, "core/backend/lib/test/assets/CompatibilityTestSeed.bim");

describe("ViewState", () => {
  let imodel: IModelConnection;
  let imodel2: IModelConnection;
  let viewState: SpatialViewState;
  let unitTestRpcImp: TestRpcInterface;

  before(async () => {
    MockRender.App.startup();
    imodel = await IModelConnection.openSnapshot(iModelLocation);
    const viewRows: ViewDefinitionProps[] = await imodel.views.queryProps({ from: SpatialViewState.sqlName });
    assert.exists(viewRows, "Should find some views");
    viewState = await imodel.views.load(viewRows[0].id!) as SpatialViewState;

    imodel2 = await IModelConnection.openSnapshot(iModelLocation2);

    unitTestRpcImp = TestRpcInterface.getClient();
  });

  after(async () => {
    if (imodel) await imodel.closeSnapshot();
    if (imodel2) await imodel2.closeSnapshot();
    MockRender.App.shutdown();
  });

  const compareView = (v1: SpatialViewState, v2: SpatialViewDefinitionProps, str: string) => {
    const compare = new DeepCompare();
    const v2State = new SpatialViewState(v2, v1.iModel, v1.categorySelector, v1.displayStyle as DisplayStyle3dState, v1.modelSelector);

    const val = compare.compare(JSON.parse(JSON.stringify(v1)), JSON.parse(JSON.stringify(v2State)));
    if (!val)
      assert.isUndefined(compare.errorTracker, str);
    assert.isTrue(val, str);
  };

  it("should be able to create ViewState from SpatialViewDefinition", async () => {
    assert.equal(viewState.code.value, "A Views - View 1", "Code value is A Views - View 1");
    assert.equal(viewState.displayStyle.id, "0x36", "Display Style Id is 0x36");
    assert.equal(viewState.categorySelector.id, "0x37", "Category Id is 0x37");
    assert.isFalse(viewState.isCameraOn, "The camera is not turned on");
    assert.isTrue(viewState.extents.isAlmostEqual(new Vector3d(429.6229727570776, 232.24786876266097, 0.1017680889917761)), "View extents as expected");
    assert.isTrue(viewState.origin.isAlmostEqual(new Point3d(-87.73958171815832, -108.96514044887601, -0.0853709702222105)), "View origin as expected");
    assert.isTrue(viewState.rotation.isIdentity, "View rotation is identity");
    assert.equal(viewState.jsonProperties.viewDetails.gridOrient, 0, "Grid orientation as expected");
    assert.equal(viewState.jsonProperties.viewDetails.gridSpaceX, 0.001, "GridSpaceX as expected");

    assert.isDefined(viewState.displayStyle);
    assert.instanceOf(viewState.categorySelector, CategorySelectorState);
    assert.equal(viewState.categorySelector.categories.size, 4);
    assert.instanceOf(viewState.modelSelector, ModelSelectorState);
    assert.equal(viewState.modelSelector.models.size, 5);
    assert.isTrue(viewState.origin.isAlmostEqual(new Point3d(-87.73958171815832, -108.96514044887601, -0.0853709702222105)), "View origin as expected");

    const v2 = viewState.clone();
    compareView(viewState, v2.toJSON(), "v2 clone");

    assert.notEqual(v2.origin, viewState.origin); // make sure we're really looking at a copy
    assert.notEqual(v2.extents, viewState.extents);
    assert.notEqual(v2.camera, viewState.camera);
    assert.notEqual(v2.jsonProperties, viewState.jsonProperties);
    assert.notEqual(v2.rotation, viewState.rotation);
    const stat = v2.lookAt(new Point3d(1, 2, 3), new Point3d(100, 100, 100), new Vector3d(0, 1, 0));
    assert.equal(stat, ViewStatus.Success);
    assert.notDeepEqual(v2, viewState);

    const acs = v2.createAuxCoordSystem("test");
    assert.equal(acs.code.value, "test");
    assert.instanceOf(acs, AuxCoordSystemSpatialState);
    acs.setOrigin({ x: 1, y: 1 });
    assert.isTrue(acs.getOrigin().isExactEqual({ x: 1, y: 1, z: 0 }));
    acs.setRotation(StandardView.iso);
    assert.isTrue(acs.getRotation().isExactEqual(StandardView.iso));
  });

  it("should be able to propagate viewFlags and displayStyle changes when cloning ViewState", async () => {
    const vs0 = viewState.clone();

    assert.isTrue(vs0.is3d(), "viewState should be 3d");

    // query and change various viewFlags and displayStyle settings and ensure the changes propagate when cloning the state

    const vf = vs0.viewFlags.clone();
    vf.acsTriad = !vf.acsTriad;
    vf.ambientOcclusion = !vf.ambientOcclusion;
    vf.backgroundMap = !vf.backgroundMap;
    vf.cameraLights = !vf.cameraLights;
    vf.clipVolume = !vf.clipVolume;
    vf.constructions = !vf.constructions;
    vf.continuousRendering = !vf.continuousRendering;
    vf.dimensions = !vf.dimensions;
    vf.edgeMask = vf.edgeMask === 0 ? 1 : 0;
    vf.fill = !vf.fill;
    vf.grid = !vf.grid;
    vf.hLineMaterialColors = !vf.hLineMaterialColors;
    vf.hiddenEdges = !vf.hiddenEdges;
    vf.materials = !vf.materials;
    vf.monochrome = !vf.monochrome;
    vf.noGeometryMap = !vf.noGeometryMap;
    vf.patterns = !vf.patterns;
    vf.renderMode = vf.renderMode === RenderMode.HiddenLine ? RenderMode.SmoothShade : RenderMode.HiddenLine;
    vf.shadows = !vf.shadows;
    vf.solarLight = !vf.solarLight;
    vf.sourceLights = !vf.sourceLights;
    vf.styles = !vf.styles;
    vf.textures = !vf.textures;
    vf.transparency = !vf.transparency;
    vf.visibleEdges = !vf.visibleEdges;
    vf.weights = !vf.weights;
    vs0.displayStyle.viewFlags = vf;

    const vs0DisplayStyle3d = (vs0 as ViewState3d).getDisplayStyle3d();

    const oldAOSettings = vs0DisplayStyle3d.settings.ambientOcclusionSettings;
    const vs0AOSettings = AmbientOcclusion.Settings.fromJSON({
      bias: oldAOSettings.bias! / 2.0,
      zLengthCap: oldAOSettings.zLengthCap! / 2.0,
      intensity: oldAOSettings.intensity! / 2.0,
      texelStepSize: oldAOSettings.texelStepSize! / 2.0,
      blurDelta: oldAOSettings.blurDelta! / 2.0,
      blurSigma: oldAOSettings.blurSigma! / 2.0,
      blurTexelStepSize: oldAOSettings.blurTexelStepSize! / 2.0,
    });
    vs0DisplayStyle3d.settings.ambientOcclusionSettings = vs0AOSettings;

    const vs0BackgroundColor = ColorDef.from(32, 1, 99);
    vs0DisplayStyle3d.backgroundColor = vs0BackgroundColor;

    const oldBackgroundMap = vs0DisplayStyle3d.settings.backgroundMap;
    if (undefined !== oldBackgroundMap) {
      let mt = BackgroundMapType.Aerial;
      if (oldBackgroundMap.providerData !== undefined)
        mt = oldBackgroundMap.providerData.mapType === BackgroundMapType.Aerial ? BackgroundMapType.Hybrid : BackgroundMapType.Aerial;
      vs0DisplayStyle3d.setBackgroundMap({
        providerName: oldBackgroundMap.providerName === "BingProvider" ? "MapProvider" : "BingProvider",
        providerData: { mapType: mt },
      });
    } else {
      vs0DisplayStyle3d.setBackgroundMap({
        providerName: "BingProvider",
        providerData: {
          mapType: BackgroundMapType.Aerial,
        },
      });
    }
    const vs0BackgroundMap = vs0DisplayStyle3d.settings.backgroundMap;

    const oldHLSettings = vs0DisplayStyle3d.settings.hiddenLineSettings.toJSON();
    vs0DisplayStyle3d.settings.hiddenLineSettings = HiddenLine.Settings.fromJSON({
      transThreshold: oldHLSettings.transThreshold !== undefined && oldHLSettings.transThreshold! > 0.0 ? 0.0 : 0.2,
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

    assert.equal(vs0.viewFlags.acsTriad, vs1.viewFlags.acsTriad, "clone should copy viewFlags.acsTriad");
    assert.equal(vs0.viewFlags.ambientOcclusion, vs1.viewFlags.ambientOcclusion, "clone should copy viewFlags.ambientOcclusion");
    assert.equal(vs0.viewFlags.backgroundMap, vs1.viewFlags.backgroundMap, "clone should copy viewFlags.backgroundMap");
    assert.equal(vs0.viewFlags.cameraLights, vs1.viewFlags.cameraLights, "clone should copy viewFlags.cameraLights");
    assert.equal(vs0.viewFlags.clipVolume, vs1.viewFlags.clipVolume, "clone should copy viewFlags.clipVolume");
    assert.equal(vs0.viewFlags.constructions, vs1.viewFlags.constructions, "clone should copy viewFlags.constructions");
    // This flag is hidden - assert.equal(vs0.viewFlags.continuousRendering, vs1.viewFlags.continuousRendering, "clone should copy viewFlags.continuousRendering");
    assert.equal(vs0.viewFlags.dimensions, vs1.viewFlags.dimensions, "clone should copy viewFlags.dimensions");
    // This flag is hidden - assert.equal(vs0.viewFlags.edgeMask, vs1.viewFlags.edgeMask, "clone should copy viewFlags.edgeMask"); //
    assert.equal(vs0.viewFlags.fill, vs1.viewFlags.fill, "clone should copy viewFlags.fill");
    assert.equal(vs0.viewFlags.grid, vs1.viewFlags.grid, "clone should copy viewFlags.grid");
    assert.equal(vs0.viewFlags.hLineMaterialColors, vs1.viewFlags.hLineMaterialColors, "clone should copy viewFlags.hLineMaterialColors");
    assert.equal(vs0.viewFlags.hiddenEdges, vs1.viewFlags.hiddenEdges, "clone should copy viewFlags.hiddenEdges");
    assert.equal(vs0.viewFlags.materials, vs1.viewFlags.materials, "clone should copy viewFlags.materials");
    assert.equal(vs0.viewFlags.monochrome, vs1.viewFlags.monochrome, "clone should copy viewFlags.monochrome");
    // This flag test will fail because the backend doesn't do anything with it - assert.equal(vs0.viewFlags.noGeometryMap, vs1.viewFlags.noGeometryMap, "clone should copy viewFlags.noGeometryMap");
    assert.equal(vs0.viewFlags.patterns, vs1.viewFlags.patterns, "clone should copy viewFlags.patterns");
    assert.equal(vs0.viewFlags.renderMode, vs1.viewFlags.renderMode, "clone should copy viewFlags.renderMode");
    assert.equal(vs0.viewFlags.shadows, vs1.viewFlags.shadows, "clone should copy viewFlags.shadows");
    assert.equal(vs0.viewFlags.solarLight, vs1.viewFlags.solarLight, "clone should copy viewFlags.solarLight");
    assert.equal(vs0.viewFlags.sourceLights, vs1.viewFlags.sourceLights, "clone should copy viewFlags.sourceLights");
    assert.equal(vs0.viewFlags.styles, vs1.viewFlags.styles, "clone should copy viewFlags.styles");
    assert.equal(vs0.viewFlags.textures, vs1.viewFlags.textures, "clone should copy viewFlags.textures");
    assert.equal(vs0.viewFlags.transparency, vs1.viewFlags.transparency, "clone should copy viewFlags.transparency");
    assert.equal(vs0.viewFlags.visibleEdges, vs1.viewFlags.visibleEdges, "clone should copy viewFlags.visibleEdges");
    assert.equal(vs0.viewFlags.weights, vs1.viewFlags.weights, "clone should copy viewFlags.weights");
    assert.equal(vs0AOSettings.bias, vs1AOSettings.bias, "clone should copy displayStyle.ambientOcclusionSettings.bias");
    assert.equal(vs0AOSettings.zLengthCap, vs1AOSettings.zLengthCap, "clone should copy displayStyle.ambientOcclusionSettings.zLengthCap");
    assert.equal(vs0AOSettings.intensity, vs1AOSettings.intensity, "clone should copy displayStyle.ambientOcclusionSettings.intensity");
    assert.equal(vs0AOSettings.texelStepSize, vs1AOSettings.texelStepSize, "clone should copy displayStyle.ambientOcclusionSettings.texelStepSize");
    assert.equal(vs0AOSettings.blurDelta, vs1AOSettings.blurDelta, "clone should copy displayStyle.ambientOcclusionSettings.blurDelta");
    assert.equal(vs0AOSettings.blurSigma, vs1AOSettings.blurSigma, "clone should copy displayStyle.ambientOcclusionSettings.blurSigma");
    assert.equal(vs0AOSettings.blurTexelStepSize, vs1AOSettings.blurTexelStepSize, "clone should copy displayStyle.ambientOcclusionSettings.blurTexelStepSize");
    assert.isTrue(vs0BackgroundColor.equals(vs1BackgroundColor), "clone should copy displayStyle.backgroundColor");
    assert.isDefined(vs0BackgroundMap);
    assert.isDefined(vs0BackgroundMap!.providerData);
    assert.isDefined(vs1BackgroundMap);
    assert.isDefined(vs1BackgroundMap!.providerData);
    assert.equal(vs0BackgroundMap!.providerData!.mapType, vs1BackgroundMap!.providerData!.mapType, "clone should copy displayStyle.backgroundMap.providerData.mapType");
    assert.isDefined(vs0BackgroundMap!.providerName);
    assert.isDefined(vs1BackgroundMap!.providerName);
    assert.equal(vs0BackgroundMap!.providerName, vs1BackgroundMap!.providerName, "clone should copy displayStyle.backgroundMap.providerName");
    assert.equal(vs0HLSettings.transparencyThreshold, vs1HLSettings.transparencyThreshold, "clone should copy displayStyle.hiddenLineSettings.transparencyThreshold");
    assert.isTrue(vs0MonochromeColor.equals(vs1MonochromeColor), "clone should copy displayStyle.monochromeColor");
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

    let cppView: SpatialViewDefinitionProps = await unitTestRpcImp.executeTest(imodel.iModelToken, "lookAtVolume", testParams);
    viewState.lookAtVolume(testParams.volume, testParams.aspectRatio, testParams.margin);
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
    cppView = await unitTestRpcImp.executeTest(imodel.iModelToken, "lookAtVolume", testParams);
    viewState.lookAtVolume(testParams.volume, testParams.aspectRatio, testParams.margin);
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
    cppView = await unitTestRpcImp.executeTest(imodel.iModelToken, "lookAtVolume", testParams);
    viewState.lookAtVolume(testParams.volume, testParams.aspectRatio, testParams.margin);
    compareView(viewState, cppView, "LookAtVolume 2");
  });

  // TODO: Needs to be looked at
  it.skip("rotateCameraLocal should work", async () => {
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
    let cppView: SpatialViewDefinitionProps = await unitTestRpcImp.executeTest(imodel.iModelToken, "rotateCameraLocal", testParams);
    viewState.rotateCameraLocal(Angle.createRadians(testParams.angle), testParams.axis, testParams.about);
    compareView(viewState, cppView, "RotateCameraLocal 1");

    viewState.setOrigin(Point3d.create(100, 23, -18));
    viewState.setExtents(Vector3d.create(55, 0.01, 23));
    viewState.setRotation(YawPitchRollAngles.createDegrees(23, 65, 2).toMatrix3d());
    viewState.setLensAngle(Angle.createDegrees(11));
    viewState.setFocusDistance(191);
    viewState.setEyePoint(Point3d.create(-64, 120, 500));
    testParams.angle = 1.6788888;
    testParams.axis = Vector3d.create(-1, 6, 3);
    testParams.about = Point3d.create(1, 2, 3);
    cppView = await unitTestRpcImp.executeTest(imodel.iModelToken, "rotateCameraLocal", testParams);
    viewState.rotateCameraLocal(Angle.createRadians(testParams.angle), testParams.axis, testParams.about);
    compareView(viewState, cppView, "RotateCameraLocal 2");
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
    viewState.setExtents(Vector3d.create(55, 0.01, 23));
    viewState.setRotation(YawPitchRollAngles.createDegrees(23, 65, 2).toMatrix3d());
    viewState.setLensAngle(Angle.createDegrees(11));
    viewState.setFocusDistance(191);
    viewState.setEyePoint(Point3d.create(-64, 120, 500));
    const cppView: SpatialViewDefinitionProps = await unitTestRpcImp.executeTest(imodel.iModelToken, "lookAtUsingLensAngle", testParams);
    viewState.lookAtUsingLensAngle(testParams.eye, testParams.target, testParams.up, testParams.lens, testParams.front, testParams.back);
    compareView(viewState, cppView, "lookAtUsingLensAngle");
  });

  it("should ignore 2d models in model selector", async () => {
    const view = await imodel2.views.load("0x46") as SpatialViewState;
    expect(view).not.to.be.undefined;
    assert.instanceOf(view, SpatialViewState);

    const numSpatialModels = view.modelSelector.models.size;
    expect(numSpatialModels).to.be.greaterThan(0);

    // Add 2d models to selector
    view.modelSelector.addModels(["0x24", "0x28"]);
    await imodel2.models.load(view.modelSelector.models);
    assert.instanceOf(imodel2.models.loaded.get("0x24"), DrawingModelState);
    assert.instanceOf(imodel2.models.loaded.get("0x28"), SheetModelState);
    expect(view.modelSelector.models.size).to.equal(numSpatialModels + 2);

    let numModelsVisited = 0;
    view.forEachModel((model) => {
      assert.instanceOf(model, SpatialModelState);
      ++numModelsVisited;
    });

    expect(numModelsVisited).to.equal(numSpatialModels);
  });

  it("should enforce extent limits", async () => {
    const view = await imodel2.views.load("0x46") as SpatialViewState;
    const defaultLimits = view.defaultExtentLimits;
    expect(view.extentLimits.min).to.equal(defaultLimits.min);
    expect(view.extentLimits.max).to.equal(defaultLimits.max);

    // Default limits are accepted
    const delta = new Vector3d(defaultLimits.min, defaultLimits.min, defaultLimits.min);
    expect(view.validateViewDelta(delta)).to.equal(ViewStatus.Success);
    delta.set(defaultLimits.max, defaultLimits.max, defaultLimits.max);
    expect(view.validateViewDelta(delta)).to.equal(ViewStatus.Success);
    delta.scale(0.5, delta);
    expect(view.validateViewDelta(delta)).to.equal(ViewStatus.Success);

    // Outside default limits rejected
    delta.scale(5.0, delta);
    expect(view.validateViewDelta(delta)).to.equal(ViewStatus.MaxWindow);
    delta.scale(0.0, delta);
    expect(view.validateViewDelta(delta)).to.equal(ViewStatus.MinWindow);

    // Override default limits
    view.extentLimits = { min: 20, max: 100 };
    expect(view.extentLimits.min).to.equal(20);
    expect(view.extentLimits.max).to.equal(100);
    delta.set(20, 20, 20);
    expect(view.validateViewDelta(delta)).to.equal(ViewStatus.Success);
    delta.set(100, 100, 100);
    expect(view.validateViewDelta(delta)).to.equal(ViewStatus.Success);
    delta.set(10, 10, 10);
    expect(view.validateViewDelta(delta)).to.equal(ViewStatus.MinWindow);
    delta.set(110, 110, 110);
    expect(view.validateViewDelta(delta)).to.equal(ViewStatus.MaxWindow);

    // Cloning preserved extent overrides
    const view2 = view.clone();
    expect(view2.extentLimits.min).to.equal(view.extentLimits.min);
    expect(view2.extentLimits.max).to.equal(view.extentLimits.max);

    // Can reset default extent limits
    view.resetExtentLimits();
    expect(view.extentLimits.min).to.equal(defaultLimits.min);
    expect(view.extentLimits.max).to.equal(defaultLimits.max);
    expect(view2.extentLimits.min).not.to.equal(view.extentLimits.min);
    expect(view2.extentLimits.max).not.to.equal(view.extentLimits.max);
  });

  // test.bim contains 4 spatial categories, 1 drawing category, and 6 subcategories.
  // Spatial category 0x2f contains 2 subcategories.
  it("should query pages of subcategories", async () => {
    // First use ECSql to query all the subcategories.
    const ecsql = "SELECT ECInstanceId as subCategoryId, Parent.Id as categoryId FROM bis.SubCategory";
    const ecsqlRows = await imodel.queryPage(ecsql);
    expect(ecsqlRows).not.to.be.undefined;
    expect(ecsqlRows.length).to.equal(6);

    const ecsqlSubcats = new Map<string, string>(); // map subcat Id to cat Id
    const ecsqlCats = new Set<string>(); // unique cat Ids

    for (const ecsqlRow of ecsqlRows) {
      ecsqlSubcats.set(ecsqlRow.subCategoryId, ecsqlRow.categoryId);
      ecsqlCats.add(ecsqlRow.categoryId);
    }

    expect(ecsqlSubcats.size).to.equal(6);
    expect(ecsqlCats.size).to.equal(5);

    // Now construct a paged SubCategoryRequests object to query same data as above.
    // Allow only 1 category to be sent per query, and only 1 row in each page of results.
    let request = new SubCategoriesCache.Request(ecsqlCats, imodel, 1, 1);
    let result = await request.dispatch();

    // Result is an array of pages, each of which is an array of rows, each containing id=subcategoryId and parentId=categoryId
    expect(result).not.to.be.undefined;
    expect(result!.length).to.equal(6);

    const resultSubcats = new Map<string, string>();
    const resultCats = new Set<string>();

    for (const page of result!) {
      expect(page.length).to.equal(1);
      const row = page[0];
      resultSubcats.set(row.id, row.parentId);
      resultCats.add(row.parentId);
    }

    expect(resultSubcats.size).to.equal(ecsqlSubcats.size);
    expect(resultCats.size).to.equal(ecsqlCats.size);

    // Now request 2 categories per query and 100 rows per page
    request = new SubCategoriesCache.Request(ecsqlCats, imodel, 2, 100);
    result = await request.dispatch();
    expect(result!.length).to.equal(3);

    // Now request 100 categories per query and 4 rows per page
    request = new SubCategoriesCache.Request(ecsqlCats, imodel, 100, 4);
    result = await request.dispatch();
    expect(result!.length).to.equal(2);
    expect(result![0].length).to.equal(4);
    expect(result![1].length).to.equal(2);

    // Request using default limits.
    request = new SubCategoriesCache.Request(ecsqlCats, imodel);
    result = await request.dispatch();
    expect(result!.length).to.equal(1);
    expect(result![0].length).to.equal(6);
  });

  it("should not repeatedly request same categories", async () => {
    const catIds = new Set<string>();
    catIds.add("0x2f"); // contains 2 subcategories: 0x33 and 0x30
    catIds.add("0x17"); // contains 1 subcategory: 0x18

    // Request the categories and await the result
    const subcats = new SubCategoriesCache(imodel);
    const req1 = subcats.load(catIds);
    expect(req1).not.to.be.undefined;
    expect(req1!.missingCategoryIds.size).to.equal(catIds.size);
    for (const catId of catIds)
      expect(req1!.missingCategoryIds.has(catId)).to.be.true;

    const res1 = await req1!.promise;
    expect(res1).to.be.true; // indicates all info loaded

    // Request the same categories again - should be a no-op as they are already loaded.
    const req2 = subcats.load(catIds);
    expect(req2).to.be.undefined;

    // Now request some "categories" using Ids that do not identify category elements
    catIds.clear();
    catIds.add("0x1a"); // is a subcategory Id, not a category Id
    catIds.add("0x12345678"); // does not identify an existent element
    catIds.add("lalala"); // is an invalid Id64String

    const req3 = subcats.load(catIds);
    expect(req3).not.to.be.undefined;
    expect(req3!.missingCategoryIds.size).to.equal(catIds.size);
    for (const catId of catIds)
      expect(req3!.missingCategoryIds.has(catId)).to.be.true;

    const res3 = await req3!.promise;
    expect(res3).to.be.true;

    // Repeat the request - should be a no-op - we should cache the result even if the query returned no subcategory info
    const req4 = subcats.load(catIds);
    expect(req4).to.be.undefined;
  });
});
