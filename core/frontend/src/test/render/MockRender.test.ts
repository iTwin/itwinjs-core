/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { Schema, SchemaContext } from "@bentley/ecschema-metadata";
import { IModelApp } from "../../IModelApp";
import { MockRender } from "../../render/MockRender";
import { RenderGraphic } from "../../render/RenderGraphic";
import { RenderTarget } from "../../render/RenderTarget";
import { ViewRect } from "../../ViewRect";
import { UNIT_SCHEMA_STRING } from "../public/assets/UnitSchema/UnitSchema";

class MyTarget extends MockRender.OffScreenTarget { }
class MyList extends MockRender.List { }
class MySystem extends MockRender.System {
  public createOffscreenTarget(rect: ViewRect): RenderTarget { return new MyTarget(this, rect); }
  public createGraphicList(list: RenderGraphic[]) { return new MyList(list); }
}

describe("MockRender", () => {
  before(async () => {
    MockRender.App.systemFactory = () => new MySystem();
    const schemaContext = new SchemaContext();
    Schema.fromJsonSync(UNIT_SCHEMA_STRING, schemaContext);
    await MockRender.App.startup({ schemaContext });
  });

  after(async () => MockRender.App.shutdown());

  it("Should override mock render system", () => {
    expect(IModelApp.hasRenderSystem).to.be.true;
    expect(IModelApp.renderSystem).instanceof(MySystem);
    expect(IModelApp.renderSystem.createOffscreenTarget(new ViewRect(0, 0, 10, 20))).instanceof(MyTarget);
    expect(IModelApp.renderSystem.createGraphicList([])).instanceof(MyList);
  });
});
