/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { Suite } from "mocha";
import { CloudSqlite, IModelDb, IModelHost, ViewStore } from "@itwin/core-backend";
import { Guid, GuidString, Id64, Id64String } from "@itwin/core-bentley";
import { Code, IModel, ViewDefinitionProps } from "@itwin/core-common";
import { AzuriteTest } from "./AzuriteTest";

const viewContainer = "views-itwin1";

async function initializeContainer(containerId: string) {
  await AzuriteTest.Sqlite.createAzContainer({ containerId });
  const props: CloudSqlite.ContainerTokenProps = { baseUri: AzuriteTest.baseUri, storageType: "azure", containerId, writeable: true };
  const accessToken = await CloudSqlite.requestToken(props);
  await ViewStore.CloudAccess.initializeDb({ ...props, accessToken });
}

async function makeViewStore(moniker: string) {
  const props: CloudSqlite.ContainerTokenProps = { baseUri: AzuriteTest.baseUri, storageType: "azure", containerId: viewContainer, writeable: true };
  const accessToken = await CloudSqlite.requestToken(props);
  const propStore = new ViewStore.CloudAccess({ ...props, accessToken });
  propStore.setCache(CloudSqlite.CloudCaches.getCache({ cacheName: moniker }));
  propStore.lockParams.moniker = moniker;
  return propStore;
}

describe.only("ViewStore", function (this: Suite) {
  this.timeout(0);

  let vs1: ViewStore.CloudAccess;

  before(async () => {
    IModelHost.authorizationClient = new AzuriteTest.AuthorizationClient();
    AzuriteTest.userToken = AzuriteTest.service.userToken.readWrite;

    await initializeContainer(viewContainer);
    vs1 = await makeViewStore("viewStore1");
  });
  after(async () => {
    vs1.close();
    IModelHost.authorizationClient = undefined;
  });

  it("access ViewStore", async () => {
    const vs1locker = vs1.writeLocker;
    const vs1reader = vs1.reader;

    const viewDef: ViewDefinitionProps = {
      code: Code.createEmpty(),
      model: IModel.dictionaryId,
      classFullName: "spatial",
      categorySelectorId: "@1",
      displayStyleId: "@1",
    };
    viewDef.code.value = "view1";

    const guids: GuidString[] = [];
    const ids1: Id64String[] = [];
    const elements: IModelDb.GuidMapper = {
      getFederationGuidFromId(id: Id64String): GuidString | undefined {
        const index = ids1.indexOf(id);
        if (index >= 0)
          return guids[index];
        return undefined;
      },
      getIdFromFederationGuid(guid?: GuidString): Id64String | undefined {
        const index = guids.indexOf(guid!);
        if (index >= 0)
          return ids1[index];
        return undefined;
      },
    };
    for (let i = 0; i < 100; i++) {
      guids.push(Guid.createValue());
      ids1.push(Id64.fromLocalAndBriefcaseIds(i, 0));
    }

    const ms1Row = await vs1locker.addCategorySelector({ elements, categories: ["0x01", "0x22"] });
    expect(ms1Row).equals("@1");
    const ds1Row = await vs1locker.addDisplayStyle({ elements, className: "spatial", settings: { backgroundColor: 10 } });
    expect(ds1Row).equals("@1");

    expect(vs1reader.getViewByName({ name: "view1" })).to.be.undefined;
    const v1Id = await vs1locker.addViewDefinition({ elements, viewDef, owner: "owner1" });
    expect(v1Id).equals("@1");

    const v1 = vs1reader.getViewByName({ name: "view1" })!;
    expect(v1.owner).equals("owner1");
    expect(v1.className).equals("spatial");
    expect(v1.groupId).equals(ViewStore.defaultViewGroupId);
    expect(v1.shared).to.be.false;
    expect(v1.name).equals("view1");

    const g1 = await vs1locker.addViewGroup({ name: "group1", parentId: ViewStore.defaultViewGroupId });
    viewDef.code.value = "view2";
    viewDef.classFullName = "spatial2";
    const v2Id = await vs1locker.addViewDefinition({ elements, viewDef, owner: "owner2", groupId: g1 });
    expect(v2Id).equals("@2");

    expect(vs1reader.findViewsByClass(["spatial"]).length).equals(1);
    expect(vs1reader.findViewsByClass(["spatial2"]).length).equals(1);
    expect(vs1reader.findViewsByClass(["spatial", "spatial2", "blah"]).length).equals(2);
    expect(vs1reader.findViewsByClass([]).length).equals(0);
    expect(vs1reader.findViewsByClass(["blah"]).length).equals(0);
    expect(vs1reader.findViewsByOwner("owner1").length).equals(1);

    expect(vs1reader.getViewByName({ name: "view2", groupId: g1 })?.groupId).equals(g1);
    await vs1locker.deleteViewGroup(g1);
    expect(vs1reader.getViewByName({ name: "view2", groupId: g1 })).to.be.undefined;
  });
});
