/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { Suite } from "mocha";
import * as azureBlob from "@azure/storage-blob";
import { CloudSqlite, PropertyStore } from "@itwin/core-backend";

// spell:ignore mkdirs devstoreaccount1, racwdl

const blockSize = 64 * 1024;
const httpAddr = "127.0.0.1:10000";
const propContainer = "properties-itwin1";
const storage: CloudSqlite.AccountAccessProps = {
  accessName: "devstoreaccount1",
  storageType: `azure?emulator=${httpAddr}&sas=1`,
};
const credential = new azureBlob.StorageSharedKeyCredential(storage.accessName, "Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==");

async function createAzureContainer(containerId: string) {
  const pipeline = azureBlob.newPipeline(credential);
  const blobService = new azureBlob.BlobServiceClient(`http://${httpAddr}/${storage.accessName}`, pipeline);
  try {
    await blobService.deleteContainer(containerId);
  } catch (e) {
  }
  try {
    await blobService.createContainer(containerId);
  } catch (e) {
  }
}
async function initializeContainer(containerId: string) {
  await createAzureContainer(containerId);
  await PropertyStore.CloudDb.initializeDb({ props: { ...storage, containerId, accessToken: makeSasToken(containerId, "racwdl") }, initContainer: { blockSize } });
}

export function makeSasToken(containerName: string, permissionFlags: string) {
  const now = new Date();
  return azureBlob.generateBlobSASQueryParameters({
    containerName,
    permissions: azureBlob.ContainerSASPermissions.parse(permissionFlags),
    startsOn: now,
    expiresOn: new Date(now.valueOf() + 86400 * 1000), // one day, in milliseconds
    version: "2018-03-28", // note: fails without this value
  }, credential).toString();
}

function countProperties(values: any, filter?: PropertyStore.PropertyFilter) {
  let count = 0;
  values.forAllProperties(() => {
    ++count;
  }, filter);
  return count;
}

function makePropertyStore(name: string) {
  const accessProps = { ...storage, containerId: propContainer, accessToken: makeSasToken(propContainer, "racwdl") };
  const propStore = new PropertyStore.CloudDb(accessProps);
  propStore.setCache(CloudSqlite.CloudCaches.getCache({ cacheName: name }));
  propStore.lockParams.user = name;
  return propStore;
}

describe.only("PropertyStore", function (this: Suite) {
  this.timeout(0);

  let ps1: PropertyStore.CloudDb;
  let ps2: PropertyStore.CloudDb;

  before(async () => {
    await initializeContainer(propContainer);

    ps1 = makePropertyStore("propertyStore1");
    ps2 = makePropertyStore("propertyStore2");
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
    ps1.destroy();
    ps2.destroy();
  });
});

