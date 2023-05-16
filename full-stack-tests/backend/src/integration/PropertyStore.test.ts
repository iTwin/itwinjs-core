/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { Suite } from "mocha";
import { CloudSqlite, IModelHost, PropertyStore } from "@itwin/core-backend";
import { AzuriteTest } from "./AzuriteTest";

// spell:ignore mkdirs

const blockSize = 64 * 1024;
const propContainer = "properties-itwin1";

async function initializeContainer(containerId: string) {
  await AzuriteTest.Sqlite.createAzContainer({ containerId });
  const props: CloudSqlite.ContainerTokenProps = { baseUri: AzuriteTest.baseUri, storageType: "azure", containerId, writeable: true };
  const accessToken = await CloudSqlite.requestToken(props);
  await PropertyStore.CloudAccess.initializeDb({ props: { ...props, accessToken }, initContainer: { blockSize } });
}

function countProperties(values: any, filter?: PropertyStore.PropertyFilter) {
  let count = 0;
  values.forAllProperties(() => {
    ++count;
  }, filter);
  return count;
}

async function makePropertyStore(moniker: string) {
  const props: CloudSqlite.ContainerTokenProps = { baseUri: AzuriteTest.baseUri, storageType: "azure", containerId: propContainer, writeable: true };
  const accessToken = await CloudSqlite.requestToken(props);
  const propStore = new PropertyStore.CloudAccess({ ...props, accessToken });
  propStore.setCache(CloudSqlite.CloudCaches.getCache({ cacheName: moniker }));
  propStore.lockParams.moniker = moniker;
  return propStore;
}

describe("PropertyStore", function (this: Suite) {
  this.timeout(0);

  let ps1: PropertyStore.CloudAccess;
  let ps2: PropertyStore.CloudAccess;

  before(async () => {
    IModelHost.authorizationClient = new AzuriteTest.AuthorizationClient();
    AzuriteTest.userToken = AzuriteTest.service.userToken.readWrite;

    await initializeContainer(propContainer);

    ps1 = await makePropertyStore("propertyStore1");
    ps2 = await makePropertyStore("propertyStore2");
  });
  after(async () => {
    IModelHost.authorizationClient = undefined;
  });

  it("access PropertyStore", async () => {
    const ps1locker = ps1.writeLocker;
    const ps1reader = ps1.reader;

    expect(countProperties(ps1reader)).equal(0);
    expect(countProperties(ps2.reader)).equal(0);

    const prop1 = "test/prop-1";
    const value1 = "this is value 1";
    const value2 = "this is value 2";
    await ps1locker.saveProperty(prop1, value1);
    expect(ps1reader.getString(prop1)).equal(value1);
    expect(ps2.reader.getString(prop1)).undefined;
    ps2.synchronizeWithCloud();
    expect(ps2.reader.getString(prop1)).equal(value1);
    await ps2.writeLocker.saveProperty(prop1, value2);
    expect(ps2.reader.getString(prop1)).equal(value2);
    expect(ps1reader.getString(prop1)).equal(value1);
    ps1.synchronizeWithCloud();
    expect(ps1reader.getString(prop1)).equal(value2);
    expect(countProperties(ps1reader)).equal(1);

    await ps1locker.deleteProperty(prop1);
    expect(ps1reader.getString(prop1)).undefined;
    expect(ps2.reader.getString(prop1)).equal(value2);
    expect(countProperties(ps2.reader)).equal(1);
    ps2.synchronizeWithCloud();
    expect(ps2.reader.getString(prop1)).undefined;
    expect(countProperties(ps2.reader)).equal(0);

    const prop3 = "test/property/3";
    const prop4 = "test/property/4";
    const prop5 = "test/property/5";
    const prop6 = "test/property/6";
    const prop7 = "test/property/7";
    const val3 = { a: 100, b: "blah", c: { d: true, e: "this is a string" }, f: 2.330 };
    const val4 = new Uint8Array(200);
    for (let i = 0; i < 200; ++i)
      val4[i] = i;
    const val5 = true;
    const val6 = " value of property 6    ";
    const val7 = 40234;

    await ps1locker.saveProperties([
      { name: prop3, value: val3 },
      { name: prop4, value: val4 },
      { name: prop5, value: val5 },
      { name: prop6, value: val6 },
      { name: prop7, value: val7 },
    ]);

    expect(countProperties(ps2.reader)).equal(0);
    ps2.synchronizeWithCloud();
    expect(ps2.reader.getObject(prop3)).deep.equal(val3);
    expect(ps2.reader.getBlob(prop4)).deep.equal(val4);
    expect(ps2.reader.getBoolean(prop5)).equal(val5);
    expect(ps2.reader.getString(prop6)).equal(val6);
    expect(ps2.reader.getNumber(prop7)).equal(val7);
    expect(countProperties(ps2.reader)).equal(5);
    await ps2.writeLocker.deleteProperties([prop3, prop4, prop5]);
    expect(ps2.reader.getObject(prop3)).undefined;
    expect(ps2.reader.getBlob(prop4)).undefined;
    expect(ps2.reader.getBoolean(prop5)).undefined;
    expect(countProperties(ps2.reader)).equal(2);
    ps1.close();
    ps2.close();
  });
});

