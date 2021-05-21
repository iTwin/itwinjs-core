/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import { join } from "path";
import { Guid } from "@bentley/bentleyjs-core";
import { ChangesType } from "@bentley/imodelhub-client";
import { IModelJsFs } from "../../IModelJsFs";
import { HubMock } from "../HubMock";
import { IModelTestUtils } from "../IModelTestUtils";
import { KnownTestLocations } from "../KnownTestLocations";

describe.only("HubMock", () => {
  const mockRoot = join(KnownTestLocations.outputDir, "HubMockTest");
  const tmpDir = join(mockRoot, "temp");

  before(() => HubMock.startup(mockRoot));
  after(() => HubMock.shutdown());

  it("should be able to create HubMock", async () => {
    const revision0 = IModelTestUtils.resolveAssetFile("test.bim");
    const iModelId = Guid.createValue();

    HubMock.create({ contextId: Guid.createValue(), iModelId, iModelName: "test imodel", revision0 });

    const mock = HubMock.findMock(iModelId);
    const checkpoints = mock.getCheckpoints();
    assert.equal(checkpoints.length, 1);
    assert.equal(checkpoints[0], "0");

    const cp1 = join(tmpDir, "cp-1.bim");
    mock.downloadCheckpoint({ id: "0", targetFile: cp1 });
    const stat1 = IModelJsFs.lstatSync(cp1);
    const statRev0 = IModelJsFs.lstatSync(revision0);
    assert.equal(stat1?.size, statRev0?.size);

    assert.equal(2, mock.acquireNewBriefcaseId("user1"));
    assert.equal(3, mock.acquireNewBriefcaseId("user2"));
    assert.equal(4, mock.acquireNewBriefcaseId("user3"));

    let briefcases = mock.getBriefcaseIds();
    assert.equal(briefcases.length, 3);
    assert.deepEqual(briefcases[0], { id: 2, user: "user1" });
    assert.deepEqual(briefcases[1], { id: 3, user: "user2" });
    assert.deepEqual(briefcases[2], { id: 4, user: "user3" });

    mock.releaseBriefcaseId(2);
    briefcases = mock.getBriefcaseIds();
    assert.equal(briefcases.length, 2);
    assert.deepEqual(briefcases[0], { id: 3, user: "user2" });
    assert.deepEqual(briefcases[1], { id: 4, user: "user3" });

    mock.releaseBriefcaseId(4);
    briefcases = mock.getBriefcaseIds();
    assert.equal(briefcases.length, 1);
    assert.deepEqual(briefcases[0], { id: 3, user: "user2" });

    assert.equal(5, mock.acquireNewBriefcaseId("user4"));
    briefcases = mock.getBriefcaseIds();
    assert.equal(briefcases.length, 2);
    assert.deepEqual(briefcases[0], { id: 3, user: "user2" });
    assert.deepEqual(briefcases[1], { id: 5, user: "user4" });

    const cs1 = { id: "changeset0", description: "first changeset", changesType: ChangesType.Regular, pathname: IModelTestUtils.resolveAssetFile("CloneTest.01.00.00.ecschema.xml") };
    mock.addChangeset(cs1);
    const changesets1 = mock.getChangesets();
    assert.equal(changesets1.length, 1);
    assert.equal(changesets1[0].id, cs1.id);
    assert.equal(changesets1[0].description, cs1.description);
    assert.equal(changesets1[0].changesType, cs1.changesType);
    assert.equal(changesets1[0].index, 1);
    assert.isAtLeast(changesets1[0].size!, 1);
    assert.isUndefined(changesets1[0].parentId);
    assert.isDefined(changesets1[0].pushDate);
    assert.equal(cs1.id, mock.getLatestChangesetId());

    const cs2 = { id: "changeset1", parentId: "changeset0", description: "second changeset", changesType: ChangesType.Schema, pathname: IModelTestUtils.resolveAssetFile("CloneTest.01.00.01.ecschema.xml") };
    mock.addChangeset(cs2);
    const changesets2 = mock.getChangesets();
    assert.equal(changesets2.length, 2);
    assert.deepEqual(changesets1[0], changesets2[0]);
    assert.equal(changesets2[1].id, cs2.id);
    assert.equal(changesets2[1].parentId, cs2.parentId);
    assert.equal(changesets2[1].description, cs2.description);
    assert.equal(changesets2[1].changesType, cs2.changesType);
    assert.equal(changesets2[1].index, 2);
    assert.isAtLeast(changesets2[1].size!, 1);
    assert.isDefined(changesets2[1].pushDate);
    assert.equal(cs2.id, mock.getLatestChangesetId());

    const version1 = "release 1";
    const version2 = "release 2";
    mock.addNamedVersion({ versionName: version1, id: cs1.id });
    mock.addNamedVersion({ versionName: version2, id: cs2.id });
    assert.equal(mock.findNamedVersion(version1), cs1.id);
    expect(() => mock.findNamedVersion("not there")).throws("not found");
    expect(() => mock.addNamedVersion({ versionName: version2, id: cs2.id })).throws("insert");
    mock.deleteNamedVersion(version1);
    expect(() => mock.findNamedVersion(version1)).throws("not found");

    // test for duplicate changeset id
    const cs3 = { id: "changeset0", parentId: "changeset1", description: "third changeset", changesType: ChangesType.Regular, pathname: cs1.pathname };
    expect(() => mock.addChangeset(cs3)).throws("can't insert");
    // now test for valid changeset id, but bad parentId
    const cs4 = { id: "changeset4", parentId: "bad", description: "fourth changeset", changesType: ChangesType.Regular, pathname: cs1.pathname };
    expect(() => mock.addChangeset(cs4)).throws("can't insert");

    const out1 = join(tmpDir, "cs1-out");
    mock.downloadChangeset({ id: cs1.id, targetFile: out1 });
    const orig1 = IModelJsFs.readFileSync(cs1.pathname);
    const downloaded1 = IModelJsFs.readFileSync(out1);
    assert.deepEqual(orig1, downloaded1);
    const out2 = join(tmpDir, "cs2-out");
    mock.downloadChangeset({ id: cs2.id, targetFile: out2 });
    const orig2 = IModelJsFs.readFileSync(cs2.pathname);
    const downloaded2 = IModelJsFs.readFileSync(out2);
    assert.deepEqual(orig2, downloaded2);
    assert.notDeepEqual(orig1, orig2);
  });

});
