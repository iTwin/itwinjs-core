/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { IModelApp, iModelApp } from "../../frontend/IModelApp"; // must be first import!
import { Tool } from "../../frontend/tools/Tool";
import { assert } from "chai";
import { AccuDraw } from "../../frontend/AccuDraw";
import { IdleTool } from "../../frontend/tools/IdleTool";
import { I18NNamespace } from "../../frontend/Localization";
import { RotateTool, PanTool } from "../../frontend/tools/ViewTool";
import { SelectionTool } from "../../frontend/tools/SelectTool";

/** class to simulate overriding the default AccuDraw */
class TestAccuDraw extends AccuDraw { }

/** class to simulate overriding the Idle tool */
class TestIdleTool extends IdleTool { }

let testVal1: string;
let testVal2: string;

/** class to test immediate tool */
class TestImmediate extends Tool {
  public static toolId = "Test.Immediate";
  constructor(val1: string, val2: string) { testVal1 = val1; testVal2 = val2; super(); }
}

class TestRotateTool extends RotateTool { }
class TestSelectTool extends SelectionTool { }

class TestApp extends IModelApp {
  public testNamespace?: I18NNamespace;

  protected onStartup() {
    this._accuDraw = new TestAccuDraw();

    this.testNamespace = iModelApp.i18n.registerNamespace("TestApp");
    TestImmediate.register(this.testNamespace);
    TestIdleTool.register();
    TestRotateTool.register();
    TestSelectTool.register();

    // register an anonymous class with the toolId "Null.Tool"
    const testNull = class extends Tool { public static toolId = "Null.Tool"; public run() { testVal1 = "fromNullTool"; return true; } };
    testNull.register(this.testNamespace);

    this.features.setGate("feature2", { a: true, b: false });
    this.features.setGate("feature5", { val: { str1: "string1", doNot: false } });
  }

  protected supplyI18NOptions() { return { urlTemplate: "http://localhost:3000/locales/{{lng}}/{{ns}}.json" }; }
}

describe("IModelApp", () => {
  before(() => TestApp.startup());
  after(() => TestApp.shutdown());

  it("TestApp should override correctly", () => {
    assert.instanceOf(iModelApp, TestApp, "test app instance is valid");
    assert.instanceOf(iModelApp.accuDraw, TestAccuDraw, "accudraw override");
    assert.instanceOf(iModelApp.toolAdmin.idleTool, TestIdleTool, "idle tool override");
    assert.isTrue(iModelApp.tools.run("Test.Immediate", "test1", "test2"), "immediate tool ran");
    assert.equal(testVal1, "test1", "arg1 was correct");
    assert.equal(testVal2, "test2", "arg2 was correct");
    assert.isFalse(iModelApp.tools.run("Not.Found"), "toolId is not registered");
    assert.isTrue(iModelApp.tools.run("View.Pan"), "run view pan");
    assert.instanceOf(iModelApp.toolAdmin.activeViewTool, PanTool, "pan tool is active");

    assert.isUndefined(iModelApp.features.check("feature1.test1"));
    assert.isTrue(iModelApp.features.check("feature2.a"));
    assert.isFalse(iModelApp.features.check("feature2.b"));
    assert.isFalse(iModelApp.features.check("feature5.val.doNot"));
    assert.equal(iModelApp.features.check("feature5.val.str1"), "string1");
    const feature5 = iModelApp.features.check("feature5");
    assert.equal(feature5.val.str1, "string1");

    assert.isTrue(iModelApp.tools.run("Null.Tool"), "run null");
    assert.equal(testVal1, "fromNullTool");

    iModelApp.features.setGate("feat2", false);
    iModelApp.features.setGate("feat3.sub1.val.a", true);
    iModelApp.features.setGate("feat3.sub1.val.b", { yes: true });
    assert.isFalse(iModelApp.features.check("feat2"));
    assert.equal(iModelApp.features.check("feat3.sub1.notHere", "hello"), "hello", "undefined features should use default value");
    assert.isTrue(iModelApp.features.check("feat3.sub1.val.a"));
    assert.isTrue(iModelApp.features.check("feat3.sub1.val.b.yes"));
  });

  it("Should get localized name for tools", async () => {
    const thisApp = iModelApp as TestApp;
    await thisApp.testNamespace!.readFinished;  // we must wait for the localization read to finish.
    assert.equal(TestImmediate.keyin, "Localized TestImmediate Keyin");
    // here we are testing to make sure we can override the Select command but the keyin comes from the superclass.
    assert.isTrue(iModelApp.tools.run("Select"));
    const select = iModelApp.toolAdmin.activePrimitiveTool as TestSelectTool;
    assert.instanceOf(select, TestSelectTool, "test select tool is active");
    assert.equal(select.keyin, "Select Elements", "keyin comes from superclass");
  });

  it("Should do trivial localizations", () => {
    // we have "TrivialTest.Test1" as the key in TestApp.json
    assert.equal(iModelApp.i18n.translate("TestApp:TrivialTests.Test1"), "Localized Trivial Test 1");
    assert.equal(iModelApp.i18n.translate("TestApp:TrivialTests.Test2"), "Localized Trivial Test 2");
    assert.equal(iModelApp.i18n.translate("LocateFailure.NoElements"), "No Elements Found", "message from default (iModelJs) namespace");
  });

  it("Should return the key for localization keys that are missing", () => {
    // there is no key for TrivialTest.Test3
    assert.equal(iModelApp.i18n.translate("TestApp:TrivialTests.Test3"), "TrivialTests.Test3");
  });

  it("Should properly substitute the  values in localized strings with interpolations", () => {
    assert.equal(iModelApp.i18n.translate("TestApp:SubstitutionTests.Test1", { varA: "Variable1", varB: "Variable2" }), "Substitute Variable1 and Variable2");
    assert.equal(iModelApp.i18n.translate("TestApp:SubstitutionTests.Test2", { varA: "Variable1", varB: "Variable2" }), "Reverse substitute Variable2 and Variable1");
  });

});
