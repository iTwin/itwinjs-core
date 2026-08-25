/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { Id64 } from "@itwin/core-bentley";
import { ElementAgenda, IModelApp, IModelConnection, ModifyElementSource, PrimitiveTool, Viewport } from "@itwin/core-frontend";
import { TestUtility } from "../TestUtility";
import { TestSnapshotConnection } from "../TestSnapshotConnection";

describe("Tools", () => {
  let imodel: IModelConnection;

  before(async () => {
    await TestUtility.startFrontend(undefined, true);
    imodel = await TestSnapshotConnection.openFile("test.bim"); // relative path resolved by BackendTestAssetResolver
  });
  after(async () => {
    await imodel?.close();
    await TestUtility.shutdownFrontend();
  });

  it("ElementAgenda tests", () => {
    const ids = [Id64.fromString("0x1"), Id64.fromString("0x2"), Id64.fromString("0x3"), Id64.fromString("0x4")];
    const agenda = new ElementAgenda(imodel);
    assert.equal(agenda.iModel, imodel);
    assert.equal(agenda.count, 0);
    agenda.add(ids[0]);
    assert.equal(agenda.length, 1, "add with Id64");
    agenda.add([ids[0], ids[1]]);
    agenda.setSource(ModifyElementSource.Selected);
    assert.equal(agenda.length, 2, "add with array");
    assert.equal(agenda.getSource(), ModifyElementSource.Selected, "setSource selected");
    const idsSet = new Set([ids[0], ids[1], ids[2], ids[3]]);
    agenda.add(idsSet);
    agenda.setSource(ModifyElementSource.Selected);
    assert.equal(agenda.length, 4, "add with IdSet");
    ids.forEach((id) => assert.isTrue(agenda.has(id)));
    assert.isFalse(agenda.has("0x11"), "should not find");
    assert.equal(agenda.getSource(), ModifyElementSource.Selected, "setSource group");
    assert.equal(imodel.hilited.elements.size, 4, "hilite");
    agenda.remove(ids[0]);
    assert.equal(imodel.hilited.elements.size, 3, "remove unhilites");
    assert.equal(agenda.length, 3, "remove");
    agenda.popGroup();
    assert.equal(imodel.hilited.elements.size, 1, "popGroup unhilites");
    assert.equal(agenda.length, 1, "popGroup");
    assert.equal(agenda.getSource(), ModifyElementSource.Selected, "popGroup pops source");
    agenda.invert(idsSet);
    assert.equal(agenda.length, 3, "invert");
    assert.equal(imodel.hilited.elements.size, 3, "invert unhilites");
    assert.isTrue(agenda.find(ids[0]), "agenda find");
    agenda.clear();
    assert.isTrue(agenda.isEmpty, "clear works");
    assert.equal(imodel.hilited.elements.size, 0, "clear unhilites");
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
    assert.isTrue(res1);
    assert.isTrue(res2);
    // Ensure events show serialized start/done pairs (no interleaving)
    for (let i = 0; i < events.length; i += 2) {
      assert(events[i].startsWith("start "));
      assert(events[i + 1].startsWith("done "));
      assert.equal(events[i].slice(6), events[i + 1].slice(5)); // same tool name
    }
    // final active primitive must match last start event
    const lastStart = events.filter((e) => e.startsWith("start ")).pop();
    if (lastStart) {
      const toolName = lastStart.slice(6);
      assert.strictEqual(toolAdmin.primitiveTool?.constructor.name, toolName);
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
    assert(idxCleanupEnd >= 0);
    assert(idxStartedFast >= 0);
    assert(idxStartedFast > idxCleanupEnd, `fast started at ${idxStartedFast} before cleanup end ${idxCleanupEnd}`);
    // active primitive should correspond to last installed tool in sequence
    assert.strictEqual(toolAdmin.primitiveTool, fastTool);
  });
});
