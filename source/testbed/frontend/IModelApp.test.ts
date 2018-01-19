/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { IModelApp, iModelApp } from "@build/imodeljs-core/lib/frontend/IModelApp";
import { AccuDraw, CompassMode } from "@build/imodeljs-core/lib/frontend/AccuDraw";
import { IdleTool } from "@build/imodeljs-core/lib/frontend/tools/IdleTool";
import { ToolGroup, ImmediateTool } from "@build/imodeljs-core/lib/frontend/tools/Tool";
import { ViewRotateTool } from "@build/imodeljs-core/lib/frontend/tools/ViewTool";

/** class to simulate overriding the default AccuDraw */
class TestAccuDraw extends AccuDraw {
  public getCompassMode(): CompassMode { return CompassMode.Polar; }
}

/** class to simulate overriding the Idle tool */
class TestIdleTool extends IdleTool {
}

let testVal1: string;
let testVal2: string;
/** class to test immediate tool */
class TestImmediate extends ImmediateTool {
  public static toolId = "Test.Immediate";
  public run(val1: string, val2: string) { testVal1 = val1; testVal2 = val2; }
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
  // tslint:disable-next-line:only-arrow-functions
  // tslint:disable-next-line:space-before-function-paren
  before(async function () {   // Create a ViewState to load into a ViewPort
    this.timeout(99999);
    TestApp.startup();
  });

  it("TestApp should override correctly", () => {
    assert.instanceOf(iModelApp, TestApp, "test app instance is valid");
    assert.instanceOf(iModelApp.accuDraw, TestAccuDraw, "accudraw override");
    assert.equal(iModelApp.accuDraw.getCompassMode(), CompassMode.Polar, "accudraw method");
    assert.instanceOf(iModelApp.toolAdmin.idleTool, TestIdleTool, "idle tool override");
    assert.isTrue(iModelApp.runImmediateTool("Test.Immediate", "test1", "test2"));
    assert.equal(testVal1, "test1", "arg1");
    assert.equal(testVal2, "test2", "arg2");
    assert.isFalse(iModelApp.runImmediateTool("Not.Found"), "toolId is not registered");
    assert.isFalse(iModelApp.runImmediateTool("View.Pan"), "not an immediate tool");
    // assert.instanceOf(iModelApp.createTool("View.Rotate"), TestRotateTool, "rotate tool override");
  });

  it("Should get localized name for TestImmediate tool"), () => {
    assert.equal(TestImmediate.getLocalizedName(), "Localized TestImmediate Name");
  )
  });

});
