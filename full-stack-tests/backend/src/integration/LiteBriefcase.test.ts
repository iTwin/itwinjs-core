/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/**
 * Integration tests for LiteBriefcaseDb — a lightweight briefcase for short-lived edit
 * sessions on a server or agent. Blocks stream on demand from a V2 checkpoint container;
 * the full briefcase is never downloaded to disk.
 *
 * Required environment variable (set in full-stack-tests/backend/.env):
 *   IMJS_TEST_PROJECT_NAME  – name of the iTwin to create the test iModel in
 *                             (same variable used by other integration tests)
 *
 * A fresh iModel is created by the manager user in `before()` and deleted in
 * `after()` so tests are fully self-contained and leave no permanent artifacts.
 *
 * No BCV daemon is required. V2CheckpointManager.attach falls back to daemonless
 * mode automatically when no `portnumber.bcv` is found: it passes cacheDir=undefined
 * to CloudCaches.getCache, which stores the local block cache under
 * IModelHost.profileDir. CloudSqlite then fetches blocks directly from Azure Blob
 * Storage — fully adequate for a single-process push/pull test.
 */

import { expect } from "chai";
import { BriefcaseDb, BriefcaseManager, IModelHost, LiteBriefcaseDb, V2CheckpointManager } from "@itwin/core-backend";
import { _hubAccess } from "@itwin/core-backend/lib/cjs/internal/Symbols";
import { withEditTxn } from "@itwin/core-backend/lib/cjs/test";
import { AccessToken, GuidString } from "@itwin/core-bentley";
import { ChangesetProps } from "@itwin/core-common";
import { TestUsers, TestUtility } from "@itwin/oidc-signin-tool";
import { HubUtility } from "../HubUtility";

import "./StartupShutdown"; // startup/shutdown IModelHost before/after all tests

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

const propNamespace = "LiteBriefcaseTest";
const iModelName = "LiteBriefcaseIntegrationTest";

