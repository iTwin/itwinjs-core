import { LoggingMetaData, ProcessDetector } from "@itwin/core-bentley";
import { TestUtility } from "../TestUtility";
import { TestUsers } from "@itwin/oidc-signin-tool/lib/cjs/TestUsers";
import { coreFullStackTestIpc } from "../Editing";
import { InUseLock, ITwinError, LockState } from "@itwin/core-common";
import { expect } from "chai";

if (ProcessDetector.isElectronAppFrontend) {

  describe("Error (#integration)", async () => {

    beforeEach(async () => {
      await TestUtility.startFrontend();
      await TestUtility.initialize(TestUsers.regular);
    });

    afterEach(async () => {
      await TestUtility.shutdownFrontend();
    });

    it("should receive ConflictingLocksError on the frontend", async () => {
      const message = "One or more objects are already locked by another briefcase";
      const inUseLocks: InUseLock[] = [{ briefcaseIds: [1], objectId: "objectId", state: LockState.Exclusive }];
      const metadata: LoggingMetaData = { category: "test", severity: "error" };
      let caughtError = false;
      try {
        await coreFullStackTestIpc.throwInUseLocksError(inUseLocks, message, metadata);
      } catch (err) {
        caughtError = true;
        expect(ITwinError.isInUseLocksError(err)).to.be.true;
        if (ITwinError.isInUseLocksError(err)) {
          // Even though we're on the frontend we should make sure our stack trace includes backend code.
          expect(err.stack?.includes("core\\backend"), `Expected ${err.stack} to have mention of core\\backend`).to.be.true;
          expect(err.message).to.equal(message);
          expect(err.inUseLocks).to.deep.equal(inUseLocks);
          expect(ITwinError.getMetaData(err)).to.be.undefined; // Currently not propagating metadata.
        }
      }
      expect(caughtError).to.be.true;
    });

    // it("should throw error on frontend", async () => {
    //   const message = "One or more objects are already locked by another briefcase";
    //   const inUseLocks: InUseLock[] = [{ briefcaseIds: [1], objectId: "objectId", state: LockState.Exclusive }];
    //   const metadata: LoggingMetaData = { category: "test", severity: "error" };
    //   await coreFullStackTestIpc.throwInUseLocksError(inUseLocks, message, metadata);
    // });
  });

}
