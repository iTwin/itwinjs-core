/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { BeEvent } from "@itwin/core-bentley";
import { Range3d, Transform } from "@itwin/core-geometry";
import { Feature, FeatureTable, PackedFeatureTable } from "@itwin/core-common";
import { ViewRect } from "../../../ViewRect";
import { IModelApp } from "../../../IModelApp";
import { FeatureSymbology } from "../../../render/FeatureSymbology";
import { GraphicBranch } from "../../../render/GraphicBranch";
import { Target } from "../../../render/webgl/Target";
import { Batch, Branch } from "../../../render/webgl/Graphic";

describe("Batch", () => {
  before(async () => IModelApp.startup());
  after(async () => IModelApp.shutdown());

  function makeTarget(): Target {
    const rect = new ViewRect(0, 0, 100, 50);
    const target = IModelApp.renderSystem.createOffscreenTarget(rect);
    expect(target).instanceof(Target);
    return target as Target;
  }

  function makeBranch(ovrs?: FeatureSymbology.Overrides): Branch {
    const branch = new GraphicBranch();
    branch.symbologyOverrides = ovrs;
    const graphic = IModelApp.renderSystem.createGraphicBranch(branch, Transform.identity);
    expect(graphic).instanceOf(Branch);
    return graphic as Branch;
  }

  function makeBatch(): Batch {
    const featureTable = new FeatureTable(100, "0x123");
    featureTable.insertWithIndex(new Feature("0x456", "0x789"), 0);
    const graphic = IModelApp.renderSystem.createGraphicList([]);
    const batch = IModelApp.renderSystem.createBatch(graphic, PackedFeatureTable.pack(featureTable), Range3d.createNull());
    expect(batch).instanceOf(Batch);
    return batch as Batch;
  }

  function makeOverrides(source?: FeatureSymbology.Source): FeatureSymbology.Overrides {
    return source ? FeatureSymbology.Overrides.withSource(source) : new FeatureSymbology.Overrides();
  }

  function makeSource(): FeatureSymbology.Source {
    return {
      onSourceDisposed: new BeEvent<() => void>(),
    };
  }

  describe("feature overrides", () => {
    it("is allocated per combination of target, batch, and source", () => {
      const t1 = makeTarget();
      const br1 = makeBranch();
      const ba1 = makeBatch();

      expect(ba1.perTargetData.data.length).to.equal(0);

      t1.overrideFeatureSymbology(makeOverrides());
      t1.pushBatch(ba1);
      expect(ba1.perTargetData.data.length).to.equal(1);
      t1.popBatch();

      t1.pushBranch(br1);
      t1.pushBatch(ba1);
      expect(ba1.perTargetData.data.length).to.equal(1);
      expect(ba1.perTargetData.data[0].featureOverrides.size).to.equal(1);
      expect(ba1.perTargetData.data[0].featureOverrides.get(undefined)).not.to.be.undefined;
      t1.popBatch();
      t1.popBranch();

      const br2 = makeBranch();
      t1.pushBranch(br2);
      t1.pushBatch(ba1);
      expect(ba1.perTargetData.data.length).to.equal(1);
      expect(ba1.perTargetData.data[0].featureOverrides.size).to.equal(1);
      t1.popBatch();
      t1.popBranch();

      const s1 = makeSource();
      const br3 = makeBranch(makeOverrides(s1));
      t1.pushBranch(br3);
      t1.pushBatch(ba1);
      expect(ba1.perTargetData.data.length).to.equal(1);
      expect(ba1.perTargetData.data[0].featureOverrides.size).to.equal(2);
      expect(ba1.perTargetData.data[0].featureOverrides.get(s1)).not.to.be.undefined;
      t1.popBatch();
      t1.popBranch();

      const br4 = makeBranch(makeOverrides(s1));
      t1.pushBranch(br4);
      t1.pushBatch(ba1);
      expect(ba1.perTargetData.data.length).to.equal(1);
      expect(ba1.perTargetData.data[0].featureOverrides.size).to.equal(2);
      t1.popBatch();
      t1.popBranch();

      const t2 = makeTarget();
      t2.pushBranch(br3);
      t2.pushBatch(ba1);
      expect(ba1.perTargetData.data.length).to.equal(2);
      expect(ba1.perTargetData.data[0].featureOverrides.size).to.equal(2);
      expect(ba1.perTargetData.data[1].featureOverrides.size).to.equal(1);
      t2.popBatch();
      t2.popBranch();

      const s2 = makeSource();
      const br5 = makeBranch(makeOverrides(s2));
      t2.pushBranch(br5);
      t2.pushBatch(ba1);
      expect(ba1.perTargetData.data.length).to.equal(2);
      expect(ba1.perTargetData.data[1].featureOverrides.get(s1)).not.to.be.undefined;
      expect(ba1.perTargetData.data[1].featureOverrides.get(s2)).not.to.be.undefined;
      expect(ba1.perTargetData.data[1].featureOverrides.size).to.equal(2);
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
          ovr.buildLookupTable = () => ovr.updated = true;
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

      expect(ovrs.length).to.equal(3);
      expect(Array.from(batch.perTargetData.data[0].featureOverrides.keys())).to.deep.equal([undefined, s1, s2]);

      expect(ovrs.some((x) => x.updated)).to.be.false;

      update();
      expect(ovrs.some((x) => x.updated)).to.be.false;

      target.overrideFeatureSymbology(makeOverrides());
      update();
      expect(ovrs[0].updated).to.be.true;
      expect(ovrs[1].updated).to.be.false;
      expect(ovrs[2].updated).to.be.false;

      reset(ovrs);
      br1.branch.symbologyOverrides = makeOverrides(s1);
      update();
      expect(ovrs[1].updated).to.be.true;
      expect(ovrs[0].updated).to.be.false;
      expect(ovrs[2].updated).to.be.false;

      reset(ovrs);
      br2.branch.symbologyOverrides = makeOverrides(s2);
      update();
      expect(ovrs[2].updated).to.be.true;
      expect(ovrs[0].updated).to.be.false;
      expect(ovrs[1].updated).to.be.false;
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
        expect(batch.perTargetData.data.length).to.equal(2);
        for (let i = 0; i < 2; i++) {
          const ovrs = batch.perTargetData.data[i].featureOverrides;
          expect(ovrs.size).to.equal(3);
          for (const source of [undefined, s1, s2])
            expect(ovrs.get(source)).not.to.be.undefined;
        }
      }

      s1.onSourceDisposed.raiseEvent();
      for (const batch of batches) {
        expect(batch.perTargetData.data.length).to.equal(2);
        for (let i = 0; i < 2; i++) {
          const ovrs = batch.perTargetData.data[i].featureOverrides;
          expect(ovrs.size).to.equal(2);
          expect(ovrs.get(s1)).to.be.undefined;
        }
      }

      t2.dispose();
      for (const batch of batches) {
        expect(batch.perTargetData.data.length).to.equal(1);
        expect(batch.perTargetData.data[0].target).to.equal(t1);
        expect(batch.perTargetData.data[0].featureOverrides.size).to.equal(2);
      }

      ba1.dispose();
      expect(ba1.perTargetData.data.length).to.equal(0);
      expect(ba1.isDisposed).to.be.true;
      expect(ba2.isDisposed).to.be.false;

      t1.dispose();
      s1.onSourceDisposed.raiseEvent();
      expect(ba2.perTargetData.data.length).to.equal(0);

      ba2.dispose();
    });
  });
});
