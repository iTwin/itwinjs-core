/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ITwinLocalization } from "@itwin/core-i18n";
import { AccuDraw } from "../AccuDraw";
import { IModelApp, IModelAppOptions } from "../IModelApp";
import { MockRender } from "../render/MockRender";
import { IdleTool } from "../tools/IdleTool";
import { SelectionTool } from "../tools/SelectTool";
import { Tool } from "../tools/Tool";
import { PanViewTool, RotateViewTool } from "../tools/ViewTool";
import { BentleyStatus, DbResult, IModelStatus } from "@itwin/core-bentley";

/** class to simulate overriding the default AccuDraw */
class TestAccuDraw extends AccuDraw { }

/** class to simulate overriding the Idle tool */
class TestIdleTool extends IdleTool { }

let testVal1: string;
let testVal2: string;

/** class to test immediate tool */
class TestImmediate extends Tool {
  public static override toolId = "Test.Immediate";
  constructor(val1: string, val2: string) {
    testVal1 = val1;
    testVal2 = val2;
    super();
  }
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
    const testNull = class extends Tool {
      public static override toolId = "Null.Tool"; public override async run() {
        testVal1 = "fromNullTool";
        return true;
      }
    };
    testNull.register(namespace);
  }

  protected static supplyI18NOptions() { return { urlTemplate: `${window.location.origin}/locales/{{lng}}/{{ns}}.json` }; }
}

describe("IModelApp", () => {
  beforeAll(async () => {
    await TestApp.startup();
    await IModelApp.localization.registerNamespace("TestApp");  // we must wait for the localization read to finish.
  });
  afterAll(async () => TestApp.shutdown());

  it("TestApp should override correctly", async () => {
    expect(IModelApp.accuDraw).toBeInstanceOf(TestAccuDraw);
    expect(IModelApp.toolAdmin.idleTool).toBeInstanceOf(TestIdleTool);
    expect(await IModelApp.tools.run("Test.Immediate", "test1", "test2")).toBe(true);
    expect(testVal1).toBe("test1");
    expect(testVal2).toBe("test2");
    expect(await IModelApp.tools.run("Not.Found")).toBe(false);
    expect(await IModelApp.tools.run("View.Pan")).toBe(true);
    expect(IModelApp.toolAdmin.viewTool).toBeInstanceOf(PanViewTool);
    expect(await IModelApp.tools.run("Null.Tool")).toBe(true);
    expect(testVal1).toBe("fromNullTool");
  });

  it("Should get localized keyin, flyover, and description for tools", async () => {
    expect(TestImmediate.keyin).toBe("Localized TestImmediate Keyin");
    expect(TestImmediate.flyover).toBe("Localized TestImmediate Flyover");
    expect(TestImmediate.description).toBe("Test of an Immediate Command");

    expect(AnotherImmediate.keyin).toBe("Localized AnotherImmediate keyin and flyover");
    expect(AnotherImmediate.flyover).toBe("Localized AnotherImmediate keyin and flyover");
    expect(AnotherImmediate.description).toBe("Another Immediate Command description");

    expect(ThirdImmediate.keyin).toBe("Localized ThirdImmediate Keyin");
    expect(ThirdImmediate.flyover).toBe("ThirdImmediate flyover and description");
    expect(ThirdImmediate.description).toBe("ThirdImmediate flyover and description");

    expect(FourthImmediate.keyin).toBe("Localized FourthImmediate keyin, flyover, and description");
    expect(FourthImmediate.flyover).toBe("Localized FourthImmediate keyin, flyover, and description");
    expect(FourthImmediate.description).toBe("Localized FourthImmediate keyin, flyover, and description");

    // here we are testing to make sure we can override the Select command but the keyin comes from the superclass because the toolId is not overridden
    const selTool = IModelApp.tools.create("Select")!;
    expect(selTool).toBeInstanceOf(TestSelectTool);
    expect(selTool.keyin).toBe("select elements");
  });

  it("Should do localizations", () => {
    // we have "TrivialTest.Test1" as the key in TestApp.json
    expect(IModelApp.localization.getLocalizedString("TestApp:TrivialTests.Test1")).toBe("Localized Trivial Test 1");
    expect(IModelApp.localization.getLocalizedString("TestApp:TrivialTests.Test2")).toBe("Localized Trivial Test 2");
    expect(IModelApp.localization.getLocalizedString("LocateFailure.NoElements")).toBe("No Elements Found");

    // there is no key for TrivialTest.Test3
    expect(IModelApp.localization.getLocalizedString("TestApp:TrivialTests.Test3")).toBe("TrivialTests.Test3");

    // Should properly substitute the values in localized strings with interpolations
    expect(IModelApp.localization.getLocalizedString("TestApp:SubstitutionTests.Test1", { varA: "Variable1", varB: "Variable2" })).toBe("Substitute Variable1 and Variable2");
    expect(IModelApp.localization.getLocalizedString("TestApp:SubstitutionTests.Test2", { varA: "Variable1", varB: "Variable2" })).toBe("Reverse substitute Variable2 and Variable1");

    expect(IModelApp.translateStatus(IModelStatus.AlreadyOpen)).toBe("Already open");
    expect(IModelApp.translateStatus(IModelStatus.DuplicateCode)).toBe("Duplicate code");
    expect(IModelApp.translateStatus(DbResult.BE_SQLITE_ERROR_AlreadyOpen)).toBe("Database already open");
    expect(IModelApp.translateStatus(BentleyStatus.ERROR)).toBe("Error");
    expect(IModelApp.translateStatus(BentleyStatus.SUCCESS)).toBe("Success");
    expect(IModelApp.translateStatus(101)).toBe("DbResult.BE_SQLITE_DONE");
    expect(IModelApp.translateStatus(11111)).toBe("Status: 11111");
    expect(IModelApp.translateStatus(undefined as any)).toBe("Illegal value");

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
    expect(canvas).not.toBeUndefined();
    if (canvas !== undefined) {
      const context = canvas.getContext("webgl");
      expect(context).not.toBeNull();
      expect(context).not.toBeUndefined();
    }
  });

  it("Should create mock render system without WebGL", () => {
    expect(IModelApp.hasRenderSystem).toBe(true);
    expect(IModelApp.renderSystem).toBeInstanceOf(MockRender.System);
  });
});
