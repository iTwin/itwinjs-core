/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { afterEach, beforeEach, describe, expect, it, MockInstance, vi } from "vitest";
import { type ChangesetIndexAndId, getPullChangesIpcChannel, getPushChangesIpcChannel, type IpcListener, type RemoveFunction } from "@itwin/core-common";
import { BriefcaseConnection, GenericAbortSignal, LockService, LockServiceFactory } from "../BriefcaseConnection";
import { IModelApp } from "../IModelApp";
import { IpcApp } from "../IpcApp";
import { Guid } from "@itwin/core-bentley";

type AbortSignalListener = (this: GenericAbortSignal, ev: any) => any;

class MockAbortSignal implements GenericAbortSignal {
  public readonly listeners = new Set<AbortSignalListener>();

  public addEventListener(_type: "abort", listener: AbortSignalListener) {
    this.listeners.add(listener);
  }

  public removeEventListener(_type: "abort", listener: AbortSignalListener) {
    this.listeners.delete(listener);
  }

  public abort() {
    this.listeners.forEach((listener) => listener.bind(this)(undefined));
  }
}

const testIModelId = "22222222-2222-2222-2222-222222222222";

let addListenerSpy: MockInstance<(channel: string, handler: IpcListener) => RemoveFunction>;

/** Opens a connection whose IPC functions are the supplied fakes. Supply `Guid.empty` as `iTwinId` for a briefcase with no timeline. */
async function openTestBriefcase(ipcFunctions: object, iTwinId = "11111111-1111-1111-1111-111111111111"): Promise<BriefcaseConnection> {
  vi.spyOn(IpcApp, "appFunctionIpc", "get").mockReturnValue({
    openBriefcase: vi.fn().mockResolvedValue({
      key: "test-key",
      rootSubject: { name: "test" },
      iTwinId,
      iModelId: testIModelId,
      changeset: { index: 1, id: "original-changeset-id" },
    }),
    ...ipcFunctions,
  } as any);

  return BriefcaseConnection.openFile({ fileName: "test.bim" });
}

/** Finds the progress listener registered for `channel`. `openFile` also registers unrelated listeners, so this must match by channel. */
function findProgressListener(channel: string): IpcListener | undefined {
  const call = addListenerSpy.mock.calls.find(([listenedChannel]) => listenedChannel === channel);
  return call?.[1];
}

