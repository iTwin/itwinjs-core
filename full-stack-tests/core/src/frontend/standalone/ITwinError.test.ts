import { IModelStatus, ProcessDetector } from "@itwin/core-bentley";
import { BackendError, ChannelError, getITwinErrorMetaData } from "@itwin/core-common";
import { expect } from "chai";
import { coreFullStackTestIpc } from "../Editing";
import { TestUtility } from "../TestUtility";

if (ProcessDetector.isElectronAppFrontend) {

  describe.only("ITwinError exceptions from backend", async () => {

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
      try {
        await coreFullStackTestIpc.throwLegacyError(errorNumber, testMsg, metadata);
      } catch (err: any) {
        caughtError = true;
        expect(err instanceof BackendError).true;
        expect(err.stack?.includes("core") && err.stack?.includes("backend")).to.be.true;
        expect(err.message).to.equal(testMsg);
        expect(err.errorNumber).equal(IModelStatus.AlreadyLoaded);
        expect(err.name).equal("Already Loaded");
        expect(err.getMetaData()).to.deep.equal(metadata);
      }
      expect(caughtError).to.be.true;
    });

    it("should receive ChannelError on the frontend", async () => {
      const sentErr = {
        message: "test message",
        channelKey: "123",
        metadata: { category: "test", severity: "error" },
      }

      let caughtError = false;
      try {
        await coreFullStackTestIpc.throwChannelError("may-not-nest", sentErr.message, sentErr.channelKey, sentErr.metadata);
      } catch (err: any) {
        caughtError = true;
        expect(ChannelError.isError(err, "may-not-nest")).to.be.true;
        // Even though we're on the frontend we should make sure our stack trace includes backend code.
        expect(err.stack?.includes("core") && err.stack?.includes("backend")).to.be.true;
        expect(err.message).to.equal(sentErr.message);
        expect(err.channelKey).equal(sentErr.channelKey);
        expect(getITwinErrorMetaData(err)).to.deep.equal(sentErr.metadata);
      }
      expect(caughtError).to.be.true;
    });

  });

}
