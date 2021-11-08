/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { BeDuration } from "@itwin/core-bentley";
import { Environment, EnvironmentProps } from "@itwin/core-common";
import { EnvironmentDecorations } from "../../EnvironmentDecorations";
import { SpatialViewState } from "../../SpatialViewState";
import { IModelConnection } from "../../IModelConnection";
import { IModelApp } from "../../IModelApp";
import { createBlankConnection } from "../createBlankConnection";

class Decorations extends EnvironmentDecorations {
  public get sky() { return this._sky; }
  public get ground() { return this._ground; }

  public constructor(view: SpatialViewState, onLoad?: () => void, onDispose?: () => void) {
    super(view, onLoad ?? (() => undefined), onDispose ?? (() => undefined));
  }

  public async load(): Promise<void> {
    if (!this.sky.promise)
      return;

    await this.sky.promise;
    return BeDuration.wait(1);
  }
}

describe.only("EnvironmentDecorations", () => {
  let iModel: IModelConnection;

  function createView(env?: EnvironmentProps): SpatialViewState {
    const view = SpatialViewState.createBlank(iModel, {x: 0, y: 0, z: 0}, {x: 1, y: 1, z: 1});
    if (env)
      view.displayStyle.environment = Environment.fromJSON(env);

    return view;
  }

  before(async () => {
    await IModelApp.startup();
    iModel = createBlankConnection();
  });

  after(async () => {
    await iModel.close();
    await IModelApp.shutdown();
  });

  it("initializes from display style", async () => {
  });

  it("disposes", async () => {
    let disposed = false;
    const dec = new Decorations(createView({ ground: { display: true } }), undefined, () => disposed = true);
    expect(disposed).to.be.false;
    expect(dec.ground).not.to.be.undefined;
    expect(dec.sky.promise).not.to.be.undefined;
    expect(dec.sky.params).to.be.undefined;

    await dec.load();
    expect(disposed).to.be.false;
    expect(dec.ground).not.to.be.undefined;
    expect(dec.sky.promise).to.be.undefined;
    expect(dec.sky.params).not.to.be.undefined;

    dec.dispose();
    expect(disposed).to.be.true;
    expect(dec.ground).to.be.undefined;
    expect(dec.sky.promise).to.be.undefined;
    expect(dec.sky.params).to.be.undefined;
  });

  it("only allocates ground while displayed", async () => {
  });

  it("only recreates ground if settings change", async () => {
  });

  it("always loads sky", async () => {
  });

  it("notifies when asynchronous loading completes", async () => {
  });

  it("produces sky sphere", async () => {
  });

  it("produces sky cube", async () => {
  });

  it("produces sky gradient", async () => {
  });

  it("falls back to sky gradient on error", async () => {
  });

  it("reuses cached textures", async () => {
  });

  it("only recreates sky if settings change", async () => {
  });
});
