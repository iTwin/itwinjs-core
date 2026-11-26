/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable @typescript-eslint/no-deprecated -- Verify the still-supported viewport visibility methods. */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { EmptyLocalization, Feature, FeatureAppearance, PlanProjectionSettings, RenderSchedule, SubCategoryAppearance, SubCategoryOverride } from "@itwin/core-common";
import { IModelApp } from "../IModelApp";
import { EmphasizeElements } from "../EmphasizeElements";
import { PerModelCategoryVisibility } from "../PerModelCategoryVisibility";
import { type ChangeFlags } from "../ChangeFlags";
import { ContextRealityModelState } from "../ContextRealityModelState";
import { FeatureSymbology } from "../render/FeatureSymbology";
import { SceneContext } from "../ViewContext";
import { GeometricModel3dState } from "../ModelState";
import { OffScreenViewport } from "../Viewport";
import { SpatialViewState } from "../SpatialViewState";
import { ViewRect } from "../common/ViewRect";
import { createPrimaryTileTreeReference } from "../internal/tile/PrimaryTileTree";
import { openBlankViewport } from "./openBlankViewport";
import { createBlankConnection } from "./createBlankConnection";

describe("Primary appearance changes", () => {
  beforeAll(async () => IModelApp.startup({ localization: new EmptyLocalization() }));
  afterAll(async () => IModelApp.shutdown());
  afterEach(() => vi.restoreAllMocks());

  for (const scene of ["ordinary", "shadows", "sheet"] as const) {
    it(`conditionally rebuilds the scene for ${scene} views`, async () => {
      using vp = openBlankViewport();
      await vi.waitFor(() => expect(vp.primaryIModelRef.isLoadingComplete).toBe(true));
      vi.spyOn(vp.displayStyle, "wantShadows", "get").mockReturnValue(scene === "shadows");
      vi.spyOn(vp.view, "isSheetView").mockReturnValue(scene === "sheet");
      const ref = vp.primaryIModelRef;
      const changed = vi.fn();
      vp.target.overrideFeatureSymbology = changed;
      const provider = { addFeatureOverrides: vi.fn() };
      vp.addFeatureOverrideProvider(provider);
      vp.renderFrame();
      const createScene = vi.spyOn(vp.view, "createScene");
      const mutations = [
        () => vp.setFeatureOverrideProviderChanged(),
        () => ref.invalidateSymbologyOverrides(),
        () => ref.neverDrawnElements.add("0x123"),
        () => ref.neverDrawnElements.clear(),
        () => ref.alwaysDrawnElements.add("0x123"),
        () => ref.alwaysDrawnElements.clear(),
        () => ref.isAlwaysDrawnExclusive = true,
        () => ref.featureOverrideProviders.add({ addFeatureOverrides: () => {} }),
        () => vp.timePoint = 1,
        () => vp.displayStyle.settings.analysisFraction = 0.4,
        () => vp.displayStyle.overrideSubCategory("0x321", SubCategoryOverride.fromJSON({ color: 0xff })),
        () => vp.displayStyle.settings.overrideModelAppearance("0x123", FeatureAppearance.fromJSON({ transparency: 0.5 })),
        () => vp.displayStyle.settings.addExcludedElements("0x456"),
        () => vp.setNeverDrawn(new Set(["0x123"])),
        () => vp.setNeverDrawn(ref.neverDrawnElements),
        () => vp.clearNeverDrawn(),
        () => vp.setAlwaysDrawn(new Set(["0x123"])),
        () => vp.setAlwaysDrawn(ref.alwaysDrawnElements),
        () => vp.clearAlwaysDrawn(),
        () => ref.isAlwaysDrawnExclusive = true,
        () => vp.clearAlwaysDrawn(),
      ];
      for (const mutate of mutations) {
        createScene.mockClear();
        changed.mockClear();
        provider.addFeatureOverrides.mockClear();
        mutate();
        expect(vp.sceneValid).toBe(scene === "ordinary");
        vp.renderFrame();
        expect(createScene).toHaveBeenCalledTimes(scene === "ordinary" ? 0 : 1);
        expect(changed).toHaveBeenCalledOnce();
        expect(provider.addFeatureOverrides).toHaveBeenCalledOnce();
      }
    });
  }

  it("does not recreate a static-camera scene for appearance-only schedule playback", async () => {
    using vp = openBlankViewport();
    await vi.waitFor(() => expect(vp.primaryIModelRef.isLoadingComplete).toBe(true));
    const script = RenderSchedule.Script.fromJSON([{
      modelId: "0x123", elementTimelines: [],
      visibilityTimeline: [{ time: 0, value: 100 }, { time: 60, value: 0 }],
    }])!;
    vp.view.displayStyle.scheduleScript = script;
    vp.renderFrame();
    const createScene = vi.spyOn(vp.view, "createScene");
    const override = vi.spyOn(vp.target, "overrideFeatureSymbology");
    for (let time = 1; time <= 60; ++time) {
      vp.timePoint = time;
      vp.renderFrame();
    }

    expect(createScene).not.toHaveBeenCalled();
    expect(override).toHaveBeenCalledTimes(60);
  });

  it("uses the public style schedule script for primary overrides", () => {
    using vp = openBlankViewport();
    const script = RenderSchedule.Script.fromJSON([{ modelId: "0x123", elementTimelines: [], visibilityTimeline: [{ time: 0, value: 50 }] }])!;
    vi.spyOn(vp.displayStyle, "scheduleScript", "get").mockReturnValue(script);
    for (const overrides of [new FeatureSymbology.Overrides(vp.view), new FeatureSymbology.Overrides(vp), vp.primaryIModelRef.getSymbologyOverrides()])
      expect(overrides.getModelOverridesById("0x123")?.transparency).toBe(0.5);
  });

  it("still rebuilds scenes for linked reference appearance changes", async () => {
    using vp = openBlankViewport();
    const other = createBlankConnection();
    try {
      const refs = vp.iModelRefs;
      if (!refs.isSpatial)
        throw new Error("Expected spatial references");

      const linked = refs.link({ iModel: other });
      await vi.waitFor(() => expect(linked.isLoadingComplete).toBe(true));
      for (const mutate of [
        () => linked.invalidateSymbologyOverrides(),
        () => linked.neverDrawnElements.add("0x123"),
        () => linked.alwaysDrawnElements.add("0x123"),
        () => linked.isAlwaysDrawnExclusive = true,
      ]) {
        vp.setAllValid();
        mutate();
        expect(vp.sceneValid).toBe(false);
      }
    } finally {
      other.closeSync();
    }
  });

  it("inherits target overrides for primary native tiles but retains linked branch overrides", () => {
    using vp = openBlankViewport();
    const other = createBlankConnection();
    try {
      const refs = vp.iModelRefs;
      if (!refs.isSpatial)
        throw new Error("Expected spatial references");

      const linked = refs.link({ iModel: other });
      for (const ref of [refs.primary, linked]) {
        const model = new GeometricModel3dState({ id: "0x123", classFullName: "BisCore:PhysicalModel", modeledElement: { id: "0x123" } }, ref.iModel);
        const treeRef = createPrimaryTileTreeReference(ref, model);
        const overrides = (treeRef as any).getSymbologyOverrides(undefined, new SceneContext(vp));
        expect(overrides).toBe(ref === refs.primary ? undefined : linked.getSymbologyOverrides());
      }
    } finally {
      other.closeSync();
    }
  });

  it("notifies detached external tree owners when explicitly enabled categories are ready to draw", async () => {
    using vp = openBlankViewport();
    const owner = vp.view.clone().iModelRefs.primary;
    await vi.waitFor(() => expect(owner.isLoadingComplete).toBe(true));
    vi.spyOn(vp.iModel, "isClosed", "get").mockReturnValue(false);
    vi.spyOn(vp.iModel, "querySubCategories").mockResolvedValue([{ parentId: "0x10", id: "0x11", appearance: {} }]);
    const loaded = vi.fn(() => vp.invalidateScene());
    owner.onViewedCategoriesLoaded.addListener(loaded);
    owner.changeCategoryDisplay({ categories: ["0x10"], display: true });
    await vi.waitFor(() => expect(loaded).toHaveBeenCalledOnce());
    expect(owner.getSymbologyOverrides().isSubCategoryIdVisible("0x11")).toBe(true);
  });

  it("honors another view's primary overrides for its supplied tile references", () => {
    using vp = openBlankViewport();
    const owner = vp.view.clone().iModelRefs.primary;
    owner.neverDrawnElements.add("0x55");
    const model = new GeometricModel3dState({ id: "0x123", classFullName: "BisCore:PhysicalModel", modeledElement: { id: "0x123" } }, owner.iModel);
    const ref = createPrimaryTileTreeReference(owner, model);
    const otherTree = createPrimaryTileTreeReference(owner, model);
    const provider = { addFeatureOverrides: vi.fn() };
    owner.featureOverrideProviders.add(provider);
    const context = new SceneContext(vp);
    const snapshot = (ref as any).getSymbologyOverrides(undefined, context) as FeatureSymbology.Overrides;
    expect(snapshot.neverDrawn.hasId("0x55")).toBe(true);
    expect((otherTree as any).getSymbologyOverrides(undefined, context)).toBe(snapshot);
    expect(provider.addFeatureOverrides).toHaveBeenCalledOnce();
    owner.neverDrawnElements.clear();
    const next = (ref as any).getSymbologyOverrides(undefined, new SceneContext(vp)) as FeatureSymbology.Overrides;
    expect(next.neverDrawn.hasId("0x55")).toBe(false);
    expect(provider.addFeatureOverrides).toHaveBeenCalledTimes(2);
    expect(vp.primaryIModelRef.getSymbologyOverrides().neverDrawn.hasId("0x55")).toBe(false);
  });

  it("does not announce a provider change for visibility or replace the snapshot for an analysis fraction", async () => {
    using vp = openBlankViewport();
    await vi.waitFor(() => expect(vp.primaryIModelRef.isLoadingComplete).toBe(true));
    vp.renderFrame();
    const providerChanged = vi.fn();
    vp.onFeatureOverrideProviderChanged.addListener(providerChanged);
    const apply = vi.spyOn(vp.target, "overrideFeatureSymbology");
    vp.primaryIModelRef.neverDrawnElements.add("0x123");
    vp.renderFrame();
    expect(providerChanged).not.toHaveBeenCalled();
    expect(apply).toHaveBeenCalledOnce();
    vp.displayStyle.settings.analysisFraction = 0.5;
    vp.renderFrame();
    expect(apply).toHaveBeenCalledOnce();
    expect(vp.target.analysisFraction).toBe(0.5);
    const overridesChanged = vi.fn();
    vp.onFeatureOverridesChanged.addListener(overridesChanged);
    vp.primaryIModelRef.invalidateSymbologyOverrides();
    vp.renderFrame();
    expect(overridesChanged).toHaveBeenCalledOnce();
    expect(providerChanged).not.toHaveBeenCalled();

    const ref = vp.primaryIModelRef;
    if (!ref.isSpatial())
      throw new Error("Expected a spatial reference");
    let flags: ChangeFlags | undefined;
    vp.onViewportChanged.addListener((_vp, changes) => { flags = changes; });
    const appearance = FeatureAppearance.fromJSON({ transparency: 0.75 });
    ref.overrides.defaultFeatureAppearance = appearance;
    ref.viewedModels.add("0x923");
    vp.renderFrame();
    expect(apply.mock.calls.at(-1)?.[0].defaultOverrides).toBe(appearance);
    expect(overridesChanged).toHaveBeenCalledTimes(2);
    expect(providerChanged).not.toHaveBeenCalled();
    expect(flags?.viewedModels).toBe(true);
    expect(flags?.areFeatureOverridesDirty).toBe(true);
    expect(flags?.featureOverrideProvider).toBe(false);
  });

  it("installs cached view snapshots without reporting an overrides change after attachment", async () => {
    using vp = openBlankViewport();
    await vi.waitFor(() => expect(vp.areAllTileTreesLoaded).toBe(true));
    vp.renderFrame();
    const provider = { addFeatureOverrides: vi.fn() };
    vp.addFeatureOverrideProvider(provider);
    vp.renderFrame();
    const providerChanged = vi.fn();
    vp.onFeatureOverrideProviderChanged.addListener(providerChanged);
    const changed = vi.fn();
    vp.onFeatureOverridesChanged.addListener(changed);
    vp.changeView(vp.view.clone());
    await vi.waitFor(() => expect(vp.areAllTileTreesLoaded).toBe(true));
    vp.renderFrame();
    expect(changed).not.toHaveBeenCalled();
    expect(providerChanged).not.toHaveBeenCalled();
    expect(vp.findFeatureOverrideProvider((p) => p === provider)).toBe(provider);
  });

  for (const replace of ["changeView", "applyViewState"] as const) {
    it.each(["default", "reference provider", "model-dependent provider", "constant provider"] as const)(`${replace}: reports the installed appearance, not merely a new snapshot (%s)`, async (source) => {
      using vp = openBlankViewport();
      const model = "0x123";
      if (source === "model-dependent provider" || source === "constant provider") {
        vp.addFeatureOverrideProvider({ addFeatureOverrides: (overrides, viewport) => {
          const transparency = source === "model-dependent provider" && viewport.view.viewsModel(model) ? 0.8 : 0.2;
          overrides.override({ elementId: "0x321", appearance: FeatureAppearance.fromJSON({ transparency }) });
        } });
      }
      await vi.waitFor(() => expect(vp.areAllTileTreesLoaded).toBe(true));
      const applied = vi.spyOn(vp.target, "overrideFeatureSymbology");
      vp.renderFrame();
      const next = vp.view.clone();
      if (source === "default")
        next.iModelRefs.primary.overrides.defaultFeatureAppearance = FeatureAppearance.fromJSON({ transparency: 0.8 });
      else if (source === "reference provider")
        next.iModelRefs.primary.featureOverrideProviders.add({ addFeatureOverrides: (overrides) => overrides.setNeverDrawn("0x321") });
      else if (next.isSpatialView())
        next.modelSelector.models.add(model);

      const dirty = vi.fn();
      vp.onViewportChanged.addListener((_vp, flags) => dirty(flags.areFeatureOverridesDirty));
      const readAppearance = () => {
        const installed = applied.mock.lastCall?.[0];
        if (source === "reference provider")
          return installed?.neverDrawn.hasId("0x321");
        return source === "default" ? installed?.defaultOverrides.transparency : installed?.getElementOverridesById("0x321")?.transparency;
      };
      const changed = vi.fn();
      vp.onFeatureOverridesChanged.addListener(() => changed(readAppearance()));
      const registration = vi.fn();
      vp.onFeatureOverrideProviderChanged.addListener(registration);
      vp[replace](next);
      await vi.waitFor(() => expect(vp.areAllTileTreesLoaded).toBe(true));
      vp.renderFrame();
      const expected = source === "reference provider" ? true : source === "constant provider" ? 0.2 : 0.8;
      expect(readAppearance()).toBe(expected);
      if (source === "constant provider") {
        expect(changed).not.toHaveBeenCalled();
        expect(dirty).not.toHaveBeenCalledWith(true);
      } else {
        expect(changed).toHaveBeenCalledExactlyOnceWith(expected);
        expect(dirty).toHaveBeenCalledExactlyOnceWith(true);
      }
      if (source !== "reference provider")
        expect(registration).not.toHaveBeenCalled();
      vp.renderFrame();
      expect(changed).toHaveBeenCalledTimes(source === "constant provider" ? 0 : 1);
    });

    it(`${replace}: compares animated emphasis with the IDs installed on the previous frame`, async () => {
      using vp = openBlankViewport();
      const emphasis = EmphasizeElements.getOrCreate(vp);
      emphasis.isolateElements(["0x1", "0x2"], vp);
      emphasis.emphasizeElements(["0x1"], vp);
      vp.addFeatureOverrideProvider({ addFeatureOverrides: (overrides) => {
        // Keep the element entries equal across snapshots: only the animation filter changes.
        overrides.override({ elementId: "0x2", appearance: FeatureAppearance.defaults });
        overrides.animationNodeOverrides.set(1, FeatureAppearance.fromJSON({ transparency: 0.35 }));
      } });
      await vi.waitFor(() => expect(vp.areAllTileTreesLoaded).toBe(true));
      const applied = vi.spyOn(vp.target, "overrideFeatureSymbology");
      vp.renderFrame();
      const appearance = () => applied.mock.lastCall?.[0].getFeatureAppearance(new Feature("0x2"), "0x3", undefined, 1);
      expect(appearance()).toBeDefined();
      expect(appearance()?.transparency).toBeUndefined();
      const changed = vi.fn();
      vp.onFeatureOverridesChanged.addListener(() => changed(appearance()?.transparency));
      emphasis.getEmphasizedIsolatedElements()!.add("0x2");
      vp[replace](vp.view.clone());
      await vi.waitFor(() => expect(vp.areAllTileTreesLoaded).toBe(true));
      vp.renderFrame();
      expect(appearance()?.transparency).toBe(0.35);
      expect(changed).toHaveBeenCalledExactlyOnceWith(0.35);
    });

    it(`${replace}: preserves a real visibility edit made by a listener during migration`, async () => {
      using vp = openBlankViewport();
      vp.setNeverDrawn(new Set(["0x77"]));
      await vi.waitFor(() => expect(vp.areAllTileTreesLoaded).toBe(true));
      vp.renderFrame();
      const next = vp.view.clone();
      const hidden = next.iModelRefs.primary.neverDrawnElements;
      hidden.onBatchAdded.addOnce(() => hidden.add("0x78"));
      const applied = vi.spyOn(vp.target, "overrideFeatureSymbology");
      const changed = vi.fn();
      vp.onNeverDrawnChanged.addListener(() => changed(applied.mock.lastCall?.[0].neverDrawn.hasId("0x78")));
      vp[replace](next);
      await vi.waitFor(() => expect(vp.areAllTileTreesLoaded).toBe(true));
      vp.renderFrame();
      expect(changed).toHaveBeenCalledExactlyOnceWith(true);
    });

    it(`${replace}: does not announce copied visibility or unchanged emphasis`, async () => {
      using vp = openBlankViewport();
      vp.iModel.subcategories.add("0x10", "0x11", new SubCategoryAppearance(), true);
      vp.setNeverDrawn(new Set(["0x77"]));
      EmphasizeElements.getOrCreate(vp).emphasizeElements(["0x88"], vp);
      vp.addFeatureOverrideProvider({ addFeatureOverrides: (overrides) => overrides.animationNodeOverrides.set(1, FeatureAppearance.fromJSON({ transparency: 0.3 })) });
      vp.perModelCategoryVisibility.setOverride("0x20", "0x10", PerModelCategoryVisibility.Override.Hide);
      await vi.waitFor(() => expect(vp.areAllTileTreesLoaded).toBe(true));
      vp.renderFrame();
      const changed = vi.fn();
      for (const event of [vp.onFeatureOverridesChanged, vp.onNeverDrawnChanged, vp.onAlwaysDrawnChanged, vp.onViewedCategoriesPerModelChanged, vp.onFeatureOverrideProviderChanged])
        event.addListener(changed);
      vp[replace](vp.view.clone());
      await vi.waitFor(() => expect(vp.areAllTileTreesLoaded).toBe(true));
      vp.renderFrame();
      expect(vp.neverDrawn?.has("0x77")).toBe(true);
      expect(vp.alwaysDrawn?.has("0x88")).toBe(true);
      expect(changed).not.toHaveBeenCalled();
    });
  }

  it.each([true, false])("does not move or drop a provider when a view is already attached (same connection: %s)", (same) => {
    const model = createBlankConnection();
    try {
      using first = openBlankViewport({ iModel: model });
      using second = openBlankViewport(same ? { iModel: model } : {});
      const original = first.view;
      const provider = { addFeatureOverrides: vi.fn() };
      first.addFeatureOverrideProvider(provider);
      expect(() => first.changeView(second.view)).toThrow(/already attached/);
      expect(first.view).toBe(original);
      expect(first.findFeatureOverrideProvider((p) => p === provider)).toBe(provider);
      expect(second.primaryIModelRef.featureOverrideProviders.size).toBe(0);
      expect(first.primaryIModelRef.featureOverrideProviders.size).toBe(1);
    } finally {
      model.closeSync();
    }
  });

  it("applies animator visibility changes before dispatching the frame's change event", async () => {
    using vp = openBlankViewport();
    await vi.waitFor(() => expect(vp.areAllTileTreesLoaded).toBe(true));
    vp.renderFrame();
    const applied = vi.spyOn(vp.target, "overrideFeatureSymbology");
    const changed = vi.fn(() => expect(applied.mock.lastCall?.[0].neverDrawn.hasId("0x123")).toBe(true));
    vp.onNeverDrawnChanged.addListener(changed);
    vp.setAnimator({ interrupt: () => {}, animate: vi.fn().mockReturnValueOnce(false).mockImplementation(() => { vp.primaryIModelRef.neverDrawnElements.add("0x123"); return true; }) });
    vp.renderFrame();
    expect(changed).toHaveBeenCalledOnce();
    vp.renderFrame();
    expect(applied).toHaveBeenCalledOnce();
    expect(changed).toHaveBeenCalledOnce();
  });

  it.each(["view", "style", "settings"] as const)("refreshes fraction-dependent subcategory visibility from a custom %s without a provider", (source) => {
    using vp = openBlankViewport();
    vp.iModel.subcategories.add("0x10", "0x11", new SubCategoryAppearance(), true);
    vp.primaryIModelRef.viewedCategories.add("0x10");
    const hooks = { view: vp.view, style: vp.displayStyle, settings: vp.displayStyle.settings };
    vi.spyOn(hooks[source], "getSubCategoryOverride").mockImplementation(() => SubCategoryOverride.fromJSON({ invisible: vp.displayStyle.settings.analysisFraction >= 0.5 }));
    const apply = vi.spyOn(vp.target, "overrideFeatureSymbology");
    for (const fraction of [0.1, 0.7]) {
      vp.displayStyle.settings.analysisFraction = fraction;
      vp.renderFrame();
      expect(apply.mock.lastCall?.[0].isSubCategoryIdVisible("0x11")).toBe(fraction < 0.5);
    }
  });

  it("refreshes a registered provider that reads the analysis fraction", () => {
    using vp = openBlankViewport();
    vp.addFeatureOverrideProvider({ addFeatureOverrides: (o, viewport) => o.override({ elementId: "0xa", appearance: FeatureAppearance.fromJSON({ transparency: viewport.displayStyle.settings.analysisFraction }) }) });
    const apply = vi.spyOn(vp.target, "overrideFeatureSymbology");
    for (const fraction of [0.1, 0.7]) {
      vp.displayStyle.settings.analysisFraction = fraction;
      vp.renderFrame();
      expect(apply.mock.calls.at(-1)?.[0].getElementOverridesById("0xa")?.transparency).toBe(fraction);
    }
  });

  it("uses the same rules for viewport and reference overrides", () => {
    using vp = openBlankViewport();
    const ref = vp.primaryIModelRef;
    if (!ref.isSpatial())
      throw new Error("Expected spatial reference");

    ref.isAlwaysDrawnExclusive = true;
    ref.planProjectionSettings.set("0x123", PlanProjectionSettings.fromJSON({ transparency: 0.5 })!);
    const appearance = FeatureAppearance.fromJSON({ transparency: 0.75 });
    vp.addFeatureOverrideProvider({ addFeatureOverrides: (ovrs) => ovrs.override({ modelId: "0x123", appearance }) });
    const fromRef = ref.getSymbologyOverrides();
    const fromViewport = new FeatureSymbology.Overrides(vp);
    expect(fromRef.isAlwaysDrawnExclusive).toBe(true);
    expect(fromViewport.isAlwaysDrawnExclusive).toBe(true);
    expect(fromRef.getModelOverridesById("0x123")?.transparency).toBe(0.75);
    expect(fromViewport.getModelOverridesById("0x123")?.transparency).toBe(0.75);

    const other = createBlankConnection();
    try {
      if (!vp.iModelRefs.isSpatial)
        throw new Error("Expected spatial references");
      const linked = vp.iModelRefs.link({ iModel: other });
      linked.planProjectionSettings.set("0x123", ref.planProjectionSettings.get("0x123")!);
      linked.featureOverrideProviders.add({ addFeatureOverrides: (ovrs) => ovrs.override({ modelId: "0x123", appearance }) });
      expect(linked.getSymbologyOverrides().getModelOverridesById("0x123")?.transparency).toBe(0.5);
    } finally {
      other.closeSync();
    }
  });

  it("applies visibility changes made during setupFromView before completing an offscreen render", async () => {
    const iModel = createBlankConnection();
    try {
      const view = SpatialViewState.createBlank(iModel, { x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 });
      using vp = OffScreenViewport.create({ view, viewRect: new ViewRect(0, 0, 100, 100) });
      await vp.waitForSceneCompletion();

      let installed: FeatureSymbology.Overrides | undefined;
      vi.spyOn(vp.target, "overrideFeatureSymbology").mockImplementation((ovrs) => { installed = ovrs; });
      const events: boolean[] = [];
      vp.onNeverDrawnChanged.addListener(() => events.push(installed?.neverDrawn.hasId("0x123") ?? false));
      vp.onViewChanged.addOnce(() => vp.setNeverDrawn(new Set(["0x123"])));

      vp.invalidateController();
      await vp.waitForSceneCompletion();

      expect(installed?.neverDrawn.hasId("0x123")).toBe(true);
      expect(events).toEqual([true]);
    } finally {
      iModel.closeSync();
    }
  });

  it("does not emit spurious symbology change events when invalidating a settled schedule script scene", async () => {
    using vp = openBlankViewport();
    await vi.waitFor(() => expect(vp.primaryIModelRef.isLoadingComplete).toBe(true));
    const script = RenderSchedule.Script.fromJSON([{
      modelId: "0x123", elementTimelines: [],
      visibilityTimeline: [{ time: 0, value: 100, interpolation: RenderSchedule.Interpolation.Linear }, { time: 60, value: 0 }],
    }])!;
    vp.displayStyle.scheduleScript = script;
    vp.timePoint = 30;
    vp.renderFrame();

    const changed = vi.fn();
    vp.onFeatureOverridesChanged.addListener(changed);
    const viewportChanged = vi.fn();
    vp.onViewportChanged.addListener(viewportChanged);

    for (let i = 0; i < 3; ++i) {
      vp.invalidateScene();
      vp.renderFrame();
    }

    expect(changed).not.toHaveBeenCalled();
    expect(viewportChanged).not.toHaveBeenCalled();

    const applied = vi.spyOn(vp.target, "overrideFeatureSymbology");
    vp.timePoint = 45;
    vp.renderFrame();
    expect(changed).toHaveBeenCalledOnce();
    expect(viewportChanged).toHaveBeenCalledOnce();
    expect(applied.mock.lastCall?.[0].getModelOverridesById("0x123")?.transparency).toBe(0.75);
  });

  it("refreshes fraction-dependent reality model appearance from a custom forEachRealityModel hook", () => {
    using vp = openBlankViewport();
    vp.renderFrame();

    const apply = vi.spyOn(vp.target, "overrideFeatureSymbology");
    vp.displayStyle.settings.analysisFraction = 0.5;
    vp.renderFrame();
    expect(apply).not.toHaveBeenCalled();
    expect(vp.target.analysisFraction).toBe(0.5);

    vi.spyOn(vp.displayStyle, "forEachRealityModel").mockImplementation((func) => {
      func({
        modelId: "0x99",
        appearanceOverrides: FeatureAppearance.fromJSON({ transparency: vp.displayStyle.settings.analysisFraction }),
      } as ContextRealityModelState);
    });

    for (const fraction of [0.2, 0.8]) {
      vp.displayStyle.settings.analysisFraction = fraction;
      vp.renderFrame();
      expect(apply.mock.lastCall?.[0].getModelOverridesById("0x99")?.transparency).toBe(fraction);
    }
  });
});
