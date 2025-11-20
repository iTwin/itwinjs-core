/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import { BeDuration, ProcessDetector } from "@itwin/core-bentley";
import { IModelApp, PrimitiveTool, Viewport } from "@itwin/core-frontend";
import { EditTools, makeEditToolIpc } from "@itwin/editor-frontend";
import { TestUtility } from "../TestUtility";
import { TestSnapshotConnection } from "../TestSnapshotConnection";

const expect = chai.expect;
const assert = chai.assert;

chai.use(chaiAsPromised);

let iModel: TestSnapshotConnection;

// Test command IDs
const mockTestEditCommandId = "Test.MockTestEditCommand";
const mockTestEditCommand2Id = "Test.MockTestEditCommand2";

interface MockTestEditCommandIpc {
  ping: () => Promise<{ commandId: string; version: string;[propName: string]: any }>;
  testMethod: () => Promise<string>;
  requiresStartup: () => Promise<boolean>;
  getStartupStatus: () => Promise<{ hasStarted: boolean; message: string }>;
}

// Test tool that uses the slow startup command
class MockTestEditCommandTool extends PrimitiveTool {
  public static override toolId = "MockTestEditCommandTool";
  public override isCompatibleViewport(_vp: Viewport | undefined, _isSelectedViewChange: boolean): boolean { return true; }
  public async onRestartTool() { return this.exitTool(); }

  public testIpc = makeEditToolIpc<MockTestEditCommandIpc>();

  public async startMockEditCommand(): Promise<string> {
    return EditTools.startCommand<string>({ commandId: mockTestEditCommandId, iModelKey: iModel.key });
  }

  public async startMockTestEditCommand2(): Promise<string> {
    return EditTools.startCommand<string>({ commandId: mockTestEditCommand2Id, iModelKey: iModel.key });
  }

  public async callTestMethod(): Promise<string> {
    return this.testIpc.testMethod();
  }

  public async callRequiresStartup(): Promise<boolean> {
    return this.testIpc.requiresStartup();
  }

  public async getStartupStatus(): Promise<{ hasStarted: boolean; message: string }> {
    return this.testIpc.getStartupStatus();
  }
}

if (!ProcessDetector.isMobileAppFrontend) {
  describe.only("EditCommand Tests", () => {

    before(async () => {
      await TestUtility.startFrontend(undefined, undefined, true);
      const namespace = "TestApp";
      await IModelApp.localization.registerNamespace(namespace);
      IModelApp.tools.register(MockTestEditCommandTool, namespace);
      iModel = await TestSnapshotConnection.openFile("test.bim");
    });

    after(async () => {
      await iModel.close();
      await TestUtility.shutdownFrontend();
    });

    afterEach(async () => {
      // Ensure no command is left running
      await EditTools.finishCommand();
    });

    it("should prevent IPC method calls while command is starting up", async () => {
      expect(await IModelApp.tools.run("MockTestEditCommandTool")).to.be.true;
      const tool = IModelApp.toolAdmin.currentTool as MockTestEditCommandTool;
      assert.isTrue(tool instanceof MockTestEditCommandTool);

      // Start the slow command but don't await it
      const startPromise = tool.startMockEditCommand();
      await BeDuration.fromMilliseconds(500).wait();

      // Try to call a method - this should fail because command is still starting
      try {
        await tool.callTestMethod();
        assert.fail("Method call should have failed while command is starting");
      } catch (error: any) {
        expect(error.message).to.contain("Edit command is still starting");
      }

      // Wait for startup to complete
      await startPromise;

      // Now the method call should succeed
      const result = await tool.callTestMethod();
      expect(result).to.equal("testMethod executed");
    });

    it("should block method calls that require startup completion", async () => {
      expect(await IModelApp.tools.run("MockTestEditCommandTool")).to.be.true;
      const tool = IModelApp.toolAdmin.currentTool as MockTestEditCommandTool;

      // Start the slow command but don't await it
      const startPromise = tool.startMockEditCommand();
      await BeDuration.fromMilliseconds(500).wait();

      // Try to call a method that requires startup - should fail
      try {
        await tool.callRequiresStartup();
        assert.fail("Method requiring startup should have failed");
      } catch (error: any) {
        expect(error.message).to.contain("Edit command is still starting");
      }

      // Wait for startup to complete
      await startPromise;

      // Now it should work
      const result = await tool.callRequiresStartup();
      expect(result).to.be.true;
    });

    it("should properly sequence multiple command starts", async () => {
      expect(await IModelApp.tools.run("MockTestEditCommandTool")).to.be.true;
      const tool = IModelApp.toolAdmin.currentTool as MockTestEditCommandTool;

      // Start first slow command without awaiting
      const start1Promise = tool.startMockEditCommand();

      // Immediately try to start a second command - it should wait
      const start2Promise = tool.startMockTestEditCommand2();

      // Wait for both to complete
      const [result1, result2] = await Promise.all([start1Promise, start2Promise]);

      // Both should have completed successfully
      expect(result1).to.equal("Mock edit command started");
      expect(result2).to.equal("Mock edit command 2 started");
    });

    it("should handle multiple command starts correctly", async () => {
      expect(await IModelApp.tools.run("MockTestEditCommandTool")).to.be.true;
      const tool = IModelApp.toolAdmin.currentTool as MockTestEditCommandTool;

      // Start multiple commands in rapid succession
      const promises = [
        tool.startMockTestEditCommand2(),
        tool.startMockTestEditCommand2(),
        tool.startMockTestEditCommand2(),
      ];

      // All should complete without error
      const results = await Promise.all(promises);
      results.forEach((result) => {
        expect(result).to.equal("Mock edit command 2 started");
      });
    });
  });
}
