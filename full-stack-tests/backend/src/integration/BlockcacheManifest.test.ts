/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { IModelTestUtils } from "@itwin/core-backend/lib/cjs/test";
import { CloudSqlite } from "@bentley/imodeljs-native";
import { Guid } from "@itwin/core-bentley";

// Default account and key for azurite
const azuriteAccount = "devstoreaccount1";
const accessKey = "Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==";
const commandArgs: CloudSqlite.DaemonCommandArg & CloudSqlite.TransferDbProps = {
  dbName: "test1.bim",
  accountName: azuriteAccount,
  sasToken: accessKey,
  containerId: `testcontainer-${Guid.createValue()}`,
  storageType: "azure?emulator=127.0.0.1:10000&sas=0",
  localFile: "",
};

// ###TODO re-enable this test after updates from SQLite team - currently we have no way of knowing when the "upload" command has completed.
describe.skip("Manifest", async () => {
  it("should get etag from manifest", async () => {
    const dbPath = IModelTestUtils.prepareOutputFile("IModel", "mirukuru.ibim");
    IModelTestUtils.createSnapshotFromSeed(dbPath, IModelTestUtils.resolveAssetFile("mirukuru.ibim"));
    commandArgs.localFile = dbPath;

    // Create the container in azurite.
    await CloudSqlite.Daemon.command("create", commandArgs);
    const result = await CloudSqlite.Daemon.command("queryManifestETag", commandArgs);
    assert(result.eTag !== undefined, "etag is undefined!");
    assert(result.eTag.length !== 0, "eTag is empty string");
    // Upload a database to the container, this SHOULD change the manifest's ETag.
    await CloudSqlite.uploadDb(commandArgs);
    const result2 = await CloudSqlite.Daemon.command("queryManifestETag", commandArgs);
    assert(result2.eTag !== undefined, "etag after uploading db is undefined!");
    assert(result2.eTag.length !== 0, "eTag is empty string after uploading db");
    assert(result2.eTag !== result.eTag, "eTag didn't change after changing the manifest!");
    // Make sure the manifest's eTag stays the same if no changes take place.
    const result3 = await CloudSqlite.Daemon.command("queryManifestETag", commandArgs);
    assert(result3.eTag !== undefined, "etag is undefined");
    assert(result3.eTag === result2.eTag, "eTags should be the same, we didn't change the manifest!");
  });
});
