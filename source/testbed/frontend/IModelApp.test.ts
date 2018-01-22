/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { IModelApp, iModelApp } from "../../frontend/IModelApp";
import { AccuDraw } from "../../frontend/AccuDraw";
import { IdleTool } from "../../frontend/tools/IdleTool";
import { ToolGroup, Tool } from "../../frontend/tools/Tool";
import { ViewRotateTool, ViewPanTool } from "../../frontend/tools/ViewTool";

/** class to simulate overriding the default AccuDraw */
class TestAccuDraw extends AccuDraw {
}

/** class to simulate overriding the Idle tool */
class TestIdleTool extends IdleTool {
}

let testVal1: string;
let testVal2: string;

/** class to test immediate tool */
class TestImmediate extends Tool {
  public static toolId = "Test.Immediate";
  constructor(val1: string, val2: string) { testVal1 = val1; testVal2 = val2; super(); }
}

class TestRotateTool extends ViewRotateTool {
}

class TestApp extends IModelApp {
  protected onStartup() {
    this._accuDraw = new TestAccuDraw();

    const group = new ToolGroup("TestApp");
    TestIdleTool.register(group);
    TestImmediate.register(group);
    TestRotateTool.register(group);
  }
}

describe("IModelApp", () => {
  before(async () => {
    TestApp.startup();
  });

  it("TestApp should override correctly", () => {
    assert.instanceOf(iModelApp, TestApp, "test app instance is valid");
    assert.instanceOf(iModelApp.accuDraw, TestAccuDraw, "accudraw override");
    assert.instanceOf(iModelApp.toolAdmin.idleTool, TestIdleTool, "idle tool override");
    assert.isTrue(iModelApp.tools.run("Test.Immediate", "test1", "test2"), "immediate tool ran");
    assert.equal(testVal1, "test1", "arg1 was correct");
    assert.equal(testVal2, "test2", "arg2 was correct");
    assert.isFalse(iModelApp.tools.run("Not.Found"), "toolId is not registered");
    assert.isTrue(iModelApp.tools.run("View.Pan"), "run view pan");
    assert.instanceOf(iModelApp.toolAdmin.activeViewTool, ViewPanTool, "pan tool is active");
  });

});
