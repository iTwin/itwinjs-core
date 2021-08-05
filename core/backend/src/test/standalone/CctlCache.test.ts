/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import * as path from "path";
import { CodeProps } from "@bentley/imodeljs-common";
import { ConcurrencyControl, IModelJsFs, LockScope } from "../../imodeljs-backend";
import { KnownTestLocations } from "../KnownTestLocations";

describe("ConcurrencyControl.StateCache", () => {

  it("cctl cache - basic insert and query", async () => {

    const mockBriefcasePathname = path.join(KnownTestLocations.outputDir, "ConcurrencyControl.StateCache.test", "dummy.bim");
    if (IModelJsFs.existsSync(path.dirname(mockBriefcasePathname)))
      IModelJsFs.removeSync(path.dirname(mockBriefcasePathname));
    IModelJsFs.mkdirSync(path.dirname(mockBriefcasePathname));

    const concurrencyControlMock = {
      iModel: {
        needsConcurrencyControl: true,
        pathName: mockBriefcasePathname,
        isOpen: true,
        briefcaseId: 3,
        allowLocalChanges: true,
      },
    };

    const cctl = new ConcurrencyControl.StateCache(concurrencyControlMock as unknown as ConcurrencyControl);
    if (!cctl.open())
      cctl.create();

    const code: CodeProps = { scope: "1", spec: "2", value: "3" };
    const code2: CodeProps = { scope: "1", spec: "2", value: "2" };
    try {
      assert.equal(cctl.getHeldLock("1"), LockScope.None);
      assert.isFalse(cctl.isLockHeld({ entityId: "1", scope: LockScope.Shared }));
      assert.equal(cctl.getHeldLock("2"), LockScope.None);
      cctl.insertLocks([{ entityId: "1", scope: LockScope.Shared }]);
      assert.equal(cctl.getHeldLock("1"), LockScope.Shared);
      assert.equal(cctl.getHeldLock("2"), LockScope.None);
      cctl.clear();
      assert.equal(cctl.getHeldLock("1"), LockScope.None);
      cctl.insertLocks([{ entityId: "1", scope: LockScope.Shared }, { entityId: "2", scope: LockScope.Exclusive }]);
      assert.equal(cctl.getHeldLock("1"), LockScope.Shared);
      assert.equal(cctl.getHeldLock("2"), LockScope.Exclusive);
      cctl.clear();

      assert.isFalse(cctl.isCodeReserved(code));
      assert.isFalse(cctl.isCodeReserved(code2));
      assert.equal(cctl.getHeldLock("1"), LockScope.None);
      cctl.insertCodes([code]);
      assert.isTrue(cctl.isCodeReserved(code));
      assert.isFalse(cctl.isCodeReserved(code2));
      cctl.clear();
      assert.isFalse(cctl.isCodeReserved(code));
      assert.isFalse(cctl.isCodeReserved(code2));

      cctl.insertCodes([code, code2]);
      cctl.insertLocks([{ entityId: "1", scope: LockScope.Shared }, { entityId: "2", scope: LockScope.Exclusive }]);
      assert.isTrue(cctl.isCodeReserved(code));
      assert.isTrue(cctl.isCodeReserved(code2));
      assert.equal(cctl.getHeldLock("1"), LockScope.Shared);
      assert.equal(cctl.getHeldLock("2"), LockScope.Exclusive);

      cctl.saveChanges();
    } finally {
      cctl.close(false);
    }

    assert.throws(() => {
      cctl.isCodeReserved(code);
    });

    assert.throws(() => {
      cctl.getHeldLock("1");
    });

    assert.isTrue(cctl.open());
    try {
      assert.isTrue(cctl.isCodeReserved(code));
      assert.isTrue(cctl.isCodeReserved(code2));
      assert.equal(cctl.getHeldLock("1"), LockScope.Shared);
      assert.equal(cctl.getHeldLock("2"), LockScope.Exclusive);
    } finally {
      cctl.close(false);
    }
  });

});
