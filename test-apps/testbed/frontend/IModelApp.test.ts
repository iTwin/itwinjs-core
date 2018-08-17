/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { IModelApp, Tool, AccuDraw, IdleTool, RotateViewTool, PanViewTool, SelectionTool } from "@bentley/imodeljs-frontend";
import { I18NNamespace } from "@bentley/imodeljs-i18n";
import { TestbedConfig } from "../common/TestbedConfig";
import { MaybeRenderApp } from "./WebGLTestContext";

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

class AnotherImmediate extends Tool {
  public static toolId = "Test.AnotherImmediate";
}

class ThirdImmediate extends Tool {
  public static toolId = "Test.ThirdImmediate";
}

class FourthImmediate extends Tool {
  public static toolId = "Test.FourthImmediate";
}

class TestRotateTool extends RotateViewTool { }
class TestSelectTool extends SelectionTool { }

class TestApp extends MaybeRenderApp {
  public static testNamespace?: I18NNamespace;

  protected static onStartup() {
    IModelApp.accuDraw = new TestAccuDraw();

    this.testNamespace = IModelApp.i18n.registerNamespace("TestApp");
    TestImmediate.register(this.testNamespace);
    AnotherImmediate.register(this.testNamespace);
    ThirdImmediate.register(this.testNamespace);
    FourthImmediate.register(this.testNamespace);
    TestIdleTool.register();
    TestRotateTool.register();
    TestSelectTool.register();

    // register an anonymous class with the toolId "Null.Tool"
    const testNull = class extends Tool { public static toolId = "Null.Tool"; public run() { testVal1 = "fromNullTool"; return true; } };
    testNull.register(this.testNamespace);

    IModelApp.features.setGate("feature2", { a: true, b: false });
    IModelApp.features.setGate("feature5", { val: { str1: "string1", doNot: false } });
  }

  protected static supplyI18NOptions() { return { urlTemplate: `${TestbedConfig.localServerUrlPrefix}/locales/{{lng}}/{{ns}}.json` }; }
}

describe("IModelApp", () => {
  before(() => TestApp.startup());
  after(() => TestApp.shutdown());

  it("TestApp should override correctly", () => {
    assert.instanceOf(IModelApp.accuDraw, TestAccuDraw, "accudraw override");
    assert.instanceOf(IModelApp.toolAdmin.idleTool, TestIdleTool, "idle tool override");
    assert.isTrue(IModelApp.tools.run("Test.Immediate", "test1", "test2"), "immediate tool ran");
    assert.equal(testVal1, "test1", "arg1 was correct");
    assert.equal(testVal2, "test2", "arg2 was correct");
    assert.isFalse(IModelApp.tools.run("Not.Found"), "toolId is not registered");
    assert.isTrue(IModelApp.tools.run("View.Pan"), "run view pan");
    assert.instanceOf(IModelApp.toolAdmin.viewTool, PanViewTool, "pan tool is active");

    assert.isUndefined(IModelApp.features.check("feature1.test1"));
    assert.isTrue(IModelApp.features.check("feature2.a"));
    assert.isFalse(IModelApp.features.check("feature2.b"));
    assert.isFalse(IModelApp.features.check("feature5.val.doNot"));
    assert.equal(IModelApp.features.check("feature5.val.str1"), "string1");
    const feature5 = IModelApp.features.check("feature5");
    assert.equal(feature5.val.str1, "string1");

    assert.isTrue(IModelApp.tools.run("Null.Tool"), "run null");
    assert.equal(testVal1, "fromNullTool");

    IModelApp.features.setGate("feat2", false);
    IModelApp.features.setGate("feat3.sub1.val.a", true);
    IModelApp.features.setGate("feat3.sub1.val.b", { yes: true });
    assert.isFalse(IModelApp.features.check("feat2"));
    assert.equal(IModelApp.features.check("feat3.sub1.notHere", "hello"), "hello", "undefined features should use default value");
    assert.isTrue(IModelApp.features.check("feat3.sub1.val.a"));
    assert.isTrue(IModelApp.features.check("feat3.sub1.val.b.yes"));
  });

  it("Should get localized keyin, flyover, and description for tools", async () => {
    await TestApp.testNamespace!.readFinished;  // we must wait for the localization read to finish.
    assert.equal(TestImmediate.keyin, "Localized TestImmediate Keyin");
    assert.equal(TestImmediate.flyover, "Localized TestImmediate Flyover");
    assert.equal(TestImmediate.description, "Test of an Immediate Command");

    assert.equal(AnotherImmediate.keyin, "Localized AnotherImmediate keyin and flyover");
    assert.equal(AnotherImmediate.flyover, "Localized AnotherImmediate keyin and flyover");
    assert.equal(AnotherImmediate.description, "Another Immediate Command description");

    assert.equal(ThirdImmediate.keyin, "Localized ThirdImmediate Keyin");
    assert.equal(ThirdImmediate.flyover, "ThirdImmediate flyover and description");
    assert.equal(ThirdImmediate.description, "ThirdImmediate flyover and description");

    assert.equal(FourthImmediate.keyin, "Localized FourthImmediate keyin, flyover, and description");
    assert.equal(FourthImmediate.flyover, "Localized FourthImmediate keyin, flyover, and description");
    assert.equal(FourthImmediate.description, "Localized FourthImmediate keyin, flyover, and description");

    // here we are testing to make sure we can override the Select command but the keyin comes from the superclass.
    const selTool = IModelApp.tools.create("Select");
    assert.instanceOf(selTool, TestSelectTool, "test select tool is active");
    assert.equal(selTool!.keyin, "Select Elements", "keyin comes from superclass");
  });

  it("Should do trivial localizations", () => {
    // we have "TrivialTest.Test1" as the key in TestApp.json
    assert.equal(IModelApp.i18n.translate("TestApp:TrivialTests.Test1"), "Localized Trivial Test 1");
    assert.equal(IModelApp.i18n.translate("TestApp:TrivialTests.Test2"), "Localized Trivial Test 2");
    assert.equal(IModelApp.i18n.translate("LocateFailure.NoElements"), "No Elements Found", "message from default (iModelJs) namespace");
  });

  it("Should return the key for localization keys that are missing", () => {
    // there is no key for TrivialTest.Test3
    assert.equal(IModelApp.i18n.translate("TestApp:TrivialTests.Test3"), "TrivialTests.Test3");
  });

  it("Should properly substitute the values in localized strings with interpolations", () => {
    assert.equal(IModelApp.i18n.translate("TestApp:SubstitutionTests.Test1", { varA: "Variable1", varB: "Variable2" }), "Substitute Variable1 and Variable2");
    assert.equal(IModelApp.i18n.translate("TestApp:SubstitutionTests.Test2", { varA: "Variable1", varB: "Variable2" }), "Reverse substitute Variable2 and Variable1");
  });

});
