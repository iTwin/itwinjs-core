/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import { Suite } from "mocha";
import { _nativeDb, BriefcaseDb, IModelHost } from "@itwin/core-backend";
import { AzuriteTest } from "./AzuriteTest";
import { HubMock } from "@itwin/core-backend/lib/cjs/internal/HubMock";
import { HubWrappers, KnownTestLocations } from "@itwin/core-backend/lib/cjs/test";
import { Guid } from "@itwin/core-bentley";

describe.only("Schema lock tests", function (this: Suite) {
  this.timeout(0);

  before(async () => {
    IModelHost.authorizationClient = new AzuriteTest.AuthorizationClient();
    // AzuriteTest.userToken = AzuriteTest.service.userToken.readWrite;
  });

  after(async () => {
    IModelHost.authorizationClient = undefined;
  });
  it("multi user workflow", async () => {
    const iModelName = "SchemaLockMultiUserTest";
    const iTwinId = Guid.createValue();
    const user1AccessToken = "token 1";
    const user2AccessToken = "token 2";
    let user1Briefcase: BriefcaseDb | undefined;
    let user2Briefcase: BriefcaseDb | undefined;

    HubMock.startup("test", KnownTestLocations.outputDir);

    try {
      const iModelId = await HubMock.createNewIModel({ iTwinId, iModelName, description: "TestSubject", accessToken: user1AccessToken });
      assert.isNotEmpty(iModelId);
      user1Briefcase = await HubWrappers.downloadAndOpenBriefcase({ iTwinId, iModelId, accessToken: user1AccessToken });

      const schema = `<?xml version="1.0" encoding="UTF-8"?>
      <ECSchema schemaName="TestDomain" alias="ts" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
          <ECSchemaReference name="BisCore" version="01.00.23" alias="bis"/>
          <ECEntityClass typeName="Test2dElement">
              <BaseClass>bis:GraphicalElement2d</BaseClass>
              <ECProperty propertyName="MyProperty" typeName="string"/>
          </ECEntityClass>
      </ECSchema>`;
      await user1Briefcase.importSchemaStrings([schema]);
      // rwIModel.channels.addAllowedChannel(ChannelControl.sharedChannelName); Needed?
      user1Briefcase.saveChanges();
      await user1Briefcase.pushChanges({ description: "import schema", accessToken: user1AccessToken });

      // Open briefcase as user 2.
      user2Briefcase = await HubWrappers.downloadAndOpenBriefcase({ iTwinId, iModelId, accessToken: user2AccessToken });
      const updatedSchemaUser2 = `<?xml version="1.0" encoding="UTF-8"?>
      <ECSchema schemaName="TestDomain" alias="ts" version="01.00.01" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
          <ECSchemaReference name="BisCore" version="01.00.23" alias="bis"/>
          <ECEntityClass typeName="Test2dElement">
              <BaseClass>bis:GraphicalElement2d</BaseClass>
              <ECProperty propertyName="MyProperty" typeName="string"/>
              <ECProperty propertyName="MyPropertyForUser2" typeName="string"/>
          </ECEntityClass>
      </ECSchema>`;
      await user2Briefcase.importSchemaStrings([updatedSchemaUser2]);
      user2Briefcase.saveChanges();

      const updatedSchemaUser1 = `<?xml version="1.0" encoding="UTF-8"?>
      <ECSchema schemaName="TestDomain" alias="ts" version="01.00.01" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
          <ECSchemaReference name="BisCore" version="01.00.23" alias="bis"/>
          <ECEntityClass typeName="Test2dElement">
              <BaseClass>bis:GraphicalElement2d</BaseClass>
              <ECProperty propertyName="MyProperty" typeName="string"/>
              <ECProperty propertyName="MyPropertyForUser1" typeName="string"/>
          </ECEntityClass>
      </ECSchema>`;
      await user1Briefcase.importSchemaStrings([updatedSchemaUser1]);
      user1Briefcase.saveChanges();

      // Push changes from user 1
      await user1Briefcase.pushChanges({ description: "update schema from user 1", accessToken: user1AccessToken });

      // Now try to push changes from user 2 - should get a schema conflict
      await expect(user2Briefcase.pushChanges({ description: "update schema from user 2", accessToken: user2AccessToken }))
        .to.be.rejectedWith("Failed something something");

    } finally {
      user1Briefcase?.close();
      user2Briefcase?.close();
      HubMock.shutdown();
    }
  });
});
