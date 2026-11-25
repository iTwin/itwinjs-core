/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { ColorDef, EmptyLocalization, FeatureAppearance, FeatureOverrideType, SubCategoryAppearance, SubCategoryOverride } from "@itwin/core-common";
import { EmphasizeElements, EmphasizeIModelElements } from "../EmphasizeElements";
import { IModelApp } from "../IModelApp";
import { OffScreenViewport } from "../Viewport";
import { SpatialViewState } from "../SpatialViewState";
import { DisplayStyle3dState } from "../DisplayStyleState";
import { PerModelCategoryVisibility } from "../PerModelCategoryVisibility";
import { ViewRect } from "../common/ViewRect";
import { FeatureSymbology } from "../render/FeatureSymbology";
import { openBlankViewport } from "./openBlankViewport";

// The legacy subclass contract remains supported even though new code can use reference-specific providers.
describe("Legacy display compatibility", () => {
  beforeAll(async () => IModelApp.startup({ localization: new EmptyLocalization() }));
  afterAll(async () => IModelApp.shutdown());
  afterEach(() => vi.restoreAllMocks());

  class ProtectedElements extends EmphasizeElements {
    public override hideElements() { return false; }
    public override isolateElements() { return false; }
    public override emphasizeElements() { return false; }
    public override overrideElements() { return false; }
  }

  for (const operation of ["hide", "isolate", "emphasize", "override"] as const) {
    it(`dispatches ${operation}SelectedElements through the subclass`, () => {
      using vp = openBlankViewport();
      const provider = new ProtectedElements();
      vp.iModel.selectionSet.add("0x123");
      const result = operation === "override" ? provider.overrideSelectedElements(vp, ColorDef.red)
        : operation === "emphasize" ? provider.emphasizeSelectedElements(vp)
          : operation === "isolate" ? provider.isolateSelectedElements(vp) : provider.hideSelectedElements(vp);
      expect(result).toBe(false);
      expect(vp.iModel.selectionSet.elements.has("0x123")).toBe(true);
      expect(vp.primaryIModelRef.neverDrawnElements.size).toBe(0);
      expect(vp.primaryIModelRef.alwaysDrawnElements.size).toBe(0);
      expect(provider.getOverriddenElements()).toBeUndefined();
    });
  }

  it("uses subclass override keys for explicit and deserialized overrides", () => {
    using vp = openBlankViewport();
    class NoOverrides extends EmphasizeElements {
      public override createOverrideKey() { return undefined; }
    }
    const provider = new NoOverrides();
    expect(provider.overrideElements(["0x123"], vp, ColorDef.red)).toBe(false);
    expect(provider.fromJSON({ appearanceOverride: [{ ids: ["0x123"], color: ColorDef.red.toJSON() }] }, vp)).toBe(false);
    expect(provider.getOverriddenElements()).toBeUndefined();
  });

  for (const referenceSpecific of [false, true]) {
    it(`does not resurrect old colors after replacing overrides (${referenceSpecific ? "reference" : "legacy"} provider)`, () => {
      using vp = openBlankViewport();
      const legacy = new EmphasizeElements();
      const reference = EmphasizeIModelElements.getOrCreate(vp.primaryIModelRef);
      const provider = referenceSpecific ? reference : legacy;
      const ids = new Set(["0x123"]);
      if (referenceSpecific) {
        reference.overrideElements(ids, ColorDef.red);
        reference.overrideElements(ids, ColorDef.blue);
      } else {
        legacy.overrideElements(ids, vp, ColorDef.red);
        legacy.overrideElements(ids, vp, ColorDef.blue);
      }
      expect(provider.getOverriddenElements()?.size).toBe(1);
      const blue = provider.createOverrideKey(ColorDef.blue, FeatureOverrideType.ColorOnly)!;
      if (referenceSpecific)
        reference.clearOverriddenElements(blue);
      else
        legacy.clearOverriddenElements(vp, blue);
      expect(provider.getOverriddenElements()).toBeUndefined();
    });
  }

  it("retains setter and getter hooks in the legacy operations", () => {
    using vp = openBlankViewport();
    class NoVisibilityChanges extends EmphasizeElements {
      public override setNeverDrawnElements() { return false; }
      public override setAlwaysDrawnElements() { return false; }
      public override getAlwaysDrawnElements() { return new Set(["0x456"]); }
    }
    const provider = new NoVisibilityChanges();
    expect(provider.hideElements(["0x123"], vp)).toBe(false);
    expect(provider.isolateElements(["0x123"], vp)).toBe(false);
    expect(provider.emphasizeElements(["0x123"], vp)).toBe(false);
    expect(provider.fromJSON({ neverDrawn: ["0x123"], alwaysDrawn: ["0x123"] }, vp)).toBe(false);
    vp.primaryIModelRef.alwaysDrawnElements.add("0x77");
    expect(provider.fromJSON({ alwaysDrawn: [], isAlwaysDrawnExclusive: true }, vp)).toBe(false);
    expect(provider.fromJSON({ isAlwaysDrawnExclusive: true }, vp)).toBe(false);
    expect(vp.primaryIModelRef.isAlwaysDrawnExclusive).toBe(false);
    expect([...vp.primaryIModelRef.alwaysDrawnElements]).toEqual(["0x77"]);
    expect(provider.isActive(vp)).toBe(true);
    expect(provider.toJSON(vp).alwaysDrawn).toEqual(["0x456"]);
  });

  it("renders color overrides through an overridden emphasis accessor", () => {
    using vp = openBlankViewport();
    class AccessorProvider extends EmphasizeElements {
      private _emphasis = false;
      public override get wantEmphasis() { return this._emphasis; }
      public override set wantEmphasis(value: boolean) { this._emphasis = value; }
    }
    const provider = new AccessorProvider();
    provider.fromJSON({ wantEmphasis: true }, vp);
    provider.overrideElements(["0x123"], vp, ColorDef.red);
    const overrides = new FeatureSymbology.Overrides();
    provider.addFeatureOverrides(overrides, vp);
    expect(provider.toJSON(vp).wantEmphasis).toBe(true);
    expect(overrides.getElementOverridesById("0x123")?.emphasized).toBe(true);
  });

  it("round-trips and renders an overridden default-appearance accessor", () => {
    using vp = openBlankViewport();
    class AccessorProvider extends EmphasizeElements {
      private _appearance?: FeatureAppearance;
      public override get defaultAppearance() { return this._appearance; }
      public override set defaultAppearance(value: FeatureAppearance | undefined) { this._appearance = value; }
    }
    const provider = new AccessorProvider();
    const props = { defaultAppearance: { transparency: 0.8 }, alwaysDrawn: ["0x123"] };
    expect(provider.fromJSON(props, vp)).toBe(true);
    expect(provider.defaultAppearance?.transparency).toBe(0.8);
    expect(provider.toJSON(vp).defaultAppearance?.transparency).toBe(0.8);
    const overrides = new FeatureSymbology.Overrides();
    provider.addFeatureOverrides(overrides, vp);
    expect(overrides.defaultOverrides.transparency).toBe(0.8);
    expect(provider.isActive(vp)).toBe(true);
    expect(provider.getEmphasizedElements(vp)?.has("0x123")).toBe(true);
    expect(provider.clearEmphasizedElements(vp)).toBe(true);
    expect(provider.defaultAppearance).toBeUndefined();
    expect(provider.isActive(vp)).toBe(false);
    expect(provider.emphasizeElements(["0x123"], vp)).toBe(true);
    expect(provider.defaultAppearance).toBeDefined();
    expect(provider.isolateElements(["0x123"], vp)).toBe(true);
    expect(provider.defaultAppearance).toBeUndefined();
    expect(provider.fromJSON({ defaultAppearance: { transparency: 0.8 } }, vp)).toBe(true);
    expect(provider.fromJSON({ defaultAppearance: { transparency: 0.8 } }, vp)).toBe(false);
  });

  it("uses the same custom key decoder for rendering and JSON", () => {
    using vp = openBlankViewport();
    class CustomKeys extends EmphasizeElements {
      public override createOverrideKey() { return 7; }
      public override getOverrideFromKey() { return { color: ColorDef.red, overrideType: FeatureOverrideType.ColorOnly }; }
    }
    const provider = new CustomKeys();
    provider.overrideElements(["0x123"], vp, ColorDef.red);
    const overrides = new FeatureSymbology.Overrides();
    provider.addFeatureOverrides(overrides, vp);
    expect(overrides.getElementOverridesById("0x123")?.rgb?.r).toBe(255);
    expect(provider.toJSON(vp).appearanceOverride?.[0].color).toBe(ColorDef.red.toJSON());
  });

  it("notifies once when clearing isolation changes the provider's emphasized set", () => {
    using vp = openBlankViewport();
    const provider = EmphasizeElements.getOrCreate(vp);
    provider.isolateElements(["0x1", "0x2"], vp);
    provider.emphasizeElements(["0x1"], vp);
    vp.renderFrame();
    const changed = vi.fn();
    vp.onFeatureOverrideProviderChanged.addListener(changed);
    expect(provider.clearIsolatedElements(vp)).toBe(true);
    vp.renderFrame();
    expect(changed).toHaveBeenCalledOnce();
  });

  it("uses subclass appearance hooks when building overrides", () => {
    using vp = openBlankViewport();
    class CustomAppearance extends EmphasizeElements {
      public override createAppearanceFromKey() { return FeatureAppearance.fromJSON({ transparency: 0.9 }); }
    }
    const provider = new CustomAppearance();
    provider.overrideElements(["0x123"], vp, ColorDef.red);
    const overrides = new FeatureSymbology.Overrides();
    provider.addFeatureOverrides(overrides, vp);
    expect(overrides.getElementOverridesById("0x123")?.transparency).toBe(0.9);
  });

  it("reuses override arguments across large emphasis and color sets", () => {
    using vp = openBlankViewport();
    const provider = new EmphasizeElements();
    const emphasized = Array.from({ length: 1000 }, (_, i) => `0x${(i + 1).toString(16)}`);
    const colored = Array.from({ length: 1000 }, (_, i) => `0x${(i + 0x10000).toString(16)}`);
    provider.emphasizeElements(emphasized, vp);
    provider.overrideElements(colored.slice(0, 500), vp, ColorDef.red);
    provider.overrideElements(colored.slice(500), vp, ColorDef.blue);
    const overrides = new FeatureSymbology.Overrides();
    const apply = vi.spyOn(overrides, "override");
    provider.addFeatureOverrides(overrides, vp);
    expect(apply).toHaveBeenCalledTimes(2000);
    expect(new Set(apply.mock.calls.slice(0, 1000).map(([args]) => args)).size).toBe(1);
    expect(new Set(apply.mock.calls.slice(1000).map(([args]) => args)).size).toBe(1);
    for (const id of emphasized)
      expect(overrides.getElementOverridesById(id)).toBeDefined();
    for (const id of colored.slice(0, 500))
      expect(overrides.getElementOverridesById(id)?.rgb).toEqual(expect.objectContaining({ r: 255, g: 0, b: 0 }));
    for (const id of colored.slice(500))
      expect(overrides.getElementOverridesById(id)?.rgb).toEqual(expect.objectContaining({ r: 0, g: 0, b: 255 }));
  });

  it("retains nested clearing, ID-set, and serialization hooks", () => {
    using vp = openBlankViewport();
    const provider = new EmphasizeElements();
    const clearHidden = vi.spyOn(provider, "clearNeverDrawnElements").mockReturnValue(false);
    expect(provider.clearHiddenElements(vp)).toBe(false);
    expect(clearHidden).toHaveBeenCalledWith(vp);
    vi.spyOn(provider, "getIsolatedElements").mockReturnValue(new Set(["0x123"]));
    const clearEmphasis = vi.spyOn(provider, "clearEmphasizedIsolatedElements").mockReturnValue(false);
    const clearAlways = vi.spyOn(provider, "clearAlwaysDrawnElements").mockReturnValue(false);
    expect(provider.clearIsolatedElements(vp)).toBe(false);
    expect(clearEmphasis).toHaveBeenCalledWith(vp, true);
    expect(clearAlways).toHaveBeenCalledWith(vp);
    vi.spyOn(provider, "getEmphasizedElements").mockReturnValue(new Set(["0x123"]));
    expect(provider.clearEmphasizedElements(vp)).toBe(false);
    expect(clearEmphasis).toHaveBeenCalledWith(vp, false);
    const update = vi.spyOn(provider, "updateIdSet").mockReturnValue(undefined);
    expect(provider.setNeverDrawnElements(["0x123"], vp)).toBe(false);
    expect(provider.setAlwaysDrawnElements(["0x123"], vp)).toBe(false);
    expect(update).toHaveBeenCalledTimes(2);
    provider.overrideElements(["0x123"], vp, ColorDef.red);
    const decode = vi.spyOn(provider, "getOverrideFromKey");
    expect(provider.toJSON(vp).appearanceOverride).toHaveLength(1);
    expect(decode).toHaveBeenCalledOnce();
  });

  it("preserves existing visibility sets returned by an overridden ID-set hook", () => {
    using vp = openBlankViewport();
    const provider = new EmphasizeElements();
    const ref = vp.primaryIModelRef;
    ref.neverDrawnElements.add("0x123");
    ref.alwaysDrawnElements.add("0x456");
    vi.spyOn(provider, "updateIdSet").mockImplementation((_ids, _replace, existing) => existing);
    expect(provider.hideElements(["0x123"], vp)).toBe(true);
    expect(provider.isolateElements(["0x456"], vp)).toBe(true);
    expect([...ref.neverDrawnElements]).toEqual(["0x123"]);
    expect([...ref.alwaysDrawnElements]).toEqual(["0x456"]);
  });

  it("renders and serializes just the subclass's emphasized isolated IDs", () => {
    using vp = openBlankViewport();
    class Filtered extends EmphasizeElements {
      public override getEmphasizedIsolatedElements() {
        const ids = super.getEmphasizedIsolatedElements();
        return ids ? new Set([...ids].slice(0, 1)) : undefined;
      }
    }
    const provider = new Filtered();
    provider.isolateElements(["0x1", "0x2"], vp);
    provider.emphasizeElements(["0x1", "0x2"], vp);
    const overrides = new FeatureSymbology.Overrides();
    provider.addFeatureOverrides(overrides, vp);
    expect(provider.toJSON(vp).alwaysDrawnExclusiveEmphasized).toEqual(["0x1"]);
    expect(overrides.getElementOverridesById("0x1")).toBeDefined();
    expect(overrides.getElementOverridesById("0x2")).toBeUndefined();
  });

  it("round-trips empty exclusive visibility for both provider APIs", () => {
    using vp = openBlankViewport();
    const ref = vp.primaryIModelRef;
    const legacy = EmphasizeElements.getOrCreate(vp);
    const reference = EmphasizeIModelElements.getOrCreate(ref);
    expect(reference.setAlwaysDrawnElements(["0x321"], false)).toBe(true);
    expect(reference.setAlwaysDrawnElements([])).toBe(false);
    expect(legacy.setAlwaysDrawnElements([], vp)).toBe(false);
    expect(ref.isAlwaysDrawnExclusive).toBe(false);
    expect([...ref.alwaysDrawnElements]).toEqual(["0x321"]);
    reference.clearAlwaysDrawnElements();
    for (const api of [legacy, reference]) {
      ref.isAlwaysDrawnExclusive = true;
      const json = api === legacy ? legacy.toJSON(vp) : reference.toJSON();
      expect(json.alwaysDrawn).toBeUndefined();
      expect(json.isAlwaysDrawnExclusive).toBe(true);
      ref.isAlwaysDrawnExclusive = false;
      ref.alwaysDrawnElements.add("0x123");
      const restore = () => api === legacy ? legacy.fromJSON(json, vp) : reference.fromJSON(json);
      expect(restore()).toBe(true);
      expect(new FeatureSymbology.Overrides(vp).isAlwaysDrawnExclusive).toBe(true);
      expect(ref.alwaysDrawnElements.size).toBe(0);
      expect(restore()).toBe(false);
      expect(api === legacy ? legacy.isActive(vp) : reference.isActive).toBe(true);
      if (api === legacy) {
        EmphasizeElements.clear(vp, true);
        expect(EmphasizeElements.get(vp)).toBe(legacy);
        expect(legacy.clearAlwaysDrawnElements(vp)).toBe(true);
      } else {
        EmphasizeIModelElements.clear(ref, true);
        expect(EmphasizeIModelElements.get(ref)).toBe(reference);
        expect(reference.clearAlwaysDrawnElements()).toBe(true);
      }
      expect(ref.isAlwaysDrawnExclusive).toBe(false);
    }
  });

  it("retains view-owned visibility in a fresh viewport and supports explicit reset", () => {
    using vp = openBlankViewport();
    const view = (vp.view as SpatialViewState).clone();
    const ref = view.iModelRefs.primary;
    ref.iModel.subcategories.add("0x20", "0x21", new SubCategoryAppearance(), true);
    {
      using first = OffScreenViewport.create({ view, viewRect: new ViewRect(0, 0, 20, 20) });
      first.primaryIModelRef.neverDrawnElements.add("0x1");
      first.primaryIModelRef.alwaysDrawnElements.add("0x2");
      first.primaryIModelRef.isAlwaysDrawnExclusive = true;
      ref.perModelCategoryVisibility.setOverride("0x10", "0x20", PerModelCategoryVisibility.Override.Hide);
    }
    using second = OffScreenViewport.create({ view, viewRect: new ViewRect(0, 0, 20, 20) });
    expect([...second.primaryIModelRef.neverDrawnElements]).toEqual(["0x1"]);
    expect([...second.primaryIModelRef.alwaysDrawnElements]).toEqual(["0x2"]);
    expect(second.primaryIModelRef.isAlwaysDrawnExclusive).toBe(true);
    expect(ref.perModelCategoryVisibility.getOverride("0x10", "0x20")).toBe(PerModelCategoryVisibility.Override.Hide);
    ref.neverDrawnElements.clear();
    ref.alwaysDrawnElements.clear();
    ref.isAlwaysDrawnExclusive = false;
    ref.perModelCategoryVisibility.clearOverrides();
    expect([...ref.perModelCategoryVisibility]).toEqual([]);
    expect(ref.isAlwaysDrawnExclusive).toBe(false);
    const provider = new EmphasizeElements();
    expect(provider.getNeverDrawnElements(second)).toBeUndefined();
    expect(provider.getAlwaysDrawnElements(second)).toBeUndefined();
    expect(provider.toJSON(second).neverDrawn).toBeUndefined();
    expect(provider.toJSON(second).alwaysDrawn).toBeUndefined();
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- Legacy getters delegate directly to the primary reference's sets.
    expect(second.neverDrawn).toBe(ref.neverDrawnElements);
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- Legacy getters delegate directly to the primary reference's sets.
    expect(second.alwaysDrawn).toBe(ref.alwaysDrawnElements);

    // Verify 5.15.2 subclass override compatibility (Id64Set | undefined).
    class LegacySubclassViewport extends OffScreenViewport {
      // eslint-disable-next-line @typescript-eslint/no-deprecated -- Verifies subclass override compatibility.
      public override get neverDrawn(): Set<string> | undefined { return super.neverDrawn; }
      // eslint-disable-next-line @typescript-eslint/no-deprecated -- Verifies subclass override compatibility.
      public override get alwaysDrawn(): Set<string> | undefined { return super.alwaysDrawn; }
    }
    const checkSubclass: typeof LegacySubclassViewport = LegacySubclassViewport;
    expect(checkSubclass).toBeDefined();
  });

  class CustomStyle extends DisplayStyle3dState {
    private readonly _overrides = new Map<string, SubCategoryOverride>();
    public writes = 0;
    public override getSubCategoryOverride(id: string) { return this._overrides.get(id); }
    public override overrideSubCategory(id: string, value: SubCategoryOverride): void {
      ++this.writes;
      this._overrides.set(id, value);
    }
    public override dropSubCategoryOverride(id: string): void { this._overrides.delete(id); }
  }

  it("keeps legacy viewport and primary reference overrides in sync with custom style storage", async () => {
    using vp = openBlankViewport();
    const style = new CustomStyle(vp.displayStyle.toJSON(), vp.iModel);
    vp.displayStyle = style;
    const ref = vp.primaryIModelRef;
    vp.iModel.subcategories.add("0x10", "0x11", new SubCategoryAppearance(), true);
    ref.viewedCategories.add("0x10");
    await vi.waitFor(() => expect(ref.isLoadingComplete).toBe(true));
    vp.renderFrame();
    using second = OffScreenViewport.create({ view: vp.view.clone(), viewRect: vp.viewRect });
    second.displayStyle = style;
    second.renderFrame();
    const secondApplied = vi.spyOn(second.target, "overrideFeatureSymbology");
    const applied = vi.spyOn(vp.target, "overrideFeatureSymbology");
    const createScene = vi.spyOn(vp.view, "createScene");
    const appearance = SubCategoryOverride.fromJSON({ transp: 0.9, priority: 12 });
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- Exercise the viewport compatibility API.
    vp.overrideSubCategory("0x11", appearance);
    expect(style.getSubCategoryOverride("0x11")).toBe(appearance);
    second.renderFrame();
    expect(secondApplied.mock.calls.at(-1)?.[0].getSubCategoryOverridesById("0x11")?.transparency).toBe(0.9);
    vp.renderFrame();
    expect(applied.mock.calls.at(-1)?.[0].getSubCategoryOverridesById("0x11")?.transparency).toBe(0.9);
    expect(ref.getSymbologyOverrides().isSubCategoryIdVisible("0x11")).toBe(true);
    expect(ref.isSubCategoryVisible("0x11")).toBe(true);
    expect(ref.changeSubCategoryDisplay("0x11", false)).toBe(true);
    expect(style.writes).toBe(2);
    expect(ref.isSubCategoryVisible("0x11")).toBe(false);
    expect(ref.getSymbologyOverrides().isSubCategoryIdVisible("0x11")).toBe(false);
    vp.renderFrame();
    expect(applied.mock.calls.at(-1)?.[0].isSubCategoryIdVisible("0x11")).toBe(false);
    expect(new FeatureSymbology.Overrides(vp).isSubCategoryIdVisible("0x11")).toBe(false);
    expect(style.getSubCategoryOverride("0x11")?.transparency).toBe(0.9);
    expect(ref.changeSubCategoryDisplay("0x11", true)).toBe(true);
    expect(style.writes).toBe(3);
    expect(ref.isSubCategoryVisible("0x11")).toBe(true);
    expect(ref.getSubCategoryAppearance("0x11").transparency).toBe(0.9);
    expect(style.getSubCategoryOverride("0x11")?.priority).toBe(12);
    expect(ref.changeSubCategoryDisplay("0x11", true)).toBe(false);
    expect(style.writes).toBe(3);
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- The viewport must read the ref's last write.
    expect(vp.getSubCategoryOverride("0x11")).toBe(style.getSubCategoryOverride("0x11"));
    vp.renderFrame();
    applied.mockClear();
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- Drop through the legacy API and check the next frame.
    vp.dropSubCategoryOverride("0x11");
    expect(style.getSubCategoryOverride("0x11")).toBeUndefined();
    secondApplied.mockClear();
    second.renderFrame();
    expect(secondApplied).toHaveBeenCalledOnce();
    expect(secondApplied.mock.calls[0][0].getSubCategoryOverridesById("0x11")).toBeUndefined();
    vp.renderFrame();
    expect(applied).toHaveBeenCalledOnce();
    expect(applied.mock.calls[0][0].getSubCategoryOverridesById("0x11")).toBeUndefined();
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- Dropping a missing override is a no-op.
    vp.dropSubCategoryOverride("0x11");
    vp.renderFrame();
    expect(applied).toHaveBeenCalledOnce();
    expect(createScene).not.toHaveBeenCalled();
  });

  it("notifies a shared style even when the writing view masks its value", async () => {
    using vp = openBlankViewport();
    using second = OffScreenViewport.create({ view: vp.view.clone(), viewRect: vp.viewRect });
    const style = new CustomStyle(vp.displayStyle.toJSON(), vp.iModel);
    vp.displayStyle = style;
    second.displayStyle = style;
    vp.iModel.subcategories.add("0x10", "0x11", new SubCategoryAppearance(), true);
    second.primaryIModelRef.viewedCategories.add("0x10");
    await vi.waitFor(() => expect(second.primaryIModelRef.isLoadingComplete).toBe(true));
    second.renderFrame();
    const secondApplied = vi.spyOn(second.target, "overrideFeatureSymbology");
    const appearance = SubCategoryOverride.fromJSON({ transp: 0.9 });
    const mask = SubCategoryOverride.fromJSON({ transp: 0.3 });
    vi.spyOn(vp.view, "getSubCategoryOverride").mockReturnValue(mask);
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    vp.overrideSubCategory("0x11", appearance);
    secondApplied.mockClear();
    second.renderFrame();
    expect(secondApplied.mock.calls.at(-1)?.[0].getSubCategoryOverridesById("0x11")?.transparency).toBe(0.9);
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    expect(vp.getSubCategoryOverride("0x11")).toBe(mask);
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    vp.dropSubCategoryOverride("0x11");
    secondApplied.mockClear();
    second.renderFrame();
    expect(secondApplied).toHaveBeenCalledOnce();
    expect(secondApplied.mock.calls[0][0].getSubCategoryOverridesById("0x11")).toBeUndefined();
  });

  it.each([0.2, undefined])("keeps view-only transparency out of a shared style (initial transparency: %s)", (initial) => {
    using vp = openBlankViewport();
    const style = vp.displayStyle;
    const ref = vp.primaryIModelRef;
    vp.iModel.subcategories.add("0x10", "0x11", new SubCategoryAppearance(), true);
    using second = OffScreenViewport.create({ view: vp.view.clone(), viewRect: vp.viewRect });
    second.displayStyle = style;
    if (initial !== undefined)
      style.overrideSubCategory("0x11", SubCategoryOverride.fromJSON({ transp: initial }));
    vi.spyOn(vp.view, "getSubCategoryOverride").mockImplementation((id) => SubCategoryOverride.fromJSON({ ...style.getSubCategoryOverride(id)?.toJSON(), transp: 0.9 }));
    for (const visible of [false, true]) {
      expect(ref.changeSubCategoryDisplay("0x11", visible)).toBe(true);
      expect(ref.isSubCategoryVisible("0x11")).toBe(visible);
      expect(second.view.getSubCategoryOverride("0x11")?.transparency).toBe(initial);
      expect(second.primaryIModelRef.isSubCategoryVisible("0x11")).toBe(visible);
      expect(ref.getSubCategoryAppearance("0x11").transparency).toBe(0.9);
    }
    vi.spyOn(style, "overrideSubCategory").mockImplementation(() => {});
    expect(ref.changeSubCategoryDisplay("0x11", false)).toBe(false);
    expect(ref.isSubCategoryVisible("0x11")).toBe(true);
  });

  for (const source of ["view", "style"] as const) {
    it(`can enable subcategories hidden by the ${source}'s default override without losing appearance`, () => {
      using vp = openBlankViewport();
      const ref = vp.primaryIModelRef;
      vp.iModel.subcategories.add("0x10", "0x11", new SubCategoryAppearance(), true);
      ref.viewedCategories.add("0x10");
      const fallback = SubCategoryOverride.fromJSON({ invisible: true, transp: 0.9, priority: 12 });
      vi.spyOn(source === "view" ? vp.view : vp.displayStyle, "getSubCategoryOverride").mockImplementation((id) => SubCategoryOverride.fromJSON({ ...fallback.toJSON(), ...ref.subCategoryOverrides.get(id)?.toJSON() }));
      expect(ref.isSubCategoryVisible("0x11")).toBe(false);
      expect(ref.changeSubCategoryDisplay("0x11", true)).toBe(true);
      expect(ref.isSubCategoryVisible("0x11")).toBe(true);
      expect(ref.getSubCategoryAppearance("0x11").transparency).toBe(0.9);
      expect(ref.getSubCategoryAppearance("0x11").priority).toBe(12);
      expect(ref.changeSubCategoryDisplay("0x11", true)).toBe(false);
      expect(ref.changeSubCategoryDisplay("0x11", false)).toBe(true);
      expect(ref.getSubCategoryAppearance("0x11").transparency).toBe(0.9);
      expect(ref.changeSubCategoryDisplay("0x11", true)).toBe(true);
    });

    it(`uses the ${source}'s subcategory getter for visibility and appearance`, () => {
      using vp = openBlankViewport();
      const view = vp.view;
      vp.iModel.subcategories.add("0x10", "0x11", new SubCategoryAppearance(), true);
      vp.primaryIModelRef.viewedCategories.add("0x10");
      let override = SubCategoryOverride.fromJSON({ transp: 0.9, priority: 12 });
      vi.spyOn(source === "view" ? view : view.displayStyle, "getSubCategoryOverride").mockImplementation(() => override);
      // eslint-disable-next-line @typescript-eslint/no-deprecated -- Reads must agree with rendered symbology.
      expect(vp.getSubCategoryOverride("0x11")).toBe(override);
      for (const overrides of [new FeatureSymbology.Overrides(view), new FeatureSymbology.Overrides(vp), vp.primaryIModelRef.getSymbologyOverrides()]) {
        expect(overrides.isSubCategoryIdVisible("0x11")).toBe(true);
        expect(overrides.getSubCategoryOverridesById("0x11")?.transparency).toBe(0.9);
      }
      expect(vp.primaryIModelRef.getSubCategoryAppearance("0x11").transparency).toBe(0.9);
      override = SubCategoryOverride.fromJSON({ invisible: true });
      expect(vp.primaryIModelRef.isSubCategoryVisible("0x11")).toBe(false);
      expect(new FeatureSymbology.Overrides(view).isSubCategoryIdVisible("0x11")).toBe(false);
      expect(new FeatureSymbology.Overrides(vp).isSubCategoryIdVisible("0x11")).toBe(false);
    });
  }

  it("does not retain discarded views through shared selectors", () => {
    using vp = openBlankViewport();
    const spatial = vp.view as SpatialViewState;
    const categories = spatial.categorySelector;
    const models = spatial.modelSelector;
    const categoryListeners = categories.observableCategories.onChanged.numberOfListeners;
    const modelListeners = models.observableModels.onChanged.numberOfListeners;
    for (let i = 0; i < 20; ++i) {
      const view = spatial.clone();
      view.categorySelector = categories;
      view.modelSelector = models;
      using offscreen = OffScreenViewport.create({ view, viewRect: new ViewRect(0, 0, 20, 20) });
      expect(offscreen.view).toBe(view);
    }
    expect(categories.observableCategories.onChanged.numberOfListeners).toBe(categoryListeners);
    expect(models.observableModels.onChanged.numberOfListeners).toBe(modelListeners);
  });

  it("drops undispatched selector refreshes on detach but retains explicit model requests", async () => {
    using vp = openBlankViewport();
    const view = (vp.view as SpatialViewState).clone();
    const explicit = "0x123";
    await vi.waitFor(() => expect(vp.primaryIModelRef.isLoadingComplete).toBe(true));
    const categories = vi.spyOn(vp.iModel.subcategories, "load");
    const models = vi.spyOn(vp.iModel.models, "getProps").mockResolvedValue([]);
    let load: Promise<void>;
    {
      using attached = OffScreenViewport.create({ view, viewRect: vp.viewRect });
      load = view.iModelRefs.primary.addAndLoadViewedModels([explicit]);
      expect(attached.view).toBe(view);
    }
    view.categorySelector.categories.add("0x21");
    view.modelSelector.models.add("0x22");
    await load;
    expect(categories).not.toHaveBeenCalled();
    expect(models).toHaveBeenCalledOnce();
    expect(models.mock.calls[0][0]).toEqual(new Set([explicit]));
  });

  it("resynchronizes selector changes made while detached on reattach", async () => {
    using vp = openBlankViewport();
    const view = (vp.view as SpatialViewState).clone();
    const ref = view.iModelRefs.primary;
    {
      using offscreen = OffScreenViewport.create({ view, viewRect: new ViewRect(0, 0, 20, 20) });
      expect(offscreen.view).toBe(view);
      await vi.waitFor(() => expect(ref.isLoadingComplete).toBe(true));
    }
    const categories = vi.spyOn(vp.iModel.subcategories, "load");
    const models = vi.spyOn(vp.iModel.models, "load").mockResolvedValue();
    view.categorySelector.categories.add("0x10");
    view.modelSelector.models.add("0x20");
    await Promise.resolve();
    expect(categories).not.toHaveBeenCalled();
    expect(models).not.toHaveBeenCalled();
    {
      using offscreen = OffScreenViewport.create({ view, viewRect: new ViewRect(0, 0, 20, 20) });
      expect(offscreen.view).toBe(view);
      await vi.waitFor(() => expect(models).toHaveBeenCalledOnce());
      expect([...models.mock.calls[0][0]]).toContain("0x20");
      expect(categories).toHaveBeenCalled();
    }
  });
});
