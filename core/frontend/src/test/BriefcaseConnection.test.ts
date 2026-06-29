/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
});
