/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "vitest";
import { Id64 } from "@itwin/core-bentley";
import { ElementAgenda, IModelApp, IModelConnection, ModifyElementSource, PrimitiveTool, Viewport } from "@itwin/core-frontend";
import { TestUtility } from "../TestUtility";
import { TestSnapshotConnection } from "../TestSnapshotConnection";

describe("Tools", () => {
  let imodel: IModelConnection;

  beforeAll(async () => {
    await TestUtility.startFrontend(undefined, true);
    imodel = await TestSnapshotConnection.openFile("test.bim"); // relative path resolved by BackendTestAssetResolver
  });
  afterAll(async () => {
    await imodel?.close();
    await TestUtility.shutdownFrontend();
  });

  it("ElementAgenda tests", () => {
    const ids = [Id64.fromString("0x1"), Id64.fromString("0x2"), Id64.fromString("0x3"), Id64.fromString("0x4")];
    const agenda = new ElementAgenda(imodel);
    expect(agenda.iModel).toBe(imodel);
    expect(agenda.count).toBe(0);
    agenda.add(ids[0]);
    expect(agenda.length, "add with Id64").toBe(1);
    agenda.add([ids[0], ids[1]]);
    agenda.setSource(ModifyElementSource.Selected);
    expect(agenda.length, "add with array").toBe(2);
    expect(agenda.getSource(), "setSource selected").toBe(ModifyElementSource.Selected);
    const idsSet = new Set([ids[0], ids[1], ids[2], ids[3]]);
    agenda.add(idsSet);
    agenda.setSource(ModifyElementSource.Selected);
    expect(agenda.length, "add with IdSet").toBe(4);
    ids.forEach((id) => expect(agenda.has(id)).toBe(true));
    expect(agenda.has("0x11")).toBe(false);
    expect(agenda.getSource(), "setSource group").toBe(ModifyElementSource.Selected);
    expect(imodel.hilited.elements.size, "hilite").toBe(4);
    agenda.remove(ids[0]);
    expect(imodel.hilited.elements.size, "remove unhilites").toBe(3);
    expect(agenda.length, "remove").toBe(3);
    agenda.popGroup();
    expect(imodel.hilited.elements.size, "popGroup unhilites").toBe(1);
    expect(agenda.length, "popGroup").toBe(1);
    expect(agenda.getSource(), "popGroup pops source").toBe(ModifyElementSource.Selected);
    agenda.invert(idsSet);
    expect(agenda.length, "invert").toBe(3);
    expect(imodel.hilited.elements.size, "invert unhilites").toBe(3);
    expect(agenda.find(ids[0])).toBe(true);
    agenda.clear();
    expect(agenda.isEmpty).toBe(true);
    expect(imodel.hilited.elements.size, "clear unhilites").toBe(0);
  });

  // new test demonstrating primitive tool install serialization
  it("serializes concurrent primitive tool installations", async () => {
    const { toolAdmin } = IModelApp;
    const events: string[] = [];

    // wrap original startPrimitiveTool to log entry/exit
    const origStart = toolAdmin.startPrimitiveTool.bind(toolAdmin);
    toolAdmin.startPrimitiveTool = async (tool?: PrimitiveTool) => {
      events.push(`start ${tool?.constructor.name}`);
      await origStart(tool);
      events.push(`done ${tool?.constructor.name}`);
    };

    class SlowTool extends PrimitiveTool {
      public static override toolId = "Slow.Tool";
      public override async onInstall(): Promise<boolean> {
        // delay to force overlap
        await new Promise((r) => setTimeout(r, 100));
        return true;
      }
      public override async onRestartTool(): Promise<void> { return this.exitTool(); }
      public override isCompatibleViewport(_vp: Viewport | undefined, _isSelectedViewChange: boolean): boolean { return true; }
    }

    class FastTool extends PrimitiveTool {
      public static override toolId = "Fast.Tool";
      public override async onInstall(): Promise<boolean> { return true; }
      public override async onRestartTool(): Promise<void> { return this.exitTool(); }
      public override isCompatibleViewport(_vp: Viewport | undefined, _isSelectedViewChange: boolean): boolean { return true; }
    }

    // Not necessary to register for test...
    // IModelApp.tools.register(SlowTool, CoreTools.namespace);
    // IModelApp.tools.register(FastTool, CoreTools.namespace);

    const slow = new SlowTool();
    const fast = new FastTool();

    const [res1, res2] = await Promise.all([slow.run(), fast.run()]);
    expect(res1).toBe(true);
    expect(res2).toBe(true);
    // Ensure events show serialized start/done pairs (no interleaving)
    for (let i = 0; i < events.length; i += 2) {
      expect(events[i].startsWith("start ")).toBeTruthy();
      expect(events[i + 1].startsWith("done ")).toBeTruthy();
      expect(events[i].slice(6)).toBe(events[i + 1].slice(5)); // same tool name
    }
    // final active primitive must match last start event
    const lastStart = events.filter((e) => e.startsWith("start ")).pop();
    if (lastStart) {
      const toolName = lastStart.slice(6);
      expect(toolAdmin.primitiveTool?.constructor.name).toBe(toolName);
    }
  });

  // new test ensuring cleanup delays are serialized
  it("waits for previous tool cleanup before installing new", async () => {
    const { toolAdmin } = IModelApp;
    const order: string[] = [];

    class CleanupSlow extends PrimitiveTool {
      public static override toolId = "Cleanup.Slow";
      public override async onInstall(): Promise<boolean> {
        order.push("install slow");
        return true;
      }
      public override async onCleanup(): Promise<void> {
        order.push("cleanup slow start");
        await new Promise((r) => setTimeout(r, 100));
        order.push("cleanup slow end");
      }
      public override async onRestartTool(): Promise<void> { return this.exitTool(); }
      public override isCompatibleViewport(_vp: Viewport | undefined, _isSelectedViewChange: boolean): boolean { return true; }
    }

    class SetupFast extends PrimitiveTool {
      public static override toolId = "Setup.Fast";
      public override async onInstall(): Promise<boolean> {
        order.push("install fast");
        return true;
      }
      public override async onRestartTool(): Promise<void> { return this.exitTool(); }
      public override isCompatibleViewport(_vp: Viewport | undefined, _isSelectedViewChange: boolean): boolean { return true; }
    }

    // Not necessary to register for test...
    // IModelApp.tools.register(CleanupSlow, CoreTools.namespace);
    // IModelApp.tools.register(SetupFast, CoreTools.namespace);

    const slowTool = new CleanupSlow();
    await slowTool.run();
    order.push("started slow");

    const fastTool = new SetupFast();
    await fastTool.run();
    order.push("started fast");

    // order may interleave install of the new tool with cleanup of the old
    // but the new tool must not become active until cleanup has finished.
    const idxCleanupEnd = order.indexOf("cleanup slow end");
    const idxStartedFast = order.indexOf("started fast");
    expect(idxCleanupEnd >= 0).toBeTruthy();
    expect(idxStartedFast >= 0).toBeTruthy();
    expect(idxStartedFast > idxCleanupEnd).toBeTruthy();
    // active primitive should correspond to last installed tool in sequence
    expect(toolAdmin.primitiveTool).toBe(fastTool);
  });
});
