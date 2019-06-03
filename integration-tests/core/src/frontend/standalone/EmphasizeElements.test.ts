/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { IModelConnection, MockRender, ScreenViewport, SpatialViewState, StandardViewId, EmphasizeElements, FeatureOverrideType } from "@bentley/imodeljs-frontend";
import { assert } from "chai";
import * as path from "path";
import { ColorDef } from "@bentley/imodeljs-common";

const iModelDir = path.join(process.env.IMODELJS_CORE_DIRNAME!, "core/backend/lib/test/assets");

describe("EmphasizeElements tests", () => {
  let imodel: IModelConnection;
  let spatialView: SpatialViewState;

  const viewDiv = document.createElement("div") as HTMLDivElement;
  assert(null !== viewDiv);
  viewDiv!.style.width = viewDiv!.style.height = "1000px";
  document.body.appendChild(viewDiv!);

  before(async () => {
    MockRender.App.startup();
    imodel = await IModelConnection.openSnapshot(path.join(iModelDir, "test.bim"));
    spatialView = await imodel.views.load("0x34") as SpatialViewState;
    spatialView.setStandardRotation(StandardViewId.RightIso);
  });

  after(async () => {
    if (imodel) await imodel.closeSnapshot();
    MockRender.App.shutdown();
  });

  it("Emphasize add/replace/clear", async () => {
    const vp = ScreenViewport.create(viewDiv!, spatialView.clone());
    EmphasizeElements.clear(vp);
    const emph = EmphasizeElements.getOrCreate(vp);
    const ids = new Set<string>();

    ids.add("0x1"); ids.add("0x2"); ids.add("0x3");
    let status = emph.emphasizeElements(ids, vp, undefined, true);
    assert.isTrue(status);
    let currIds = emph.getEmphasizedElements(vp);
    assert.isTrue(undefined !== currIds && ids.size === currIds.size);

    ids.add("0x4");
    status = emph.emphasizeElements(ids, vp, undefined, false);
    assert.isTrue(status);
    currIds = emph.getEmphasizedElements(vp);
    assert.isTrue(undefined !== currIds && ids.size === currIds.size);

    ids.clear(); ids.add("0x5");
    status = emph.emphasizeElements(ids, vp, undefined, true);
    assert.isTrue(status);
    currIds = emph.getEmphasizedElements(vp);
    assert.isTrue(undefined !== currIds && ids.size === currIds.size);

    status = emph.clearEmphasizedElements(vp);
    assert.isTrue(status);
    currIds = emph.getEmphasizedElements(vp);
    assert.isTrue(undefined === currIds);

    EmphasizeElements.clear(vp);
  });

  it("Isolate add/replace/clear", async () => {
    const vp = ScreenViewport.create(viewDiv!, spatialView.clone());
    EmphasizeElements.clear(vp);
    const emph = EmphasizeElements.getOrCreate(vp);
    const ids = new Set<string>();

    ids.add("0x1"); ids.add("0x2"); ids.add("0x3");
    let status = emph.isolateElements(ids, vp, true);
    assert.isTrue(status);
    let currIds = emph.getIsolatedElements(vp);
    assert.isTrue(undefined !== currIds && ids.size === currIds.size);

    ids.add("0x4");
    status = emph.isolateElements(ids, vp, false);
    assert.isTrue(status);
    currIds = emph.getIsolatedElements(vp);
    assert.isTrue(undefined !== currIds && ids.size === currIds.size);

    ids.clear(); ids.add("0x5");
    status = emph.isolateElements(ids, vp, true);
    assert.isTrue(status);
    currIds = emph.getIsolatedElements(vp);
    assert.isTrue(undefined !== currIds && ids.size === currIds.size);

    status = emph.clearIsolatedElements(vp);
    assert.isTrue(status);
    currIds = emph.getIsolatedElements(vp);
    assert.isTrue(undefined === currIds);

    EmphasizeElements.clear(vp);
  });

  it("Hide add/replace/clear", async () => {
    const vp = ScreenViewport.create(viewDiv!, spatialView.clone());
    EmphasizeElements.clear(vp);
    const emph = EmphasizeElements.getOrCreate(vp);
    const ids = new Set<string>();

    ids.add("0x1"); ids.add("0x2"); ids.add("0x3");
    let status = emph.hideElements(ids, vp, true);
    assert.isTrue(status);
    let currIds = emph.getHiddenElements(vp);
    assert.isTrue(undefined !== currIds && ids.size === currIds.size);

    ids.add("0x4");
    status = emph.hideElements(ids, vp, false);
    assert.isTrue(status);
    currIds = emph.getHiddenElements(vp);
    assert.isTrue(undefined !== currIds && ids.size === currIds.size);

    ids.clear(); ids.add("0x5");
    status = emph.hideElements(ids, vp, true);
    assert.isTrue(status);
    currIds = emph.getHiddenElements(vp);
    assert.isTrue(undefined !== currIds && ids.size === currIds.size);

    status = emph.clearHiddenElements(vp);
    assert.isTrue(status);
    currIds = emph.getHiddenElements(vp);
    assert.isTrue(undefined === currIds);

    EmphasizeElements.clear(vp);
  });

  it("Override add/replace/clear", async () => {
    const vp = ScreenViewport.create(viewDiv!, spatialView.clone());
    EmphasizeElements.clear(vp);
    const emph = EmphasizeElements.getOrCreate(vp);
    const redIds = new Set<string>();
    const blueIds = new Set<string>();
    const redKey = emph.createOverrideKey(ColorDef.red, FeatureOverrideType.ColorOnly);
    const blueKey = emph.createOverrideKey(ColorDef.blue, FeatureOverrideType.ColorOnly);
    assert.isFalse(undefined === redKey);
    assert.isFalse(undefined === blueKey);

    redIds.add("0x1"); redIds.add("0x2"); redIds.add("0x3");
    let status = emph.overrideElements(redIds, vp, ColorDef.red, FeatureOverrideType.ColorOnly, true);
    assert.isTrue(status);
    let currRedIds = emph.getOverriddenElementsByKey(redKey!);
    assert.isTrue(undefined !== currRedIds && redIds.size === currRedIds.size);

    blueIds.add("0x11"); blueIds.add("0x21");
    status = emph.overrideElements(blueIds, vp, ColorDef.blue, FeatureOverrideType.ColorOnly, true);
    assert.isTrue(status);
    let currBlueIds = emph.getOverriddenElementsByKey(blueKey!);
    assert.isTrue(undefined !== currBlueIds && blueIds.size === currBlueIds.size);

    let currMap = emph.getOverriddenElements();
    assert.isTrue(undefined !== currMap && 2 === currMap.size);

    redIds.add("0x4");
    status = emph.overrideElements(redIds, vp, ColorDef.red, FeatureOverrideType.ColorOnly, false);
    assert.isTrue(status);
    currRedIds = emph.getOverriddenElementsByKey(redKey!);
    assert.isTrue(undefined !== currRedIds && redIds.size === currRedIds.size);

    blueIds.add("0x31");
    status = emph.overrideElements(blueIds, vp, ColorDef.blue, FeatureOverrideType.ColorOnly, false);
    assert.isTrue(status);
    currBlueIds = emph.getOverriddenElementsByKey(blueKey!);
    assert.isTrue(undefined !== currBlueIds && blueIds.size === currBlueIds.size);

    currMap = emph.getOverriddenElements();
    assert.isTrue(undefined !== currMap && 2 === currMap.size);

    redIds.clear(); redIds.add("0x5");
    status = emph.overrideElements(redIds, vp, ColorDef.red, FeatureOverrideType.ColorOnly, true);
    assert.isTrue(status);
    currRedIds = emph.getOverriddenElementsByKey(redKey!);
    assert.isTrue(undefined !== currRedIds && redIds.size === currRedIds.size);

    blueIds.clear(); blueIds.add("0x41");
    status = emph.overrideElements(blueIds, vp, ColorDef.blue, FeatureOverrideType.ColorOnly, true);
    assert.isTrue(status);
    currBlueIds = emph.getOverriddenElementsByKey(blueKey!);
    assert.isTrue(undefined !== currBlueIds && blueIds.size === currBlueIds.size);

    currMap = emph.getOverriddenElements();
    assert.isTrue(undefined !== currMap && 2 === currMap.size);

    status = emph.clearOverriddenElements(vp);
    assert.isTrue(status);

    currRedIds = emph.getOverriddenElementsByKey(redKey!);
    assert.isTrue(undefined === currRedIds);

    currBlueIds = emph.getOverriddenElementsByKey(blueKey!);
    assert.isTrue(undefined === currBlueIds);

    currMap = emph.getOverriddenElements();
    assert.isTrue(undefined === currMap);

    EmphasizeElements.clear(vp);
  });

  it("Override to/from key", async () => {
    const vp = ScreenViewport.create(viewDiv!, spatialView.clone());
    EmphasizeElements.clear(vp);
    const emph = EmphasizeElements.getOrCreate(vp);

    interface ColorEntry { color: ColorDef; overrideType: FeatureOverrideType; }
    const overrides: ColorEntry[] = [];
    overrides.push({ color: ColorDef.from(200, 150, 100, 50), overrideType: FeatureOverrideType.ColorOnly });
    overrides.push({ color: ColorDef.from(200, 150, 100, 50), overrideType: FeatureOverrideType.AlphaOnly });
    overrides.push({ color: ColorDef.from(200, 150, 100, 50), overrideType: FeatureOverrideType.ColorAndAlpha });

    const color = new ColorDef();
    for (const entry of overrides) {
      const key = emph.createOverrideKey(entry.color, entry.overrideType);
      assert(undefined !== key);
      const overrideType = emph.getOverrideFromKey(key!, color);
      assert(overrideType === entry.overrideType);
      switch (overrideType) {
        case FeatureOverrideType.ColorOnly:
          assert.isTrue(color.getRgb() === entry.color.getRgb());
          break;
        case FeatureOverrideType.AlphaOnly:
          assert.isTrue(color.getAlpha() === entry.color.getAlpha());
          break;
        case FeatureOverrideType.ColorAndAlpha:
          assert.isTrue(color.equals(entry.color));
          break;
      }
    }

    EmphasizeElements.clear(vp);
  });

  it("JSON to/from", async () => {
    const vp = ScreenViewport.create(viewDiv!, spatialView.clone());
    EmphasizeElements.clear(vp);
    let emph = EmphasizeElements.getOrCreate(vp);
    const ids = new Set<string>();
    let isolated: number = 0;
    let emphasized: number = 0;
    let overridden: number = 0;
    let hidden: number = 0;

    ids.add("0x1"); ids.add("0x2"); ids.add("0x3"); ids.add("0x4"); ids.add("0x5"); isolated = ids.size;
    let status = emph.isolateElements(ids, vp, true);
    assert.isTrue(status);
    let currIds = emph.getIsolatedElements(vp);
    assert.isTrue(undefined !== currIds && ids.size === currIds.size);

    ids.clear(); ids.add("0x3"); ids.add("0x4"); ids.add("0x5"); emphasized = ids.size;
    status = emph.emphasizeElements(ids, vp, undefined, true);
    assert.isTrue(status);
    currIds = emph.getEmphasizedElements(vp);
    assert.isTrue(undefined !== currIds && ids.size === currIds.size);

    const redKey = emph.createOverrideKey(ColorDef.red, FeatureOverrideType.ColorOnly);
    assert.isFalse(undefined === redKey);
    ids.clear(); ids.add("0x5"); overridden = ids.size;
    status = emph.overrideElements(ids, vp, ColorDef.red, undefined, true);
    assert.isTrue(status);
    currIds = emph.getOverriddenElementsByKey(redKey!);
    assert.isTrue(undefined !== currIds && ids.size === currIds.size);

    ids.clear(); ids.add("0x2"); hidden = ids.size;
    status = emph.hideElements(ids, vp, true);
    assert.isTrue(status);
    currIds = emph.getHiddenElements(vp);
    assert.isTrue(undefined !== currIds && ids.size === currIds.size);

    const json = emph.toJSON(vp);
    EmphasizeElements.clear(vp);
    emph = EmphasizeElements.getOrCreate(vp);
    emph.fromJSON(json, vp);

    currIds = emph.getIsolatedElements(vp);
    assert.isTrue(undefined !== currIds && isolated === currIds.size);
    currIds = emph.getEmphasizedElements(vp);
    assert.isTrue(undefined !== currIds && emphasized === currIds.size);
    currIds = emph.getOverriddenElementsByKey(redKey!);
    assert.isTrue(undefined !== currIds && overridden === currIds.size);
    currIds = emph.getHiddenElements(vp);
    assert.isTrue(undefined !== currIds && hidden === currIds.size);

    EmphasizeElements.clear(vp);
  });

});
