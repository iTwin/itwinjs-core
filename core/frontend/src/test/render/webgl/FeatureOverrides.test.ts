/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BeEvent } from "@itwin/core-bentley";
import { Range3d, Transform } from "@itwin/core-geometry";
import { ColorDef, EmptyLocalization, Feature, FeatureAppearance, FeatureTable, PackedFeatureTable } from "@itwin/core-common";
import { ViewRect } from "../../../common/ViewRect";
import { IModelApp } from "../../../IModelApp";
import { FeatureSymbology } from "../../../render/FeatureSymbology";
import { GraphicBranch } from "../../../render/GraphicBranch";
import { Target } from "../../../render/webgl/Target";
import { Texture2DDataUpdater } from "../../../render/webgl/Texture";
import { Batch, Branch } from "../../../render/webgl/Graphic";
import { OvrFlags } from "../../../render/webgl/RenderFlags";
import { testBlankViewport } from "../../openBlankViewport";

describe("FeatureOverrides", () => {
  beforeAll(async () => IModelApp.startup({ localization: new EmptyLocalization() }));
  afterAll(async () => IModelApp.shutdown());

  function makeTarget(): Target {
    const rect = new ViewRect(0, 0, 100, 50);
    const target = IModelApp.renderSystem.createOffscreenTarget(rect);
    expect(target).toBeInstanceOf(Target);
    return target as Target;
  }

  function makeBranch(ovrs?: FeatureSymbology.Overrides): Branch {
    const branch = new GraphicBranch();
    branch.symbologyOverrides = ovrs;
    const graphic = IModelApp.renderSystem.createGraphicBranch(branch, Transform.identity);
    expect(graphic).toBeInstanceOf(Branch);
    return graphic as Branch;
  }

  function createBatch(featureTable: FeatureTable): Batch {
    const graphic = IModelApp.renderSystem.createGraphicList([]);
    const batch = IModelApp.renderSystem.createBatch(graphic, PackedFeatureTable.pack(featureTable), Range3d.createNull());
    expect(batch).toBeInstanceOf(Batch);
    return batch as Batch;
  }

  function makeBatch(): Batch {
    const featureTable = new FeatureTable(100, "0x123");
    featureTable.insertWithIndex(new Feature("0x456", "0x789"), 0);
    return createBatch(featureTable);
  }

  function makeOverrides(source?: FeatureSymbology.Source): FeatureSymbology.Overrides {
    return source ? FeatureSymbology.Overrides.withSource(source) : new FeatureSymbology.Overrides();
  }

  function makeSource(): FeatureSymbology.Source {
    return {
      onSourceDisposed: new BeEvent<() => void>(),
    };
  }

  it("is allocated per combination of target, batch, and source", () => {
    const t1 = makeTarget();
    const br1 = makeBranch();
    const ba1 = makeBatch();

    expect(ba1.perTargetData.data.length).toEqual(0);

    t1.overrideFeatureSymbology(makeOverrides());
    t1.pushBatch(ba1);
    expect(ba1.perTargetData.data.length).toEqual(1);
    t1.popBatch();

    t1.pushBranch(br1);
    t1.pushBatch(ba1);
    expect(ba1.perTargetData.data.length).toEqual(1);
    expect(ba1.perTargetData.data[0].featureOverrides.size).toEqual(1);
    expect(ba1.perTargetData.data[0].featureOverrides.get(undefined)).toBeDefined();
    t1.popBatch();
    t1.popBranch();

    const br2 = makeBranch();
    t1.pushBranch(br2);
    t1.pushBatch(ba1);
    expect(ba1.perTargetData.data.length).toEqual(1);
    expect(ba1.perTargetData.data[0].featureOverrides.size).toEqual(1);
    t1.popBatch();
    t1.popBranch();

    const s1 = makeSource();
    const br3 = makeBranch(makeOverrides(s1));
    t1.pushBranch(br3);
    t1.pushBatch(ba1);
    expect(ba1.perTargetData.data.length).toEqual(1);
    expect(ba1.perTargetData.data[0].featureOverrides.size).toEqual(2);
    expect(ba1.perTargetData.data[0].featureOverrides.get(s1)).toBeDefined();
    t1.popBatch();
    t1.popBranch();

    const br4 = makeBranch(makeOverrides(s1));
    t1.pushBranch(br4);
    t1.pushBatch(ba1);
    expect(ba1.perTargetData.data.length).toEqual(1);
    expect(ba1.perTargetData.data[0].featureOverrides.size).toEqual(2);
    t1.popBatch();
    t1.popBranch();

    const t2 = makeTarget();
    t2.pushBranch(br3);
    t2.pushBatch(ba1);
    expect(ba1.perTargetData.data.length).toEqual(2);
    expect(ba1.perTargetData.data[0].featureOverrides.size).toEqual(2);
    expect(ba1.perTargetData.data[1].featureOverrides.size).toEqual(1);
    t2.popBatch();
    t2.popBranch();

    const s2 = makeSource();
    const br5 = makeBranch(makeOverrides(s2));
    t2.pushBranch(br5);
    t2.pushBatch(ba1);
    expect(ba1.perTargetData.data.length).toEqual(2);
    expect(ba1.perTargetData.data[1].featureOverrides.get(s1)).toBeDefined();
    expect(ba1.perTargetData.data[1].featureOverrides.get(s2)).toBeDefined();
    expect(ba1.perTargetData.data[1].featureOverrides.size).toEqual(2);
    t2.popBatch();
    t2.popBranch();
  });

  it("is recomputed only when the associated symbology overrides change", () => {
    interface Overrides {
      buildLookupTable: () => void;
      updated: boolean;
    }

    function reset(overrides: Overrides[]): void {
      for (const ovr of overrides)
        ovr.updated = false;
    }

    function hook(overrides: Overrides[]): void {
      reset(overrides);
      for (const ovr of overrides)
        ovr.buildLookupTable = () => (ovr.updated = true);
    }

    const target = makeTarget();
    const o0 = makeOverrides();
    target.overrideFeatureSymbology(o0);
    const br0 = makeBranch();
    const s1 = makeSource();
    const o1 = makeOverrides(s1);
    const br1 = makeBranch(o1);
    const s2 = makeSource();
    const o2 = makeOverrides(s2);
    const br2 = makeBranch(o2);

    const batch = makeBatch();

    function update(): void {
      target.pushBatch(batch);
      target.popBatch();
      for (const branch of [br0, br1, br2]) {
        target.pushBranch(branch);
        target.pushBatch(batch);
        target.popBatch();
        target.popBranch();
      }
    }

    update();

    const ovrs = Array.from(batch.perTargetData.data[0].featureOverrides.values()) as unknown as Overrides[];
    hook(ovrs);

    expect(ovrs.length).toEqual(3);
    expect(Array.from(batch.perTargetData.data[0].featureOverrides.keys())).toEqual([undefined, s1, s2]);

    expect(ovrs.some((x) => x.updated)).toBe(false);

    update();
    expect(ovrs.some((x) => x.updated)).toBe(false);

    target.overrideFeatureSymbology(makeOverrides());
    update();
    expect(ovrs[0].updated).toBe(true);
    expect(ovrs[1].updated).toBe(false);
    expect(ovrs[2].updated).toBe(false);

    reset(ovrs);
    br1.branch.symbologyOverrides = makeOverrides(s1);
    update();
    expect(ovrs[1].updated).toBe(true);
    expect(ovrs[0].updated).toBe(false);
    expect(ovrs[2].updated).toBe(false);

    reset(ovrs);
    br2.branch.symbologyOverrides = makeOverrides(s2);
    update();
    expect(ovrs[2].updated).toBe(true);
    expect(ovrs[0].updated).toBe(false);
    expect(ovrs[1].updated).toBe(false);
  });

  it("is disposed when batch, target, or source is disposed", () => {
    const t1 = makeTarget();
    const t2 = makeTarget();
    const s1 = makeSource();
    const s2 = makeSource();
    const ba1 = makeBatch();
    const ba2 = makeBatch();
    const br0 = makeBranch();
    const br1 = makeBranch(makeOverrides(s1));
    const br2 = makeBranch(makeOverrides(s2));

    const batches = [ba1, ba2];

    for (const target of [t1, t2]) {
      for (const branch of [br0, br1, br2]) {
        for (const batch of [ba1, ba2]) {
          target.pushBatch(batch);
          target.popBatch();

          target.pushBranch(branch);
          target.pushBatch(batch);
          target.popBatch();
          target.popBranch();
        }
      }
    }

    for (const batch of batches) {
      expect(batch.perTargetData.data.length).toEqual(2);
      for (let i = 0; i < 2; i++) {
        const ovrs = batch.perTargetData.data[i].featureOverrides;
        expect(ovrs.size).toEqual(3);
        for (const source of [undefined, s1, s2])
          expect(ovrs.get(source)).toBeDefined();
      }
    }

    s1.onSourceDisposed.raiseEvent();
    for (const batch of batches) {
      expect(batch.perTargetData.data.length).toEqual(2);
      for (let i = 0; i < 2; i++) {
        const ovrs = batch.perTargetData.data[i].featureOverrides;
        expect(ovrs.size).toEqual(2);
        expect(ovrs.get(s1)).toBeUndefined();
      }
    }

    t2.dispose();
    for (const batch of batches) {
      expect(batch.perTargetData.data.length).toEqual(1);
      expect(batch.perTargetData.data[0].target).toEqual(t1);
      expect(batch.perTargetData.data[0].featureOverrides.size).toEqual(2);
    }

    ba1.dispose();
    expect(ba1.perTargetData.data.length).toEqual(0);
    expect(ba1.isDisposed).toBe(true);
    expect(ba2.isDisposed).toBe(false);

    t1.dispose();
    s1.onSourceDisposed.raiseEvent();
    expect(ba2.perTargetData.data.length).toEqual(0);

    ba2.dispose();
  });

  it("updates when HiliteSet changes", () => {
    const m1 = "0xa1";
    const m2 = "0xa2";
    const s1 = "0xc1";
    const s2 = "0xc2";

		type ElemId = "0xe11" | "0xe12" | "0xe21" | "0xe22";
		const e11: ElemId = "0xe11";
		const e12: ElemId = "0xe12";
		const e21: ElemId = "0xe21";
		const e22: ElemId = "0xe22";

		function createFeatureTable(modelId: string, elem1: string, elem2: string): FeatureTable {
		  const featureTable = new FeatureTable(100, modelId);
		  featureTable.insertWithIndex(new Feature(elem1, s1), 0);
		  featureTable.insertWithIndex(new Feature(elem2, s2), 1);
		  return featureTable;
		}

		const b1 = createBatch(createFeatureTable(m1, e11, e12));
		const b2 = createBatch(createFeatureTable(m2, e21, e22));

		expect(b1.perTargetData.data.length).toEqual(0);

		testBlankViewport((vp) => {
		  function runTest(withSymbOvrs: boolean): void {
		    // Make the viewport consider our subcategories visible, otherwise we can't hilite them...
		    vp.addFeatureOverrideProvider({
		      addFeatureOverrides: (ovrs) => {
		        ovrs.ignoreSubCategory = true;
		        if (withSymbOvrs) {
		          ovrs.override({ modelId: m1, appearance: FeatureAppearance.fromRgba(ColorDef.blue) });
		          ovrs.override({ subCategoryId: s2, appearance: FeatureAppearance.fromJSON({ weight: 5 }) });
		        }
		      },
		    });

		    IModelApp.viewManager.addViewport(vp);
		    const target = vp.target as Target;
		    expect(target).toBeInstanceOf(Target);

		    vp.view.createScene = (context) => {
		      context.scene.foreground.push(b1);
		      context.scene.background.push(b2);
		    };

		    function test(expectedHilitedElements: ElemId | ElemId[], setup: () => void): void {
		      function expectHilited(batch: Batch, featureIndex: 0 | 1, expectToBeHilited: boolean): void {
		        const ptd = batch.perTargetData.data[0];
		        if (!ptd) {
		          expect(expectToBeHilited).toBe(false);
		          return;
		        }

		        const ovrs = ptd.featureOverrides.get(undefined);
		        expect(ovrs).toBeDefined();
		        const data = ovrs!.lutData!;
		        expect(data).toBeDefined();

		        const numBytesPerFeature = 8; // 2 RGBA values per feature
		        expect(data.length).toEqual(2 * numBytesPerFeature);

		        const tex = new Texture2DDataUpdater(data);
		        const flags = tex.getOvrFlagsAtIndex(featureIndex * numBytesPerFeature);
		        const isHilited = 0 !== (flags & OvrFlags.Hilited);
		        expect(isHilited).toEqual(expectToBeHilited);
		      }

		      setup();
		      vp.renderFrame();

		      expect(target.hilites).toEqual(vp.iModel.hilited);
		      expect(b1.perTargetData.data.length).toEqual(1);

		      const expected = new Set<string>(expectedHilitedElements ? (typeof expectedHilitedElements === "string" ? [expectedHilitedElements] : expectedHilitedElements) : []);
		      if (expected.size > 0) {
		        expect(b1.perTargetData.data.length).toEqual(1);
		        expect(b2.perTargetData.data.length).toEqual(1);
		      }

		      expectHilited(b1, 0, expected.has(e11));
		      expectHilited(b1, 1, expected.has(e12));
		      expectHilited(b2, 0, expected.has(e21));
		      expectHilited(b2, 1, expected.has(e22));
		    }

		    const h = vp.iModel.hilited;
		    function reset() {
		      test([], () => {
		        h.clear();
		        h.modelSubCategoryMode = "union";
		      });

		      if (withSymbOvrs)
		        vp.setFeatureOverrideProviderChanged();
		    }

		    reset();
		    const allElems = [e11, e12, e21, e22];
		    test(allElems, () => h.elements.addIds(allElems));

		    for (const el of allElems) {
		      reset();
		      test(el, () => {
		        expect(h.elements.isEmpty).toBe(true);
		        h.elements.addId(el);
		        expect(h.elements.isEmpty).toBe(false);
		        expect(h.elements.hasId(el)).toBe(true);
		      });
		    }

		    reset();
		    test([e11, e12], () => h.models.addId(m1));
		    reset();
		    test([e21, e22], () => h.models.addId(m2));

		    reset();
		    test([e11, e21], () => h.subcategories.addId(s1));
		    reset();
		    test([e12, e22], () => h.subcategories.addId(s2));

		    reset();
		    test([e12, e21, e22], () => {
		      h.models.addId(m2);
		      h.subcategories.addId(s2);
		    });

		    test(e22, () => (h.modelSubCategoryMode = "intersection"));
		    test([e12, e21, e22], () => (h.modelSubCategoryMode = "union"));

		    reset();
		    test([], () => {
		      h.modelSubCategoryMode = "intersection";
		      h.subcategories.addIds([s1, s2]);
		    });

		    reset();
		    test([], () => {
		      h.modelSubCategoryMode = "intersection";
		      h.models.addIds([m1, m2]);
		    });

		    test(allElems, () => h.subcategories.addIds([s1, s2]));
		  }

		  runTest(false);
		  runTest(true);
		});
  });
});
