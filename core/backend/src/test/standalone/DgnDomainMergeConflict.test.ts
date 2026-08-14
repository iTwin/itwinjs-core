/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as fs from "fs";
import { DbResult, GuidString } from "@itwin/core-bentley";
import { ChangesetFileProps } from "@itwin/core-common";
import { assert, expect } from "chai";
import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import * as sinon from "sinon";
import { HubWrappers, KnownTestLocations } from "../";
import { HubMock } from "../../internal/HubMock";
import { BriefcaseDb, ChannelControl, FunctionalSchema } from "../../core-backend";
import { IModelTestUtils, TestUserType } from "../IModelTestUtils";
import { TestUtils } from "../TestUtils";
import { withEditTxn } from "../../EditTxn";
import { _nativeDb } from "../../internal/Symbols";
import { IModelNative } from "../../internal/NativePlatform";

chai.use(chaiAsPromised);

/**
 * `dgn_Domain` holds one bookkeeping row per BIS domain present in the briefcase, and the row is
 * created automatically as soon as the domain's schema is imported. Merging a changeset that
 * registers a domain therefore conflicts with the row that was just created locally. The conflict
 * is benign - both rows describe the same domain - so it must never fail the pull.
 *
 * The tests build a timeline where two changesets each insert the same `dgn_Domain` row:
 *
 *   cs1 (b1) - "Domain schema upgrade"  : INSERT dgn_Domain('Functional')
 *   cs2 (b3) - duplicate domain rows    : INSERT dgn_Domain('Functional') again
 *
 * b1 and b3 both start at version 0 and perform the same domain upgrade, and cs2 is appended to
 * the timeline without rebasing. A normal `pushChanges()` cannot produce this shape because the
 * rebase drops the duplicate insert first, but it is observed in the field from connectors.
 *
 * Merging both changesets in one pull used to abort, while pulling them one at a time succeeded,
 * leaving the cached briefcase permanently stuck. All of these must now succeed alike.
 */
