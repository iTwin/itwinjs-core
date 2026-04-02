/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { GuidString } from "@itwin/core-bentley";
import { BriefcaseConnectionProps } from "@itwin/core-common";
import { assert } from "chai";
import { BriefcaseDb, BriefcaseManager } from "../../core-backend";
import { HubMock } from "../../internal/HubMock";
import { KnownTestLocations } from "../KnownTestLocations";

describe("BriefcaseDb", () => {
  let iTwinId: GuidString;

  before(() => {
    HubMock.startup("BriefcaseDbTest", KnownTestLocations.outputDir);
    iTwinId = HubMock.iTwinId;
  });

  after(() => HubMock.shutdown());

  describe("toJSON", () => {
    it("should include briefcaseId in the returned BriefcaseConnectionProps", async () => {
      const iModelId = await HubMock.createNewIModel({ iModelName: "ToJsonTest", iTwinId });
      const briefcaseProps = await BriefcaseManager.downloadBriefcase({ accessToken: "test token", iTwinId, iModelId });
      const db = await BriefcaseDb.open({ fileName: briefcaseProps.fileName });

      try {
        const json: BriefcaseConnectionProps = db.toJSON();

        assert.isDefined(json.briefcaseId);
        assert.equal(json.briefcaseId, db.briefcaseId);

        assert.isDefined(json.rootSubject);
        assert.isDefined(json.key);
        assert.isDefined(json.projectExtents);
      } finally {
        db.close();
      }
    });
  });
});
