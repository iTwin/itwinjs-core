/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { desync, isSynchronized, sync, SyncObserver } from "../../../render/webgl/Sync";

describe("SyncObserver", () => {
  it("should synchronize with Sync", () => {
    const target = { syncKey: 0 };
    const observer: SyncObserver = { };

    expect(isSynchronized(target, observer)).to.be.false;
    expect(sync(target, observer)).to.be.false;
    expect(observer.syncToken).not.to.be.undefined;
    expect(observer.syncToken!.target).to.equal(target);
    expect(observer.syncToken!.syncKey).to.equal(0);
    expect(isSynchronized(target, observer)).to.be.true;

    expect(isSynchronized(target, observer)).to.be.true;
    expect(sync(target, observer)).to.be.true;
    expect(observer.syncToken!.target).to.equal(target);
    expect(observer.syncToken!.syncKey).to.equal(0);

    desync(target);
    expect(target.syncKey).to.equal(1);
    expect(sync(target, observer)).to.be.false;
    expect(observer.syncToken!.target).to.equal(target);
    expect(observer.syncToken!.syncKey).to.equal(1);
    expect(sync(target, observer)).to.be.true;

    const target2 = { syncKey: 111 };
    expect(sync(target2, observer)).to.be.false;
    expect(observer.syncToken!.target).to.equal(target2);
    expect(observer.syncToken!.syncKey).to.equal(111);
  });
});

describe("SyncTarget", () => {
  it("should roll over correctly", () => {
    const target = { syncKey: Number.MAX_SAFE_INTEGER - 1 };

    desync(target);
    expect(target.syncKey).to.equal(Number.MAX_SAFE_INTEGER);
    desync(target);
    expect(target.syncKey).to.equal(Number.MIN_SAFE_INTEGER);
    desync(target);
    expect(target.syncKey).to.equal(Number.MIN_SAFE_INTEGER + 1);
  });
});
