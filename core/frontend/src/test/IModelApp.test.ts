/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert, expect } from "chai";
import { ITwinLocalization } from "@itwin/core-i18n";
import { AccuDraw } from "../AccuDraw";
import { IModelApp, IModelAppOptions } from "../IModelApp";
import { MockRender } from "../render/MockRender";
import { IdleTool } from "../tools/IdleTool";
import { SelectionTool } from "../tools/SelectTool";
import { Tool } from "../tools/Tool";
import { PanViewTool, RotateViewTool } from "../tools/ViewTool";
import { BentleyStatus, DbResult, IModelStatus, Logger, LogLevel } from "@itwin/core-bentley";

/** class to simulate overriding the default AccuDraw */
class TestAccuDraw extends AccuDraw { }

/** class to simulate overriding the Idle tool */
class TestIdleTool extends IdleTool { }

let testVal1: string;
let testVal2: string;

/** class to test immediate tool */
class TestImmediate extends Tool {
  public static override toolId = "Test.Immediate";
  constructor(val1: string, val2: string) { testVal1 = val1; testVal2 = val2; super(); }
}

class AnotherImmediate extends Tool {
  public static override toolId = "Test.AnotherImmediate";
}

class ThirdImmediate extends Tool {
  public static override toolId = "Test.ThirdImmediate";
}

class FourthImmediate extends Tool {
  public static override toolId = "Test.FourthImmediate";
}

class TestRotateTool extends RotateViewTool { }
class TestSelectTool extends SelectionTool { }

class TestApp extends MockRender.App {
  public static override async startup(opts?: IModelAppOptions): Promise<void> {
    opts = opts ? opts : {};
    opts.accuDraw = new TestAccuDraw();
    opts.localization = new ITwinLocalization(this.supplyI18NOptions());
    await MockRender.App.startup(opts);

    const namespace = "TestApp";
    TestImmediate.register(namespace);
    AnotherImmediate.register(namespace);
    ThirdImmediate.register(namespace);
    FourthImmediate.register(namespace);
    TestIdleTool.register();
    TestRotateTool.register();
    TestSelectTool.register();
    IModelApp.toolAdmin.onInitialized();

    // register an anonymous class with the toolId "Null.Tool"
    const testNull = class extends Tool { public static override toolId = "Null.Tool"; public override async run() { testVal1 = "fromNullTool"; return true; } };
    testNull.register(namespace);
  }

  protected static supplyI18NOptions() { return { urlTemplate: `${window.location.origin}/locales/{{lng}}/{{ns}}.json` }; }
}

