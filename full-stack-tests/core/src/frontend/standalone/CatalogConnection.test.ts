/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as path from "path";
import { Guid, ProcessDetector } from "@itwin/core-bentley";
import { CatalogIModelTypes } from "@itwin/core-common";
import { CatalogConnection } from "@itwin/core-frontend";
import { coreFullStackTestIpc } from "../Editing";
import { TestUtility } from "../TestUtility";

if (ProcessDetector.isElectronAppFrontend) {

  const iTwinId = Guid.createValue();

  describe("CatalogConnection", async () => {

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

      const people = {
        fred: "Fred Smith",
        bill: "Bill Jones",
        harold: "Harold Kennedy",
        sarah: "Sarah Wilson"
      } as const;

      const manifest: CatalogIModelTypes.CatalogManifest = {
        catalogName: "Catalog of Parts",
        contactName: people.fred,
        description: "collection of part definitions",
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

      await expect(CatalogConnection.openReadonly({ dbName, containerId, version: "^2" })).rejectedWith("No version of");
      await expect(CatalogConnection.openReadonly({ dbName: "not there", containerId, version: "^1" })).rejectedWith("No version of");

      await expect(CatalogConnection.acquireWriteLock({ containerId, username: people.bill })).rejectedWith("unauthorized user");
      await coreFullStackTestIpc.setAzTestUser("readWrite");
      await expect(CatalogConnection.createNewVersion({ containerId, fromDb: { dbName, version: "^1" }, versionType: "patch" })).rejectedWith("Write lock must be held");

      await CatalogConnection.acquireWriteLock({ containerId, username: people.bill });
      await expect(CatalogConnection.openEditable({ dbName, version: "1.0.0", containerId })).rejectedWith("Catalog has already been published");
      const v101 = await CatalogConnection.createNewVersion({ containerId, fromDb: { dbName, version: "^1" }, versionType: "patch" });
      expect(v101.oldDb.version).equal("1.0.0");
      expect(v101.newDb.dbName).equal(dbName);
      expect(v101.newDb.version).equal("1.0.1");
      let v101db = await CatalogConnection.openEditable({ dbName, version: "1.0.1", containerId });
      info = await v101db.getCatalogInfo();
      expect(info.version).equal("1.0.1")
      await v101db.updateCatalogManifest({ ...info.manifest, contactName: people.harold })

      const dictModelId = await v101db.models.getDictionaryModel();
      const cat1 = await coreFullStackTestIpc.createAndInsertSpatialCategory(v101db.key, dictModelId, "Category 1", { color: 1 });
      await v101db.saveChanges();
      await v101db.close();
      await CatalogConnection.releaseWriteLock({ containerId });

      await CatalogConnection.acquireWriteLock({ containerId, username: people.sarah });
      const v20 = await CatalogConnection.createNewVersion({ containerId, fromDb: { dbName, version: "^1" }, versionType: "major" });
      expect(v20.oldDb.version).equal("1.0.1");
      expect(v20.newDb.version).equal("2.0.0");
      let v20db = await CatalogConnection.openEditable({ dbName, containerId });
      info = await v20db.getCatalogInfo();
      expect(info.version).equal("2.0.0");
      const cat2 = await coreFullStackTestIpc.createAndInsertSpatialCategory(v20db.key, dictModelId, "Category 2", { color: 2 });
      await v20db.saveChanges();
      await v20db.close();
      await CatalogConnection.releaseWriteLock({ containerId });

      await coreFullStackTestIpc.setAzTestUser("readOnly");
      const v100db = await CatalogConnection.openReadonly({ containerId, dbName, version: "1.0.0", syncWithCloud: true });
      v101db = await CatalogConnection.openReadonly({ containerId, dbName, version: "^1" });
      v20db = await CatalogConnection.openReadonly({ containerId, dbName });

      const verifyInfo = async (db: CatalogConnection, version: string, contactName: string, lastEditedBy?: string) => {
        const inf = await db.getCatalogInfo();
        expect(inf.version).equal(version);
        expect(inf.manifest.contactName).equal(contactName);
        expect(inf.manifest.lastEditedBy).equal(lastEditedBy);
      }
      const verifyCategory = async (db: CatalogConnection, id: string, name?: string) => {
        const props = await db.elements.loadProps(id);
        if (undefined === name) {
          expect(props).undefined;
          return;
        }
        expect(props).not.undefined;
        if (props) {
          expect(props.classFullName).equal("BisCore:SpatialCategory");
          expect(props.code.value).equal(name);
        }
      }

      await verifyInfo(v100db, "1.0.0", people.fred);
      await verifyCategory(v100db, cat1);
      await verifyCategory(v100db, cat2);
      await v100db.close();

      await verifyInfo(v101db, "1.0.1", people.harold, people.bill);
      await verifyCategory(v101db, cat1, "Category 1");
      await verifyCategory(v101db, cat2);
      await v101db.close();

      await verifyInfo(v20db, "2.0.0", people.harold, people.sarah);
      await verifyCategory(v20db, cat1, "Category 1");
      await verifyCategory(v20db, cat2, "Category 2");
      await v20db.close();
    });
  });
}
