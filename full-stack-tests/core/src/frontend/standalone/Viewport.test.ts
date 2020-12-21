/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { BeDuration, Id64, Id64Arg, Id64String, using } from "@bentley/bentleyjs-core";
import { Angle, Point3d, Range2d } from "@bentley/geometry-core";
import { BackgroundMapProps, BackgroundMapSettings, BackgroundMapType, Cartographic, CartographicRange, ColorDef, Feature, FeatureAppearance, FontMap, FontType, SubCategoryOverride, ViewFlags } from "@bentley/imodeljs-common";
import {
  ChangeFlag, ChangeFlags, CompassMode, createRenderPlanFromViewport, FeatureSymbology, IModelApp, IModelConnection, MockRender, PanViewTool, PerModelCategoryVisibility,
  RenderPlan, ScreenViewport, SnapshotConnection, SpatialViewState, StandardViewId, TwoWayViewportSync, Viewport,
} from "@bentley/imodeljs-frontend";
import { assert, expect } from "chai";

// cSpell:ignore calibri subcats subcat pmcv ovrs

function createViewDiv() {
  const div = document.createElement("div");
  assert(null !== div);
  div.style.width = div.style.height = "1000px";
  document.body.appendChild(div);
  return div;
}

describe("Viewport", () => {
  let imodel: IModelConnection;
  let imodel2: IModelConnection;
  let spatialView: SpatialViewState;

  const viewDiv = createViewDiv();
  const viewDiv2 = createViewDiv();

  before(async () => {   // Create a ViewState to load into a Viewport
    await MockRender.App.startup();
    imodel = await SnapshotConnection.openFile("test.bim"); // relative path resolved by BackendTestAssetResolver
    imodel2 = await SnapshotConnection.openFile("test2.bim"); // relative path resolved by BackendTestAssetResolver
    spatialView = await imodel.views.load("0x34") as SpatialViewState;
    spatialView.setStandardRotation(StandardViewId.RightIso);
  });

  after(async () => {
    if (imodel) await imodel.close();
    if (imodel2) await imodel2.close();
    await MockRender.App.shutdown();
  });

  it("Viewport", async () => {
    const vpView = spatialView.clone();
    const vp = ScreenViewport.create(viewDiv, vpView);
    assert.isFalse(vp.isRedoPossible, "no redo");
    assert.isFalse(vp.isUndoPossible, "no undo");
    assert.isFalse(vp.isCameraOn, "camera is off");

    const saveView = vpView.clone();
    assert.notEqual(saveView.modelSelector, vpView.modelSelector, "clone should copy modelSelector");
    assert.notEqual(saveView.categorySelector, vpView.categorySelector, "clone should copy categorySelector");
    assert.notEqual(saveView.displayStyle, vpView.displayStyle, "clone should copy displayStyle");

    const frustSave = vp.getFrustum();
    const vpView2 = spatialView.clone(imodel2);
    vpView2.setStandardRotation(StandardViewId.Top);
    const vp2 = ScreenViewport.create(viewDiv2, vpView2);
    assert.isFalse(vp2.getFrustum().isSame(vp.getFrustum()), "frustums should start out different");

    // test the two-way connection between 2 viewports
    const vpConnection = new TwoWayViewportSync();
    vpConnection.connect(vp, vp2); // wire them together
    assert.isTrue(vp2.getFrustum().isSame(frustSave), "vp2 frustum should be same as vp1 after connect");
    vp.turnCameraOn();

    vp.synchWithView();
    assert.equal(vp.iModel, imodel);
    assert.equal(vp2.iModel, imodel2);

    assert.isTrue(vp.isCameraOn, "camera should be on");
    assert.isTrue(vp2.isCameraOn, "camera should be synched");
    assert.isTrue(vp2.getFrustum().isSame(vp.getFrustum()), "frustum should be synched");

    const frust2 = vp.getFrustum();
    assert.isFalse(frust2.isSame(frustSave), "turning camera on changes frustum");
    assert.isTrue(vp.isUndoPossible, "undo should now be possible");
    vp.doUndo();
    assert.isTrue(vp.getFrustum().isSame(frustSave), "undo should reinstate saved view");
    assert.isTrue(vp.isRedoPossible, "redo is possible");
    assert.isFalse(vp.isUndoPossible, "no undo");
    assert.isTrue(vp2.getFrustum().isSame(vp.getFrustum()), "frustum should be synched");
    vp.doRedo();
    assert.isTrue(vp.getFrustum().isSame(frust2), "redo should reinstate saved view");
    assert.isFalse(vp.isRedoPossible, "after redo, redo is not possible");
    assert.isTrue(vp.isUndoPossible, "after redo, undo is possible");
    assert.isTrue(vp2.getFrustum().isSame(frust2), "frustum should be synched");

    vp2.view.displayStyle.monochromeColor = ColorDef.blue;
    vp2.synchWithView();
    assert.equal(vp.view.displayStyle.monochromeColor.getRgb(), ColorDef.blue.getRgb(), "synch from 2->1 should work");

    const pan = IModelApp.tools.create("View.Pan", vp) as PanViewTool;
    assert.instanceOf(pan, PanViewTool);
    assert.equal(pan.viewport, vp);
  });

  it("AccuDraw", () => {
    const vpView = spatialView.clone();
    const viewport = ScreenViewport.create(viewDiv, vpView);
    const accudraw = IModelApp.accuDraw;
    assert.isTrue(accudraw.isEnabled, "Accudraw should be enabled");
    const pt = new Point3d(1, 1, 1);
    accudraw.adjustPoint(pt, viewport, false);

    accudraw.activate();
    assert.isTrue(accudraw.isActive, "AccuDraw is active");
    accudraw.deactivate();
    assert.isFalse(accudraw.isActive, "not active");
    accudraw.setCompassMode(CompassMode.Polar);
    assert.equal(accudraw.compassMode, CompassMode.Polar, "polar mode");
  });

  it("loadFontMap", async () => {
    const fonts1 = await imodel.loadFontMap();
    assert.equal(fonts1.fonts.size, 4, "font map size should be 4");
    assert.equal(FontType.TrueType, fonts1.getFont(1)!.type, "get font 1 type is TrueType");
    assert.equal("Arial", fonts1.getFont(1)!.name, "get Font 1 name");
    assert.equal(1, fonts1.getFont("Arial")!.id, "get Font 1, by name");
    assert.equal(FontType.Rsc, fonts1.getFont(2)!.type, "get font 2 type is Rsc");
    assert.equal("Font0", fonts1.getFont(2)!.name, "get Font 2 name");
    assert.equal(2, fonts1.getFont("Font0")!.id, "get Font 2, by name");
    assert.equal(FontType.Shx, fonts1.getFont(3)!.type, "get font 1 type is Shx");
    assert.equal("ShxFont0", fonts1.getFont(3)!.name, "get Font 3 name");
    assert.equal(3, fonts1.getFont("ShxFont0")!.id, "get Font 3, by name");
    assert.equal(FontType.TrueType, fonts1.getFont(4)!.type, "get font 4 type is TrueType");
    assert.equal("Calibri", fonts1.getFont(4)!.name, "get Font 4 name");
    assert.equal(4, fonts1.getFont("Calibri")!.id, "get Font 3, by name");
    assert.isUndefined(fonts1.getFont("notfound"), "attempt lookup of a font that should not be found");
    assert.deepEqual(new FontMap(fonts1.toJSON()), fonts1, "toJSON on FontMap");
  });

  it("creates a RenderPlan from a viewport", () => {
    const vpView = spatialView.clone();
    const vp = ScreenViewport.create(viewDiv, vpView);
    let plan: RenderPlan | undefined;
    try {
      plan = createRenderPlanFromViewport(vp);
    } catch (e) {
      plan = undefined;
    }

    assert.isDefined(plan);
    if (plan) {
      assert.isTrue(plan.is3d);
      assert.isUndefined(plan.activeClipSettings);
      assert.isDefined(plan.hline);
      assert.isFalse(plan.hline!.visible.ovrColor);
      assert.equal(plan.hline!.hidden.width, undefined);
    }
  });

  it("supports changing a subset of background map settings", () => {
    const vp = ScreenViewport.create(viewDiv, spatialView.clone());
    const test = (changeProps: BackgroundMapProps, expectProps: BackgroundMapProps) => {
      const oldSettings = vp.backgroundMapSettings;
      const expectSettings = BackgroundMapSettings.fromJSON(expectProps);
      vp.changeBackgroundMapProps(changeProps);
      const newSettings = vp.backgroundMapSettings;

      expect(newSettings).to.deep.equal(expectSettings);
      expect(newSettings.equals(expectSettings)).to.be.true;
      if (undefined === changeProps.providerName)
        expect(newSettings.providerName).to.equal(oldSettings.providerName);

      if (undefined === changeProps.groundBias)
        expect(newSettings.groundBias).to.equal(oldSettings.groundBias);

      if (undefined === changeProps.providerData || undefined === changeProps.providerData.mapType)
        expect(newSettings.mapType).to.equal(oldSettings.mapType);
    };

    // Set up baseline values for all properties
    test({ providerName: "MapBoxProvider", providerData: { mapType: BackgroundMapType.Street }, groundBias: 1234.5, transparency: 0.3, useDepthBuffer: true, applyTerrain: true },
      { providerName: "MapBoxProvider", providerData: { mapType: BackgroundMapType.Street }, groundBias: 1234.5, transparency: 0.3, useDepthBuffer: true, applyTerrain: true });
    // Set values to the current values
    test({ providerName: "MapBoxProvider", providerData: { mapType: BackgroundMapType.Street }, groundBias: 1234.5, transparency: 0.3, useDepthBuffer: true, applyTerrain: true },
      { providerName: "MapBoxProvider", providerData: { mapType: BackgroundMapType.Street }, groundBias: 1234.5, transparency: 0.3, useDepthBuffer: true, applyTerrain: true });
    // Undefined values => preserve current name, type, & bias
    test({ providerName: undefined, providerData: { mapType: undefined }, groundBias: undefined, transparency: undefined, useDepthBuffer: undefined, applyTerrain: undefined },
      { providerName: "MapBoxProvider", providerData: { mapType: BackgroundMapType.Street }, groundBias: 1234.5, transparency: 0.3, useDepthBuffer: true, applyTerrain: true });
    // Missing values => preserve current name, type, & bias
    test({},
      { providerName: "MapBoxProvider", providerData: { mapType: BackgroundMapType.Street }, groundBias: 1234.5, transparency: 0.3, useDepthBuffer: true, applyTerrain: true });
    // Invalid provider => use default instead
    test({ providerName: "NonExistentProvider" }, { providerName: "BingProvider", providerData: { mapType: BackgroundMapType.Street }, groundBias: 1234.5, transparency: 0.3, useDepthBuffer: true, applyTerrain: true });
    // Change provider only
    test({ providerName: "MapBoxProvider" }, { providerName: "MapBoxProvider", providerData: { mapType: BackgroundMapType.Street }, groundBias: 1234.5, transparency: 0.3, useDepthBuffer: true, applyTerrain: true });

    // Invalid provider => use default instead
    test({ providerName: "" }, { providerName: "BingProvider", providerData: { mapType: BackgroundMapType.Street }, groundBias: 1234.5, transparency: 0.3, useDepthBuffer: true, applyTerrain: true });

    // providerData missing mapType => preserve current mapType
    test({ providerData: {} }, { providerName: "BingProvider", providerData: { mapType: BackgroundMapType.Street }, groundBias: 1234.5, transparency: 0.3, useDepthBuffer: true, applyTerrain: true });

    // invalid mapType => use default
    test({ providerData: { mapType: -1 } }, { providerName: "BingProvider", providerData: { mapType: BackgroundMapType.Hybrid }, groundBias: 1234.5, transparency: 0.3, useDepthBuffer: true, applyTerrain: true });

    // Change mapType only
    test({ providerData: { mapType: BackgroundMapType.Aerial } }, { providerName: "BingProvider", providerData: { mapType: BackgroundMapType.Aerial }, groundBias: 1234.5, transparency: 0.3, useDepthBuffer: true, applyTerrain: true });

    // invalid mapType => use default
    test({ providerData: { mapType: 9876 } }, { providerName: "BingProvider", providerData: { mapType: BackgroundMapType.Hybrid }, groundBias: 1234.5, transparency: 0.3, useDepthBuffer: true, applyTerrain: true });

    // Change groundBias only to int
    test({ groundBias: 543 }, { providerName: "BingProvider", providerData: { mapType: BackgroundMapType.Hybrid }, groundBias: 543, transparency: 0.3, useDepthBuffer: true, applyTerrain: true });

    // Change groundBias to negative
    test({ groundBias: -50.3 }, { providerName: "BingProvider", providerData: { mapType: BackgroundMapType.Hybrid }, groundBias: -50.3, transparency: 0.3, useDepthBuffer: true, applyTerrain: true });

    // Change provider & type
    test({ providerName: "MapBoxProvider", providerData: { mapType: BackgroundMapType.Aerial } },
      { providerName: "MapBoxProvider", providerData: { mapType: BackgroundMapType.Aerial }, groundBias: -50.3, transparency: 0.3, useDepthBuffer: true, applyTerrain: true });

    // Change type & bias
    test({ providerData: { mapType: BackgroundMapType.Street }, groundBias: 0.03 },
      { providerName: "MapBoxProvider", providerData: { mapType: BackgroundMapType.Street }, groundBias: 0.03, transparency: 0.3, useDepthBuffer: true, applyTerrain: true });

    // Change provider & bias
    test({ providerName: "BingProvider", groundBias: 0 },
      { providerName: "BingProvider", providerData: { mapType: BackgroundMapType.Street }, groundBias: 0, transparency: 0.3, useDepthBuffer: true, applyTerrain: true });

    // Test invalid provider & type => name & type revert to default
    test({ providerName: "MapBoxProvider", providerData: { mapType: BackgroundMapType.Street }, groundBias: -10 },
      { providerName: "MapBoxProvider", providerData: { mapType: BackgroundMapType.Street }, groundBias: -10, transparency: 0.3, useDepthBuffer: true, applyTerrain: true });
    test({ providerName: "NonExistentProvider", providerData: { mapType: 4 } },
      { providerName: "BingProvider", providerData: { mapType: BackgroundMapType.Hybrid }, groundBias: -10, transparency: 0.3, useDepthBuffer: true, applyTerrain: true });

    // Change transparency to a number
    test({ transparency: 0.0 }, { providerName: "BingProvider", providerData: { mapType: BackgroundMapType.Hybrid }, groundBias: -10, transparency: 0.0, useDepthBuffer: true, applyTerrain: true });
    test({ transparency: 1.0 }, { providerName: "BingProvider", providerData: { mapType: BackgroundMapType.Hybrid }, groundBias: -10, transparency: 1.0, useDepthBuffer: true, applyTerrain: true });
    test({ transparency: 0.7 }, { providerName: "BingProvider", providerData: { mapType: BackgroundMapType.Hybrid }, groundBias: -10, transparency: 0.7, useDepthBuffer: true, applyTerrain: true });
    test({ transparency: -2.0 }, { providerName: "BingProvider", providerData: { mapType: BackgroundMapType.Hybrid }, groundBias: -10, transparency: 0.0, useDepthBuffer: true, applyTerrain: true });
    test({ transparency: 2.0 }, { providerName: "BingProvider", providerData: { mapType: BackgroundMapType.Hybrid }, groundBias: -10, transparency: 1.0, useDepthBuffer: true, applyTerrain: true });

    // Change transparency to false
    test({ transparency: false }, { providerName: "BingProvider", providerData: { mapType: BackgroundMapType.Hybrid }, groundBias: -10, transparency: false, useDepthBuffer: true, applyTerrain: true });

    // Change applyTerrain to false
    test({ applyTerrain: false }, { providerName: "BingProvider", providerData: { mapType: BackgroundMapType.Hybrid }, groundBias: -10, transparency: false, useDepthBuffer: true, applyTerrain: false });

    // Change useDepthBuffer to false
    test({ useDepthBuffer: false }, { providerName: "BingProvider", providerData: { mapType: BackgroundMapType.Hybrid }, groundBias: -10, transparency: false, useDepthBuffer: false, applyTerrain: false });

    // Test that transparency cannot be enabled unless the depth buffer is also enabled
    // test({ useDepthBuffer: false, transparency: 0.5 }, { providerName: "BingProvider", providerData: { mapType: BackgroundMapType.Hybrid }, groundBias: -10, transparency: false, useDepthBuffer: false, applyTerrain: false });
    // test({ useDepthBuffer: true, transparency: 0.5 }, { providerName: "BingProvider", providerData: { mapType: BackgroundMapType.Hybrid }, groundBias: -10, transparency: 0.5, useDepthBuffer: true, applyTerrain: false });

    // etc...test valid and invalid combinations. try to make the tests fail.
  });
});

