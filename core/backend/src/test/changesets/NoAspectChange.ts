/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import * as path from "path";
import {
  ChangeSummaryManager, ExternalSourceAspect, HubMock, IModelDb, IModelHost, IModelJsFs, NativeLoggerCategory, SnapshotDb
} from "../../core-backend";

import { AccessToken, DbResult, Guid, GuidString, Id64, Id64String, Logger, LogLevel } from "@itwin/core-bentley";
import { ExternalSourceAspectProps, IModel } from "@itwin/core-common";
import { KnownTestLocations } from "../KnownTestLocations";
import * as TestUtils from "../IModelTestUtils";

import { advancedDeepEqual } from "../AdvancedEqual";

describe.only("NoAspectChange", () => {
  const outputDir = path.join(KnownTestLocations.outputDir, "IModelTransformerHub");
  let iTwinId: GuidString;
  let accessToken: AccessToken;

  before(async () => {
    HubMock.startup("IModelChangesetsHub", KnownTestLocations.outputDir);
    iTwinId = HubMock.iTwinId;
    IModelJsFs.recursiveMkDirSync(outputDir);

    accessToken = await TestUtils.HubWrappers.getAccessToken(TestUtils.TestUserType.Regular);

    // initialize logging
    Logger.initializeToConsole();
    Logger.setLevelDefault(LogLevel.Error);
  });

  after(() => HubMock.shutdown());

  it.only("test 1", async () => {
    // Create and push seed of source IModel
    const iModelName = "TransformerSource";
    const seedFileName = path.join(outputDir, `${iModelName}.bim`);
    if (IModelJsFs.existsSync(seedFileName))
      IModelJsFs.removeSync(seedFileName);

    const seedDb = SnapshotDb.createEmpty(seedFileName, { rootSubject: { name: "TransformerSource" } });
    assert.isTrue(IModelJsFs.existsSync(seedFileName));
    const aspectProps: ExternalSourceAspectProps = {
      classFullName: ExternalSourceAspect.classFullName,
      element: { id: IModelDb.rootSubjectId },
      scope: { id: IModel.rootSubjectId },
      identifier: "anything",
      kind: ExternalSourceAspect.Kind.Scope,
    };
    seedDb.elements.insertAspect(aspectProps);
    seedDb.saveChanges();
    seedDb.close();

    const iModelId = await IModelHost.hubAccess.createNewIModel({ iTwinId, iModelName, description: "imodel", version0: seedFileName, noLocks: true });

    const db = await TestUtils.HubWrappers.downloadAndOpenBriefcase({ accessToken, iTwinId, iModelId });

    // modify the aspect here
    aspectProps.version = "new";
    db.elements.updateAspect(aspectProps);
    db.saveChanges();
    await db.pushChanges({ accessToken, description: "Update target scope element's external source aspect's version" });

    const _changeSummaryId = await ChangeSummaryManager.createChangeSummary(accessToken, db);
    ChangeSummaryManager.attachChangeCache(db);

    const targetScopeElementAspects = db.elements.getAspects(IModelDb.rootSubjectId);
    expect(targetScopeElementAspects).to.have.length(1);

    const changes = db.withStatement("SELECT * FROM ecchange.change.InstanceChange", s=>[...s]);
    expect(changes.length === 2);
    expect(
      advancedDeepEqual(
        changes,
        [
          // FIXME: where is the aspect update? why only updating the lastMod on the targetScopeElement?
          { changedInstance: { id: "0x1" }, opCode: 2, isIndirect: false },
          { changedInstance: { id: "0x1" }, opCode: 2, isIndirect: true },
        ],
      )
    )

    ChangeSummaryManager.detachChangeCache(db);
  });
});
