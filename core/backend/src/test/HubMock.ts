/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { join } from "path";
import * as sinon from "sinon";
import type { GuidString } from "@itwin/core-bentley";
import { Guid } from "@itwin/core-bentley";
import type {
  ChangesetFileProps, ChangesetIndex, ChangesetIndexAndId, ChangesetProps, ChangesetRange, IModelVersion, LocalDirName,
} from "@itwin/core-common";
import type {
  BackendHubAccess, BriefcaseDbArg, BriefcaseIdArg, ChangesetArg, ChangesetRangeArg, CheckpointArg, CreateNewIModelProps, IModelIdArg, IModelNameArg,
  LockMap, LockProps, V2CheckpointAccessProps,
} from "../BackendHubAccess";
import type { CheckpointProps } from "../CheckpointManager";
import { IModelHost } from "../IModelHost";
import type { AcquireNewBriefcaseIdArg, TokenArg } from "../core-backend";
import { IModelJsFs } from "../IModelJsFs";
import { KnownTestLocations } from "./KnownTestLocations";
import { LocalHub } from "./LocalHub";

/**
 * Mocks iModelHub for testing creating Briefcases, downloading checkpoints, and simulating multiple users pushing and pulling changesets, etc.
 *
 * Generally, tests for apis that *create or modify* iModels can and should be mocked. Otherwise they:
 * - create tremendous load on the test servers when they run on programmer's desktops and in CI jobs
 * - waste network and data center resources (i.e. $$$s),
 * - interfere with other tests running on the same or other systems, and
 * - (far worse) are the source of test flakiness outside of the api being tested.
 *
 * This class can be used to create tests that do not require authentication, are synchronous,
 * are guaranteed to be self-contained (i.e. do not interfere with other tests running at the same time or later), and do not fail for reasons outside
 * of the control of the test itself. As a bonus, in addition to making tests more reliable, mocking IModelHub generally makes tests run *much* faster.
 *
 * On the other hand, tests that expect to find an existing iModels, checkpoints, changesets, etc. in IModelHub cannot be mocked. In that case, those tests
 * should be careful to NOT modify the data, since doing so causes interference with other tests running simultaneously. These tests should be limited to
 * low level testing of the core apis only.
 *
 * To initialize HubMock, call [[startup]] at the beginning of your test, usually in `describe.before`. Thereafter, all access to iModelHub for an iModel will be
 * directed to a [[LocalHub]] - your test code does not change. After the test(s) complete, call [[shutdown]] (usually in `describe.after`) to stop mocking IModelHub and clean
 * up any resources used by the test(s). If you want to mock a single test, call [[startup]] as the first line and [[shutdown]] as the last. If you wish to run the
 * test against a "real" IModelHub, you can simply comment off the call [[startup]], though in that case you should make sure the name of your
 * iModel is unique so your test won't collide with other tests (iModel name uniqueness is not necessary for mocked tests.)
 *
 * Mocked tests must always start by creating a new iModel via [[IModelHost.hubAccess.createNewIModel]] with a `version0` iModel.
 * They use mock (aka "bogus") credentials for `AccessTokens`, which is fine since [[HubMock]] never accesses resources outside the current
 * computer.
 *
 * @note Only one HubMock at a time, *running in a single process*, may be active. The comments above about multiple simultaneous tests refer to tests
 * running on different computers, or on a single computer in multiple processes. All of those scenarios are problematic without mocking.
 *
 * @internal
 */
export class HubMock {
  private static mockRoot: LocalDirName | undefined;
  private static hubs = new Map<string, LocalHub>();
  private static _saveHubAccess: BackendHubAccess;
  private static _iTwinId: GuidString | undefined;

  /** Determine whether a test us currently being run under HubMock */
  public static get isValid() { return undefined !== this.mockRoot; }

  public static get iTwinId() {
    if (undefined === this._iTwinId)
      throw new Error("Either a previous test did not call HubMock.shutdown() properly, or more than one test is simultaneously attempting to use HubMock, which is not allowed");
    return this._iTwinId;
  }