describe("dgn_Domain merge conflict", () => {
  let iTwinId: GuidString;

  before(async () => {
    await TestUtils.startBackend();
    HubMock.startup("DgnDomainMergeConflict", KnownTestLocations.outputDir);
    iTwinId = HubMock.iTwinId;
  });
  after(() => HubMock.shutdown());

  /** The domain names present in the briefcase's `dgn_Domain` table. */
  function queryDomains(db: BriefcaseDb): string[] {
    const names: string[] = [];
    db.withPreparedSqliteStatement("SELECT Name FROM dgn_Domain ORDER BY Name", (stmt) => {
      while (stmt.step() === DbResult.BE_SQLITE_ROW)
        names.push(stmt.getValueString(0));
    });
    return names;
  }

  /**
   * Creates an iModel whose timeline holds two changesets that each INSERT the same
   * `dgn_Domain` row, and leaves both authoring briefcases closed.
   */
  async function createTimelineWithDuplicateDomainRows(iModelName: string) {
    const accessToken1 = await HubWrappers.getAccessToken(TestUserType.SuperManager);
    const accessToken3 = await HubWrappers.getAccessToken(TestUserType.Super);

    const iModelId = await HubMock.createNewIModel({ accessToken: accessToken1, iTwinId, iModelName, description: iModelName, noLocks: true });
    assert.isNotEmpty(iModelId);

    const b1 = await HubWrappers.downloadAndOpenBriefcase({ accessToken: accessToken1, iTwinId, iModelId, noLock: true });
    b1.channels.addAllowedChannel(ChannelControl.sharedChannelName);
    // b3 is downloaded at version 0 as well, so it never learns about cs1.
    const b3 = await HubWrappers.downloadAndOpenBriefcase({ accessToken: accessToken3, iTwinId, iModelId, noLock: true });
    b3.channels.addAllowedChannel(ChannelControl.sharedChannelName);

    // cs1: the "Domain schema upgrade" changeset. Importing the Functional *domain* adds a
    // `dgn_Domain` row for "Functional", and that insert is part of the pushed changeset.
    await withEditTxn(b1, "Domain schema upgrade", async () => {
      await FunctionalSchema.importSchema(b1);
    });
    await b1.pushChanges({ accessToken: accessToken1, description: "Domain schema upgrade" });
    expect(queryDomains(b1)).to.include("Functional");

    // cs2: b3 performs the same domain upgrade while unaware of cs1, so its changeset carries a
    // second INSERT for the same `dgn_Domain` row. It is appended to the timeline without a
    // rebase (a rebase would rewrite the duplicate insert away, which is exactly why this shape
    // of changeset cannot be produced by `pushChanges` but is observed in the field).
    await withEditTxn(b3, "Domain schema upgrade", async () => {
      await FunctionalSchema.importSchema(b3);
    });
    // extra content so cs2 does not hash to the same changeset id as cs1
    withEditTxn(b3, "connector data", (txn) => {
      IModelTestUtils.createAndInsertPhysicalPartitionAndModel(txn, IModelTestUtils.getUniqueModelCode(b3, "ConnectorModel"), true);
    });

    const csProps = b3[_nativeDb].startCreateChangeset() as ChangesetFileProps;
    csProps.briefcaseId = b3.briefcaseId;
    csProps.description = "Duplicate dgn_Domain rows";
    csProps.size = fs.statSync(csProps.pathname).size;
    csProps.parentId = b1.changeset.id;
    csProps.id = IModelNative.platform.DgnDb.computeChangesetId(csProps);
    await HubMock.pushChangeset({ accessToken: accessToken3, iModelId, changesetProps: csProps });
    b3[_nativeDb].abandonCreateChangeset();

    b1.close();
    b3.close();
    return { iModelId, tipIndex: 2 };
  }

  it("resolves the duplicate dgn_Domain insert when the changesets are pulled one at a time", async () => {
    const { iModelId } = await createTimelineWithDuplicateDomainRows("DgnDomainOneAtATime");
    const accessToken = await HubWrappers.getAccessToken(TestUserType.Regular);

    // A briefcase parked at version 0, i.e. behind the domain upgrade.
    const b2 = await HubWrappers.downloadAndOpenBriefcase({ accessToken, iTwinId, iModelId, asOf: { first: true }, noLock: true });
    try {
      expect(b2.txns.hasPendingTxns).to.be.false;

      // Each pull is its own pull-merge session, so no local change is pending when the
      // conflicting insert is applied.
      await b2.pullChanges({ accessToken, toIndex: 1 });
      await b2.pullChanges({ accessToken });

      expect(b2.changeset.index).to.equal(2);
      expect(queryDomains(b2).filter((name) => name === "Functional")).to.have.lengthOf(1);
    } finally {
      b2.close();
    }
  });

  it("resolves the duplicate dgn_Domain insert when the changesets are merged by a single pullChanges", async () => {
    const { iModelId } = await createTimelineWithDuplicateDomainRows("DgnDomainSinglePull");
    const accessToken = await HubWrappers.getAccessToken(TestUserType.Regular);

    const b2 = await HubWrappers.downloadAndOpenBriefcase({ accessToken, iTwinId, iModelId, asOf: { first: true }, noLock: true });
    try {
      expect(b2.txns.hasPendingTxns).to.be.false;

      // Both changesets are merged inside one pull-merge session, so merging cs1 leaves a pending
      // change behind while cs2 is merged. That used to turn the benign `dgn_Domain` conflict into
      // an abort and leave the briefcase stuck mid-merge. The conflict is now always resolved by
      // keeping the incoming row, so batching no longer changes the outcome.
      await b2.pullChanges({ accessToken });

      expect(b2.changeset.index).to.equal(2);
      expect(queryDomains(b2).filter((name) => name === "Functional")).to.have.lengthOf(1);
    } finally {
      b2.close();
    }
  });

  it("succeeds for a briefcase downloaded at the tip", async () => {
    const { iModelId } = await createTimelineWithDuplicateDomainRows("DgnDomainFreshBriefcase");
    const accessToken = await HubWrappers.getAccessToken(TestUserType.Regular);

    const b2 = await HubWrappers.downloadAndOpenBriefcase({ accessToken, iTwinId, iModelId, noLock: true });
    try {
      expect(b2.changeset.index).to.equal(2);
      expect(queryDomains(b2).filter((name) => name === "Functional")).to.have.lengthOf(1);
    } finally {
      b2.close();
    }
  });

  it("resolves the conflict when the TypeScript handler defers to the default handler", async () => {
    const { iModelId } = await createTimelineWithDuplicateDomainRows("DgnDomainNativeHandler");
    const accessToken = await HubWrappers.getAccessToken(TestUserType.Regular);

    // `IModelDb.onChangesetConflict` is consulted first and normally resolves this conflict.
    // Returning `undefined` hands the decision to the default handler in the addon, which is the
    // path taken by hosts that install no JavaScript handler, such as checkpoint creation and
    // change history. Both handlers must agree, otherwise the same changeset would apply in an
    // iTwin.js backend but be rejected by those services.
    const stub = sinon.stub(BriefcaseDb.prototype, "onChangesetConflict" as any).returns(undefined);
    const b2 = await HubWrappers.downloadAndOpenBriefcase({ accessToken, iTwinId, iModelId, asOf: { first: true }, noLock: true });
    try {
      await b2.pullChanges({ accessToken });

      expect(stub.called, "the default conflict handler should have been reached via the stub").to.be.true;
      expect(b2.changeset.index).to.equal(2);
      expect(queryDomains(b2).filter((name) => name === "Functional")).to.have.lengthOf(1);
    } finally {
      stub.restore();
      b2.close();
    }
  });
});
