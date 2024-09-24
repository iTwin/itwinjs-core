/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { describe, expect, it } from "vitest";
import { desync, isSynchronized, sync, SyncObserver } from "../../../render/webgl/Sync";

describe("SyncObserver", () => {
  it("should synchronize with Sync", () => {
    const target = { syncKey: 0 };
    const observer: SyncObserver = {};

    expect(isSynchronized(target, observer)).toBe(false);
    expect(sync(target, observer)).toBe(false);
    expect(observer.syncToken).toBeDefined();
    expect(observer.syncToken!.target).toEqual(target);
    expect(observer.syncToken!.syncKey).toEqual(0);
    expect(isSynchronized(target, observer)).toBe(true);

    expect(isSynchronized(target, observer)).toBe(true);
    expect(sync(target, observer)).toBe(true);
    expect(observer.syncToken!.target).toEqual(target);
    expect(observer.syncToken!.syncKey).toEqual(0);

    desync(target);
    expect(target.syncKey).toEqual(1);
    expect(sync(target, observer)).toBe(false);
    expect(observer.syncToken!.target).toEqual(target);
    expect(observer.syncToken!.syncKey).toEqual(1);
    expect(sync(target, observer)).toBe(true);

    const target2 = { syncKey: 111 };
    expect(sync(target2, observer)).toBe(false);
    expect(observer.syncToken!.target).toEqual(target2);
    expect(observer.syncToken!.syncKey).toEqual(111);
  });
});

describe("SyncTarget", () => {
  it("should roll over correctly", () => {
    const target = { syncKey: Number.MAX_SAFE_INTEGER - 1 };

    desync(target);
    expect(target.syncKey).toEqual(Number.MAX_SAFE_INTEGER);
    desync(target);
    expect(target.syncKey).toEqual(Number.MIN_SAFE_INTEGER);
    desync(target);
    expect(target.syncKey).toEqual(Number.MIN_SAFE_INTEGER + 1);
  });
});
