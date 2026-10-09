/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "vitest";
import {
  EmphasizeElements, FeatureOverrideProvider, FeatureSymbology, IModelConnection, MutableChangeFlags, Viewport,
} from "@itwin/core-frontend";
import { TestUtility } from "../TestUtility";
import { testOnScreenViewport } from "../TestViewport";
import { TestSnapshotConnection } from "../TestSnapshotConnection";

describe("FeatureOverrideProvider", () => {
  let imodel: IModelConnection;

  beforeAll(async () => {
    await TestUtility.startFrontend();
    imodel = await TestSnapshotConnection.openFile("mirukuru.ibim");
  });

  afterAll(async () => {
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
    expect(flags.featureOverrideProvider).toBe(expectDirty);
    flags.clear();
  }

  it("adds and drops", async () => {
    await testOnScreenViewport("0x24", imodel, 200, 150, async (vp) => {
      const expectCount = (count: number) => {
        const list = (vp as any)._featureOverrideProviders as FeatureOverrideProvider[];
        expect(list.length).toBe(count);
      };

      const p1 = new Provider();
      const p2 = new Provider();

      expectCount(0);
      expect(vp.addFeatureOverrideProvider(p1)).toBe(true);
      checkDirty(vp, true);
      expectCount(1);

      expect(vp.addFeatureOverrideProvider(p1)).toBe(false);
      checkDirty(vp, false);
      expectCount(1);

      expect(vp.addFeatureOverrideProvider(p2)).toBe(true);
      checkDirty(vp, true);
      expectCount(2);

      expect(vp.addFeatureOverrideProvider(p2)).toBe(false);
      checkDirty(vp, false);
      expectCount(2);

      expect(vp.dropFeatureOverrideProvider(p1)).toBe(true);
      checkDirty(vp, true);
      expectCount(1);

      expect(vp.dropFeatureOverrideProvider(p1)).toBe(false);
      checkDirty(vp, false);
      expectCount(1);

      expect(vp.dropFeatureOverrideProvider(p2)).toBe(true);
      checkDirty(vp, true);
      expectCount(0);

      expect(vp.dropFeatureOverrideProvider(p2)).toBe(false);
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

      expect(vp.findFeatureOverrideProviderOfType<Provider>(Provider)).toBe(p1);
      expect(vp.findFeatureOverrideProviderOfType<EmphasizeElements>(EmphasizeElements)).toBeUndefined();

      expect(vp.findFeatureOverrideProvider((x) => (x as Provider).id === 1)).toBe(p1);
      expect(vp.findFeatureOverrideProvider((x) => (x as Provider).id === 2)).toBe(p2);
      expect(vp.findFeatureOverrideProvider((x) => (x as Provider).id === 3)).toBeUndefined();
    });
  });
});
