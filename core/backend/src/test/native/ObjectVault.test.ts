/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { IModelHost } from "../../core-backend";

describe("ObjectVault", () => {
  it("should verify object vault", () => {
    const platform = IModelHost.platform;

    const o1 = "o1";
    platform.storeObjectInVault({ thisIs: "obj1" }, o1);
    exerciseGc();
    assert.deepEqual(platform.getObjectFromVault(o1), { thisIs: "obj1" });
    assert.equal(platform.getObjectRefCountFromVault(o1), 1);

    const o2 = "o2";
    platform.storeObjectInVault({ thatIs: "obj2" }, o2);
    exerciseGc();
    assert.deepEqual(platform.getObjectFromVault(o2), { thatIs: "obj2" });
    exerciseGc();
    assert.equal(platform.getObjectRefCountFromVault(o2), 1);

    platform.storeObjectInVault(platform.getObjectFromVault(o1), o1); // this is one way to increase the ref count on obj1
    assert.equal(platform.getObjectRefCountFromVault(o1), 2);
    assert.equal(platform.getObjectRefCountFromVault(o2), 1);

    platform.addReferenceToObjectInVault(o1); // this is the more direct way to increase the ref count to obj1
    assert.equal(platform.getObjectRefCountFromVault(o1), 3);

    platform.dropObjectFromVault(o1); // decrease the ref count on obj1
    platform.dropObjectFromVault(o1); // decrease the ref count on obj1
    assert.equal(platform.getObjectRefCountFromVault(o1), 1);

    exerciseGc();

    platform.dropObjectFromVault(o1); // remove the only remaining reference to obj1
    try {
      platform.getObjectFromVault(o1);
    } catch (_err) {
    // expected
    }
    try {
      platform.dropObjectFromVault(o1); // this is ID is invalid and should be rejected.
    } catch (_err) {
    // expected
    }

    assert.equal(platform.getObjectRefCountFromVault(o2), 1);
    assert.deepEqual(platform.getObjectFromVault(o2), { thatIs: "obj2" });
    platform.dropObjectFromVault(o2); // remove the only reference to obj2
    try {
      platform.getObjectFromVault(o2);
    } catch (_err) {
    // expected
    }
  });
});

function exerciseGc() {
  for (let i = 0; i < 1000; ++i) {
    const obj = { value: i };
    const fmt = obj.value.toString();
    assert.isTrue(i === parseInt(fmt, 10));
  }
}
