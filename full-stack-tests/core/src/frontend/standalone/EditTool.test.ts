/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import { ElectronRpcConfiguration } from "@bentley/imodeljs-common";
import { EditTool } from "@bentley/imodeljs-editor-frontend";
import { IModelApp, Viewport } from "@bentley/imodeljs-frontend";
import { cmdIds, Test1Args, Test1Response } from "../../common/TestEditCommandProps";

const expect = chai.expect;
const assert = chai.assert;

chai.use(chaiAsPromised);

let testNum: number;
let testStr: string;

class TestEditTool1 extends EditTool {
  public static toolId = "TestEditTool1";
  public isCompatibleViewport(_vp: Viewport | undefined, _isSelectedViewChange: boolean): boolean { return true; }

  public async go(cmd: string, args: Test1Args) {
    const ret = await EditTool.startCommand<Test1Args, Test1Response>(cmd, args);
    if (ret.result) {
      testNum = ret.result.outNum;
      testStr = ret.result.outStr;
    }
  }

}

if (ElectronRpcConfiguration.isElectron) {
  describe("EditTools", () => {

    before(async () => {
      await IModelApp.startup();
      const testNamespace = IModelApp.i18n.registerNamespace("TestApp");
      IModelApp.tools.register(TestEditTool1, testNamespace);
    });

    after(async () => {
      await IModelApp.shutdown();
    });

    it.only("should start test commands", async () => {
      expect(IModelApp.tools.run("TestEditTool1")).to.be.true;
      const tool = IModelApp.toolAdmin.currentTool as TestEditTool1;
      chai.assert.isTrue(tool instanceof TestEditTool1);
      await tool.go(cmdIds.cmd1,
        {
          str1: "abc",
          str2: "def",
          obj1: {
            i1: 10,
            i2: 20,
          },
        });

      assert.equal(testNum, 30);
      assert.equal(testStr, "abcdef");

    });

  });
}
