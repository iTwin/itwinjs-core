/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "vitest";
import { assert as bAssert } from "@itwin/core-bentley";
import { ColorDef, Feature, FeatureAppearance, FeatureAppearanceProps, FeatureOverrideType, LinePixels, RgbColor } from "@itwin/core-common";
import {
  EmphasizeElements, FeatureSymbology, IModelConnection, ScreenViewport, SpatialViewState, StandardViewId,
} from "@itwin/core-frontend";
import { TestUtility } from "../TestUtility";
import { TestSnapshotConnection } from "../TestSnapshotConnection";

describe("EmphasizeElements tests", () => {
  let imodel: IModelConnection;
  let spatialView: SpatialViewState;

  const viewDiv = document.createElement("div");
  expect(null !== viewDiv).toBeTruthy();
  viewDiv.style.width = viewDiv.style.height = "1000px";
  document.body.appendChild(viewDiv);

  beforeAll(async () => {
    await TestUtility.startFrontend(undefined, true);
    imodel = await TestSnapshotConnection.openFile("test.bim");
    spatialView = await imodel.views.load("0x34") as SpatialViewState;
    spatialView.setStandardRotation(StandardViewId.RightIso);
  });

  afterAll(async () => {
    await imodel?.close();
    await TestUtility.shutdownFrontend();
  });

  it("Emphasize add/replace/clear", async () => {
    const vp = ScreenViewport.create(viewDiv, spatialView.clone());
    EmphasizeElements.clear(vp);
    const emph = EmphasizeElements.getOrCreate(vp);
    const ids = new Set<string>();

    ids.add("0x1");
    ids.add("0x2");
    ids.add("0x3");
    let status = emph.emphasizeElements(ids, vp, undefined, true);
    expect(status).toBe(true);
    let currIds = emph.getEmphasizedElements(vp);
    expect(undefined !== currIds && ids.size === currIds.size).toBe(true);

    ids.add("0x4");
    status = emph.emphasizeElements(ids, vp, undefined, false);
    expect(status).toBe(true);
    currIds = emph.getEmphasizedElements(vp);
    expect(undefined !== currIds && ids.size === currIds.size).toBe(true);

    ids.clear();
    ids.add("0x5");
    status = emph.emphasizeElements(ids, vp, undefined, true);
    expect(status).toBe(true);
    currIds = emph.getEmphasizedElements(vp);
    expect(undefined !== currIds && ids.size === currIds.size).toBe(true);

    status = emph.clearEmphasizedElements(vp);
    expect(status).toBe(true);
    currIds = emph.getEmphasizedElements(vp);
    expect(undefined === currIds).toBe(true);

    EmphasizeElements.clear(vp);
  });

  it("Isolate add/replace/clear", async () => {
    const vp = ScreenViewport.create(viewDiv, spatialView.clone());
    EmphasizeElements.clear(vp);
    const emph = EmphasizeElements.getOrCreate(vp);
    const ids = new Set<string>();

    ids.add("0x1");
    ids.add("0x2");
    ids.add("0x3");
    let status = emph.isolateElements(ids, vp, true);
    expect(status).toBe(true);
    let currIds = emph.getIsolatedElements(vp);
    expect(undefined !== currIds && ids.size === currIds.size).toBe(true);

    ids.add("0x4");
    status = emph.isolateElements(ids, vp, false);
    expect(status).toBe(true);
    currIds = emph.getIsolatedElements(vp);
    expect(undefined !== currIds && ids.size === currIds.size).toBe(true);

    ids.clear();
    ids.add("0x5");
    status = emph.isolateElements(ids, vp, true);
    expect(status).toBe(true);
    currIds = emph.getIsolatedElements(vp);
    expect(undefined !== currIds && ids.size === currIds.size).toBe(true);

    status = emph.clearIsolatedElements(vp);
    expect(status).toBe(true);
    currIds = emph.getIsolatedElements(vp);
    expect(undefined === currIds).toBe(true);

    EmphasizeElements.clear(vp);
  });

  it("Hide add/replace/clear", async () => {
    const vp = ScreenViewport.create(viewDiv, spatialView.clone());
    EmphasizeElements.clear(vp);
    const emph = EmphasizeElements.getOrCreate(vp);
    const ids = new Set<string>();

    ids.add("0x1");
    ids.add("0x2");
    ids.add("0x3");
    let status = emph.hideElements(ids, vp, true);
    expect(status).toBe(true);
    let currIds = emph.getHiddenElements(vp);
    expect(undefined !== currIds && ids.size === currIds.size).toBe(true);

    ids.add("0x4");
    status = emph.hideElements(ids, vp, false);
    expect(status).toBe(true);
    currIds = emph.getHiddenElements(vp);
    expect(undefined !== currIds && ids.size === currIds.size).toBe(true);

    ids.clear();
    ids.add("0x5");
    status = emph.hideElements(ids, vp, true);
    expect(status).toBe(true);
    currIds = emph.getHiddenElements(vp);
    expect(undefined !== currIds && ids.size === currIds.size).toBe(true);

    status = emph.clearHiddenElements(vp);
    expect(status).toBe(true);
    currIds = emph.getHiddenElements(vp);
    expect(undefined === currIds).toBe(true);

    EmphasizeElements.clear(vp);
  });

  it("Override add/replace/clear", async () => {
    const vp = ScreenViewport.create(viewDiv, spatialView.clone());
    EmphasizeElements.clear(vp);
    const emph = EmphasizeElements.getOrCreate(vp);
    const redIds = new Set<string>();
    const blueIds = new Set<string>();
    const redKey = emph.createOverrideKey(ColorDef.red, FeatureOverrideType.ColorOnly);
    const blueKey = emph.createOverrideKey(ColorDef.blue, FeatureOverrideType.ColorOnly);
    expect(undefined === redKey).toBe(false);
    expect(undefined === blueKey).toBe(false);

    redIds.add("0x1");
    redIds.add("0x2");
    redIds.add("0x3");
    let status = emph.overrideElements(redIds, vp, ColorDef.red, FeatureOverrideType.ColorOnly, true);
    expect(status).toBe(true);
    let currRedIds = emph.getOverriddenElementsByKey(redKey!);
    expect(undefined !== currRedIds && redIds.size === currRedIds.size).toBe(true);

    blueIds.add("0x11");
    blueIds.add("0x21");
    status = emph.overrideElements(blueIds, vp, ColorDef.blue, FeatureOverrideType.ColorOnly, true);
    expect(status).toBe(true);
    let currBlueIds = emph.getOverriddenElementsByKey(blueKey!);
    expect(undefined !== currBlueIds && blueIds.size === currBlueIds.size).toBe(true);

    let currMap = emph.getOverriddenElements();
    expect(undefined !== currMap && 2 === currMap.size).toBe(true);

    redIds.add("0x4");
    status = emph.overrideElements(redIds, vp, ColorDef.red, FeatureOverrideType.ColorOnly, false);
    expect(status).toBe(true);
    currRedIds = emph.getOverriddenElementsByKey(redKey!);
    expect(undefined !== currRedIds && redIds.size === currRedIds.size).toBe(true);

    blueIds.add("0x31");
    status = emph.overrideElements(blueIds, vp, ColorDef.blue, FeatureOverrideType.ColorOnly, false);
    expect(status).toBe(true);
    currBlueIds = emph.getOverriddenElementsByKey(blueKey!);
    expect(undefined !== currBlueIds && blueIds.size === currBlueIds.size).toBe(true);

    currMap = emph.getOverriddenElements();
    expect(undefined !== currMap && 2 === currMap.size).toBe(true);

    redIds.clear();
    redIds.add("0x5");
    status = emph.overrideElements(redIds, vp, ColorDef.red, FeatureOverrideType.ColorOnly, true);
    expect(status).toBe(true);
    currRedIds = emph.getOverriddenElementsByKey(redKey!);
    expect(undefined !== currRedIds && redIds.size === currRedIds.size).toBe(true);

    blueIds.clear();
    blueIds.add("0x41");
    status = emph.overrideElements(blueIds, vp, ColorDef.blue, FeatureOverrideType.ColorOnly, true);
    expect(status).toBe(true);
    currBlueIds = emph.getOverriddenElementsByKey(blueKey!);
    expect(undefined !== currBlueIds && blueIds.size === currBlueIds.size).toBe(true);

    currMap = emph.getOverriddenElements();
    expect(undefined !== currMap && 2 === currMap.size).toBe(true);

    status = emph.clearOverriddenElements(vp);
    expect(status).toBe(true);

    currRedIds = emph.getOverriddenElementsByKey(redKey!);
    expect(undefined === currRedIds).toBe(true);

    currBlueIds = emph.getOverriddenElementsByKey(blueKey!);
    expect(undefined === currBlueIds).toBe(true);

    currMap = emph.getOverriddenElements();
    expect(undefined === currMap).toBe(true);

    EmphasizeElements.clear(vp);
  });

  it("Clear color overrides test", async () => {
    const vp = ScreenViewport.create(viewDiv, spatialView.clone());
    EmphasizeElements.clear(vp);
    const emph = EmphasizeElements.getOrCreate(vp);
    const redIds = new Set<string>();
    const blueIds = new Set<string>();
    const redKey = emph.createOverrideKey(ColorDef.red, FeatureOverrideType.ColorOnly);
    const blueKey = emph.createOverrideKey(ColorDef.blue, FeatureOverrideType.ColorOnly);
    expect(undefined === redKey).toBe(false);
    expect(undefined === blueKey).toBe(false);

    redIds.add("0x1");
    redIds.add("0x2");
    redIds.add("0x3");
    let status = emph.overrideElements(redIds, vp, ColorDef.red, FeatureOverrideType.ColorOnly, true);
    expect(status).toBe(true);
    let currRedIds = emph.getOverriddenElementsByKey(redKey!);
    expect(undefined !== currRedIds && redIds.size === currRedIds.size).toBe(true);

    blueIds.add("0x11");
    blueIds.add("0x21");
    status = emph.overrideElements(blueIds, vp, ColorDef.blue, FeatureOverrideType.ColorOnly, true);
    expect(status).toBe(true);
    let currBlueIds = emph.getOverriddenElementsByKey(blueKey!);
    expect(undefined !== currBlueIds && blueIds.size === currBlueIds.size).toBe(true);

    let currMap = emph.getOverriddenElements();
    expect(undefined !== currMap && 2 === currMap.size).toBe(true);

    status = emph.clearOverriddenElements(vp, ["0x21", "0x2"]); // Clear some elements with red and blue overrides...
    expect(status).toBe(true);

    currRedIds = emph.getOverriddenElementsByKey(redKey!);
    expect(undefined !== currRedIds && 2 === currRedIds.size).toBe(true);

    currBlueIds = emph.getOverriddenElementsByKey(blueKey!);
    expect(undefined !== currBlueIds && 1 === currBlueIds.size).toBe(true);

    status = emph.clearOverriddenElements(vp, redIds); // Clear remaining red overrides by element ids...
    expect(status).toBe(true);

    currRedIds = emph.getOverriddenElementsByKey(redKey!);
    expect(undefined === currRedIds).toBe(true);

    currMap = emph.getOverriddenElements();
    expect(undefined !== currMap && 1 === currMap.size).toBe(true);

    status = emph.clearOverriddenElements(vp, blueKey); // Clear blue overrides by key...
    expect(status).toBe(true);

    currBlueIds = emph.getOverriddenElementsByKey(blueKey!);
    expect(undefined === currBlueIds).toBe(true);

    currMap = emph.getOverriddenElements();
    expect(undefined === currMap).toBe(true);

    EmphasizeElements.clear(vp);
  });

  it("Applies correct overrides", () => {
    const vp = ScreenViewport.create(viewDiv, spatialView.clone());
    EmphasizeElements.clear(vp);

    vp.viewFlags = vp.viewFlags.with("weights", true);

    const expectAppearance = (color: ColorDef, type: FeatureOverrideType, expectedAppearance: FeatureAppearanceProps) => {
      const emph = EmphasizeElements.getOrCreate(vp);
      const elemId = "0x123";
      const elemIds = new Set<string>([elemId]);

      emph.clearOverriddenElements(vp);
      emph.overrideElements(elemIds, vp, color, type, true);

      const ovrs = new FeatureSymbology.Overrides(vp);
      emph.addFeatureOverrides(ovrs, vp);

      const feature = new Feature(elemId);
      const actualAppearance = ovrs.getFeatureAppearance(feature, "0");
      expect(actualAppearance).not.toBeUndefined();
      if (undefined !== actualAppearance) {
        expect(JSON.stringify(actualAppearance)).toBe(JSON.stringify(expectedAppearance));
      }

      EmphasizeElements.clear(vp);
    };

    const rgb = RgbColor.fromColorDef(ColorDef.red);
    const black = new RgbColor(0, 0, 0);
    expectAppearance(ColorDef.red, FeatureOverrideType.ColorOnly, { rgb });
    expectAppearance(ColorDef.red, FeatureOverrideType.AlphaOnly, { rgb: black, transparency: 0 }); // EE does not permit overriding only transparency to opaque...
    expectAppearance(ColorDef.red, FeatureOverrideType.ColorAndAlpha, { rgb, transparency: 0 });

    const red = ColorDef.red.withTransparency(184);
    const transparency = 184 / 255;

    expectAppearance(red, FeatureOverrideType.ColorOnly, { rgb });
    expectAppearance(red, FeatureOverrideType.AlphaOnly, { transparency });
    expectAppearance(red, FeatureOverrideType.ColorAndAlpha, { rgb, transparency });
  });

  it("ignores animation overrides for de-emphasized elements", () => {
    const vp = ScreenViewport.create(viewDiv, spatialView.clone());
    vp.viewFlags = vp.viewFlags.with("weights", true);

    const emph = EmphasizeElements.getOrCreate(vp);
    const deemphasized = FeatureAppearance.fromTransparency(0.5);
    emph.wantEmphasis = true;
    emph.emphasizeElements("0x1", vp, deemphasized);

    const red = FeatureAppearance.fromRgb(ColorDef.red);
    const ovrs = new FeatureSymbology.Overrides(vp);
    ovrs.overrideAnimationNode(1, red);
    emph.addFeatureOverrides(ovrs, vp);

    const emphasized = FeatureAppearance.fromJSON({ emphasized: true });
    const emphasizedRed = FeatureAppearance.fromJSON({ rgb: { r: 255, g: 0, b: 0 }, emphasized: true });
    const expectAppearance = (elementId: string, nodeId: number, expected: FeatureAppearance) => {
      const actual = ovrs.getFeatureAppearance(new Feature(elementId), "0x123", undefined, nodeId)!;
      expect(actual).not.toBeUndefined();
      expect(actual.toJSON()).toEqual(expected.toJSON());
    };

    expectAppearance("0x1", 0, emphasized);
    expectAppearance("0x1", 2, emphasized);
    expectAppearance("0x1", 1, emphasizedRed);

    expectAppearance("0x2", 0, deemphasized);
    expectAppearance("0x2", 2, deemphasized);
    expectAppearance("0x2", 1, deemphasized);

    EmphasizeElements.clear(vp);
  });

  it("applies default appearance with no elements emphasized", () => {
    const vp = ScreenViewport.create(viewDiv, spatialView.clone());
    EmphasizeElements.clear(vp);
    vp.viewFlags = vp.viewFlags.with("weights", true);

    const emph = EmphasizeElements.getOrCreate(vp);
    const deemphasized = FeatureAppearance.fromTransparency(0.5);
    emph.defaultAppearance = deemphasized;

    const ovrs = new FeatureSymbology.Overrides(vp);
    emph.addFeatureOverrides(ovrs, vp);

    // Nothing is in vp.alwaysDrawn, so every element should receive the default (de-emphasized) appearance.
    const actual = ovrs.getFeatureAppearance(new Feature("0x123"), "0x456")!;
    expect(actual).not.to.be.undefined;
    expect(actual.equals(deemphasized)).to.be.true;

    EmphasizeElements.clear(vp);
  });

  it("Override to/from key", async () => {
    const vp = ScreenViewport.create(viewDiv, spatialView.clone());
    EmphasizeElements.clear(vp);
    const emph = EmphasizeElements.getOrCreate(vp);

    interface ColorEntry { color: ColorDef, overrideType: FeatureOverrideType }
    const overrides: ColorEntry[] = [];
    overrides.push({ color: ColorDef.from(200, 150, 100, 50), overrideType: FeatureOverrideType.ColorOnly });
    overrides.push({ color: ColorDef.from(200, 150, 100, 50), overrideType: FeatureOverrideType.AlphaOnly });
    overrides.push({ color: ColorDef.from(200, 150, 100, 50), overrideType: FeatureOverrideType.ColorAndAlpha });

    for (const entry of overrides) {
      const key = emph.createOverrideKey(entry.color, entry.overrideType);
      bAssert(undefined !== key);
      const { overrideType, color } = { ...emph.getOverrideFromKey(key) };
      expect(overrideType === entry.overrideType).toBeTruthy();
      switch (overrideType) {
        case FeatureOverrideType.ColorOnly:
          expect(color.getRgb() === entry.color.getRgb()).toBe(true);
          break;
        case FeatureOverrideType.AlphaOnly:
          expect(color.getAlpha() === entry.color.getAlpha()).toBe(true);
          break;
        case FeatureOverrideType.ColorAndAlpha:
          expect(color.equals(entry.color)).toBe(true);
          break;
      }
    }

    EmphasizeElements.clear(vp);
  });

  it("to/from JSON", async () => {
    function roundTrip(populate: (emph: EmphasizeElements, vp: ScreenViewport) => void): void {
      using vp1 = ScreenViewport.create(viewDiv, spatialView.clone());
      EmphasizeElements.clear(vp1);
      const before = EmphasizeElements.getOrCreate(vp1);
      populate(before, vp1);

      const inputJson = JSON.stringify(before.toJSON(vp1));

      using vp2 = ScreenViewport.create(viewDiv, spatialView.clone());
      const after = EmphasizeElements.getOrCreate(vp2);
      after.fromJSON(JSON.parse(inputJson), vp2);
      const outputJson = JSON.stringify(after.toJSON(vp2));
      expect(outputJson).toBe(inputJson);

      function expectEqualSets(a: Set<string> | undefined, b: Set<string> | undefined): void {
        expect(a === undefined).toBe(b === undefined);
        if (undefined !== a && undefined !== b)
          expect(a.size).toBe(b.size);
      }

      expect(after.wantEmphasis).toBe(before.wantEmphasis);
      expect(vp2.isAlwaysDrawnExclusive).toBe(vp1.isAlwaysDrawnExclusive);

      const aApp = after.defaultAppearance;
      const bApp = before.defaultAppearance;
      expect(undefined === aApp).toBe(undefined === bApp);
      if (undefined !== aApp && undefined !== bApp)
        expect(aApp.equals(bApp)).toBe(true);

      const aUnanimated = after.unanimatedAppearance;
      const bUnanimated = before.unanimatedAppearance;
      expect(undefined === aUnanimated).toBe(undefined === bUnanimated);
      if (aUnanimated && bUnanimated)
        expect(aUnanimated.equals(bUnanimated)).toBe(true);

      expectEqualSets(after.getHiddenElements(vp2), before.getHiddenElements(vp1));
      expectEqualSets(after.getEmphasizedElements(vp2), before.getEmphasizedElements(vp1));
      expectEqualSets(after.getIsolatedElements(vp2), before.getIsolatedElements(vp1));
      expectEqualSets(after.getEmphasizedIsolatedElements(), before.getEmphasizedIsolatedElements());

      const aOvr = after.getOverriddenElements();
      const bOvr = before.getOverriddenElements();
      expect(undefined === aOvr).toBe(undefined === bOvr);
      if (undefined !== aOvr && undefined !== bOvr) {
        expect(aOvr.size).toBe(bOvr.size);
        for (const key of aOvr.keys()) {
          expectEqualSets(after.getOverriddenElementsByKey(key), before.getOverriddenElementsByKey(key));

          const aOvrs = after.getOverrideFromKey(key);
          const bOvrs = before.getOverrideFromKey(key);
          expect(aOvrs.overrideType).toBe(bOvrs.overrideType);
          expect(aOvrs.color.tbgr).toBe(bOvrs.color.tbgr);
        }
      }

      EmphasizeElements.clear(vp1);
      EmphasizeElements.clear(vp2);
    }

    roundTrip((emph, _vp) => {
      expect(emph.wantEmphasis).toBe(false);
      emph.wantEmphasis = true;
    });

    roundTrip((emph, _vp) => {
      expect(emph.defaultAppearance).toBeUndefined();
      emph.defaultAppearance = FeatureAppearance.fromJSON({
        rgb: { r: 10, g: 20, b: 30 },
        weight: 4,
        transparency: 0.75,
        linePixels: LinePixels.Invisible,
        ignoresMaterial: true,
        nonLocatable: true,
        emphasized: true,
      });
    });

    roundTrip((emph, vp) => {
      emph.isolateElements("0x123", vp, false);
      emph.emphasizeElements("0x456", vp, undefined, false);
      expect(emph.getIsolatedElements(vp)!.size).toBe(1);
      expect(emph.getEmphasizedIsolatedElements()!.size).toBe(1);
    });

    roundTrip((emph, vp) => {
      const ids = new Set<string>();
      ids.add("0x1");
      ids.add("0x2");
      ids.add("0x3");
      ids.add("0x4");
      ids.add("0x5");
      expect(emph.isolateElements(ids, vp, true)).toBe(true);
      let currIds = emph.getIsolatedElements(vp);
      expect(undefined !== currIds && ids.size === currIds.size).toBe(true);

      ids.clear();
      ids.add("0x3");
      ids.add("0x4");
      ids.add("0x5");
      expect(emph.emphasizeElements(ids, vp, undefined, true)).toBe(true);
      currIds = emph.getEmphasizedElements(vp);
      expect(undefined !== currIds && ids.size === currIds.size).toBe(true);

      const redKey = emph.createOverrideKey(ColorDef.red, FeatureOverrideType.ColorOnly)!;
      expect(redKey).not.toBeUndefined();
      ids.clear();
      ids.add("0x5");
      expect(emph.overrideElements(ids, vp, ColorDef.red, undefined, true)).toBe(true);
      currIds = emph.getOverriddenElementsByKey(redKey);
      expect(undefined !== currIds && ids.size === currIds.size).toBe(true);

      ids.clear();
      ids.add("0x2");
      expect(emph.hideElements(ids, vp, true)).toBe(true);
      currIds = emph.getHiddenElements(vp);
      expect(undefined !== currIds && ids.size === currIds.size).toBe(true);
    });

    roundTrip((emph, vp) => {
      const redIds = new Set<string>();
      const redKey = emph.createOverrideKey(ColorDef.red, FeatureOverrideType.ColorOnly)!;
      expect(redKey).not.toBeUndefined();
      redIds.add("0x1");
      redIds.add("0x2");
      redIds.add("0x3");
      expect(emph.overrideElements(redIds, vp, ColorDef.red, undefined, true)).toBe(true);
      const currRedIds = emph.getOverriddenElementsByKey(redKey);
      expect(undefined !== currRedIds && redIds.size === currRedIds.size).toBe(true);

      const blueIds = new Set<string>();
      const blueKey = emph.createOverrideKey(ColorDef.blue, FeatureOverrideType.ColorOnly)!;
      expect(blueKey).not.toBeUndefined();
      blueIds.add("0x4");
      blueIds.add("0x5");
      expect(emph.overrideElements(blueIds, vp, ColorDef.blue, undefined, true)).toBe(true);
      const currBlueIds = emph.getOverriddenElementsByKey(blueKey);
      expect(undefined !== currBlueIds && blueIds.size === currBlueIds.size).toBe(true);
    });

    roundTrip((emph, vp) => {
      const blue = FeatureAppearance.fromRgb(ColorDef.blue);
      emph.unanimatedAppearance = blue;
      expect(emph.unanimatedAppearance).not.toBeUndefined();
      expect(JSON.stringify(emph.unanimatedAppearance.toJSON())).toBe(JSON.stringify(blue.toJSON()));

      const ovrs = new FeatureSymbology.Overrides();
      const feature = new Feature("0x123");
      let app = ovrs.getFeatureAppearance(feature, "0x456")!;
      expect(app).not.toBeUndefined();
      expect(app.matchesDefaults).toBe(true);

      emph.addFeatureOverrides(ovrs, vp);
      app = ovrs.getFeatureAppearance(feature, "0x456")!;
      expect(app).not.toBeUndefined();
      expect(app.matchesDefaults).toBe(false);
      expect(app.equals(blue)).toBe(true);
    });

    roundTrip((emph, vp) => {
      const transp = FeatureAppearance.fromTransparency(1.0);
      emph.unanimatedAppearance = transp;

      const ovrs = new FeatureSymbology.Overrides();
      const feature = new Feature("0x123");
      const app = ovrs.getFeatureAppearance(feature, "0x456");
      expect(app).not.toBeUndefined();
      expect(app!.matchesDefaults).toBe(true);

      emph.addFeatureOverrides(ovrs, vp);
      expect(ovrs.getFeatureAppearance(feature, "0x456")).toBeUndefined();
    });
  });

  it("fromJSON reports a change when only defaultAppearance differs", () => {
    const vp = ScreenViewport.create(viewDiv, spatialView.clone());
    EmphasizeElements.clear(vp);
    const emph = EmphasizeElements.getOrCreate(vp);

    const appearance = FeatureAppearance.fromTransparency(0.5);
    expect(emph.fromJSON({ defaultAppearance: appearance.toJSON() }, vp)).to.be.true;
    expect(emph.defaultAppearance!.equals(appearance)).to.be.true;

    // Applying the same appearance again is not a change.
    expect(emph.fromJSON({ defaultAppearance: appearance.toJSON() }, vp)).to.be.false;

    // A different appearance is a change.
    const other = FeatureAppearance.fromTransparency(0.75);
    expect(emph.fromJSON({ defaultAppearance: other.toJSON() }, vp)).to.be.true;
    expect(emph.defaultAppearance!.equals(other)).to.be.true;

    EmphasizeElements.clear(vp);
  });
});
