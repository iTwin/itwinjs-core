import { LoggingMetaData, ProcessDetector } from "@itwin/core-bentley";
import { TestUtility } from "../TestUtility";
import { TestUsers } from "@itwin/oidc-signin-tool/lib/cjs/TestUsers";
import { coreFullStackTestIpc } from "../Editing";
import { ConflictingLock, ConflictingLocksError, LockState } from "@itwin/core-common";
import { expect } from "chai";

if (ProcessDetector.isElectronAppFrontend) {

  describe.only("Error (#integration)", async () => {

    beforeEach(async () => {
      await TestUtility.startFrontend();
      await TestUtility.initialize(TestUsers.regular);
    });

    afterEach(async () => {
      await TestUtility.shutdownFrontend();
    });

    it.only("should receive ConflictingLocksError on the frontend", async () => {
      const message = "test";
      const conflictingLocks: ConflictingLock[] = [{ briefcaseIds: [1], objectId: "objectId", state: LockState.Exclusive }];
      const metadata: LoggingMetaData = { category: "test", severity: "error" };
      try {
        await coreFullStackTestIpc.throwConflictingLocksError(message, metadata, conflictingLocks);
      } catch (err) {
        expect(err instanceof ConflictingLocksError).to.be.true;
        const castedError = err as ConflictingLocksError;
        // Even though we're on the frontend we should make sure our stack trace includes backend code.
        expect(castedError.stack?.includes("core\\backend")).to.be.true;
        expect(castedError.message).to.equal(message);
        expect(castedError.conflictingLocks).to.deep.equal(conflictingLocks);
        expect(castedError.getMetaData()).to.deep.equal(metadata);
      }
    });
  });

}