  /**
   * Begin mocking IModelHub access. After this call, all access to IModelHub will be directed to a [[LocalHub]].
   * @param mockName a unique name (e.g. "MyTest") for this HubMock to disambiguate tests when more than one is simultaneously active.
   * It is used to create a private directory used by the HubMock for a test. That directory is removed when [[shutdown]] is called.
   */
  public static startup(mockName: LocalDirName) {
    if (this.isValid)
      throw new Error("Either a previous test did not call HubMock.shutdown() properly, or more than one test is simultaneously attempting to use HubMock, which is not allowed");

    this.hubs.clear();
    this.mockRoot = join(KnownTestLocations.outputDir, "HubMock", mockName);
    IModelJsFs.recursiveMkDirSync(this.mockRoot);
    IModelJsFs.purgeDirSync(this.mockRoot);
    this._saveHubAccess = IModelHost.hubAccess;
    IModelHost.setHubAccess(this);
    HubMock._iTwinId = Guid.createValue(); // all iModels for this test get the same "iTwinId"
  }

  /** Stop a HubMock that was previously started with [[startup]]
   * @note this function throws an exception if any of the iModels used during the tests are left open.
   */
  public static shutdown() {
    if (!this.isValid)
      return;

    HubMock._iTwinId = undefined;
    for (const hub of this.hubs)
      hub[1].cleanup();

    this.hubs.clear();
    IModelJsFs.purgeDirSync(this.mockRoot!);
    IModelJsFs.removeSync(this.mockRoot!);
    sinon.restore();
    IModelHost.setHubAccess(this._saveHubAccess);
    this.mockRoot = undefined;
  }

  public static findLocalHub(iModelId: GuidString): LocalHub {
    const hub = this.hubs.get(iModelId);
    if (!hub)
      throw new Error(`local hub for iModel ${iModelId} not created`);
    return hub;
  }

  /** create a [[LocalHub]] for an iModel.  */
  public static async createNewIModel(arg: CreateNewIModelProps): Promise<GuidString> {
    if (!this.mockRoot)
      throw new Error("call startup first");

    const props = { ...arg, iModelId: Guid.createValue() };
    const mock = new LocalHub(join(this.mockRoot, props.iModelId), props);
    this.hubs.set(props.iModelId, mock);
    return props.iModelId;
  }

  /** remove the [[LocalHub]] for an iModel */
  public static destroy(iModelId: GuidString) {
    this.findLocalHub(iModelId).cleanup();
    this.hubs.delete(iModelId);
  }

  /** All methods below are mocks of the [[BackendHubAccess]] interface */

  public static async getChangesetFromNamedVersion(arg: IModelIdArg & { versionName: string }): Promise<ChangesetProps> {
    return this.findLocalHub(arg.iModelId).findNamedVersion(arg.versionName);
  }

  private static changesetIndexFromArg(arg: ChangesetArg) {
    return (undefined !== arg.changeset.index) ? arg.changeset.index : this.findLocalHub(arg.iModelId).getChangesetIndex(arg.changeset.id);
  }

  public static async getChangesetFromVersion(arg: IModelIdArg & { version: IModelVersion }): Promise<ChangesetProps> {
    const hub = this.findLocalHub(arg.iModelId);
    const version = arg.version;
    if (version.isFirst)
      return hub.getChangesetByIndex(0);

    const asOf = version.getAsOfChangeSet();
    if (asOf)
      return hub.getChangesetById(asOf);

    const versionName = version.getName();
    if (versionName)
      return hub.findNamedVersion(versionName);

    return hub.getLatestChangeset();
  }

  public static async getLatestChangeset(arg: IModelIdArg): Promise<ChangesetProps> {
    return this.findLocalHub(arg.iModelId).getLatestChangeset();
  }

  private static async getAccessToken(arg: TokenArg) {
    return arg.accessToken ?? await IModelHost.getAccessToken();
  }

