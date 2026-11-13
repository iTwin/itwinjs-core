/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { EmptyLocalization, FeatureAppearance, PlanProjectionSettings, RenderSchedule, SubCategoryOverride } from "@itwin/core-common";
import { IModelApp } from "../IModelApp";
import { FeatureSymbology } from "../render/FeatureSymbology";
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
        () => vp.displayStyle.overrideSubCategory("0x321", SubCategoryOverride.fromJSON({ color: 0xff })),
        () => vp.displayStyle.settings.overrideModelAppearance("0x123", FeatureAppearance.fromJSON({ transparency: 0.5 })),
        () => vp.displayStyle.settings.addExcludedElements("0x456"),
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
        const overrides = (treeRef as unknown as { getSymbologyOverrides(): FeatureSymbology.Overrides | undefined }).getSymbologyOverrides();
        expect(overrides).toBe(ref === refs.primary ? undefined : linked.getSymbologyOverrides());
      }
    } finally {
      other.closeSync();
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
  });
});
