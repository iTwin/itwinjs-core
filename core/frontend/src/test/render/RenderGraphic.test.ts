/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/* eslint-disable @typescript-eslint/unbound-method */

import { describe, expect, it } from "vitest";
import { IDisposable } from "@itwin/core-bentley";
import { Transform } from "@itwin/core-geometry";
import { ElementAlignedBox3d, RenderFeatureTable } from "@itwin/core-common";
import { GraphicBranch, GraphicBranchOptions } from "../../render/GraphicBranch";
import { MockRender } from "../../render/MockRender";
import { RenderGraphic } from "../../render/RenderGraphic";

function addIsDisposed(disposable: IDisposable): void {
  (disposable as any).isDisposed = false;
  const dispose = disposable.dispose;
  disposable.dispose = () => {
    (disposable as any).isDisposed = true;
    dispose.call(disposable);
  };
}

class Branch extends GraphicBranch {
  public isDisposed = false;

  public constructor(ownsEntries: boolean) {
    super(ownsEntries);
  }

  public override dispose() {
    this.isDisposed = true;
    super.dispose();
  }
}

class System extends MockRender.System {
  public override createGraphicList(graphics: RenderGraphic[]) {
    const ret = super.createGraphicList(graphics);
    addIsDisposed(ret);
    return ret;
  }

  public override createGraphicBranch(branch: GraphicBranch, transform: Transform, options?: GraphicBranchOptions) {
    const ret = super.createGraphicBranch(branch, transform, options);
    addIsDisposed(ret);
    return ret;
  }

  public override createBatch(graphic: RenderGraphic, features: RenderFeatureTable, range: ElementAlignedBox3d) {
    const ret = super.createBatch(graphic, features, range);
    addIsDisposed(ret);
    return ret;
  }

  public override createGraphicOwner(graphic: RenderGraphic) {
    const ret = super.createGraphicOwner(graphic);
    addIsDisposed(ret);
    return ret;
  }

  public makeGraphic() {
    const ret = super.createMesh({} as any);
    addIsDisposed(ret);
    return ret;
  }
}

function isDisposed(disposable: any): boolean {
  expect(disposable.isDisposed).toBeDefined();
  return disposable.isDisposed;
}

describe("RenderGraphic", () => {
  it("should not be disposed if owned", () => {
    const system = new System();
    const unowned = system.makeGraphic();
    const owned = system.makeGraphic();
    const owner = system.createGraphicOwner(owned);

    unowned.dispose();
    owner.dispose();

    expect(isDisposed(unowned)).toBe(true);
    expect(isDisposed(owner)).toBe(true);
    expect(isDisposed(owned)).toBe(false);

    owner.disposeGraphic();
    expect(isDisposed(owned)).toBe(true);
  });
});

describe("GraphicBranch", () => {
  it("should dispose of entries only if owned", () => {
    const system = new System();
    const owned = system.makeGraphic();
    const owningBranch = new Branch(true);
    owningBranch.add(owned);

    const unowned = system.makeGraphic();
    const branch = new Branch(false);
    branch.add(unowned);

    owningBranch.dispose();
    expect(isDisposed(owningBranch)).toBe(true);
    expect(isDisposed(owned)).toBe(true);
    expect(owningBranch.entries.length).toBe(0);

    branch.dispose();
    expect(isDisposed(branch)).toBe(true);
    expect(isDisposed(unowned)).toBe(false);
    expect(branch.entries.length).toBe(0);
  });

  it("should not dispose of graphics owned by a graphic owner", () => {
    const system = new System();
    const owned = system.makeGraphic();
    const owner = system.createGraphicOwner(owned);
    const unowned = system.makeGraphic();

    const branch = new Branch(true);
    branch.add(owner);
    branch.add(unowned);

    branch.dispose();
    expect(isDisposed(branch)).toBe(true);
    expect(branch.entries.length).toBe(0);
    expect(isDisposed(owner)).toBe(true);
    expect(isDisposed(unowned)).toBe(true);
    expect(isDisposed(owned)).toBe(false);
  });
});
