/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "vitest";
import { ProcessDetector } from "@itwin/core-bentley";
import { IModelApp, PrimitiveTool, Viewport } from "@itwin/core-frontend";
import { EditTools, makeEditToolIpc } from "@itwin/editor-frontend";
import { testCmdIds, TestCmdOjb1, TestCmdResult, TestCommandIpc } from "../../common/TestEditCommandIpc";
import { TestUtility } from "../TestUtility";
import { TestSnapshotConnection } from "../TestSnapshotConnection";

let iModel: TestSnapshotConnection;
let testOut: TestCmdResult;
const cmdArg = "test command arg";
let cmdStr: string;

class TestEditTool1 extends PrimitiveTool {
  public static override toolId = "TestEditTool1";
  public override isCompatibleViewport(_vp: Viewport | undefined, _isSelectedViewChange: boolean): boolean { return true; }
  public async onRestartTool() { return this.exitTool(); }

  public testIpc = makeEditToolIpc<TestCommandIpc>();

  public async go(commandId: string, str1: string, str2: string, obj1: TestCmdOjb1) {
    cmdStr = await EditTools.startCommand<string>({ commandId, iModelKey: iModel.key }, cmdArg);
    testOut = await this.testIpc.testMethod1(str1, str2, obj1);
  }
}

if (!ProcessDetector.isMobileAppFrontend) {
  describe("EditTools", () => {

    let busyCalls = 0;
    beforeAll(async () => {
      await TestUtility.startFrontend(undefined, undefined, true);
      const namespace = "TestApp";
      await IModelApp.localization.registerNamespace(namespace);
      IModelApp.tools.register(TestEditTool1, namespace);
      EditTools.busyRetry = async (attempt: number, msg: string) => {
        expect(attempt).toBe(busyCalls++);
        expect(msg).toBe("edit command is busy");
        return 0;
      };
      iModel = await TestSnapshotConnection.openFile("test.bim"); // relative path resolved by BackendTestAssetResolver

    });

    afterAll(async () => {
      await iModel.close();
      await TestUtility.shutdownFrontend();
      EditTools.busyRetry = undefined;
    });

    it("should start edit commands", async () => {
      expect(await IModelApp.tools.run("TestEditTool1")).toBe(true);
      const tool = IModelApp.toolAdmin.currentTool as TestEditTool1;
      expect(tool instanceof TestEditTool1).toBe(true);
      const str1 = "abc";
      const str2 = "def";
      const obj1 = {
        i1: 10,
        i2: 20,
        buf: Int8Array.from([1, 2, 3, 4, 6]),
      };

      await tool.go(testCmdIds.cmd1, str1, str2, obj1);
      expect(cmdStr).toBe(`${cmdArg}:1`);
      expect(testOut.num).toBe(30);
      expect(testOut.str).toBe("abcdef");
      expect(Array.from(testOut.buf)).toEqual([1, 2, 3, 4, 6, -22]);

      await tool.go(testCmdIds.cmd2, str1, str2, obj1);
      expect(cmdStr).toBe(`${cmdArg}:2`);
      expect(testOut.num).toBe(-10);
      expect(testOut.str).toBe("defabc");
      expect(Array.from(testOut.buf)).toEqual([1, 2, 3, 4, 6, -32]);
      expect(busyCalls).toBe(4);

      busyCalls = 0;
      await EditTools.startCommand({ commandId: "", iModelKey: "" });
      expect(busyCalls).toBe(4);

    });

  });
}
