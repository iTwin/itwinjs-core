/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { IModelApp } from "../IModelApp";
import { ViewRect } from "../Viewport";
import { RenderGraphic, RenderTarget } from "../render/System";
import { MockRender } from "../render/MockRender";

class MyTarget extends MockRender.OffScreenTarget { }
class MyList extends MockRender.List { }
class MySystem extends MockRender.System {
  public createOffscreenTarget(rect: ViewRect): RenderTarget { return new MyTarget(this, rect); }
  public createGraphicList(list: RenderGraphic[]) { return new MyList(list); }
}

describe("MockRender", () => {
  before(() => {
    MockRender.App.systemFactory = () => new MySystem();
    MockRender.App.startup();
  });

  after(() => MockRender.App.shutdown());

  it("Should override mock render system", () => {
    expect(IModelApp.hasRenderSystem).to.be.true;
    expect(IModelApp.renderSystem).instanceof(MySystem);
    expect(IModelApp.renderSystem.createOffscreenTarget(new ViewRect(0, 0, 10, 20))).instanceof(MyTarget);
    expect(IModelApp.renderSystem.createGraphicList([])).instanceof(MyList);
  });
});
