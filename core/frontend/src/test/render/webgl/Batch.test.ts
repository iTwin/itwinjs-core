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
  before(async () => await IModelApp.startup());
  after(async () => await IModelApp.shutdown());

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
      const o1 = makeOverrides();

      expect(ba1.perTargetData.data.length).to.equal(0);

      t1.overrideFeatureSymbology(o1);
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
    });

    it("is updated when flash or hilite changes", () => {
    });

    it("is disposed when batch, target, or source is disposed", () => {
    });
  });
});
