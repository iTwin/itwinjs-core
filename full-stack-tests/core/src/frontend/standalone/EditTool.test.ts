/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import { ProcessDetector } from "@itwin/core-bentley";
import { _callIpcChannel, IModelApp, IpcApp, PrimitiveTool, Viewport } from "@itwin/core-frontend";
import { EditTools, makeEditToolIpc, UndoAllTool } from "@itwin/editor-frontend";
import sinon = require("sinon"); // eslint-disable-line @typescript-eslint/no-require-imports
import { testCmdIds, TestCmdOjb1, TestCmdResult, TestCommandIpc } from "../../common/TestEditCommandIpc";
import { TestUtility } from "../TestUtility";
import { TestSnapshotConnection } from "../TestSnapshotConnection";

const expect = chai.expect;
const assert = chai.assert;

chai.use(chaiAsPromised);

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
    before(async () => {
      await TestUtility.startFrontend(undefined, undefined, true);
      const namespace = "TestApp";
      await IModelApp.localization.registerNamespace(namespace);
      IModelApp.tools.register(TestEditTool1, namespace);
      EditTools.busyRetry = async (attempt: number, msg: string) => {
        expect(attempt).equals(busyCalls++);
        expect(msg).equals("edit command is busy");
        return 0;
      };
      iModel = await TestSnapshotConnection.openFile("test.bim"); // relative path resolved by BackendTestAssetResolver

    });

    after(async () => {
      await iModel.close();
      await TestUtility.shutdownFrontend();
      EditTools.busyRetry = undefined;
    });

    it("should start edit commands", async () => {
      expect(await IModelApp.tools.run("TestEditTool1")).to.be.true;
      const tool = IModelApp.toolAdmin.currentTool as TestEditTool1;
      assert.isTrue(tool instanceof TestEditTool1);
      const str1 = "abc";
      const str2 = "def";
      const obj1 = {
        i1: 10,
        i2: 20,
        buf: Int8Array.from([1, 2, 3, 4, 6]),
      };

      await tool.go(testCmdIds.cmd1, str1, str2, obj1);
      assert.equal(cmdStr, `${cmdArg}:1`);
      assert.equal(testOut.num, 30);
      assert.equal(testOut.str, "abcdef");
      assert.deepEqual(Array.from(testOut.buf), [1, 2, 3, 4, 6, -22]);

      await tool.go(testCmdIds.cmd2, str1, str2, obj1);
      assert.equal(cmdStr, `${cmdArg}:2`);
      assert.equal(testOut.num, -10);
      assert.equal(testOut.str, "defabc");
      assert.deepEqual(Array.from(testOut.buf), [1, 2, 3, 4, 6, -32]);
      expect(busyCalls).equal(4);

      busyCalls = 0;
      await EditTools.startCommand({ commandId: "", iModelKey: "" });
      expect(busyCalls).equal(4);

    });

    it("UndoAllTool should notify and abort when active edit command cannot finish", async () => {
      const fakeIModel = {
        key: "test-key",
        isReadonly: false,
        isBriefcaseConnection: true,
      };

      const selectedViewStub = sinon.stub(IModelApp.viewManager, "selectedView").get(() => ({ view: { iModel: fakeIModel } } as any));
      const startCommandStub = sinon.stub(IpcApp as any, _callIpcChannel).rejects(new Error("edit command is busy"));
      const reverseAllStub = sinon.stub(IpcApp.appFunctionIpc, "reverseAllTxn").resolves();
      const outputMessageStub = sinon.stub(IModelApp.notifications, "outputMessage");

      const result = await new UndoAllTool().run();

      expect(result).to.be.false;
      expect(startCommandStub).to.be.calledOnce;
      expect(reverseAllStub).not.to.be.called;
      expect(outputMessageStub).to.be.calledOnce;

      outputMessageStub.restore();
      reverseAllStub.restore();
      startCommandStub.restore();
      selectedViewStub.restore();
    });

    it("UndoAllTool should reverse txns when active edit command finishes", async () => {
      const fakeIModel = {
        key: "test-key",
        isReadonly: false,
        isBriefcaseConnection: true,
      };

      const selectedViewStub = sinon.stub(IModelApp.viewManager, "selectedView").get(() => ({ view: { iModel: fakeIModel } } as any));
      const startCommandStub = sinon.stub(IpcApp as any, _callIpcChannel).resolves(undefined);
      const reverseAllStub = sinon.stub(IpcApp.appFunctionIpc, "reverseAllTxn").resolves();
      const outputMessageStub = sinon.stub(IModelApp.notifications, "outputMessage");

      const result = await new UndoAllTool().run();

      expect(result).to.be.true;
      expect(startCommandStub).to.be.calledOnce;
      expect(reverseAllStub).to.be.calledOnceWithExactly(fakeIModel.key);
      expect(outputMessageStub).not.to.be.called;

      outputMessageStub.restore();
      reverseAllStub.restore();
      startCommandStub.restore();
      selectedViewStub.restore();
    });

  });
}