describe("IModelApp", () => {
  before(async () => {
    await TestApp.startup();
    await IModelApp.localization.registerNamespace("TestApp");  // we must wait for the localization read to finish.
  });
  after(async () => TestApp.shutdown());

  it("TestApp should override correctly", async () => {
    assert.instanceOf(IModelApp.accuDraw, TestAccuDraw, "accudraw override");
    assert.instanceOf(IModelApp.toolAdmin.idleTool, TestIdleTool, "idle tool override");
    assert.isTrue(await IModelApp.tools.run("Test.Immediate", "test1", "test2"), "immediate tool ran");
    assert.equal(testVal1, "test1", "arg1 was correct");
    assert.equal(testVal2, "test2", "arg2 was correct");
    assert.isFalse(await IModelApp.tools.run("Not.Found"), "toolId is not registered");
    assert.isTrue(await IModelApp.tools.run("View.Pan"), "run view pan");
    assert.instanceOf(IModelApp.toolAdmin.viewTool, PanViewTool, "pan tool is active");

    assert.isTrue(await IModelApp.tools.run("Null.Tool"), "run null");
    assert.equal(testVal1, "fromNullTool");
  });

  it("Should get localized keyin, flyover, and description for tools", async () => {
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

    // here we are testing to make sure we can override the Select command but the keyin comes from the superclass because the toolId is not overridden
    const selTool = IModelApp.tools.create("Select")!;
    assert.instanceOf(selTool, TestSelectTool, "test select tool is active");
    assert.equal(selTool.keyin, "select elements", "keyin comes from superclass");
  });

  it("Localization with no substitution", () => {
    // Custom namespace
    //  "TrivialTest.Test1" exists as a key in TestApp.json
    assert.equal(IModelApp.localization.getLocalizedString("TestApp:TrivialTests.Test1"), "Localized Trivial Test 1");
    assert.equal(IModelApp.localization.getLocalizedString("TestApp:TrivialTests.Test2"), "Localized Trivial Test 2");

    // Default namespace (iModelJs)
    assert.equal(IModelApp.localization.getLocalizedString("LocateFailure.NoElements"), "No Elements Found", "message from default (iModelJs) namespace");
  });

  it("Localization when there is no key", () => {
    // Custom namespace
    //  "TrivialTest.Test3" does NOT exist as a key in TestApp.json
    assert.equal(IModelApp.localization.getLocalizedString("TestApp:TrivialTests.Test3"), "TrivialTests.Test3");

    // Default namespace (iModelJs)
    assert.equal(IModelApp.localization.getLocalizedString("IDontExist.Test1"), "IDontExist.Test1");
  });

  it("Localization with variable substitution", () => { // Properly substitute the values in localized strings with interpolations
    // Custom namespace
    assert.equal(IModelApp.localization.getLocalizedString("TestApp:SubstitutionTests.Test1", { varA: "Variable1", varB: "Variable2" }), "Substitute Variable1 and Variable2");
    assert.equal(IModelApp.localization.getLocalizedString("TestApp:SubstitutionTests.Test2", { varA: "Variable1", varB: "Variable2" }), "Reverse substitute Variable2 and Variable1");

    // Default namespace (iModelJs)
    assert.equal(IModelApp.localization.getLocalizedString("Errors.Status", { status: "test" }), "Status: test");
    assert.equal(IModelApp.localization.getLocalizedString("ExtensionErrors.Success", { extensionName: "testExtension" }), "Extension 'testExtension' loaded");
  });

  it("Error status localization", () => {
    assert.equal(IModelApp.translateStatus(IModelStatus.AlreadyOpen), "Already open");
    assert.equal(IModelApp.translateStatus(IModelStatus.DuplicateCode), "Duplicate code");
    assert.equal(IModelApp.translateStatus(DbResult.BE_SQLITE_ERROR_AlreadyOpen), "Database already open");
    assert.equal(IModelApp.translateStatus(BentleyStatus.ERROR), "Error");
    assert.equal(IModelApp.translateStatus(BentleyStatus.SUCCESS), "Success");
    assert.equal(IModelApp.translateStatus(101), "DbResult.BE_SQLITE_DONE");
    assert.equal(IModelApp.translateStatus(11111), "Status: 11111");
    assert.equal(IModelApp.translateStatus(undefined as any), "Illegal value");
  });

  it("Attempt to register missing namespace logs error", async () => {

    let errorOut: any[] = [];
    Logger.initialize((c, m, d) => errorOut = [c, m, d]);
    Logger.setLevel("i18n", LogLevel.Error);

    await IModelApp.localization.registerNamespace("IDontExist");

    assert.notEqual(errorOut.length, 0);
    assert.equal(errorOut[0], "i18n"); // logged to correct category
  });

  it("Should support WebGL", () => {
    expect(IModelApp.hasRenderSystem).to.be.true;
    let canvas = document.getElementById("WebGLTestCanvas") as HTMLCanvasElement;
    if (null === canvas) {
      canvas = document.createElement("canvas");
      if (null !== canvas) {
        canvas.id = "WebGLTestCanvas";
        document.body.appendChild(document.createTextNode("WebGL tests"));
        document.body.appendChild(canvas);
      }
    }
    canvas.width = 300;
    canvas.height = 150;
    expect(canvas).not.to.be.undefined;
    if (undefined !== canvas) {
      const context = canvas.getContext("webgl");
      expect(context).not.to.be.null;
      expect(context).not.to.be.undefined;
    }
  });

  it("Should create mock render system without WebGL", () => {
    expect(IModelApp.hasRenderSystem).to.be.true;
    expect(IModelApp.renderSystem).instanceof(MockRender.System);
  });
});
