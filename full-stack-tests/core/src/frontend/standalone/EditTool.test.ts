/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import { ElectronRpcConfiguration } from "@bentley/imodeljs-common";
import { EditTool } from "@bentley/imodeljs-editor-frontend";
import { IModelApp, SnapshotConnection, Viewport } from "@bentley/imodeljs-frontend";
import { cmdIds, Test1Args, Test1Response } from "../../common/TestEditCommandProps";

const expect = chai.expect;
const assert = chai.assert;

chai.use(chaiAsPromised);

let iModel: SnapshotConnection;
let testNum: number;
let testStr: string;
const cmdArg = "test command arg";
let cmdStr: string;

class TestEditTool1 extends EditTool {
  public static toolId = "TestEditTool1";
  public isCompatibleViewport(_vp: Viewport | undefined, _isSelectedViewChange: boolean): boolean { return true; }

  public async go(cmd: string, args: Test1Args) {
    const ret = await EditTool.startCommand<string, string>(cmd, iModel, cmdArg);
    cmdStr = ret.result!;
    const ret2 = await EditTool.callCommand<Test1Args, Test1Response>("testMethod1", args);
    if (ret2.result) {
      testNum = ret2.result.outNum;
      testStr = ret2.result.outStr;
    }
  }
}

if (ElectronRpcConfiguration.isElectron) {
  describe("EditTools", () => {

    before(async () => {
      await IModelApp.startup();
      const testNamespace = IModelApp.i18n.registerNamespace("TestApp");
      IModelApp.tools.register(TestEditTool1, testNamespace);
      iModel = await SnapshotConnection.openFile("test.bim"); // relative path resolved by BackendTestAssetResolver

    });

    after(async () => {
      await iModel.close();
      await IModelApp.shutdown();
    });

    it("should start edit commands", async () => {
      expect(IModelApp.tools.run("TestEditTool1")).to.be.true;
      const tool = IModelApp.toolAdmin.currentTool as TestEditTool1;
      assert.isTrue(tool instanceof TestEditTool1);
      const arg: Test1Args = {
        str1: "abc",
        str2: "def",
        obj1: {
          i1: 10,
          i2: 20,
        },
      };

      await tool.go(cmdIds.cmd1, arg);
      assert.equal(cmdStr, `${cmdArg}:1`);
      assert.equal(testNum, 30);
      assert.equal(testStr, "abcdef");

      await tool.go(cmdIds.cmd2, arg);
      assert.equal(cmdStr, `${cmdArg}:2`);
      assert.equal(testNum, -10);
      assert.equal(testStr, "defabc");
    });

  });
}