describe("Cartographic range tests", () => {

  let imodel: IModelConnection;

  before(async () => {
    await IModelApp.startup();
    imodel = await SnapshotConnection.openFile("mirukuru.ibim");
  });

  after(async () => {
    if (imodel)
      await imodel.close();

    await IModelApp.shutdown();
  });

  it("Cartographic range should convert properly", () => {
    const projectRange = new CartographicRange(imodel.projectExtents, imodel.ecefLocation!.getTransform());
    const expected = Range2d.fromJSON({ low: { x: 2.316129378420503, y: 0.5995855439816498 }, high: { x: 2.316183773897448, y: 0.5996166857950551 } });
    const longLatBox = projectRange.getLongitudeLatitudeBoundingBox();
    assert.isTrue(longLatBox.isAlmostEqual(expected), "range matches correctly");
  });
});


class ViewportChangedHandler {
  private readonly _vp: Viewport;
  private readonly _removals: Array<() => void> = [];
  // Flags set by individual event callbacks
  private readonly _eventFlags = new ChangeFlags(ChangeFlag.None);
  // Flags received by onViewportChanged callback
  private _changeFlags?: ChangeFlags;
  private _featureOverridesDirty = false;
  private readonly _undoDelay: BeDuration;

  public constructor(vp: Viewport) {
    // NB: Viewport.saveViewUndo() does nothing if called in rapid succession. That can make tests of undo/redo unpredictable.
    // Reset the delay to 0. Will set it back in dispose()
    this._undoDelay = Viewport.undoDelay;
    Viewport.undoDelay = BeDuration.fromSeconds(0);

    this._vp = vp;
    this._removals.push(vp.onViewportChanged.addListener((_: Viewport, cf) => {
      expect(this._changeFlags).to.be.undefined;
      this._changeFlags = cf;
    }));
    this._removals.push(vp.onAlwaysDrawnChanged.addListener(() => {
      expect(this._eventFlags.alwaysDrawn).to.be.false;
      this._eventFlags.setAlwaysDrawn();
    }));
    this._removals.push(vp.onNeverDrawnChanged.addListener(() => {
      expect(this._eventFlags.neverDrawn).to.be.false;
      this._eventFlags.setNeverDrawn();
    }));
    this._removals.push(vp.onDisplayStyleChanged.addListener(() => {
      expect(this._eventFlags.displayStyle).to.be.false;
      this._eventFlags.setDisplayStyle();
    }));
    this._removals.push(vp.onViewedCategoriesChanged.addListener(() => {
      expect(this._eventFlags.viewedCategories).to.be.false;
      this._eventFlags.setViewedCategories();
    }));
    this._removals.push(vp.onViewedCategoriesPerModelChanged.addListener(() => {
      expect(this._eventFlags.viewedCategoriesPerModel).to.be.false;
      this._eventFlags.setViewedCategoriesPerModel();
    }));
    this._removals.push(vp.onViewedModelsChanged.addListener(() => {
      expect(this._eventFlags.viewedModels).to.be.false;
      this._eventFlags.setViewedModels();
    }));
    this._removals.push(vp.onFeatureOverrideProviderChanged.addListener(() => {
      expect(this._eventFlags.featureOverrideProvider).to.be.false;
      this._eventFlags.setFeatureOverrideProvider();
    }));
    this._removals.push(vp.onFeatureOverridesChanged.addListener(() => {
      expect(this._featureOverridesDirty).to.be.false;
      this._featureOverridesDirty = true;
    }));

    // Initial change events are sent the first time the new ViewState is rendered.
    this.expect(ChangeFlag.Initial, () => undefined);
  }

