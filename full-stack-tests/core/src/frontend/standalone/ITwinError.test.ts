import { IModelStatus, ProcessDetector } from "@itwin/core-bentley";
import { BackendError, ChannelError, getITwinErrorMetaData } from "@itwin/core-common";
import { expect } from "chai";
import { coreFullStackTestIpc } from "../Editing";
import { TestUtility } from "../TestUtility";

if (ProcessDetector.isElectronAppFrontend) {

  describe("ITwinError exceptions from backend", async () => {

    beforeEach(async () => {
      await TestUtility.startFrontend();
    });

    afterEach(async () => {
      await TestUtility.shutdownFrontend();
    });

    it("should receive legacy BackendError", async () => {
      const metadata = { category: "test", severity: "error" };
      const testMsg = "test message";
      const errorNumber = IModelStatus.AlreadyLoaded;
      let caughtError = false;
      const verify = (err: any) => {
        caughtError = true;
        expect(err instanceof BackendError).true;
        expect(err.stack?.includes("core") && err.stack?.includes("backend")).true;
        expect(err.message).equal(testMsg);
        expect(err.errorNumber).equal(IModelStatus.AlreadyLoaded);
        expect(err.name).equal("Already Loaded");
        expect(err.getMetaData()).deep.equal(metadata);
      }
      try {
        await coreFullStackTestIpc.throwLegacyError(errorNumber, testMsg, metadata, false);
      } catch (err: any) {
        verify(err);
      }
      expect(caughtError).true;
      caughtError = false;
      try {
        await coreFullStackTestIpc.throwLegacyError(errorNumber, testMsg, metadata, true);
      } catch (err: any) {
        verify(err);
      }
      expect(caughtError).true;
    });

    it("should receive ChannelError on the frontend", async () => {
      const sentErr = {
        message: "test message",
        channelKey: "123",
        metadata: { category: "test", severity: "error" },
      }

      let caughtError = false;
      const verify = (err: any) => {
        caughtError = true;
        expect(ChannelError.isError(err, "may-not-nest")).true;
        // Even though we're on the frontend we should make sure our stack trace includes backend code.
        expect(err.stack?.includes("core") && err.stack?.includes("backend")).true;
        expect(err.message).equal(sentErr.message);
        expect(err.channelKey).equal(sentErr.channelKey);
        expect(getITwinErrorMetaData(err)).deep.equal(sentErr.metadata);
      }
      try {
        await coreFullStackTestIpc.throwChannelError("may-not-nest", sentErr.message, sentErr.channelKey, sentErr.metadata, false);
      } catch (err: any) {
        verify(err);
      }
      expect(caughtError).true;
      caughtError = false;
      try {
        await coreFullStackTestIpc.throwChannelError("may-not-nest", sentErr.message, sentErr.channelKey, sentErr.metadata, true);
      } catch (err: any) {
        verify(err);
      }
      expect(caughtError).true;
    });

  });

}
