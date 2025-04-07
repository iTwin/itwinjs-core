/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { IModelApp } from "../../IModelApp.js";
import { MockRender } from "../../internal/render/MockRender.js";
import { RenderGraphic } from "../../render/RenderGraphic.js";
import { RenderTarget } from "../../render/RenderTarget.js";
import { ViewRect } from "../../common/ViewRect.js";

class MyTarget extends MockRender.OffScreenTarget { }
class MyList extends MockRender.List { }
class MySystem extends MockRender.System {
  public override createOffscreenTarget(rect: ViewRect): RenderTarget { return new MyTarget(this, rect); }
  public override createGraphicList(list: RenderGraphic[]) { return new MyList(list); }
}

describe("MockRender", () => {
  beforeAll(async () => {
    MockRender.App.systemFactory = () => new MySystem();
    await MockRender.App.startup();
  });

  afterAll(async () => MockRender.App.shutdown());

  it("Should override mock render system", () => {
    expect(IModelApp.hasRenderSystem).toBe(true);
    expect(IModelApp.renderSystem).toBeInstanceOf(MySystem);
    expect(IModelApp.renderSystem.createOffscreenTarget(new ViewRect(0, 0, 10, 20))).toBeInstanceOf(MyTarget);
    expect(IModelApp.renderSystem.createGraphicList([])).toBeInstanceOf(MyList);
  });
});