  public dispose() {
    Viewport.undoDelay = this._undoDelay;

    for (const removal of this._removals)
      removal();

    this._removals.length = 0;
  }

  public static test(vp: Viewport, func: (mon: ViewportChangedHandler) => void): void {
    using(new ViewportChangedHandler(vp), (mon) => func(mon));
  }

  public expect(flags: ChangeFlag, func: () => void): void {
    func();
    this._vp.renderFrame();

    // Expect exactly the same ChangeFlags to be received by onViewportChanged handler.
    if (undefined === this._changeFlags)
      expect(flags).to.equal(ChangeFlag.None);
    else
      expect(this._changeFlags.value).to.equal(flags);

    // Confirm onFeatureOverridesChanged invoked or not invoked based on expected flags.
    const expectFeatureOverridesChanged = 0 !== (flags & ChangeFlag.Overrides);
    expect(this._featureOverridesDirty).to.equal(expectFeatureOverridesChanged);
    if (undefined !== this._changeFlags)
      expect(this._changeFlags.areFeatureOverridesDirty).to.equal(expectFeatureOverridesChanged);

    // No dedicated deferred event for ViewState changed...just the immediate one.
    expect(this._eventFlags.value).to.equal(flags & ~ChangeFlag.ViewState);

    // Reset for next frame.
    this._eventFlags.clear();
    this._changeFlags = undefined;
    this._featureOverridesDirty = false;
  }
}

