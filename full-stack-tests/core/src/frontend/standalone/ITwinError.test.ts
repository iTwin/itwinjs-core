import { BentleyError, IModelHubStatus, ProcessDetector } from "@itwin/core-bentley";
import { BackendError, ChannelControlError, ConflictingLock, ConflictingLocksError, LockState } from "@itwin/core-common";
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
        } catch (err: unknown) {
          caughtError = true;
          expect(err instanceof BackendError).true;
          expect(ConflictingLocksError.isError(err)).true;
          if (ConflictingLocksError.isError(err)) {
            expect(BentleyError.isError(err, errorNumber)).true;
            expect(err.stack?.includes("backend.ts")).true; // this is where we threw from the backend
            expect(err.message).equal(testMsg);
            expect(err.errorNumber).equal(errorNumber);
            expect(err.iTwinErrorId.key).equal("Lock is owned by another briefcase");
            expect(err.loggingMetadata).deep.equal(metadata);
            expect(err.conflictingLocks).deep.equal(inUseLocks);
          }
        }
        expect(caughtError).true;
      }
      await verify(false);
      await verify(true);
    });

    it("should receive ChannelControlError", async () => {
      const sentErr = {
        message: "test message",
        channelKey: "123",
      }
      let caughtError = false;
      const errKey = "may-not-nest";
      try {
        await coreFullStackTestIpc.throwChannelError(errKey, sentErr.message, sentErr.channelKey);
      } catch (err: unknown) {
        caughtError = true;
        expect(ChannelControlError.isError(err, errKey)).true;
        if (ChannelControlError.isError(err, errKey)) {
          expect(err.stack?.includes("backend.ts")).true; // this is where we threw from the backend
          expect(err.message).equal(sentErr.message);
          expect(err.name).equal(errKey);
          expect(err.channelKey).equal(sentErr.channelKey);
        }
      }
      expect(caughtError).true;
    });

  });

}