  public static async getMyBriefcaseIds(arg: IModelIdArg): Promise<number[]> {
    const accessToken = await this.getAccessToken(arg);
    return this.findLocalHub(arg.iModelId).getBriefcaseIds(accessToken);
  }

  public static async acquireNewBriefcaseId(arg: AcquireNewBriefcaseIdArg): Promise<number> {
    const accessToken = await this.getAccessToken(arg);
    return this.findLocalHub(arg.iModelId).acquireNewBriefcaseId(accessToken, arg.briefcaseAlias);
  }

  /** Release a briefcaseId. After this call it is illegal to generate changesets for the released briefcaseId. */
  public static async releaseBriefcase(arg: BriefcaseIdArg): Promise<void> {
    return this.findLocalHub(arg.iModelId).releaseBriefcaseId(arg.briefcaseId);
  }

  public static async downloadChangeset(arg: ChangesetArg & { targetDir: LocalDirName }): Promise<ChangesetFileProps> {
    return this.findLocalHub(arg.iModelId).downloadChangeset({ index: this.changesetIndexFromArg(arg), targetDir: arg.targetDir });
  }

  public static async downloadChangesets(arg: ChangesetRangeArg & { targetDir: LocalDirName }): Promise<ChangesetFileProps[]> {
    return this.findLocalHub(arg.iModelId).downloadChangesets({ range: arg.range, targetDir: arg.targetDir });
  }

  public static async queryChangeset(arg: ChangesetArg): Promise<ChangesetProps> {
    return this.findLocalHub(arg.iModelId).getChangesetByIndex(this.changesetIndexFromArg(arg));
  }

  public static async queryChangesets(arg: IModelIdArg & { range?: ChangesetRange }): Promise<ChangesetProps[]> {
    return this.findLocalHub(arg.iModelId).queryChangesets(arg.range);
  }

  public static async pushChangeset(arg: IModelIdArg & { changesetProps: ChangesetFileProps }): Promise<ChangesetIndex> {
    return this.findLocalHub(arg.iModelId).addChangeset(arg.changesetProps);
  }

  public static async queryV2Checkpoint(_arg: CheckpointProps): Promise<V2CheckpointAccessProps | undefined> {
    return undefined;
  }

  public static async downloadV2Checkpoint(arg: CheckpointArg): Promise<ChangesetIndexAndId> {
    return this.findLocalHub(arg.checkpoint.iModelId).downloadCheckpoint({ changeset: arg.checkpoint.changeset, targetFile: arg.localFile });
  }

  public static async downloadV1Checkpoint(arg: CheckpointArg): Promise<ChangesetIndexAndId> {
    return this.findLocalHub(arg.checkpoint.iModelId).downloadCheckpoint({ changeset: arg.checkpoint.changeset, targetFile: arg.localFile });
  }

  public static async releaseAllLocks(arg: BriefcaseDbArg) {
    const hub = this.findLocalHub(arg.iModelId);
    hub.releaseAllLocks({ briefcaseId: arg.briefcaseId, changesetIndex: hub.getIndexFromChangeset(arg.changeset) });
  }

  public static async queryAllLocks(_arg: BriefcaseDbArg): Promise<LockProps[]> {
    return [];
  }

  public static async acquireLocks(arg: BriefcaseDbArg, locks: LockMap): Promise<void> {
    this.findLocalHub(arg.iModelId).acquireLocks(locks, arg);
  }

  public static async queryIModelByName(arg: IModelNameArg): Promise<GuidString | undefined> {
    for (const hub of this.hubs) {
      const localHub = hub[1];
      if (localHub.iTwinId === arg.iTwinId && localHub.iModelName === arg.iModelName)
        return localHub.iModelId;
    }
    return undefined;
  }

  public static async deleteIModel(arg: IModelIdArg & { iTwinId: GuidString }): Promise<void> {
    return this.destroy(arg.iModelId);
  }
}
