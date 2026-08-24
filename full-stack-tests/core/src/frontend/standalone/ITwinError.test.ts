import { BentleyError, IModelHubStatus, ProcessDetector } from "@itwin/core-bentley";
import { BackendError, ChannelControlError, ConflictingLock, ConflictingLocksError, LockState } from "@itwin/core-common";
import { expect } from "vitest";
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
          expect(err instanceof BackendError).toBe(true);
          expect(ConflictingLocksError.isError(err)).toBe(true);
          if (ConflictingLocksError.isError(err)) {
            expect(BentleyError.isError(err, errorNumber)).toBe(true);
            expect(err.stack?.includes("backend.ts") || err.stack?.includes("backend.js")).toBe(true); // this is where we threw from the backend
            expect(err.message).toBe(testMsg);
            expect(err.errorNumber).toBe(errorNumber);
            expect(err.iTwinErrorId.key).toBe("Lock is owned by another briefcase");
            expect(err.loggingMetadata).toEqual(metadata);
            expect(err.conflictingLocks).toEqual(inUseLocks);
          }
        }
        expect(caughtError).toBe(true);
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
        expect(ChannelControlError.isError(err, errKey)).toBe(true);
        if (ChannelControlError.isError(err, errKey)) {
          expect(err.stack?.includes("backend.ts") || err.stack?.includes("backend.js")).toBe(true); // this is where we threw from the backend
          expect(err.message).toBe(sentErr.message);
          expect(err.name).toBe(errKey);
          expect(err.channelKey).toBe(sentErr.channelKey);
        }
      }
      expect(caughtError).toBe(true);
    });

  });

}
