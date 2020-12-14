/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import * as path from "path";
import { LockLevel, LockType } from "@bentley/imodelhub-client";
import { CodeProps } from "@bentley/imodeljs-common";
import { ConcurrencyControl, IModelJsFs } from "../../imodeljs-backend";
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
      assert.equal(cctl.getHeldLock(LockType.Db, "1"), LockLevel.None);
      assert.isFalse(cctl.isLockHeld({ type: LockType.Db, objectId: "1", level: LockLevel.Shared }));
      assert.equal(cctl.getHeldLock(LockType.Db, "2"), LockLevel.None);
      cctl.insertLocks([{ type: LockType.Db, objectId: "1", level: LockLevel.Shared }]);
      assert.equal(cctl.getHeldLock(LockType.Db, "1"), LockLevel.Shared);
      assert.equal(cctl.getHeldLock(LockType.Db, "2"), LockLevel.None);
      cctl.clear();
      assert.equal(cctl.getHeldLock(LockType.Db, "1"), LockLevel.None);
      cctl.insertLocks([{ type: LockType.Db, objectId: "1", level: LockLevel.Shared }, { type: LockType.Db, objectId: "2", level: LockLevel.Exclusive }]);
      assert.equal(cctl.getHeldLock(LockType.Db, "1"), LockLevel.Shared);
      assert.equal(cctl.getHeldLock(LockType.Db, "2"), LockLevel.Exclusive);
      cctl.clear();

      assert.isFalse(cctl.isCodeReserved(code));
      assert.isFalse(cctl.isCodeReserved(code2));
      assert.equal(cctl.getHeldLock(LockType.Db, "1"), LockLevel.None);
      cctl.insertCodes([code]);
      assert.isTrue(cctl.isCodeReserved(code));
      assert.isFalse(cctl.isCodeReserved(code2));
      cctl.clear();
      assert.isFalse(cctl.isCodeReserved(code));
      assert.isFalse(cctl.isCodeReserved(code2));

      cctl.insertCodes([code, code2]);
      cctl.insertLocks([{ type: LockType.Db, objectId: "1", level: LockLevel.Shared }, { type: LockType.Db, objectId: "2", level: LockLevel.Exclusive }]);
      assert.isTrue(cctl.isCodeReserved(code));
      assert.isTrue(cctl.isCodeReserved(code2));
      assert.equal(cctl.getHeldLock(LockType.Db, "1"), LockLevel.Shared);
      assert.equal(cctl.getHeldLock(LockType.Db, "2"), LockLevel.Exclusive);

      cctl.saveChanges();
    } finally {
      cctl.close(false);
    }

    assert.throws(() => {
      cctl.isCodeReserved(code);
    });

    assert.throws(() => {
      cctl.getHeldLock(LockType.Db, "1");
    });

    assert.isTrue(cctl.open());
    try {
      assert.isTrue(cctl.isCodeReserved(code));
      assert.isTrue(cctl.isCodeReserved(code2));
      assert.equal(cctl.getHeldLock(LockType.Db, "1"), LockLevel.Shared);
      assert.equal(cctl.getHeldLock(LockType.Db, "2"), LockLevel.Exclusive);
    } finally {
      cctl.close(false);
    }
  });

});
