/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import {
  Code,
  GeometricElement3dProps,
  IModel, SubCategoryAppearance
} from "@itwin/core-common";
import * as chai from "chai";
import { assert } from "chai";
import * as chaiAsPromised from "chai-as-promised";
import { HubWrappers, KnownTestLocations } from "..";
import {
  ChannelControl,
  DictionaryModel,
  IModelHost,
  SpatialCategory
} from "../../core-backend";
import { HubMock } from "../../internal/HubMock";
import { IModelTestUtils, TestUserType } from "../IModelTestUtils";
import { Suite } from "mocha";
chai.use(chaiAsPromised);

describe("imodel limits", function (this: Suite) {
  const ctx = {
    accessTokens: {
      user1: "",
      user2: "",
      user3: "",
    },
    iModelId: "",
    iTwinId: "",
    modelId: "",
    spatialCategoryId: "",
    iModelName: "TestIModel",
    rootSubject: "TestSubject",
    openBriefcase: async (user: "user1" | "user2" | "user3", noLock?: true) => {
      const b = await HubWrappers.downloadAndOpenBriefcase({ accessToken: ctx.accessTokens[user], iTwinId: ctx.iTwinId, iModelId: ctx.iModelId, noLock });
      b.channels.addAllowedChannel(ChannelControl.sharedChannelName);
      return b;
    },
    openB1: async (noLock?: true) => { return ctx.openBriefcase("user1", noLock); },
    openB2: async (noLock?: true) => { return ctx.openBriefcase("user2", noLock); },
    openB3: async (noLock?: true) => { return ctx.openBriefcase("user3", noLock); },
  }

  before(async () => {
    await IModelHost.startup();
    HubMock.startup("PullMergeMethod", KnownTestLocations.outputDir);
  });

  after(async () => {
    HubMock.shutdown()
  });

  beforeEach(async () => {
    ctx.iTwinId = HubMock.iTwinId;
    ctx.accessTokens.user1 = await HubWrappers.getAccessToken(TestUserType.SuperManager);
    ctx.accessTokens.user2 = await HubWrappers.getAccessToken(TestUserType.Regular);
    ctx.accessTokens.user3 = await HubWrappers.getAccessToken(TestUserType.Super);
    ctx.iModelId = await HubMock.createNewIModel({ accessToken: ctx.accessTokens.user1, iTwinId: ctx.iTwinId, iModelName: ctx.iModelName, description: ctx.rootSubject });
    assert.isNotEmpty(ctx.iModelId);
    const b1 = await ctx.openB1(true);
    await b1.locks.acquireLocks({ shared: IModel.dictionaryId });
    [, ctx.modelId] = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(
      b1,
      IModelTestUtils.getUniqueModelCode(b1, "newPhysicalModel"),
      true);
    const dictionary: DictionaryModel = b1.models.getModel<DictionaryModel>(IModel.dictionaryId);
    const newCategoryCode = IModelTestUtils.getUniqueSpatialCategoryCode(dictionary, "ThisTestSpatialCategory");
    ctx.spatialCategoryId = SpatialCategory.insert(
      dictionary.iModel,
      dictionary.id,
      newCategoryCode.value,
      new SubCategoryAppearance({ color: 0xff0000 }),
    );
    b1.saveChanges();
    await b1.pushChanges({ description: "" });
    b1.close();
  });

  it("apply changes where max columns for class is used", async () => {
    const b1 = await ctx.openB1(true);
    const b2 = await ctx.openB2(true);

    // Import schema into b1 but do not push it.
    const createSchema = (additionProps: number) => {
      const schema = [
        `<?xml version="1.0" encoding="UTF-8"?>`,
        `<ECSchema schemaName="TestSchema1" alias="ts" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">`,
        ` <ECSchemaReference name="BisCore" version="01.00.00" alias="bis"/>`,
        ` <ECEntityClass typeName="Pipe1">`,
        `   <BaseClass>bis:GeometricElement3d</BaseClass>`,
      ];

      for (let i = 0; i < additionProps; i++) {
        schema.push(`   <ECProperty propertyName="p${i}" typeName="int" />`);
      }

      schema.push(...[
        ` </ECEntityClass>`,
        `</ECSchema>`
      ]);
      return schema.join("\n");
    }

    const schemaThatMaxOutColumnsLimit = 2030;

    await b1.importSchemaStrings([createSchema(schemaThatMaxOutColumnsLimit)]);
    b1.saveChanges();
    await b1.pushChanges({ description: "import schema" });

    const elementProps: GeometricElement3dProps = {
      classFullName: "TestSchema1:Pipe1",
      model: ctx.modelId,
      category: ctx.spatialCategoryId,
      code: Code.createEmpty(),
    };
    const el = b1.elements.createElement(elementProps);
    b1.elements.insertElement(el.toJSON());
    b1.saveChanges();
    await b1.pushChanges({ description: "add element" });

    // Error applying changeset with id [22f762181d236dfe25bb32e38ed3b7509e975deb]: failed to apply changes
    // Expression depth is 2001 where current limit is 2000
    await b2.pullChanges();

    b1.close();
    b2.close();

    HubMock.shutdown();
  });
});
