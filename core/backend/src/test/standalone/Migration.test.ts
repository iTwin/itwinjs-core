/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { ChannelControlError } from "@itwin/core-common";
import { withEditTxn } from "../../EditTxn";
import { _bumpChannelVersion, _verifyChannel } from "../../internal/Symbols";
import { MigrationCompatibility } from "../../Migration";
import { ChannelControl } from "../../ChannelControl";
import { StandaloneDb } from "../../core-backend";
import { IModelTestUtils } from "../IModelTestUtils";

describe("Channel version compatibility", () => {
  const channelKey = "test-channel";

  function createDb(fileName: string): StandaloneDb {
    return StandaloneDb.createEmpty(
      IModelTestUtils.prepareOutputFile("Migration", fileName),
      { rootSubject: { name: "MigrationTest" }, allowEdit: JSON.stringify({ txns: true }) },
    );
  }

  afterEach(() => {
    // Ensure any open StandaloneDbs from individual tests are cleaned up by each test.
  });

  describe("getChannelVersionCompatibility", () => {
    it("returns 'ok' when no migrations are registered", () => {
      const db = createDb("NoMigrations.bim");
      try {
        // No migrations registered → always ok, regardless of channel version.
        expect(db.channels.getChannelVersionCompatibility(channelKey)).to.equal("ok");
        expect(db.channels.getChannelVersionCompatibility(ChannelControl.sharedChannelName)).to.equal("ok");
      } finally {
        db.close();
      }
    });

    it("returns 'ok' when registered migrations match the current channel version", () => {
      const db = createDb("MatchingVersions.bim");
      try {
        // Register a patch-level migration.
        db.channels.registerMigration({
          id: "m1",
          channelKey,
          compatibility: MigrationCompatibility.ReadWrite,
          async migrate() { return undefined; },
          async migrateLocalChanges() { },
        });

        // Create the channel root so the version can be stored.
        db.channels.addAllowedChannel(channelKey);
        withEditTxn(db, (txn) => db.channels.insertChannelSubject({ subjectName: "Test", channelKey, txn }));

        // With no version bump applied yet, computed expected = "0.0.1" and actual = "0.0.0".
        // Actual (0.0.0) < expected (0.0.1), so ok.
        expect(db.channels.getChannelVersionCompatibility(channelKey)).to.equal("ok");

        // Bump the channel version by the registered migration's compatibility (patch).
        withEditTxn(db, (txn) => db.channels[_bumpChannelVersion](txn, channelKey, MigrationCompatibility.ReadWrite));

        // Now actual = "0.0.1" and expected = "0.0.1". Equal → ok.
        expect(db.channels.getChannelVersionCompatibility(channelKey)).to.equal("ok");
      } finally {
        db.close();
      }
    });

    it("returns 'read-only' when the channel's minor version exceeds what registered migrations expect", () => {
      const db = createDb("MinorVersionTooHigh.bim");
      try {
        // Register only a patch-level migration. Expected final version = "0.0.1".
        db.channels.registerMigration({
          id: "m1",
          channelKey,
          compatibility: MigrationCompatibility.ReadWrite,
          async migrate() { return undefined; },
          async migrateLocalChanges() { },
        });

        db.channels.addAllowedChannel(channelKey);
        withEditTxn(db, (txn) => db.channels.insertChannelSubject({ subjectName: "Test", channelKey, txn }));

        // Simulate a migration by another app that bumped the minor (write-compat) version.
        withEditTxn(db, (txn) => db.channels[_bumpChannelVersion](txn, channelKey, MigrationCompatibility.ReadOnly));

        // Actual = "0.1.0", expected = "0.0.1". actual.minor (1) > expected.minor (0) → read-only.
        expect(db.channels.getChannelVersionCompatibility(channelKey)).to.equal("read-only");
      } finally {
        db.close();
      }
    });

    it("returns 'blocked' when the channel's major version exceeds what registered migrations expect", () => {
      const db = createDb("MajorVersionTooHigh.bim");
      try {
        // Register only a minor-level migration. Expected final version = "0.1.0".
        db.channels.registerMigration({
          id: "m1",
          channelKey,
          compatibility: MigrationCompatibility.ReadOnly,
          async migrate() { return undefined; },
          async migrateLocalChanges() { },
        });

        db.channels.addAllowedChannel(channelKey);
        withEditTxn(db, (txn) => db.channels.insertChannelSubject({ subjectName: "Test", channelKey, txn }));

        // Simulate a migration by another app that bumped the major (read-compat) version.
        withEditTxn(db, (txn) => db.channels[_bumpChannelVersion](txn, channelKey, MigrationCompatibility.None));

        // Actual = "1.0.0", expected = "0.1.0". actual.major (1) > expected.major (0) → blocked.
        expect(db.channels.getChannelVersionCompatibility(channelKey)).to.equal("blocked");
      } finally {
        db.close();
      }
    });

    it("returns 'ok' for shared channel regardless of registered migrations", () => {
      const db = createDb("SharedChannelOk.bim");
      try {
        // Shared channel has no ChannelRootAspect version, so always ok.
        expect(db.channels.getChannelVersionCompatibility(ChannelControl.sharedChannelName)).to.equal("ok");
      } finally {
        db.close();
      }
    });

    it("handles multiple registered migrations with cumulative version bumps correctly", () => {
      const db = createDb("MultiMigrations.bim");
      try {
        // Register: patch + minor + major → expected = "1.0.0".
        for (const [id, compat] of [
          ["m1", MigrationCompatibility.ReadWrite],
          ["m2", MigrationCompatibility.ReadOnly],
          ["m3", MigrationCompatibility.None],
        ] as const) {
          db.channels.registerMigration({
            id,
            channelKey,
            compatibility: compat,
            async migrate() { return undefined; },
            async migrateLocalChanges() { },
          });
        }

        db.channels.addAllowedChannel(channelKey);
        withEditTxn(db, (txn) => db.channels.insertChannelSubject({ subjectName: "Test", channelKey, txn }));

        // Apply all three bumps: 0.0.0 → 0.0.1 → 0.1.0 (patch resets) wait...
        // semver.inc("0.0.0", "patch") = "0.0.1"
        // semver.inc("0.0.1", "minor") = "0.1.0"
        // semver.inc("0.1.0", "major") = "1.0.0"
        withEditTxn(db, (txn) => db.channels[_bumpChannelVersion](txn, channelKey, MigrationCompatibility.ReadWrite));
        withEditTxn(db, (txn) => db.channels[_bumpChannelVersion](txn, channelKey, MigrationCompatibility.ReadOnly));
        withEditTxn(db, (txn) => db.channels[_bumpChannelVersion](txn, channelKey, MigrationCompatibility.None));

        // actual = "1.0.0", expected = "1.0.0" → ok.
        expect(db.channels.getChannelVersionCompatibility(channelKey)).to.equal("ok");

        // Now bump one more minor version (simulating an unknown migration by another app).
        withEditTxn(db, (txn) => db.channels[_bumpChannelVersion](txn, channelKey, MigrationCompatibility.ReadOnly));

        // actual = "1.1.0", expected = "1.0.0". actual.minor (1) > expected.minor (0) → read-only.
        expect(db.channels.getChannelVersionCompatibility(channelKey)).to.equal("read-only");
      } finally {
        db.close();
      }
    });
  });

  describe("_verifyChannel version enforcement", () => {
    // _verifyChannel(modelId) is the write-guard for the channel system. It is called by
    // Element, Model, and ElementAspect before any write operation, where `modelId` is the
    // model that the element lives in (or the modeled element for Model inserts). It resolves
    // the channel key via getChannelKey() and checks version compatibility.
    //
    // The channel root subject has a ChannelRootAspect, so getChannelKey(channelRootSubjectId)
    // returns the custom channelKey. Calling _verifyChannel(channelRootSubjectId) directly is
    // therefore equivalent to the check performed when inserting a model whose modeledElement
    // is the channel root subject — the cleanest way to exercise the version guard in a unit test.

    it("throws 'version-read-only' when the channel's minor version was bumped beyond expectations", () => {
      const db = createDb("WriteToReadOnly.bim");
      try {
        db.channels.registerMigration({
          id: "m1",
          channelKey,
          compatibility: MigrationCompatibility.ReadWrite, // expected: "0.0.1"
          async migrate() { return undefined; },
          async migrateLocalChanges() { },
        });

        db.channels.addAllowedChannel(channelKey);
        let channelRootSubjectId!: string;
        withEditTxn(db, (txn) => {
          channelRootSubjectId = db.channels.insertChannelSubject({ subjectName: "Test", channelKey, txn });
        });

        // Bump to a minor version (0.1.0) — higher than expected (0.0.1).
        withEditTxn(db, (txn) => db.channels[_bumpChannelVersion](txn, channelKey, MigrationCompatibility.ReadOnly));

        // _verifyChannel on the channel root's ID should now throw version-read-only.
        expect(() => db.channels[_verifyChannel](channelRootSubjectId))
          .to.throw().and.satisfy((err: unknown) => ChannelControlError.isError(err, "version-read-only"));
      } finally {
        db.close();
      }
    });

    it("throws 'version-blocked' when the channel's major version was bumped beyond expectations", () => {
      const db = createDb("WriteToBlocked.bim");
      try {
        db.channels.registerMigration({
          id: "m1",
          channelKey,
          compatibility: MigrationCompatibility.ReadOnly, // expected: "0.1.0"
          async migrate() { return undefined; },
          async migrateLocalChanges() { },
        });

        db.channels.addAllowedChannel(channelKey);
        let channelRootSubjectId!: string;
        withEditTxn(db, (txn) => {
          channelRootSubjectId = db.channels.insertChannelSubject({ subjectName: "Test", channelKey, txn });
        });

        // Bump to a major version (1.0.0) — higher than expected (0.1.0).
        withEditTxn(db, (txn) => db.channels[_bumpChannelVersion](txn, channelKey, MigrationCompatibility.None));

        // _verifyChannel should throw version-blocked.
        expect(() => db.channels[_verifyChannel](channelRootSubjectId))
          .to.throw().and.satisfy((err: unknown) => ChannelControlError.isError(err, "version-blocked"));
      } finally {
        db.close();
      }
    });

    it("does not throw when the channel version exactly matches what registered migrations produce", () => {
      const db = createDb("WriteOk.bim");
      try {
        db.channels.registerMigration({
          id: "m1",
          channelKey,
          compatibility: MigrationCompatibility.ReadOnly, // expected: "0.1.0"
          async migrate() { return undefined; },
          async migrateLocalChanges() { },
        });

        db.channels.addAllowedChannel(channelKey);
        let channelRootSubjectId!: string;
        withEditTxn(db, (txn) => {
          channelRootSubjectId = db.channels.insertChannelSubject({ subjectName: "Test", channelKey, txn });
        });

        // Bump to exactly the expected version.
        withEditTxn(db, (txn) => db.channels[_bumpChannelVersion](txn, channelKey, MigrationCompatibility.ReadOnly));

        // _verifyChannel should not throw: actual (0.1.0) == expected (0.1.0).
        expect(() => db.channels[_verifyChannel](channelRootSubjectId)).not.to.throw();
      } finally {
        db.close();
      }
    });

    it("clears the allowed-model cache when a channel version is bumped", () => {
      const db = createDb("CacheInvalidation.bim");
      try {
        db.channels.registerMigration({
          id: "m1",
          channelKey,
          compatibility: MigrationCompatibility.ReadWrite, // expected: "0.0.1"
          async migrate() { return undefined; },
          async migrateLocalChanges() { },
        });

        db.channels.addAllowedChannel(channelKey);
        let channelRootSubjectId!: string;
        withEditTxn(db, (txn) => {
          channelRootSubjectId = db.channels.insertChannelSubject({ subjectName: "Test", channelKey, txn });
        });

        // First call to _verifyChannel primes the _allowedModels cache.
        expect(() => db.channels[_verifyChannel](channelRootSubjectId)).not.to.throw();

        // Bump the channel version — this clears _allowedModels.
        withEditTxn(db, (txn) => db.channels[_bumpChannelVersion](txn, channelKey, MigrationCompatibility.ReadOnly));

        // Now the cached entry is gone and the version check runs again: should throw.
        expect(() => db.channels[_verifyChannel](channelRootSubjectId))
          .to.throw().and.satisfy((err: unknown) => ChannelControlError.isError(err, "version-read-only"));
      } finally {
        db.close();
      }
    });
  });
});
