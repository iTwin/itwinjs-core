/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { BeDuration } from "@itwin/core-bentley";
import { ColorDef, Environment, EnvironmentProps } from "@itwin/core-common";
import { EnvironmentDecorations } from "../../EnvironmentDecorations";
import { SpatialViewState } from "../../SpatialViewState";
import { IModelConnection } from "../../IModelConnection";
import { IModelApp } from "../../IModelApp";
import { createBlankConnection } from "../createBlankConnection";

describe.only("EnvironmentDecorations", () => {
  let iModel: IModelConnection;

  function createView(env?: EnvironmentProps): SpatialViewState {
    const view = SpatialViewState.createBlank(iModel, {x: 0, y: 0, z: 0}, {x: 1, y: 1, z: 1});
    if (env)
      view.displayStyle.environment = Environment.fromJSON(env);

    return view;
  }

  class Decorations extends EnvironmentDecorations {
    public get sky() { return this._sky; }
    public get ground() { return this._ground; }
    public get environment() { return this._environment; }

    public constructor(view?: SpatialViewState, onLoad?: () => void, onDispose?: () => void) {
      super(view ?? createView(), onLoad ?? (() => undefined), onDispose ?? (() => undefined));
    }

    public static async create(view?: SpatialViewState, onLoad?: () => void, onDispose?: () => void): Promise<Decorations> {
      const dec = new Decorations(view, onLoad, onDispose);
      await dec.load();
      return dec;
    }

    public async load(): Promise<void> {
      if (!this.sky.promise)
        return;

      await this.sky.promise;
      return BeDuration.wait(1);
    }
  }

  before(async () => {
    await IModelApp.startup();
    iModel = createBlankConnection();
  });

  after(async () => {
    await iModel.close();
    await IModelApp.shutdown();
  });

  it("initializes from environment", async () => {
    const dec = await Decorations.create(createView({
      ground: {
        display: true,
        elevation: 20,
        aboveColor: ColorDef.blue.toJSON(),
        belowColor: ColorDef.red.toJSON(),
      },
      sky: {
        display: true,
        nadirColor: ColorDef.blue.toJSON(),
        zenithColor: ColorDef.red.toJSON(),
        skyColor: ColorDef.white.toJSON(),
        groundColor: ColorDef.black.toJSON(),
        skyExponent: 42,
        groundExponent: 24,
      },
    }));

    expect(dec.ground).not.to.be.undefined;
    expect(dec.ground!.aboveParams.lineColor.equals(ColorDef.blue.withTransparency(0xff))).to.be.true;
    expect(dec.ground!.belowParams.lineColor.equals(ColorDef.red.withTransparency(0xff))).to.be.true;

    expect(dec.sky.params).not.to.be.undefined;
    let sky = dec.sky.params!.gradient!;
    expect(sky).not.to.be.undefined;
    expect(sky.twoColor).to.be.false;
    expect(sky.nadirColor.equals(ColorDef.blue)).to.be.true;
    expect(sky.zenithColor.equals(ColorDef.red)).to.be.true;
    expect(sky.skyColor.equals(ColorDef.white)).to.be.true;
    expect(sky.groundColor.equals(ColorDef.black)).to.be.true;
    expect(sky.skyExponent).to.equal(42);
    expect(sky.groundExponent).to.equal(24);

    dec.setEnvironment(Environment.fromJSON({
      ground: {
        display: true,
        aboveColor: ColorDef.white.toJSON(),
        belowColor: ColorDef.black.toJSON(),
      },
      sky: {
        display: false,
        nadirColor: ColorDef.white.toJSON(),
        zenithColor: ColorDef.black.toJSON(),
        skyColor: ColorDef.red.toJSON(),
        groundColor: ColorDef.green.toJSON(),
        skyExponent: 123,
        groundExponent: 456,
      },
    }));

    await dec.load();
    expect(dec.ground!.aboveParams.lineColor.equals(ColorDef.white.withTransparency(0xff))).to.be.true;
    expect(dec.ground!.belowParams.lineColor.equals(ColorDef.black.withTransparency(0xff))).to.be.true;

    sky = dec.sky.params!.gradient!;
    expect(sky.nadirColor.equals(ColorDef.white)).to.be.true;
    expect(sky.zenithColor.equals(ColorDef.black)).to.be.true;
    expect(sky.skyColor.equals(ColorDef.red)).to.be.true;
    expect(sky.groundColor.equals(ColorDef.green)).to.be.true;
    expect(sky.skyExponent).to.equal(123);
    expect(sky.groundExponent).to.equal(456);
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
    const dec = await Decorations.create();
    expect(dec.ground).to.be.undefined;

    dec.setEnvironment(Environment.fromJSON({ ground: { display: true } }));
    expect(dec.ground).not.to.be.undefined;

    dec.setEnvironment(Environment.fromJSON());
    expect(dec.ground).to.be.undefined;
  });

  it("only recreates ground if settings change", async () => {
    const dec = new Decorations(createView({ ground: { display: true } }));
    const prevGround = dec.ground;
    expect(prevGround).not.to.be.undefined;

    dec.setEnvironment(dec.environment.clone({ displaySky: true }));
    expect(dec.ground).to.equal(prevGround);

    dec.setEnvironment(dec.environment.clone({ ground: dec.environment.ground.clone({ elevation: 100 }) }));
    expect(dec.ground).not.to.equal(prevGround);
    expect(dec.ground).not.to.be.undefined;

    await dec.load();
  });

  it("always loads sky", async () => {
  });

  it("notifies when asynchronous loading completes", async () => {
  });

  it("produces sky sphere", async () => {
  });

  it("produces sky cube", async () => {
  });

  it("falls back to sky gradient on error", async () => {
  });

  it("reuses cached textures", async () => {
  });

  it("only recreates sky if settings change", async () => {
  });
});
