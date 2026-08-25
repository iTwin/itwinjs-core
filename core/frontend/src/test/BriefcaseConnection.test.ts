/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChangesetIndexAndId } from "@itwin/core-common";
import { BriefcaseConnection, LockService, LockServiceFactory } from "../BriefcaseConnection";
import { IModelApp } from "../IModelApp";
import { IpcApp } from "../IpcApp";

describe("BriefcaseConnection", () => {
  beforeEach(async () => {
    await IModelApp.startup();

    vi.spyOn(IpcApp, "addListener").mockReturnValue(() => {});
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
  });
});