describe("Viewport changed events", async () => {
  // test.bim:
  //  3d views:
  //    view:           34
  //    model selector: 35
  //    models: 1c 1f 22 23 24 (all spatial models in file)
  //    spatial categories: 17, 2d, 2f (subcats: 30, 33)), 31
  //    drawing category: 19
  let testBim: IModelConnection;

  // testImodel.bim: All Ids have briefcase Id=1
  //  2d views:
  //    view:  20 2e 35 3c 43 4a
  //    model: 19 27 30 37 3e 45
  //  3d views:
  //    view:               15 17 13 16 5b    61
  //    model selector:     14
  //    models:             0c 0c 0c 0c NULL  NULL
  //    category selector:  0f 0e 0f 0f 0f    0f
  //    display style:      10 10 10 10 11    12
  //  category selector 0x0e: 07 1a 1c
  //  category selector 0x0f: 01 03 05 07
  let testImodel: IModelConnection;

  const viewDiv = document.createElement("div");
  viewDiv.style.width = viewDiv.style.height = "1000px";
  document.body.appendChild(viewDiv);

  before(async () => {
    await MockRender.App.startup();
    testBim = await SnapshotConnection.openFile("test.bim"); // relative path resolved by BackendTestAssetResolver
    testImodel = await SnapshotConnection.openFile("testImodel.bim"); // relative path resolved by BackendTestAssetResolver
  });

  after(async () => {
    if (undefined !== testBim)
      await testBim.close();

    if (undefined !== testImodel)
      await testImodel.close();

    await MockRender.App.shutdown();
  });

  // Make an Id64 for testImodel which has briefcase Id=1
  function id64(localId: number): Id64String {
    return Id64.fromLocalAndBriefcaseIds(localId, 1);
  }

  it("should be dispatched when always/never-drawn change", async () => {
    const view = await testBim.views.load("0x34") as SpatialViewState;
    view.setStandardRotation(StandardViewId.RightIso);
    const vp = ScreenViewport.create(viewDiv, view);

    // Viewport-changed events are not dispatched immediately - they are accumulated between frames and dispatched from inside Viewport.renderFrame().
    ViewportChangedHandler.test(vp, (mon) => {
      // No event if the set is already empty when we clear it.
      mon.expect(ChangeFlag.None, () => vp.clearNeverDrawn());
      mon.expect(ChangeFlag.None, () => vp.clearAlwaysDrawn());

      // Assigning the set always raises an event.
      const idSet = new Set<string>();
      idSet.add("0x123");
      mon.expect(ChangeFlag.AlwaysDrawn, () => vp.setAlwaysDrawn(idSet, false));
      mon.expect(ChangeFlag.AlwaysDrawn, () => vp.setAlwaysDrawn(idSet, true));
      mon.expect(ChangeFlag.NeverDrawn, () => vp.setNeverDrawn(idSet));

      // Clearing raises event if set was assigned.
      mon.expect(ChangeFlag.NeverDrawn, () => vp.clearNeverDrawn());
      mon.expect(ChangeFlag.AlwaysDrawn, () => vp.clearAlwaysDrawn());

      // Clearing again will not re-raise because already cleared.
      mon.expect(ChangeFlag.None, () => vp.clearNeverDrawn());
      mon.expect(ChangeFlag.None, () => vp.clearAlwaysDrawn());

      // Setting repeatedly to same set raises each time, because we're not going to compare to previous set every time it changes.
      mon.expect(ChangeFlag.AlwaysDrawn, () => vp.setAlwaysDrawn(idSet, true));
      mon.expect(ChangeFlag.AlwaysDrawn, () => vp.setAlwaysDrawn(idSet, true));

      // Setting to an empty set, and also setting the 'exclusive' flags - effectively means no elements should draw.
      idSet.clear();
      mon.expect(ChangeFlag.AlwaysDrawn, () => vp.setAlwaysDrawn(idSet, true));
      // Raises even though set was already empty, because this resets the 'exclusive' flag.
      mon.expect(ChangeFlag.AlwaysDrawn, () => vp.clearAlwaysDrawn());
      // Exclusive flag no longer set and set is empty, so no event.
      mon.expect(ChangeFlag.None, () => vp.clearAlwaysDrawn());

      // Multiple changes in between frames produce a single event.
      idSet.add("0x123");
      mon.expect(ChangeFlag.AlwaysDrawn | ChangeFlag.NeverDrawn, () => {
        for (let i = 0; i < 5; i++) {
          vp.setAlwaysDrawn(idSet);
          vp.clearAlwaysDrawn();
          vp.setNeverDrawn(idSet);
          vp.clearNeverDrawn();
        }
      });

      // Always/never-drawn unaffected by undo/redo
      vp.saveViewUndo();
      vp.doUndo();
      mon.expect(ChangeFlag.None, () => undefined);
      vp.doRedo();
      mon.expect(ChangeFlag.None, () => undefined);
    });
  });

  it("should be dispatched when display style changes", async () => {
    const view = await testBim.views.load("0x34") as SpatialViewState;
    view.setStandardRotation(StandardViewId.RightIso);
    const vp = ScreenViewport.create(viewDiv, view);

    ViewportChangedHandler.test(vp, (mon) => {
      // No event if equivalent flags
      const newFlags = vp.viewFlags.clone();
      mon.expect(ChangeFlag.None, () => vp.viewFlags = newFlags);

      // ViewFlags which do not affect symbology overrides
      newFlags.solarLight = !newFlags.solarLight;
      mon.expect(ChangeFlag.DisplayStyle, () => vp.viewFlags = newFlags);

      // ViewFlags which affect symbology overrides
      newFlags.constructions = !newFlags.constructions;
      mon.expect(ChangeFlag.DisplayStyle, () => vp.viewFlags = newFlags);

      // No event if modify display style directly.
      mon.expect(ChangeFlag.None, () => {
        vp.displayStyle.backgroundColor = ColorDef.red;
        vp.displayStyle.viewFlags = new ViewFlags();
      });

      // Modify display style through Viewport API.
      vp.saveViewUndo();
      mon.expect(ChangeFlag.DisplayStyle, () => {
        const newStyle = vp.displayStyle.clone();
        newStyle.backgroundColor = ColorDef.red;
        vp.displayStyle = newStyle;
      });

      // Modify view flags through Viewport's displayStyle property.
      vp.saveViewUndo();
      mon.expect(ChangeFlag.DisplayStyle, () => {
        const newStyle = vp.displayStyle.clone();
        newStyle.viewFlags.constructions = !newStyle.viewFlags.constructions;
        vp.displayStyle = newStyle;
      });

      vp.saveViewUndo();

      // Override subcategories directly on display style => no event
      const ovr = SubCategoryOverride.fromJSON({ color: ColorDef.green.tbgr });
      mon.expect(ChangeFlag.None, () => vp.displayStyle.overrideSubCategory("0x123", ovr));

      // Override by replacing display style on Viewport
      vp.saveViewUndo();
      mon.expect(ChangeFlag.DisplayStyle, () => {
        const style = vp.displayStyle.clone();
        style.overrideSubCategory("0x123", ovr);
        vp.displayStyle = style;
      });

      // Apply same override via Viewport method. Does not check if override actually differs.
      vp.saveViewUndo();
      mon.expect(ChangeFlag.DisplayStyle | ChangeFlag.ViewedModels, () => {
        // Because this is same override as already set, saveViewUndo will not save in undo buffer unless we make some other actual change to the ViewState
        vp.overrideSubCategory("0x123", ovr);
        vp.changeViewedModels(new Set<string>());
      });

      // Apply different override to same subcategory
      vp.saveViewUndo();
      mon.expect(ChangeFlag.DisplayStyle, () => vp.overrideSubCategory("0x123", SubCategoryOverride.fromJSON({ color: ColorDef.red.tbgr })));
    });
  });

  it("should be dispatched when displayed 2d models change", async () => {
    const vp = ScreenViewport.create(viewDiv, await testImodel.views.load(id64(0x20))); // views model 0x19

    ViewportChangedHandler.test(vp, async (mon) => {
      // changeModelDisplay is no-op for 2d views
      mon.expect(ChangeFlag.None, () => expect(vp.changeModelDisplay(id64(0x19), false)).to.be.false);
      mon.expect(ChangeFlag.None, () => expect(vp.changeModelDisplay(id64(0x27), true)).to.be.false);
      const viewedModels = new Set<string>();
      viewedModels.add(id64(0x27));
      mon.expect(ChangeFlag.ViewState, () => expect(vp.changeViewedModels(viewedModels)).to.be.false);

      // Switching to a different 2d view of the same model should not produce model-changed event
      const view20 = await testImodel.views.load(id64(0x20)); // views model 0x1e
      mon.expect(ChangeFlag.ViewState, () => vp.changeView(view20));

      // Switching to a different 2d view of a different model should produce model-changed event
      // Note: new view also has different categories enabled.
      const view35 = await testImodel.views.load(id64(0x35)); // views model 0x1e
      mon.expect(ChangeFlag.ViewedModels | ChangeFlag.ViewedCategories, () => vp.changeView(view35));

      // Switch back to previous view.
      // Note: changeView() clears undo stack so cannot/needn't test undo/redo here.
      mon.expect(ChangeFlag.ViewedModels | ChangeFlag.ViewedCategories | ChangeFlag.ViewState, () => vp.changeView(view20.clone()));
    });
  });

  it("should be dispatched when displayed 3d models change", async () => {
    const vp = ScreenViewport.create(viewDiv, await testBim.views.load("0x34"));

    ViewportChangedHandler.test(vp, async (mon) => {
      // adding a model which is already present produces no event
      mon.expect(ChangeFlag.None, () => vp.changeModelDisplay("0x1c", true));

      // removing a model not present produces no event
      mon.expect(ChangeFlag.None, () => vp.changeModelDisplay("0x9876543", false));

      // setting viewed models directly always produces event - we don't check if contents of set exactly match current set
      let selectedModels = (vp.view as SpatialViewState).modelSelector.models;
      mon.expect(ChangeFlag.ViewedModels, () => vp.changeViewedModels(selectedModels));
      selectedModels = new Set<string>();
      selectedModels.add("0x1c");
      mon.expect(ChangeFlag.ViewedModels, () => vp.changeViewedModels(selectedModels));

      // Save baseline: viewedModels = [ 0x1c ]
      vp.saveViewUndo();
      expect(vp.viewsModel("0x1c")).to.be.true;
      expect(vp.viewsModel("0x1f")).to.be.false;

      // changeModelDisplay has no net effect - but must make some other change for saveViewUndo() to actually save the view state.
      mon.expect(ChangeFlag.DisplayStyle, () => { const vf = vp.viewFlags.clone(); vf.solarLight = !vf.solarLight; vp.viewFlags = vf; });
      mon.expect(ChangeFlag.None, () => vp.changeModelDisplay("0x1c", true));
      vp.saveViewUndo();
      mon.expect(ChangeFlag.DisplayStyle, () => vp.doUndo());
      mon.expect(ChangeFlag.DisplayStyle, () => vp.doRedo());

      mon.expect(ChangeFlag.ViewedModels, () => {
        vp.changeModelDisplay("0x1c", false);
        vp.changeModelDisplay("0x1f", true);
      });
      vp.saveViewUndo();
      mon.expect(ChangeFlag.ViewedModels, () => vp.doUndo());
      mon.expect(ChangeFlag.None, () => vp.doUndo());
      mon.expect(ChangeFlag.None, () => vp.doRedo());
      mon.expect(ChangeFlag.ViewedModels, () => vp.doRedo());

      // Viewport is now viewing model 0x1f.
      // Replacing viewed models with same set [ 0x1f ] produces event
      selectedModels.clear();
      selectedModels.add("0x1f");
      mon.expect(ChangeFlag.ViewedModels, () => vp.changeViewedModels(selectedModels));

      // Undo produces view looking at same set of models => no event
      vp.saveViewUndo();
      mon.expect(ChangeFlag.None, () => vp.doUndo());
      mon.expect(ChangeFlag.None, () => vp.doRedo());
    });
  });

  it("should be dispatched when displayed categories change", async () => {
    const vp = ScreenViewport.create(viewDiv, await testImodel.views.load(id64(0x15))); // view category selector 0x0f

    ViewportChangedHandler.test(vp, async (mon) => {
      // Adding an already-enabled category or removing a disabled one has no effect
      mon.expect(ChangeFlag.None, () => vp.changeCategoryDisplay(id64(0x01), true));
      mon.expect(ChangeFlag.None, () => vp.changeCategoryDisplay(id64(0x1a), false));

      // Two changes which produce no net change still produce event - we do not track net changes
      vp.saveViewUndo();
      mon.expect(ChangeFlag.ViewedCategories, () => {
        vp.changeCategoryDisplay(id64(0x01), false);
        vp.changeCategoryDisplay(id64(0x01), true);
      });

      // Undo/redo with no net change produces no event
      vp.saveViewUndo();
      mon.expect(ChangeFlag.None, () => vp.doUndo());
      mon.expect(ChangeFlag.None, () => vp.doRedo());

      // Switching to a different view with same category selector produces no category-changed event
      const view13 = await testImodel.views.load(id64(0x13));
      mon.expect(ChangeFlag.ViewState, () => vp.changeView(view13));

      // Switching to a different view with different category selector produces event
      const view17 = await testImodel.views.load(id64(0x17));
      mon.expect(ChangeFlag.ViewState, () => vp.changeView(view17));

      // Changing category selector, then switching to a view with same categories enabled produces no event.
      mon.expect(ChangeFlag.ViewedCategories, () => {
        vp.changeCategoryDisplay(vp.view.categorySelector.categories, false);
        vp.changeCategoryDisplay(view13.categorySelector.categories, true);
      });

      mon.expect(ChangeFlag.ViewState, () => vp.changeView(view13));
    });
  });

  it("should be dispatched when per-model category visibility changes", async () => {
    const vp = ScreenViewport.create(viewDiv, await testBim.views.load("0x34"));
    const vis = vp.perModelCategoryVisibility;

    ViewportChangedHandler.test(vp, (mon) => {
      expect(vis.getOverride("0x1c", "0x1234")).to.equal(PerModelCategoryVisibility.Override.None);

      // No net change => no event
      mon.expect(ChangeFlag.None, () => vis.setOverride("0x1c", "0x1234", PerModelCategoryVisibility.Override.None));
      expect(vis.getOverride("0x1c", "0x1234")).to.equal(PerModelCategoryVisibility.Override.None);

      mon.expect(ChangeFlag.ViewedCategoriesPerModel, () => vis.setOverride("0x1c", "0x1234", PerModelCategoryVisibility.Override.Show));
      expect(vis.getOverride("0x1c", "0x1234")).to.equal(PerModelCategoryVisibility.Override.Show);

      mon.expect(ChangeFlag.ViewedCategoriesPerModel, () => vis.setOverride("0x1c", "0x1234", PerModelCategoryVisibility.Override.Hide));
      expect(vis.getOverride("0x1c", "0x1234")).to.equal(PerModelCategoryVisibility.Override.Hide);

      mon.expect(ChangeFlag.None, () => vis.clearOverrides("0x9876"));

      mon.expect(ChangeFlag.ViewedCategoriesPerModel, () => vis.clearOverrides());
      expect(vis.getOverride("0x1c", "0x1234")).to.equal(PerModelCategoryVisibility.Override.None);

      mon.expect(ChangeFlag.None, () => vis.clearOverrides());

      const idSet = new Set<string>();
      idSet.add("0x1234567");
      mon.expect(ChangeFlag.None, () => vis.setOverride(new Set<string>(), new Set<string>(), PerModelCategoryVisibility.Override.Show));
      mon.expect(ChangeFlag.None, () => vis.setOverride(idSet, new Set<string>(), PerModelCategoryVisibility.Override.Show));
      mon.expect(ChangeFlag.None, () => vis.setOverride(new Set<string>(), idSet, PerModelCategoryVisibility.Override.Show));

      const idList = ["0x1234567"];
      mon.expect(ChangeFlag.None, () => vis.setOverride([], [], PerModelCategoryVisibility.Override.Show));
      mon.expect(ChangeFlag.None, () => vis.setOverride(idList, [], PerModelCategoryVisibility.Override.Show));
      mon.expect(ChangeFlag.None, () => vis.setOverride([], idList, PerModelCategoryVisibility.Override.Show));

      const modelIdList = ["0x1", "0x2", "0x3"];
      const catIdList = ["0xa", "0xb"];
      mon.expect(ChangeFlag.ViewedCategoriesPerModel, () => vis.setOverride(modelIdList, catIdList, PerModelCategoryVisibility.Override.Show));
      for (const modelId of modelIdList)
        for (const catId of catIdList)
          expect(vis.getOverride(modelId, catId)).to.equal(PerModelCategoryVisibility.Override.Show);

      // No net change
      mon.expect(ChangeFlag.None, () => vis.setOverride(modelIdList, catIdList, PerModelCategoryVisibility.Override.Show));

      modelIdList.shift(); // remove "0x1"
      catIdList.shift(); // remove "0xa"
      mon.expect(ChangeFlag.ViewedCategoriesPerModel, () => vis.setOverride(modelIdList, catIdList, PerModelCategoryVisibility.Override.Hide));
      expect(vis.getOverride("0x1", "0xa")).to.equal(PerModelCategoryVisibility.Override.Show);
      expect(vis.getOverride("0x1", "0xb")).to.equal(PerModelCategoryVisibility.Override.Show);
      expect(vis.getOverride("0x2", "0xa")).to.equal(PerModelCategoryVisibility.Override.Show);
      expect(vis.getOverride("0x2", "0xb")).to.equal(PerModelCategoryVisibility.Override.Hide);
      expect(vis.getOverride("0x3", "0xa")).to.equal(PerModelCategoryVisibility.Override.Show);
      expect(vis.getOverride("0x3", "0xb")).to.equal(PerModelCategoryVisibility.Override.Hide);

      mon.expect(ChangeFlag.ViewedCategoriesPerModel, () => vis.clearOverrides(["0x1"]));
      expect(vis.getOverride("0x1", "0xa")).to.equal(PerModelCategoryVisibility.Override.None);
      expect(vis.getOverride("0x1", "0xb")).to.equal(PerModelCategoryVisibility.Override.None);
    });
  });

  it("should be dispatched when feature override provider changes", async () => {
    const vp = ScreenViewport.create(viewDiv, await testBim.views.load("0x34"));
    let overridesAdded = false;
    const provider = {
      addFeatureOverrides: (_overrides: FeatureSymbology.Overrides, _viewport: Viewport): void => {
        expect(overridesAdded).to.be.false;
        overridesAdded = true;
      },
    };

    ViewportChangedHandler.test(vp, (mon) => {
      // Changing the provider => event
      mon.expect(ChangeFlag.FeatureOverrideProvider, () => vp.addFeatureOverrideProvider(provider));
      expect(overridesAdded).to.be.true;
      overridesAdded = false;

      // Explicitly notifying provider's state has changed => event
      mon.expect(ChangeFlag.FeatureOverrideProvider, () => vp.setFeatureOverrideProviderChanged());
      expect(overridesAdded).to.be.true;
      overridesAdded = false;

      // Setting provider to same value => no event
      mon.expect(ChangeFlag.None, () => vp.addFeatureOverrideProvider(provider));
      expect(overridesAdded).to.be.false;

      // Actually changing the provider => event
      mon.expect(ChangeFlag.FeatureOverrideProvider, () => {
        const prov = vp.findFeatureOverrideProvider((_) => true);
        expect(prov).not.to.be.undefined;
        if (prov)
          vp.dropFeatureOverrideProvider(prov);
      });
      expect(overridesAdded).to.be.false;
    });
  });

  it("should be dispatched when changing ViewState", async () => {
    const view2d20 = await testImodel.views.load(id64(0x20));
    const view2d2e = await testImodel.views.load(id64(0x2e));
    const view3d15 = await testImodel.views.load(id64(0x15)); // cat sel 0f, mod sel 14
    const view3d17 = await testImodel.views.load(id64(0x17)); // cat sel 0e, mod sel 14

    const vp = ScreenViewport.create(viewDiv, view2d20.clone());
    ViewportChangedHandler.test(vp, (mon) => {
      // No effective change to view
      mon.expect(ChangeFlag.ViewState, () => vp.changeView(view2d20.clone()));

      // 2d => 2d
      mon.expect(ChangeFlag.ViewState | ChangeFlag.ViewedCategories | ChangeFlag.ViewedModels | ChangeFlag.DisplayStyle, () => vp.changeView(view2d2e.clone()));

      // 2d => 3d
      mon.expect(ChangeFlag.ViewState | ChangeFlag.ViewedCategories | ChangeFlag.ViewedModels | ChangeFlag.DisplayStyle, () => vp.changeView(view3d15.clone()));

      // No effective change
      mon.expect(ChangeFlag.ViewState, () => vp.changeView(view3d15.clone()));

      // 3d => 3d - same model selector, same display style, different category selector
      mon.expect(ChangeFlag.ViewState | ChangeFlag.ViewedCategories, () => vp.changeView(view3d17.clone()));

      // 3d => 2d
      mon.expect(ChangeFlag.ViewState | ChangeFlag.ViewedCategories | ChangeFlag.ViewedModels | ChangeFlag.DisplayStyle, () => vp.changeView(view2d20.clone()));

      // Pass the exact same ViewState reference => no "ViewState changed" event.
      mon.expect(ChangeFlag.None, () => vp.changeView(vp.view));
    });

    // Test the immediately-fire onChangeView event.
    let numEvents = 0;
    const removeListener = vp.onChangeView.addListener(() => ++numEvents);

    // Same ViewState reference => no event
    vp.changeView(vp.view);
    expect(numEvents).to.equal(0);

    // Different ViewState reference => event
    vp.changeView(view2d20.clone());
    expect(numEvents).to.equal(1);

    // Different ViewState reference to an logically identical ViewState => event
    vp.changeView(view2d20);
    expect(numEvents).to.equal(2);

    removeListener();
  });

  it("should load subcategories for all displayed categories", async () => {
    // NB: Because subcategories are cached, and previous tests probably loaded some, we must clear the cache.
    const subcats = testImodel.subcategories;
    subcats.onIModelConnectionClose();

    // View 0x17 views category 0x07 - expect subcategories already loaded by ViewState.load()
    const vp = ScreenViewport.create(viewDiv, await testImodel.views.load(id64(0x17)));
    expect(vp.view.viewsCategory(id64(0x07))).to.be.true;
    expect(subcats.getSubCategories(id64(0x07))).not.to.be.undefined;

    // Other categories not yet viewed therefore subcategories not yet loaded
    expect(vp.view.viewsCategory(id64(0x01))).to.be.false;
    expect(vp.view.viewsCategory(id64(0x03))).to.be.false;
    expect(vp.view.viewsCategory(id64(0x05))).to.be.false;
    expect(vp.view.viewsCategory(id64(0x1a))).to.be.false;
    expect(vp.view.viewsCategory(id64(0x1c))).to.be.false;

    const waitForSubCats = async (catIds: Id64Arg): Promise<void> => {
      Id64.forEach(catIds, (catId) => expect(subcats.getSubCategories(catId)).to.be.undefined);

      // We used to wait half a second (no loop). That was sometimes apparently not long enough for the Linux CI job.
      // Waiting for some async operation to happen in background within a limited amount of time is not great, but that is the
      // behavior we are trying to test...
      // Wait up to 4 seconds. Loop prevents tests from taking longer than necessary if response is speedy.
      for (let i = 1; i < 16; i++) {
        await BeDuration.wait(250);
        let numLoaded = 0;
        Id64.forEach(catIds, (catId) => {
          if (subcats.getSubCategories(catId) !== undefined)
            ++numLoaded;
        });

        if (0 !== numLoaded) {
          // If one category was loaded, they all should have been.
          expect(numLoaded).to.equal(Id64.sizeOf(catIds));
          break;
        }
      }

      Id64.forEach(catIds, (catId) => expect(subcats.getSubCategories(catId)).not.to.be.undefined);
    };

    // Turning on another category for the first time causes subcategories to be asynchronously loaded if not in cache
    vp.changeCategoryDisplay(id64(0x01), true);
    await waitForSubCats(id64(0x01));

    // If we turn on 2 more categories at once, subcategories for both should be loaded asynchronously
    vp.changeCategoryDisplay([id64(0x03), id64(0x05)], true);
    await waitForSubCats([id64(0x03), id64(0x05)]);

    // If we turn on 2 more categories in succession, subcategories for both should be loaded asynchronously.
    // The loading of the first category's subcategories should not be interrupted by loading of second category's subcategories.
    vp.changeCategoryDisplay(id64(0x1a), true);
    vp.changeCategoryDisplay(id64(0x1c), true);
    await waitForSubCats([id64(0x1c), id64(0x1a)]);
  });
});

