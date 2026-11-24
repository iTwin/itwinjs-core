/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable @typescript-eslint/no-deprecated -- Verify the still-supported viewport visibility methods. */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { EmptyLocalization, FeatureAppearance, PlanProjectionSettings, RenderSchedule, SubCategoryAppearance, SubCategoryOverride } from "@itwin/core-common";
import { IModelApp } from "../IModelApp";
import { type ChangeFlags } from "../ChangeFlags";
import { FeatureSymbology } from "../render/FeatureSymbology";
import { SceneContext } from "../ViewContext";
import { GeometricModel3dState } from "../ModelState";
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
});
