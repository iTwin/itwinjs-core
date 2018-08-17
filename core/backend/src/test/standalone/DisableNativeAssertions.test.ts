/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { using, DbResult } from "@bentley/bentleyjs-core";
import { IModelError } from "@bentley/imodeljs-common";
import { ECDb } from "../../backend";
import { ECDbTestHelper } from "./ECDbTestHelper";
import { KnownTestLocations } from "../KnownTestLocations";
import { DisableNativeAssertions } from "../IModelTestUtils";

describe("DisableNativeAssertions", () => {
  const _outDir = KnownTestLocations.outputDir;

  it("Prepare invalid SQLite statement with native assertions turned on", () => {
    using(ECDbTestHelper.createECDb(_outDir, "create.ecdb"), (ecdb: ECDb) => {
      assert.isTrue(ecdb.isOpen);

      let hasThrown: boolean = false;
      try {
        // An invalid SQL is expected to fire an assertion in native code BeSQLite during preparation
        ecdb.withPreparedSqliteStatement("SELECT * FROM Foo", () => { });
      } catch (e) {
        hasThrown = true;
        // cannot find out whether the addon is a debug build or not, so just test
        // that the message of the thrown error either starts with "Native Assertion Failure" (if debug build)
        // or is an IModelError (if release build)
        if (e instanceof IModelError) {
          assert.equal(e.errorNumber, DbResult.BE_SQLITE_ERROR);
        } else {
          assert.isDefined(e.message);
          const msg: string = e.message;
          assert.isTrue(msg.toLowerCase().startsWith("native assertion failure"));
        }
      }

      assert.isTrue(hasThrown);
    });
  });

  it("Prepare invalid SQLite statement with native assertions turned off", () => {
    using(ECDbTestHelper.createECDb(_outDir, "create.ecdb"), (ecdb: ECDb) => {
      assert.isTrue(ecdb.isOpen);

      using(new DisableNativeAssertions(), () => {
        let hasThrown: boolean = false;
        try {
          // An invalid SQL is expected to fire an assertion in native code BeSQLite during preparation
          ecdb.withPreparedSqliteStatement("SELECT * FROM Foo", () => { });
        } catch (e) {
          hasThrown = true;
          assert.isTrue(e instanceof IModelError);
          assert.equal(e.errorNumber, DbResult.BE_SQLITE_ERROR);
        }
        assert.isTrue(hasThrown);
      });
    });
  });
});
