import { LoggingMetaData, ProcessDetector } from "@itwin/core-bentley";
import { createITwinErrorTypeAsserter, getITwinErrorMetaData, InUseLock, InUseLocksError, ITwinError, iTwinErrorKeys, iTwinErrorMessages, iTwinjsCoreNamespace, LockState } from "@itwin/core-common";
import { TestUsers } from "@itwin/oidc-signin-tool/lib/cjs/TestUsers";
import { expect } from "chai";
import { coreFullStackTestIpc } from "../Editing";
import { TestUtility } from "../TestUtility";

if (ProcessDetector.isElectronAppFrontend) {

  describe("Error (#integration)", async () => {

    beforeEach(async () => {
      await TestUtility.startFrontend();
      await TestUtility.initialize(TestUsers.regular);
    });

    afterEach(async () => {
      await TestUtility.shutdownFrontend();
    });

    it("should receive InUseLocksError on the frontend", async () => {
      const message = iTwinErrorMessages.inUseLocks();
      const inUseLocks: InUseLock[] = [{ briefcaseIds: [1], objectId: "objectId", state: LockState.Exclusive }];
      const metadata: LoggingMetaData = { category: "test", severity: "error" };
      let caughtError = false;
      try {
        await coreFullStackTestIpc.throwDetailedError<InUseLocksError>({ inUseLocks }, iTwinjsCoreNamespace, iTwinErrorKeys.inUseLocks, message, metadata);
      } catch (err) {
        caughtError = true;
        const isInUseError = createITwinErrorTypeAsserter<InUseLocksError>(iTwinjsCoreNamespace, iTwinErrorKeys.inUseLocks);
        expect(isInUseError(err)).to.be.true;
        if (isInUseError(err)) {
          // Even though we're on the frontend we should make sure our stack trace includes backend code.
          expect(err.stack?.includes("core\\backend") || err.stack?.includes("core/backend"), `Expected ${err.stack} to have mention of 'core\\backend' or 'core/backend'`).to.be.true;
          expect(err.message).to.equal(message);
          expect(err.inUseLocks).to.deep.equal(inUseLocks);
          expect(getITwinErrorMetaData(err)).to.deep.equal(metadata);
        }
      }
      expect(caughtError).to.be.true;
    });

    it("should receive iTwin error with channel key on the frontend", async () => {
      const message = iTwinErrorMessages.channelNest("123");
      const metadata: LoggingMetaData = { category: "test", severity: "error" };
      let caughtError = false;
      try {
        await coreFullStackTestIpc.throwITwinError(iTwinjsCoreNamespace, iTwinErrorKeys.channelNest, message, metadata);
      } catch (err) {
        caughtError = true;
        const isInUseError = createITwinErrorTypeAsserter<ITwinError>(iTwinjsCoreNamespace, iTwinErrorKeys.channelNest);
        expect(isInUseError(err)).to.be.true;
        if (isInUseError(err)) {
          // Even though we're on the frontend we should make sure our stack trace includes backend code.
          expect(err.stack?.includes("core\\backend") || err.stack?.includes("core/backend"), `Expected ${err.stack} to have mention of 'core\\backend' or 'core/backend'`).to.be.true;
          expect(err.message).to.equal(message);
          expect(getITwinErrorMetaData(err)).to.deep.equal(metadata);
        }
      }
      expect(caughtError).to.be.true;
    });

  });

}
