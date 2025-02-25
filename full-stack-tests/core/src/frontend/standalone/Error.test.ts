import { LoggingMetaData, ProcessDetector } from "@itwin/core-bentley";
import { ChannelNotAllowedError, ChannelRootExistsError, ChannelsNestError, InUseLock, InUseLocksError, ITwinError, LockState } from "@itwin/core-common";
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
      const message = "One or more objects are already locked by another briefcase";
      const inUseLocks: InUseLock[] = [{ briefcaseIds: [1], objectId: "objectId", state: LockState.Exclusive }];
      const metadata: LoggingMetaData = { category: "test", severity: "error" };
      let caughtError = false;
      try {
        await coreFullStackTestIpc.throwInUseLocksError(inUseLocks, message, metadata);
      } catch (err) {
        caughtError = true;
        expect(InUseLocksError.isInUseLocksError(err)).to.be.true;
        if (InUseLocksError.isInUseLocksError(err)) {
          // Even though we're on the frontend we should make sure our stack trace includes backend code.
          expect(err.stack?.includes("core\\backend") || err.stack?.includes("core/backend"), `Expected ${err.stack} to have mention of 'core\\backend' or 'core/backend'`).to.be.true;
          expect(err.message).to.equal(message);
          expect(err.inUseLocks).to.deep.equal(inUseLocks);
          expect(ITwinError.getMetaData(err)).to.deep.equal(metadata);
        }
      }
      expect(caughtError).to.be.true;
    });

    it("should receive ChannelNotAllowedError on the frontend", async () => {
      const message = "Channel is not allowed";
      const metadata: LoggingMetaData = { category: "test", severity: "error" };
      let caughtError = false;
      try {
        await coreFullStackTestIpc.throwChannelNotAllowedError( message, metadata);
      } catch (err) {
        caughtError = true;
        expect(ChannelNotAllowedError.isChannelNotAllowedError(err)).to.be.true;
        if (ChannelNotAllowedError.isChannelNotAllowedError(err)) {
          // Even though we're on the frontend we should make sure our stack trace includes backend code.
          expect(err.stack?.includes("core\\backend") || err.stack?.includes("core/backend"), `Expected ${err.stack} to have mention of 'core\\backend' or 'core/backend'`).to.be.true;
          expect(err.message).to.equal(message);
          expect(ITwinError.getMetaData(err)).to.deep.equal(metadata);
        }
      }
      expect(caughtError).to.be.true;
    });

    it("should receive ChannelsNestError on the frontend", async () => {
      const message = "Channels may not nest";
      const metadata: LoggingMetaData = { category: "test", severity: "error" };
      let caughtError = false;
      try {
        await coreFullStackTestIpc.throwChannelsNestError( message, metadata);
      } catch (err) {
        caughtError = true;
        expect(ChannelsNestError.isChannelsNestError(err)).to.be.true;
        if (ChannelsNestError.isChannelsNestError(err)) {
          // Even though we're on the frontend we should make sure our stack trace includes backend code.
          expect(err.stack?.includes("core\\backend") || err.stack?.includes("core/backend"), `Expected ${err.stack} to have mention of 'core\\backend' or 'core/backend'`).to.be.true;
          expect(err.message).to.equal(message);
          expect(ITwinError.getMetaData(err)).to.deep.equal(metadata);
        }
      }
      expect(caughtError).to.be.true;
    });

    it("should receive ChannelRootExistsError on the frontend", async () => {
      const message = "A channel root for the specified key already exists";
      const metadata: LoggingMetaData = { category: "test", severity: "error" };
      let caughtError = false;
      try {
        await coreFullStackTestIpc.throwChannelRootExistsError( message, metadata);
      } catch (err) {
        caughtError = true;
        expect(ChannelRootExistsError.isChannelRootExistsError(err)).to.be.true;
        if (ChannelRootExistsError.isChannelRootExistsError(err)) {
          // Even though we're on the frontend we should make sure our stack trace includes backend code.
          expect(err.stack?.includes("core\\backend") || err.stack?.includes("core/backend"), `Expected ${err.stack} to have mention of 'core\\backend' or 'core/backend'`).to.be.true;
          expect(err.message).to.equal(message);
          expect(ITwinError.getMetaData(err)).to.deep.equal(metadata);
        }
      }
      expect(caughtError).to.be.true;
    });

  });

}
