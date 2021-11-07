/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/*
import { expect } from "chai";
import { EnvironmentDecorations } from "../../EnvironmentDecorations";
import { SpatialViewState } from "../../SpatialViewState";
import { IModelConnection } from "../../IModelConnection";
import { IModelApp } from "../../IModelApp";
import { MockRender } from "../../render/MockRender";
import { createBlankConnection } from "../createBlankConnection";

class Texture extends RenderTexture {
  public gradient?: Gradient.Symb;
}

class System extends MockRender.System {

}

describe.only("EnvironmentDecorations", () => {
  const system = new System();
  let iModel: IModelConnection;
  let view: SpatialViewState;

  before(async () => {
    MockRender.App.systemFactory = () => system;
    await MockRender.App.startup();
    iModel = createBlankConnection();
    view = SpatialViewState.createBlank(iModel, {x: 0, y: 0, z: 0}, {x: 1, y: 1, z: 1});
  });

  after(async () => {
    await iModel.close();
    await IModelApp.shutdown();
  });

  it("initializes from display style", async () => {
  });

  it("disposes", async () => {
  });

  it("only allocates ground if displayed", () => {
  });

  it("only recreates ground if settings change", () => {
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
});
*/
