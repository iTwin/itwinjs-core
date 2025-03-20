import { BentleyError, IModelHubStatus, isITwinError, ProcessDetector } from "@itwin/core-bentley";
import { BackendError, ChannelError, ConflictingLock, ConflictingLocksError, LockState } from "@itwin/core-common";
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

    it("should receive ConflictingLocks error", async () => {
      const inUseLocks: ConflictingLock[] = [{ briefcaseIds: [1], objectId: "objectId", state: LockState.Exclusive }];
      const metadata = { category: "test", severity: "error" };
      const testMsg = "test message";
      const errorNumber = IModelHubStatus.LockOwnedByAnotherBriefcase;
      const verify = async (logFn: boolean) => {
        let caughtError = false;

        try {
          await coreFullStackTestIpc.throwLockError(inUseLocks, testMsg, metadata, logFn);
        } catch (err: any) {
          caughtError = true;
          expect(err instanceof BackendError).true;
          expect(ConflictingLocksError.isError(err)).true;
          if (ConflictingLocksError.isError(err)) {
            expect(err.stack?.includes("backend.ts")).true;
            expect(err.message).equal(testMsg);
            expect(err.errorNumber).equal(errorNumber);
            expect(err.iTwinErrorId.key).equal("Lock is owned by another briefcase");
            expect(err.loggingMetadata).deep.equal(metadata);
            expect(err.conflictingLocks).deep.equal(inUseLocks);
            expect(isITwinError(err, BentleyError.iTwinErrorScope, BentleyError.getErrorKey(errorNumber))).true;
          }
        }
        expect(caughtError).true;
      }
      await verify(false);
      await verify(true);
    });

    it("should receive ChannelError", async () => {
      const sentErr = {
        message: "test message",
        channelKey: "123",
      }
      let caughtError = false;
      try {
        await coreFullStackTestIpc.throwChannelError("may-not-nest", sentErr.message, sentErr.channelKey);
      } catch (err: any) {
        caughtError = true;
        expect(ChannelError.isError(err, "may-not-nest")).true;
        // Even though we're on the frontend we should make sure our stack trace includes backend code.
        expect(err.stack?.includes("core") && err.stack?.includes("backend")).true;
        expect(err.message).equal(sentErr.message);
        expect(err.channelKey).equal(sentErr.channelKey);
      }
      expect(caughtError).true;
    });

  });

}