describe("LiteBriefcaseDb", function () {
  // Tests hit real iModelHub; allow generous timeouts.
  this.timeout(5 * 60 * 1000);

  let accessToken: AccessToken;
  let managerToken: AccessToken;
  let iTwinId: GuidString;
  let iModelId: GuidString;

  // -------------------------------------------------------------------------
  // Suite setup / teardown
  // -------------------------------------------------------------------------

  before(async function () {
    // Skip the entire suite when the project name env var is absent —
    // same convention used by BriefcaseManager.test.ts and Checkpoints.test.ts.
    if (!process.env.IMJS_TEST_PROJECT_NAME) {
      this.skip();
      return;
    }

    accessToken = await TestUtility.getAccessToken(TestUsers.regular);
    managerToken = await TestUtility.getAccessToken(TestUsers.manager);

    // BriefcaseManager.pushChanges calls IModelHost.getAccessToken() (ignoring arg.accessToken),
    // so we configure authorizationClient so push operations use the regular user's token.
    IModelHost.authorizationClient = { getAccessToken: async () => TestUtility.getAccessToken(TestUsers.regular) };

    // Resolve the iTwin by name (reuses the same project as other integration tests).
    iTwinId = await HubUtility.getTestITwinId(accessToken);

    // Create a dedicated iModel so these tests are fully self-contained.
    // Clean up any leftover from a previously crashed run first.
    const existingId = await IModelHost[_hubAccess].queryIModelByName({ accessToken: managerToken, iTwinId, iModelName });
    if (existingId)
      await IModelHost[_hubAccess].deleteIModel({ accessToken: managerToken, iTwinId, iModelId: existingId });

    iModelId = await IModelHost[_hubAccess].createNewIModel({
      accessToken: managerToken,
      iTwinId,
      iModelName,
      description: "Temporary iModel for LiteBriefcaseDb integration tests — safe to delete",
    });
  });

  after(async () => {
    // Always clean up cloud containers first, then remove the hub iModel.
    IModelHost.authorizationClient = undefined;
    V2CheckpointManager.cleanup();
    if (iModelId)
      await IModelHost[_hubAccess].deleteIModel({ accessToken: managerToken, iTwinId, iModelId });
  });

  afterEach(() => {
    V2CheckpointManager.cleanup();
  });

  // -------------------------------------------------------------------------
  // Tests
  // -------------------------------------------------------------------------

  /**
   * Scenario A: LiteBriefcaseDb → Regular BriefcaseDb
   *
   * 1. Open a LiteBriefcaseDb at the current tip (no full download required).
   * 2. Write a file property and push to iModelHub.
   * 3. Open a regular BriefcaseDb as a second "user" and pull.
   * 4. Verify the property is visible on the regular briefcase.
   */
  it("should push a change from LiteBriefcaseDb and pull it on a regular BriefcaseDb", async () => {
    const propName = "lite-to-regular";
    const propValue = `written-by-lite-${Date.now()}`;

    // -- Open lite briefcase at the current tip (streams blocks on demand) ---
    const latestChangeset = await IModelHost[_hubAccess].getLatestChangeset({ accessToken, iModelId });
    const liteDb = await LiteBriefcaseDb.openFromCheckpoint({
      accessToken,
      checkpoint: {
        accessToken,
        iTwinId,
        iModelId,
        changeset: { id: latestChangeset.id, index: latestChangeset.index },
        expectV2: true,
        allowPreceding: true, // accept the seed checkpoint for a brand-new iModel
      },
    });

    try {
      // Verify instance type and isLiteBriefcase property
      expect(liteDb).to.be.instanceOf(LiteBriefcaseDb);
      expect(liteDb.isLiteBriefcase).to.be.true;

      withEditTxn(liteDb, `LiteBriefcaseDb: write ${propName}`, (txn) => {
        txn.saveFileProperty({ namespace: propNamespace, name: propName }, propValue);
      });
      await liteDb.pushChanges({ accessToken, description: `LiteBriefcaseDb integration test: ${propName}` });
      expect(liteDb.changeset.id).to.not.be.empty;
    } finally {
      liteDb.close();
    }

    // -- Open a regular BriefcaseDb and pull to pick up the pushed changeset -
    const briefcaseProps = await BriefcaseManager.downloadBriefcase({ accessToken, iTwinId, iModelId });
    const regularDb = await BriefcaseDb.open({ fileName: briefcaseProps.fileName });
    try {
      await regularDb.pullChanges({ accessToken });
      const readBack = regularDb.queryFilePropertyString({ namespace: propNamespace, name: propName });
      expect(readBack).to.equal(propValue, "regular BriefcaseDb should see the property pushed from LiteBriefcaseDb");
    } finally {
      regularDb.close();
      await BriefcaseManager.deleteBriefcaseFiles(briefcaseProps.fileName, accessToken);
    }
  });

  /**
   * Scenario B: Regular BriefcaseDb → LiteBriefcaseDb
   *
   * 1. Open a regular BriefcaseDb, write a file property and push.
   * 2. Open a LiteBriefcaseDb one changeset behind the push.
   * 3. Pull changes and verify the property is visible.
   */
  it("should pull a change from a regular BriefcaseDb into a LiteBriefcaseDb", async () => {
    const propName = "regular-to-lite";
    const propValue = `written-by-regular-${Date.now()}`;

    // -- Open regular briefcase, write and push ------------------------------
    const briefcaseProps = await BriefcaseManager.downloadBriefcase({ accessToken, iTwinId, iModelId });
    const regularDb = await BriefcaseDb.open({ fileName: briefcaseProps.fileName });
    let pushedChangesetId: string;
    try {
      await regularDb.pullChanges({ accessToken }); // sync to tip first
      withEditTxn(regularDb, `Regular BriefcaseDb: write ${propName}`, (txn) => {
        txn.saveFileProperty({ namespace: propNamespace, name: propName }, propValue);
      });
      await regularDb.pushChanges({ accessToken, description: `Regular BriefcaseDb integration test: ${propName}` });
      pushedChangesetId = regularDb.changeset.id;
      expect(pushedChangesetId).to.not.be.empty;
    } finally {
      regularDb.close();
      await BriefcaseManager.deleteBriefcaseFiles(briefcaseProps.fileName, accessToken);
    }

    // -- Open LiteBriefcaseDb one changeset behind the push so pullChanges
    //    has something to fetch. No full download needed — blocks stream on demand.
    const changesets = await IModelHost[_hubAccess].queryChangesets({ accessToken, iModelId });
    const pushedIndex = changesets.findIndex((cs: ChangesetProps) => cs.id === pushedChangesetId);
    const precedingChangeset: Pick<ChangesetProps, "id" | "index"> = pushedIndex > 0
      ? changesets[pushedIndex - 1]
      : { id: "", index: 0 };

    const liteDb = await LiteBriefcaseDb.openFromCheckpoint({
      accessToken,
      checkpoint: {
        accessToken,
        iTwinId,
        iModelId,
        changeset: { id: precedingChangeset.id, index: precedingChangeset.index },
        expectV2: true,
        allowPreceding: true,
      },
    });

    try {
      await liteDb.pullChanges({ accessToken });
      const readBack = liteDb.queryFilePropertyString({ namespace: propNamespace, name: propName });
      expect(readBack).to.equal(propValue, "LiteBriefcaseDb should see the property pushed from the regular BriefcaseDb");
    } finally {
      liteDb.close();
    }
  });
});
