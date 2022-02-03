/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import type { FeatureOverrideProvider, FeatureSymbology, IModelConnection, MutableChangeFlags, Viewport} from "@itwin/core-frontend";
import {
  EmphasizeElements, SnapshotConnection,
} from "@itwin/core-frontend";
import { TestUtility } from "../TestUtility";
import { testOnScreenViewport } from "../TestViewport";

describe("FeatureOverrideProvider", () => {
  let imodel: IModelConnection;

  before(async () => {
    await TestUtility.startFrontend();
    imodel = await SnapshotConnection.openFile("mirukuru.ibim");
  });

  after(async () => {
    if (imodel)
      await imodel.close();

    await TestUtility.shutdownFrontend();
  });

  class Provider implements FeatureOverrideProvider {
    public id = 0;
    public addFeatureOverrides(_ovrs: FeatureSymbology.Overrides, _vp: Viewport): void {
    }
  }

  function checkDirty(vp: Viewport, expectDirty: boolean): void {
    const flags = (vp as any)._changeFlags as MutableChangeFlags;
    expect(flags.featureOverrideProvider).to.equal(expectDirty);
    flags.clear();
  }

  it("adds and drops", async () => {
    await testOnScreenViewport("0x24", imodel, 200, 150, async (vp) => {
      const expectCount = (count: number) => {
        const list = (vp as any)._featureOverrideProviders as FeatureOverrideProvider[];
        expect(list.length).to.equal(count);
      };

      const p1 = new Provider();
      const p2 = new Provider();

      expectCount(0);
      expect(vp.addFeatureOverrideProvider(p1)).to.be.true;
      checkDirty(vp, true);
      expectCount(1);

      expect(vp.addFeatureOverrideProvider(p1)).to.be.false;
      checkDirty(vp, false);
      expectCount(1);

      expect(vp.addFeatureOverrideProvider(p2)).to.be.true;
      checkDirty(vp, true);
      expectCount(2);

      expect(vp.addFeatureOverrideProvider(p2)).to.be.false;
      checkDirty(vp, false);
      expectCount(2);

      expect(vp.dropFeatureOverrideProvider(p1)).to.be.true;
      checkDirty(vp, true);
      expectCount(1);

      expect(vp.dropFeatureOverrideProvider(p1)).to.be.false;
      checkDirty(vp, false);
      expectCount(1);

      expect(vp.dropFeatureOverrideProvider(p2)).to.be.true;
      checkDirty(vp, true);
      expectCount(0);

      expect(vp.dropFeatureOverrideProvider(p2)).to.be.false;
      checkDirty(vp, false);
      expectCount(0);
    });
  });

  it("finds registered provider", async () => {
    await testOnScreenViewport("0x24", imodel, 200, 150, async (vp) => {
      const p1 = new Provider();
      p1.id = 1;
      vp.addFeatureOverrideProvider(p1);

      const p2 = new Provider();
      p2.id = 2;
      vp.addFeatureOverrideProvider(p2);

      expect(vp.findFeatureOverrideProviderOfType<Provider>(Provider)).to.equal(p1);
      expect(vp.findFeatureOverrideProviderOfType<EmphasizeElements>(EmphasizeElements)).to.be.undefined;

      expect(vp.findFeatureOverrideProvider((x) => (x as Provider).id === 1)).to.equal(p1);
      expect(vp.findFeatureOverrideProvider((x) => (x as Provider).id === 2)).to.equal(p2);
      expect(vp.findFeatureOverrideProvider((x) => (x as Provider).id === 3)).to.be.undefined;
    });
  });
});
