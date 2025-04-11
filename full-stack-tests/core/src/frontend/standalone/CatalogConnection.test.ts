/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Guid, ProcessDetector } from "@itwin/core-bentley";
import { expect } from "chai";
import { TestUtility } from "../TestUtility";
import { CatalogConnection } from "@itwin/core-frontend";
import * as path from "path";
import { CatalogIModelTypes } from "@itwin/core-common";
import { coreFullStackTestIpc } from "../Editing";

if (ProcessDetector.isElectronAppFrontend) {

  const iTwinId = Guid.createValue();

  describe.only("CatalogConnection", async () => {

    before(async () => {
      await TestUtility.startFrontend(undefined, true);
      await coreFullStackTestIpc.useAzTestAuthClient();
    });

    after(async () => {
      await coreFullStackTestIpc.restoreAuthClient();
      await TestUtility.shutdownFrontend();
    });

    it("CatalogIModel container", async () => {
      const catalogFileName = path.join(process.env.IMODELJS_CORE_DIRNAME!, "core/backend/lib/cjs/test/assets/test.bim");

      const manifest: CatalogIModelTypes.CatalogManifest = {
        catalogName: "Catalog of Parts",
        contactName: "Fred Smith",
        description: "catalog of a collection of part definitions",
      };
      const metadata = { label: "PartsCatalog1", description: manifest.description };
      const dbName = "TestCatalog";
      await coreFullStackTestIpc.setAzTestUser("admin");
      await expect(CatalogConnection.createNewContainer({ catalogFileName, dbName: "a:b", version: "1.0.0", iTwinId, manifest, metadata })).eventually.rejectedWith("invalid dbName");
      await expect(CatalogConnection.createNewContainer({ catalogFileName, dbName, version: "not a version", iTwinId, manifest, metadata })).eventually.rejectedWith("invalid version specification");

      const newContainer = await CatalogConnection.createNewContainer({ catalogFileName, dbName, version: "1.0.0", iTwinId, manifest, metadata });
      expect(newContainer.containerId).not.undefined;
      expect(newContainer.baseUri).not.undefined;
      expect(newContainer.provider).equal("azure");

      const containerId = newContainer.containerId;

      await coreFullStackTestIpc.setAzTestUser("readOnly");
      const readonlyConnection = await CatalogConnection.openReadonly({ dbName, containerId, version: "^1" })
      let info = await readonlyConnection.getCatalogInfo();
      expect(info.version).equal("1.0.0");
      expect(info.manifest).deep.equal(manifest);
      await readonlyConnection.close();

      await expect(CatalogConnection.openReadonly({ dbName, containerId, version: "^2" })).eventually.rejectedWith("No version of");
      await expect(CatalogConnection.openReadonly({ dbName: "not there", containerId, version: "^1" })).eventually.rejectedWith("No version of");

      await expect(CatalogConnection.acquireWriteLock({ containerId, username: "Bill Jones" })).eventually.rejectedWith("unauthorized user");
      await coreFullStackTestIpc.setAzTestUser("readWrite");
      await expect(CatalogConnection.createNewVersion({ containerId, fromDb: { dbName, version: "^1" }, versionType: "patch" })).eventually.rejectedWith("Write lock must be held");

      await CatalogConnection.acquireWriteLock({ containerId, username: "Bill Jones" });
      await expect(CatalogConnection.openEditable({ dbName, version: "1.0.0", containerId })).eventually.rejectedWith("Catalog has already been published");
      const v101 = await CatalogConnection.createNewVersion({ containerId, fromDb: { dbName, version: "^1" }, versionType: "patch" });
      expect(v101.oldDb.version).equal("1.0.0");
      expect(v101.newDb.dbName).equal(dbName);
      expect(v101.newDb.version).equal("1.0.1");
      let v101db = await CatalogConnection.openEditable({ dbName, version: "1.0.1", containerId });
      info = await v101db.getCatalogInfo();
      expect(info.version).equal("1.0.1")
      await v101db.updateCatalogManifest({ ...info.manifest, contactName: "Harold Kennedy" })

      const dictModelId = await v101db.models.getDictionaryModel();
      const cat1 = await coreFullStackTestIpc.createAndInsertSpatialCategory(v101db.key, dictModelId, Guid.createValue(), { color: 1 });
      await v101db.saveChanges();
      await v101db.close();
      await CatalogConnection.releaseWriteLock({ containerId });

      await CatalogConnection.acquireWriteLock({ containerId, username: "Sarah Wilson" });
      const v20 = await CatalogConnection.createNewVersion({ containerId, fromDb: { dbName, version: "^1" }, versionType: "major" });
      expect(v20.oldDb.version).equal("1.0.1");
      expect(v20.newDb.version).equal("2.0.0");
      let v20db = await CatalogConnection.openEditable({ dbName, containerId });
      info = await v20db.getCatalogInfo();
      expect(info.version).equal("2.0.0");
      const cat2 = await coreFullStackTestIpc.createAndInsertSpatialCategory(v20db.key, dictModelId, Guid.createValue(), { color: 2 });
      await v20db.saveChanges();
      await v20db.close();
      await CatalogConnection.releaseWriteLock({ containerId });

      expect(cat1).not.equal(cat2);
      await coreFullStackTestIpc.setAzTestUser("readOnly");
      const v100db = await CatalogConnection.openReadonly({ containerId, dbName, version: "1.0.0", syncWithCloud: true });
      v101db = await CatalogConnection.openReadonly({ containerId, dbName, version: "^1" });
      v20db = await CatalogConnection.openReadonly({ containerId, dbName });

      expect((await v100db.getCatalogInfo()).version).equal("1.0.0");
      expect((await v101db.getCatalogInfo()).version).equal("1.0.1");
      expect((await v20db.getCatalogInfo()).version).equal("2.0.0");

      await v100db.close();
      await v101db.close();
      await v20db.close();
    });
  });
}
