/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { EmptyLocalization } from "@itwin/core-common";
import { IModelApp } from "../IModelApp";
import { AccuDrawShortcutImplementation, AccuDrawShortcutTool } from "../tools/AccuDrawShortcutTool";
import { InputCollector } from "../tools/Tool";
import { ViewTool } from "../tools/ViewTool";

class TestShortcutImplementation extends AccuDrawShortcutImplementation {
  public override doManipulation(_ev: any, _isMotion: boolean): boolean {
    return false;
  }
}

class TestShortcutTool extends AccuDrawShortcutTool {
  public static override toolId = "Test.AccuDrawShortcut";

  protected override createImplementation(): AccuDrawShortcutImplementation {
    return new TestShortcutImplementation();
  }
}

class TestInputCollectorTool extends InputCollector {
  public static override toolId = "Test.ActiveInputCollector";
}

describe("AccuDrawShortcutTool host selection", () => {
  const namespace = "AccuDrawShortcutToolTest";

  beforeAll(async () => {
    await IModelApp.startup({ localization: new EmptyLocalization() });
    TestShortcutTool.register(namespace);
    TestInputCollectorTool.register(namespace);
  });

  afterEach(async () => {
    await IModelApp.toolAdmin.exitViewTool();
    await IModelApp.toolAdmin.exitInputCollector();
  });

  afterAll(async () => {
    await IModelApp.shutdown();
  });

  it("installs as InputCollector when no InputCollector is active", async () => {
    expect(await IModelApp.tools.run(TestShortcutTool.toolId)).toBe(true);
    expect(IModelApp.toolAdmin.activeTool).toBeInstanceOf(InputCollector);
    expect(IModelApp.toolAdmin.activeTool).not.toBeInstanceOf(ViewTool);
  });

  it("installs as ViewTool when an InputCollector is active", async () => {
    expect(await IModelApp.tools.run(TestInputCollectorTool.toolId)).toBe(true);
    expect(IModelApp.toolAdmin.activeTool).toBeInstanceOf(InputCollector);

    expect(await IModelApp.tools.run(TestShortcutTool.toolId)).toBe(true);
    expect(IModelApp.toolAdmin.activeTool).toBeInstanceOf(ViewTool);

    await IModelApp.toolAdmin.exitViewTool();
    expect(IModelApp.toolAdmin.activeTool).toBeInstanceOf(InputCollector);
  });

  it("is rejected when a ViewTool is active", async () => {
    expect(await IModelApp.tools.run("View.Pan")).toBe(true);
    expect(IModelApp.toolAdmin.activeTool).toBeInstanceOf(ViewTool);

    expect(await IModelApp.tools.run(TestShortcutTool.toolId)).toBe(false);
    expect(IModelApp.toolAdmin.activeTool).toBeInstanceOf(ViewTool);
  });
});
