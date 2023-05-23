/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { Suite } from "mocha";
import { CloudSqlite, IModelHost, ViewStore } from "@itwin/core-backend";
import { AzuriteTest } from "./AzuriteTest";

const viewContainer = "views-itwin1";

async function initializeContainer(containerId: string) {
  await AzuriteTest.Sqlite.createAzContainer({ containerId });
  const props: CloudSqlite.ContainerTokenProps = { baseUri: AzuriteTest.baseUri, storageType: "azure", containerId, writeable: true };
  const accessToken = await CloudSqlite.requestToken(props);
  await ViewStore.CloudAccess.initializeDb({ props: { ...props, accessToken } });
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

    expect(vs1reader.getViewByName("view1")).to.be.undefined;
    const v1Id = await vs1locker.addView({ className: "spatial", name: "view1", json: "json1", owner: "owner1" });
    expect(v1Id).equals(1);

    const v1 = vs1reader.getViewByName("view1")!;
    expect(v1.json).equals("json1");
    expect(v1.owner).equals("owner1");
    expect(v1.className).equals("spatial");
    expect(v1.groupId).to.be.undefined;
    expect(v1.shared).to.be.false;
    expect(v1.name).equals("view1");

    const g1 = await vs1locker.addGroup({ className: "group1", name: "group1" });
    const v2Id = await vs1locker.addView({ className: "spatial2", name: "view2", json: "json2", groupId: g1 });
    expect(v2Id).equals(2);

    expect(vs1reader.findViewsByClass(["spatial"]).length).equals(1);
    expect(vs1reader.findViewsByClass(["spatial2"]).length).equals(1);
    expect(vs1reader.findViewsByClass(["spatial", "spatial2", "blah"]).length).equals(2);
    expect(vs1reader.findViewsByClass([]).length).equals(0);
    expect(vs1reader.findViewsByClass(["blah"]).length).equals(0);
    expect(vs1reader.findViewsByOwner("owner1").length).equals(1);

    expect(vs1reader.getViewByName("view2")?.groupId).equals(g1);
    await vs1locker.deleteGroup(g1);
    expect(vs1reader.getViewByName("view2")?.groupId).to.be.undefined;
  });
});