class Overrides extends FeatureSymbology.Overrides {
  public constructor(vp: Viewport) {
    super(vp);
  }

  public get modelSubCategoryOverrides() { return this._modelSubCategoryOverrides; }

  public getOverride(modelId: Id64String): Id64.Uint32Set | undefined {
    return this.modelSubCategoryOverrides.get(Id64.getLowerUint32(modelId), Id64.getUpperUint32(modelId));
  }

  public expectOverridden(modelId: Id64String, subcategoryId: Id64String): void {
    const set = this.getOverride(modelId);
    expect(set).not.to.be.undefined;
    expect(set!.hasId(subcategoryId)).to.be.true;
  }

  public expectNotOverridden(modelId: Id64String, subcategoryId: Id64String): void {
    const set = this.getOverride(modelId);
    if (undefined !== set)
      expect(set.hasId(subcategoryId)).to.be.false;
  }

  public expectSubCategoryAppearance(modelId: Id64String, subcatId: Id64String, visible: boolean, color?: ColorDef): void {
    const app = this.getElementAppearance(modelId, subcatId);
    expect(undefined !== app).to.equal(visible);
    if (undefined !== app) {
      expect(app.overridesRgb).to.equal(undefined !== color);
      if (undefined !== color && undefined !== app.rgb) {
        const c = color.colors;
        expect(app.rgb.r).to.equal(c.r);
        expect(app.rgb.g).to.equal(c.g);
        expect(app.rgb.b).to.equal(c.b);
      }
    }
  }