describe("BriefcaseConnection", () => {
  beforeEach(async () => {
    await IModelApp.startup();

    addListenerSpy = vi.spyOn(IpcApp, "addListener").mockReturnValue(() => {});
    vi.spyOn(IpcApp, "removeListener").mockReturnValue(undefined);
  });

  afterEach(async () => {
    await IModelApp.shutdown();
    vi.restoreAllMocks();
  });

  it("locks property is properly initiliazed", async () => {
    const fakeBriefcaseProps = {
      key: "test-key",
      rootSubject: { name: "test" },
      iTwinId: "00000000-0000-0000-0000-000000000000",
      iModelId: "00000000-0000-0000-0000-000000000000",
    };

    vi.spyOn(IpcApp, "appFunctionIpc", "get").mockReturnValue({
      openBriefcase: vi.fn().mockResolvedValue(fakeBriefcaseProps),
    } as any);

    const mockLockService: LockService = {
      getExclusiveForeignLocks: vi.fn(),
      getSharedForeignLocks: vi.fn(),
      checkElementLockAvailability: vi.fn(),
    };
    const lockServiceFactory: LockServiceFactory = vi.fn().mockResolvedValue(mockLockService);

    const connection = await BriefcaseConnection.openFile({ fileName: "test.bim" }, lockServiceFactory);

    expect(lockServiceFactory).toHaveBeenCalledExactlyOnceWith(connection);
    expect(connection.locks).toBe(mockLockService);
  });

  describe("pullChanges", () => {
    it("updates changeset and fires onChangesetChanged", async () => {
      const originalChangeset: ChangesetIndexAndId = { index: 1, id: "original-changeset-id" };
      const pulledChangeset: ChangesetIndexAndId = { index: 3, id: "pulled-changeset-id" };

      const fakeBriefcaseProps = {
        key: "test-key",
        rootSubject: { name: "test" },
        iTwinId: "11111111-1111-1111-1111-111111111111",
        iModelId: "00000000-0000-0000-0000-000000000000",
        changeset: originalChangeset,
      };

      vi.spyOn(IpcApp, "appFunctionIpc", "get").mockReturnValue({
        openBriefcase: vi.fn().mockResolvedValue(fakeBriefcaseProps),
        pullChanges: vi.fn().mockResolvedValue(pulledChangeset),
      } as any);

      const connection = await BriefcaseConnection.openFile({ fileName: "test.bim" });

      expect(connection.changeset.index).toBe(originalChangeset.index);
      expect(connection.changeset.id).toBe(originalChangeset.id);

      const changesetChangedListener = vi.fn();
      const removeListener = connection.onChangesetChanged.addListener(changesetChangedListener);

      try {
        await connection.pullChanges();

        expect(connection.changeset.index).toBe(pulledChangeset.index);
        expect(connection.changeset.id).toBe(pulledChangeset.id);
        expect(changesetChangedListener).toHaveBeenCalledOnce();
        expect(changesetChangedListener).toHaveBeenCalledWith(originalChangeset);
      } finally {
        removeListener();
      }
    });

    it("forwards progress and cancellation options over IPC", async () => {
      const pullChanges = vi.fn().mockResolvedValue({ index: 3, id: "pulled-changeset-id" });
      const connection = await openTestBriefcase({ pullChanges, cancelPullChangesRequest: vi.fn() });

      await connection.pullChanges(5, {
        downloadProgressCallback: vi.fn(),
        progressInterval: 100,
        abortSignal: new MockAbortSignal(),
      });

      expect(pullChanges).toHaveBeenCalledWith("test-key", 5, {
        reportProgress: true,
        progressInterval: 100,
        enableCancellation: true,
      });
    });

    it("does not report progress or enable cancellation when no options are supplied", async () => {
      const pullChanges = vi.fn().mockResolvedValue({ index: 3, id: "pulled-changeset-id" });
      const connection = await openTestBriefcase({ pullChanges });

      await connection.pullChanges();

      expect(pullChanges).toHaveBeenCalledWith("test-key", undefined, {
        reportProgress: false,
        progressInterval: undefined,
        enableCancellation: false,
      });
      expect(findProgressListener(getPullChangesIpcChannel(testIModelId))).toBeUndefined();
    });

    it("relays progress events from the pull channel to the callback", async () => {
      let completePull!: (changeset: ChangesetIndexAndId) => void;
      const pullChanges = vi.fn().mockReturnValue(new Promise<ChangesetIndexAndId>((resolve) => completePull = resolve));
      const connection = await openTestBriefcase({ pullChanges });

      const downloadProgressCallback = vi.fn();
      const pullPromise = connection.pullChanges(undefined, { downloadProgressCallback });

      const progressListener = findProgressListener(getPullChangesIpcChannel(testIModelId));
      expect(progressListener).toBeDefined();

      progressListener!({} as Event, { loaded: 50, total: 100 });
      expect(downloadProgressCallback).toHaveBeenCalledWith({ loaded: 50, total: 100 });

      completePull({ index: 3, id: "pulled-changeset-id" });
      await pullPromise;
    });

    it("cancels the pull when the abort signal fires", async () => {
      let completePull!: (changeset: ChangesetIndexAndId) => void;
      const pullChanges = vi.fn().mockReturnValue(new Promise<ChangesetIndexAndId>((resolve) => completePull = resolve));
      const cancelPullChangesRequest = vi.fn().mockResolvedValue(undefined);
      const connection = await openTestBriefcase({ pullChanges, cancelPullChangesRequest });

      const abortSignal = new MockAbortSignal();
      const pullPromise = connection.pullChanges(undefined, { abortSignal });

      abortSignal.abort();
      expect(cancelPullChangesRequest).toHaveBeenCalledWith("test-key");

      completePull({ index: 3, id: "pulled-changeset-id" });
      await pullPromise;
    });

    it("removes listeners once the pull completes", async () => {
      const removeProgressListener = vi.fn();
      addListenerSpy.mockReturnValue(removeProgressListener);

      const pullChanges = vi.fn().mockResolvedValue({ index: 3, id: "pulled-changeset-id" });
      const connection = await openTestBriefcase({ pullChanges, cancelPullChangesRequest: vi.fn() });

      const abortSignal = new MockAbortSignal();
      await connection.pullChanges(undefined, { downloadProgressCallback: vi.fn(), abortSignal });

      expect(removeProgressListener).toHaveBeenCalled();
      expect(abortSignal.listeners.size).toBe(0);
    });

    it("removes listeners when the pull fails", async () => {
      const removeProgressListener = vi.fn();
      addListenerSpy.mockReturnValue(removeProgressListener);

      const pullChanges = vi.fn().mockRejectedValue(new Error("pull failed"));
      const connection = await openTestBriefcase({ pullChanges, cancelPullChangesRequest: vi.fn() });

      const abortSignal = new MockAbortSignal();
      await expect(connection.pullChanges(undefined, { downloadProgressCallback: vi.fn(), abortSignal })).rejects.toThrow("pull failed");

      expect(removeProgressListener).toHaveBeenCalled();
      expect(abortSignal.listeners.size).toBe(0);
    });

    it("registers no listeners when the briefcase has no timeline", async () => {
      const pullChanges = vi.fn();
      const connection = await openTestBriefcase({ pullChanges, cancelPullChangesRequest: vi.fn() }, Guid.empty);

      const abortSignal = new MockAbortSignal();
      await expect(connection.pullChanges(undefined, { downloadProgressCallback: vi.fn(), abortSignal })).rejects.toThrow("iModel has no timeline");

      expect(pullChanges).not.toHaveBeenCalled();
      expect(findProgressListener(getPullChangesIpcChannel(testIModelId))).toBeUndefined();
      expect(abortSignal.listeners.size).toBe(0);
    });
  });

  describe("pushChanges", () => {
    it("updates changeset and fires onChangesetChanged", async () => {
      const originalChangeset: ChangesetIndexAndId = { index: 1, id: "original-changeset-id" };
      const pushedChangeset: ChangesetIndexAndId = { index: 5, id: "pushed-changeset-id" };

      const fakeBriefcaseProps = {
        key: "test-key",
        rootSubject: { name: "test" },
        iTwinId: "11111111-1111-1111-1111-111111111111",
        iModelId: "00000000-0000-0000-0000-000000000000",
        changeset: originalChangeset,
      };

      vi.spyOn(IpcApp, "appFunctionIpc", "get").mockReturnValue({
        openBriefcase: vi.fn().mockResolvedValue(fakeBriefcaseProps),
        pushChanges: vi.fn().mockResolvedValue(pushedChangeset),
      } as any);

      const connection = await BriefcaseConnection.openFile({ fileName: "test.bim" });

      expect(connection.changeset.index).toBe(originalChangeset.index);
      expect(connection.changeset.id).toBe(originalChangeset.id);

      const changesetChangedListener = vi.fn();
      const removeListener = connection.onChangesetChanged.addListener(changesetChangedListener);

      try {
        const result = await connection.pushChanges("test push");

        expect(result).toEqual(pushedChangeset);
        expect(connection.changeset.index).toBe(pushedChangeset.index);
        expect(connection.changeset.id).toBe(pushedChangeset.id);
        expect(changesetChangedListener).toHaveBeenCalledOnce();
        expect(changesetChangedListener).toHaveBeenCalledWith(originalChangeset);
      } finally {
        removeListener();
      }
    });

    it("forwards progress and cancellation options over IPC", async () => {
      const pushChanges = vi.fn().mockResolvedValue({ index: 5, id: "pushed-changeset-id" });
      const connection = await openTestBriefcase({ pushChanges, cancelPushChangesRequest: vi.fn() });

      await connection.pushChanges("test push", {
        downloadProgressCallback: vi.fn(),
        downloadProgressInterval: 100,
        abortSignal: new MockAbortSignal(),
      });

      expect(pushChanges).toHaveBeenCalledWith("test-key", "test push", {
        reportDownloadProgress: true,
        downloadProgressInterval: 100,
        enableCancellation: true,
      });
    });

    it("does not report progress or enable cancellation when no options are supplied", async () => {
      const pushChanges = vi.fn().mockResolvedValue({ index: 5, id: "pushed-changeset-id" });
      const connection = await openTestBriefcase({ pushChanges });

      await connection.pushChanges("test push");

      expect(pushChanges).toHaveBeenCalledWith("test-key", "test push", {
        reportDownloadProgress: false,
        downloadProgressInterval: undefined,
        enableCancellation: false,
      });
      expect(findProgressListener(getPushChangesIpcChannel(testIModelId))).toBeUndefined();
    });

    it("relays progress events from the push channel to the callback", async () => {
      let completePush!: (changeset: ChangesetIndexAndId) => void;
      const pushChanges = vi.fn().mockReturnValue(new Promise<ChangesetIndexAndId>((resolve) => completePush = resolve));
      const connection = await openTestBriefcase({ pushChanges });

      const downloadProgressCallback = vi.fn();
      const pushPromise = connection.pushChanges("test push", { downloadProgressCallback });

      const progressListener = findProgressListener(getPushChangesIpcChannel(testIModelId));
      expect(progressListener).toBeDefined();
      // The pull channel is used to report a pull's progress - a push must not listen on it.
      expect(findProgressListener(getPullChangesIpcChannel(testIModelId))).toBeUndefined();

      progressListener!({} as Event, { loaded: 50, total: 100 });
      expect(downloadProgressCallback).toHaveBeenCalledWith({ loaded: 50, total: 100 });

      completePush({ index: 5, id: "pushed-changeset-id" });
      await pushPromise;
    });

    it("cancels the push when the abort signal fires", async () => {
      let completePush!: (changeset: ChangesetIndexAndId) => void;
      const pushChanges = vi.fn().mockReturnValue(new Promise<ChangesetIndexAndId>((resolve) => completePush = resolve));
      const cancelPushChangesRequest = vi.fn().mockResolvedValue(undefined);
      const connection = await openTestBriefcase({ pushChanges, cancelPushChangesRequest });

      const abortSignal = new MockAbortSignal();
      const pushPromise = connection.pushChanges("test push", { abortSignal });

      abortSignal.abort();
      expect(cancelPushChangesRequest).toHaveBeenCalledWith("test-key");

      completePush({ index: 5, id: "pushed-changeset-id" });
      await pushPromise;
    });

    it("removes listeners once the push completes", async () => {
      const removeProgressListener = vi.fn();
      addListenerSpy.mockReturnValue(removeProgressListener);

      const pushChanges = vi.fn().mockResolvedValue({ index: 5, id: "pushed-changeset-id" });
      const connection = await openTestBriefcase({ pushChanges, cancelPushChangesRequest: vi.fn() });

      const abortSignal = new MockAbortSignal();
      await connection.pushChanges("test push", { downloadProgressCallback: vi.fn(), abortSignal });

      expect(removeProgressListener).toHaveBeenCalled();
      expect(abortSignal.listeners.size).toBe(0);
    });

    it("removes listeners when the push fails", async () => {
      const removeProgressListener = vi.fn();
      addListenerSpy.mockReturnValue(removeProgressListener);

      const pushChanges = vi.fn().mockRejectedValue(new Error("push failed"));
      const connection = await openTestBriefcase({ pushChanges, cancelPushChangesRequest: vi.fn() });

      const abortSignal = new MockAbortSignal();
      await expect(connection.pushChanges("test push", { downloadProgressCallback: vi.fn(), abortSignal })).rejects.toThrow("push failed");

      expect(removeProgressListener).toHaveBeenCalled();
      expect(abortSignal.listeners.size).toBe(0);
    });

    it("registers no listeners when the briefcase has no timeline", async () => {
      const pushChanges = vi.fn();
      const connection = await openTestBriefcase({ pushChanges, cancelPushChangesRequest: vi.fn() }, Guid.empty);

      const abortSignal = new MockAbortSignal();
      await expect(connection.pushChanges("description", { downloadProgressCallback: vi.fn(), abortSignal })).rejects.toThrow("iModel has no timeline");

      expect(pushChanges).not.toHaveBeenCalled();
      expect(findProgressListener(getPushChangesIpcChannel(testIModelId))).toBeUndefined();
      expect(abortSignal.listeners.size).toBe(0);
    });
  });
});
