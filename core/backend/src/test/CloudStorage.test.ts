/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as sinon from "sinon";
import * as Azure from "@azure/storage-blob";
import { CloudStorageProvider } from "@itwin/core-common";
import { AzureBlobStorage } from "../CloudStorageBackend";

describe("AzureBlobStorage.obtainContainerUrl()", () => {
  afterEach(() => {
    sinon.restore();
  });
  it("connects to Azure blob storage by default", () => {
    sinon.stub(Azure, "generateBlobSASQueryParameters").returns({ toString: () => "fake&sas=%key" } as Azure.SASQueryParameters);
    const storage = new AzureBlobStorage({
      accessKey: "testAccessKey",
      account: "testAccountName",
    });
    const url = storage.obtainContainerUrl({
      provider: CloudStorageProvider.Azure,
      name: "testContainerName",
    }, new Date());
    expect(url.url.toLowerCase()).to.equal("https://testaccountname.blob.core.windows.net/testcontainername?fake&sas=%key");
  });

  it("connects to custom Azure provider", () => {
    sinon.stub(Azure, "generateBlobSASQueryParameters").returns({ toString: () => "fake&sas=%key" } as Azure.SASQueryParameters);
    const storage = new AzureBlobStorage({
      accessKey: "testAccessKey",
      account: "testAccountName",
      baseUrl: "https://custom.provider/",
    });
    const url = storage.obtainContainerUrl({
      provider: CloudStorageProvider.Azure,
      name: "testContainerName",
    }, new Date());
    expect(url.url).to.equal("https://custom.provider/testContainerName?fake&sas=%key");
  });
});