  public getElementAppearance(modelId: Id64String, subcatId: Id64String, elemId: Id64String = "0xabcdef"): FeatureAppearance | undefined {
    return this.getFeatureAppearance(new Feature(elemId, subcatId), modelId);
  }

  public hasSubCategoryAppearanceOverride(subcatId: Id64String): boolean {
    return undefined !== this._subCategoryOverrides.getById(subcatId);
  }
}

describe("Per-model category visibility overrides", () => {
  let imodel: IModelConnection;
  let spatialView: SpatialViewState;

  const viewDiv = createViewDiv();
  const show = PerModelCategoryVisibility.Override.Show;
  const hide = PerModelCategoryVisibility.Override.Hide;
  const usedCatIds = ["0x17", "0x2d", "0x2f", "0x31"];

  before(async () => {
    await MockRender.App.startup();
    imodel = await SnapshotConnection.openFile("test.bim"); // relative path resolved by BackendTestAssetResolver
    spatialView = await imodel.views.load("0x34") as SpatialViewState;
    spatialView.setStandardRotation(StandardViewId.RightIso);

    // Make sure all subcategories we need are loaded ahead of time.
    const req = imodel.subcategories.load(usedCatIds);
    if (undefined !== req)
      await req.promise;

    for (const usedCatId of usedCatIds)
      expect(imodel.subcategories.getSubCategories(usedCatId)).not.to.be.undefined;
  });

  after(async () => {
    if (imodel)
      await imodel.close();

    await MockRender.App.shutdown();
  });

  it("overrides category selector", async () => {
    // Turn off all categories
    const vp = ScreenViewport.create(viewDiv, spatialView.clone());
    vp.changeCategoryDisplay(usedCatIds, false);
    for (const catId of usedCatIds)
      expect(vp.view.viewsCategory(catId)).to.be.false;

    expect(vp.view.viewsModel("0x1c"));
    expect(vp.view.viewsModel("0x1f"));

    // Turn on category 2f for model 1c, and turn off category 17 for model 1f (latter is no-op because already off).
    const pmcv = vp.perModelCategoryVisibility;
    pmcv.setOverride("0x1c", "0x2f", show);
    pmcv.setOverride("0x1f", "0x17", hide);

    expect(pmcv.getOverride("0x1c", "0x2f")).to.equal(show);
    expect(pmcv.getOverride("0x1f", "0x17")).to.equal(hide);

    const ovrs = new Overrides(vp);

    // Only the per-model overrides which actually override visibility are recorded.
    expect(ovrs.modelSubCategoryOverrides.size).to.equal(1);
    ovrs.expectOverridden("0x1c", "0x30");
    ovrs.expectOverridden("0x1c", "0x33");
    ovrs.expectNotOverridden("0x1f", "0x17");

    for (const modelId of spatialView.modelSelector.models) {
      // Subcategories 0x30 and 0x33 belong to category 0x3f which is only enabled for model 0x1c.
      const expectVisible = modelId === "0x1c";
      const lo = Id64.getLowerUint32(modelId);
      const hi = Id64.getUpperUint32(modelId);

      expect(ovrs.isSubCategoryVisibleInModel(0x30, 0, lo, hi)).to.equal(expectVisible);
      expect(ovrs.isSubCategoryVisibleInModel(0x33, 0, lo, hi)).to.equal(expectVisible);
      expect(ovrs.isSubCategoryVisibleInModel(0x18, 0, lo, hi)).to.be.false;
      expect(ovrs.isSubCategoryVisibleInModel(0x2e, 0, lo, hi)).to.be.false;

      expect(ovrs.getElementAppearance(modelId, "0x30") !== undefined).to.equal(expectVisible);
      expect(ovrs.getElementAppearance(modelId, "0x33") !== undefined).to.equal(expectVisible);
    }
  });

  it("does not override always/never-drawn elements", () => {
    // Category selector contains only 0x31 and 0x2d
    const vp = ScreenViewport.create(viewDiv, spatialView.clone());
    vp.changeCategoryDisplay(usedCatIds, false);
    vp.changeCategoryDisplay(["0x31", "0x2d"], true);

    // Model 1c turns category 31 off. Model 1f turns category 17 on and category 2d off.
    const pmcv = vp.perModelCategoryVisibility;
    pmcv.setOverride("0x1c", "0x31", hide);
    pmcv.setOverride("0x1f", "0x17", show);
    pmcv.setOverride("0x1f", "0x2d", hide);
    expect(pmcv.getOverride("0x1c", "0x31")).to.equal(hide);
    expect(pmcv.getOverride("0x1f", "0x17")).to.equal(show);
    expect(pmcv.getOverride("0x1f", "0x2d")).to.equal(hide);

    vp.setAlwaysDrawn(new Set<string>(["0xabc"]));
    vp.setNeverDrawn(new Set<string>(["0xdef"]));

    const ovrs = new Overrides(vp);

    expect(ovrs.modelSubCategoryOverrides.size).to.equal(2);
    ovrs.expectOverridden("0x1c", "0x32");
    ovrs.expectOverridden("0x1f", "0x18");

    for (const modelId of spatialView.modelSelector.models) {
      expect(ovrs.getElementAppearance(modelId, "0x18", "0xabc")).not.to.be.undefined;
      expect(ovrs.getElementAppearance(modelId, "0x32", "0xabc")).not.to.be.undefined;
      expect(ovrs.getElementAppearance(modelId, "0x18", "0xdef")).to.be.undefined;
      expect(ovrs.getElementAppearance(modelId, "0x32", "0xdef")).to.be.undefined;

      expect(ovrs.getElementAppearance(modelId, "0x32") !== undefined).to.equal(modelId !== "0x1c");
      expect(ovrs.getElementAppearance(modelId, "0x18") !== undefined).to.equal(modelId === "0x1f");
      expect(ovrs.getElementAppearance(modelId, "0x2e") !== undefined).to.equal(modelId !== "0x1f");
    }
  });

  it("preserves subcategory appearance overrides", () => {
    // Enable all categories and subcategories except category 2d
    const vp = ScreenViewport.create(viewDiv, spatialView.clone());
    vp.changeCategoryDisplay(usedCatIds, true, true);
    vp.changeCategoryDisplay("0x2d", false);

    // Override 30, 32, and 33 to be invisible. Override color of 30, 33, 18, and 2e. (2e's category is turned off).
    vp.overrideSubCategory("0x30", SubCategoryOverride.fromJSON({ color: ColorDef.green.tbgr, invisible: true }));
    vp.overrideSubCategory("0x18", SubCategoryOverride.fromJSON({ color: ColorDef.red.tbgr }));
    vp.overrideSubCategory("0x2e", SubCategoryOverride.fromJSON({ color: ColorDef.blue.tbgr }));
    vp.overrideSubCategory("0x33", SubCategoryOverride.fromJSON({ color: ColorDef.white.tbgr, invisible: true }));
    vp.changeSubCategoryDisplay("0x32", false); // adds an override of { invisible: true }

    // With no per-model overrides, expect subcategory appearance overrides for invisible subcategories not to be loaded.
    let ovrs = new Overrides(vp);
    expect(ovrs.hasSubCategoryAppearanceOverride("0x18")).to.be.true; // because visible and overridden
    expect(ovrs.hasSubCategoryAppearanceOverride("0x30")).to.be.false; // because overridden to be invisible
    expect(ovrs.hasSubCategoryAppearanceOverride("0x32")).to.be.false; // because overridden to be invisible
    expect(ovrs.hasSubCategoryAppearanceOverride("0x2e")).to.be.false; // because overridden but category turned off
    expect(ovrs.hasSubCategoryAppearanceOverride("0x33")).to.be.false; // because overridden to be invisible

    // Turning a category on for a specific model turns on all subcategories.
    // If any of those subcategories have appearance overrides they must be loaded.
    // Cat 31 already enabled, but its subcat is invisible. Cat 2f is enabled; its subcat 30 is invisible and green; its subcat 18 is visible and red.
    // Cat 2d is disabled; its subcat 2e is blue.
    vp.perModelCategoryVisibility.setOverride("0x1c", ["0x2f", "0x31", "0x2d"], show);
    vp.perModelCategoryVisibility.setOverride("0x1c", "0x17", hide);

    ovrs = new Overrides(vp);
    expect(ovrs.hasSubCategoryAppearanceOverride("0x18")).to.be.true;
    expect(ovrs.hasSubCategoryAppearanceOverride("0x30")).to.be.true; // because model overrode visibility and viewport override color
    expect(ovrs.hasSubCategoryAppearanceOverride("0x32")).to.be.false; // model overrode visibility but no other appearance overrides
    expect(ovrs.hasSubCategoryAppearanceOverride("0x2e")).to.be.true; // category is off in selector but on for model and viewport overrode color
    expect(ovrs.hasSubCategoryAppearanceOverride("0x33")).to.be.true; // because model overrode visibility and viewport override color

    ovrs.expectSubCategoryAppearance("0x1f", "0x18", true, ColorDef.red);
    ovrs.expectSubCategoryAppearance("0x1f", "0x30", false);
    ovrs.expectSubCategoryAppearance("0x1f", "0x32", false);
    ovrs.expectSubCategoryAppearance("0x1f", "0x2e", false);
    ovrs.expectSubCategoryAppearance("0x1f", "0x33", false);

    ovrs.expectSubCategoryAppearance("0x1c", "0x18", false);
    ovrs.expectSubCategoryAppearance("0x1c", "0x30", true, ColorDef.green);
    ovrs.expectSubCategoryAppearance("0x1c", "0x32", true);
    ovrs.expectSubCategoryAppearance("0x1c", "0x2e", true, ColorDef.blue);
    ovrs.expectSubCategoryAppearance("0x1c", "0x33", true, ColorDef.white);
  });

  it("supports iteration", () => {
    const vp = ScreenViewport.create(viewDiv, spatialView.clone());
    const pmcv = vp.perModelCategoryVisibility;
    pmcv.setOverride("0x1c", ["0x2f", "0x31"], show);
    pmcv.setOverride("0x1c", ["0x2d"], hide);
    pmcv.setOverride("0x1d", ["0x2d"], show);
    pmcv.setOverride("0x1d", ["0x2f", "0x2e"], hide);

    let nIterations = 0;
    let completed = pmcv.forEachOverride((_modelId, _categoryId, _visible) => ++nIterations < 3);
    expect(completed).to.be.false;
    expect(nIterations).to.equal(3);

    nIterations = 0;
    const cats1c = [new Set<string>(), new Set<string>()];
    const cats1d = [new Set<string>(), new Set<string>()];

    completed = pmcv.forEachOverride((modelId, catId, vis) => {
      expect(modelId === "0x1c" || modelId === "0x1d").to.be.true;
      const arr = modelId === "0x1c" ? cats1c : cats1d;
      const set = vis ? arr[0] : arr[1];
      set.add(catId);
      ++nIterations;
      return true;
    });

    expect(completed).to.be.true;
    expect(nIterations).to.equal(6);

    expect(cats1c[0].size).to.equal(2);
    expect(cats1c[1].size).to.equal(1);
    expect(cats1d[0].size).to.equal(1);
    expect(cats1d[1].size).to.equal(2);

    expect(Array.from(cats1c[0]).join()).to.equal("0x2f,0x31");
    expect(Array.from(cats1c[1]).join()).to.equal("0x2d");
    expect(Array.from(cats1d[0]).join()).to.equal("0x2d");
    expect(Array.from(cats1d[1]).join()).to.equal("0x2e,0x2f");
  });
});
