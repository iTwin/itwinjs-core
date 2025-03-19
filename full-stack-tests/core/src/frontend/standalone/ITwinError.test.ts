import { LoggingMetaData, ProcessDetector } from "@itwin/core-bentley";
import { getITwinErrorMetaData, InUseLock, InUseLocksError, isITwinCoreError, iTwinCoreErrors, itwinCoreNamespace, LockState } from "@itwin/core-common";
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

    it("should receive InUseLocksError on the frontend", async () => {
      const inUseLocks: InUseLock[] = [{ briefcaseId: 1, objectId: "objectId", state: LockState.Exclusive }];
      const metadata: LoggingMetaData = { category: "test", severity: "error" };
      const message = "in use";
      let caughtError = false;
      try {
        await coreFullStackTestIpc.throwBackendError<InUseLocksError>({ inUseLocks, namespace: itwinCoreNamespace, errorKey: iTwinCoreErrors.lockInUse, message, metadata });
      } catch (err: any) {
        caughtError = true;
        expect(isITwinCoreError(err, iTwinCoreErrors.lockInUse)).to.be.true;
        // Even though we're on the frontend we should make sure our stack trace includes backend code.
        expect(err.stack?.includes("core") && err.stack?.includes("backend")).to.be.true;
        expect(err.message).to.equal(message);
        expect(err.inUseLocks).to.deep.equal(inUseLocks);
        expect(getITwinErrorMetaData(err)).to.deep.equal(metadata);
      }
      expect(caughtError).to.be.true;
    });

    it("should receive iTwinError with channel key on the frontend", async () => {
      const message = "123";
      const metadata: LoggingMetaData = { category: "test", severity: "error" };
      let caughtError = false;
      try {
        await coreFullStackTestIpc.throwBackendError({ namespace: itwinCoreNamespace, errorKey: iTwinCoreErrors.channelMayNotNest, message, metadata });
      } catch (err: any) {
        caughtError = true;
        expect(isITwinCoreError(err, iTwinCoreErrors.channelMayNotNest)).to.be.true;
        // Even though we're on the frontend we should make sure our stack trace includes backend code.
        expect(err.stack?.includes("core") && err.stack?.includes("backend")).to.be.true;
        expect(err.message).to.equal(message);
        expect(getITwinErrorMetaData(err)).to.deep.equal(metadata);
      }
      expect(caughtError).to.be.true;
    });

  });

}
