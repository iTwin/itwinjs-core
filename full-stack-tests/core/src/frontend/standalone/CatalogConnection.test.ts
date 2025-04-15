/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as path from "path";
import { Guid, ProcessDetector } from "@itwin/core-bentley";
import { CatalogIModel } from "@itwin/core-common";
import { CatalogConnection } from "@itwin/core-frontend";
import { coreFullStackTestIpc } from "../Editing";
import { TestUtility } from "../TestUtility";

// this test is only applicable for NativeApp frontend
if (ProcessDetector.isElectronAppFrontend) {

  // Make sure you can create containers for CatalogIModels, create new versions, and read their contents
  describe("CatalogConnection", async () => {
    const iTwinId = Guid.createValue();

    before(async () => {
      await TestUtility.startFrontend(undefined, true);
      // this test uses the AzTest framework on the backend, and requires its authorization client.
      await coreFullStackTestIpc.useAzTestAuthClient();
    });

    after(async () => {
      // restore the backend's authorization client to its value before this test started
      await coreFullStackTestIpc.restoreAuthClient();
      await TestUtility.shutdownFrontend();
    });

    it("Create container and versions of CatalogIModels within it", async () => {
      // This file will be used as the "seed catalog" file
      const localCatalogFile = path.join(process.env.IMODELJS_CORE_DIRNAME!, "core/backend/lib/cjs/test/assets/test.bim");

      // for names of individuals in various apis
      const people = {
        fred: "Fred Smith",
        bill: "Bill Jones",
        harold: "Harold J. Kennedy",
        sarah: "Sarah Wilson"
      } as const;

      // Every cloud container for Catalogs has metadata that can be retrieved from the BlobContainer service
      // without opening a CatalogIModel. This metadata applies to all versions of the CatalogIModel held in the container.
      const metadata = { label: "PartsCatalog1", description: "catalog for all projects for ClientA" };
      // Every CatalogIModel has a "manifest" that describes its purpose. This manifest is versioned inside
      // the CatalogIModel, so it may be different for each version within a container.
      const manifest: CatalogIModel.Manifest = {
        catalogName: "Catalog of Parts",
        contactName: people.fred,
        description: "collection of part definitions",
      };

      // verify that only users with administrator privilege may create new containers
      await coreFullStackTestIpc.setAzTestUser("readWrite");
      await expect(CatalogConnection.createNewContainer({ localCatalogFile, version: "1.0.0", iTwinId, manifest, metadata })).rejectedWith("only admins may create containers");

      await coreFullStackTestIpc.setAzTestUser("admin");
      // verify that illegal dbNames are rejected
      await expect(CatalogConnection.createNewContainer({ localCatalogFile, dbName: "a:b", version: "1.0.0", iTwinId, manifest, metadata })).rejectedWith("invalid dbName");
      // verify that an illegal initial version is rejected
      await expect(CatalogConnection.createNewContainer({ localCatalogFile, version: "not a version", iTwinId, manifest, metadata })).rejectedWith("invalid version specification");

      // create a container for our tests. The initial version is supplied as "1.0.0"
      const newContainer = await CatalogConnection.createNewContainer({ localCatalogFile, version: "1.0.0", iTwinId, manifest, metadata });
      expect(newContainer.containerId).not.undefined;
      expect(newContainer.baseUri).not.undefined;
      expect(newContainer.provider).equal("azure");

      // the container's id (a Guid) comes in the response from `createNewContainer`. Save it for the rest of the tests
      const containerId = newContainer.containerId;

      // simulate a normal user on another computer and verify that they can read the CatalogDb
      await coreFullStackTestIpc.setAzTestUser("readOnly");
      const readonlyConnection = await CatalogConnection.openReadonly({ containerId, version: "^1" })
      let info = await readonlyConnection.getCatalogInfo();
      expect(info.version).equal("1.0.0");
      expect(info.manifest).deep.equal(manifest);
      await readonlyConnection.close();

      // attempting to open a version that isn't present, or a dbName that isn't right should fail
      await expect(CatalogConnection.openReadonly({ containerId, version: "^2" })).rejectedWith("No version of");
      await expect(CatalogConnection.openReadonly({ dbName: "not there", containerId, version: "^1" })).rejectedWith("No version of");

      // attempt to acquire the write lock for an unauthorized user
      await expect(CatalogConnection.acquireWriteLock({ containerId, username: people.bill })).rejectedWith("unauthorized user");
      // simulate a user with write access to the container
      await coreFullStackTestIpc.setAzTestUser("readWrite");
      // verify that to create a new version, the write lock must be held
      await expect(CatalogConnection.createNewVersion({ containerId, fromDb: { version: "^1" }, versionType: "patch" })).rejectedWith("Write lock must be held");

      // get the write lock. The username supplied should become the "last editor" in the manifest.
      await CatalogConnection.acquireWriteLock({ containerId, username: people.bill });
      // you should not be able to edit a Catalog that has already been published.
      await expect(CatalogConnection.openEditable({ version: "1.0.0", containerId })).rejectedWith("Catalog has already been published");

      // create a patch version from the most recent version that starts with 1 (should be 1.0.0). This will create version "1.0.1"
      const v101 = await CatalogConnection.createNewVersion({ containerId, fromDb: { version: "^1" }, versionType: "patch" });
      expect(v101.oldDb.version).equal("1.0.0");
      expect(v101.newDb.dbName).equal("catalog-db");
      expect(v101.newDb.version).equal("1.0.1");

      // Attempt to open the new version for editing
      const v101db = await CatalogConnection.openEditable({ version: "1.0.1", containerId });
      info = await v101db.getCatalogInfo();
      expect(info.version).equal("1.0.1");
      expect(info.manifest).not.undefined;
      // change the contact name in the manifest for 1.0.1 (note that 1.0.0 will still have the old value)
      if (info.manifest) {
        expect(info.manifest.catalogName).equal(manifest.catalogName);
        await v101db.updateManifest({ ...info.manifest, contactName: people.harold });
      }

      // Now add an element to v1.0.1
      const dictModelId = await v101db.models.getDictionaryModel();
      const cat1 = await coreFullStackTestIpc.createAndInsertSpatialCategory(v101db.key, dictModelId, "Category 1", { color: 1 });
      await v101db.saveChanges();
      await v101db.close();
      // this uploads the changes and makes them available to others
      await CatalogConnection.releaseWriteLock({ containerId });

      // simulate a different user acquiring the write lock
      await CatalogConnection.acquireWriteLock({ containerId, username: people.sarah });
      // now create a new major version (2.0.0) from the most recent version in 1.x.x (should be 1.0.1)
      const v20 = await CatalogConnection.createNewVersion({ containerId, fromDb: { version: "^1" }, versionType: "major" });
      expect(v20.oldDb.version).equal("1.0.1");
      expect(v20.newDb.version).equal("2.0.0");
      // open 2.0.0 for editing (we don't supply a version here, but it's the "latest version" )
      const v20db = await CatalogConnection.openEditable({ containerId });
      info = await v20db.getCatalogInfo();
      expect(info.version).equal("2.0.0");

      // now add another element to 2.0.0. This version of the catalogDb will have both spatial categories.
      const cat2 = await coreFullStackTestIpc.createAndInsertSpatialCategory(v20db.key, dictModelId, "Category 2", { color: 2 });
      await v20db.saveChanges();
      await v20db.close();
      await CatalogConnection.releaseWriteLock({ containerId });

      // switch back to simulating a readonly user on another computer
      await coreFullStackTestIpc.setAzTestUser("readOnly");

      // Now open all three versions of the catalogDb and verify they hold what's expected.
      // Note: ordinarily containers are sync'd with the latest version when they're first accessed. Since we opened the container above, we need
      // to pass "SyncWithCloud=true" to see the changes made above
      const v100db = await CatalogConnection.openReadonly({ containerId, version: "1.0.0", syncWithCloud: true });
      const v101dbReadonly = await CatalogConnection.openReadonly({ containerId, version: "^1" });
      const v20dbReadonly = await CatalogConnection.openReadonly({ containerId });

      const verifyInfo = async (db: CatalogConnection, version: string, contactName: string, lastEditedBy?: string) => {
        const inf = await db.getCatalogInfo();
        expect(inf.version).equal(version);
        expect(inf.manifest).not.undefined;
        if (inf.manifest) {
          expect(inf.manifest.contactName).equal(contactName);
          expect(inf.manifest.lastEditedBy).equal(lastEditedBy);
        }
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

      // v1.0.0 is the initial version, so its "lastEditedBy" value is undefined. It should not have either SpatialCategory
      await verifyInfo(v100db, "1.0.0", people.fred);
      await verifyCategory(v100db, cat1);
      await verifyCategory(v100db, cat2);
      await v100db.close();

      // v1.0.1 was edited by Bill, and we changed the manifest to show Harold as the contact. It only has the first SpatialCategory
      await verifyInfo(v101dbReadonly, "1.0.1", people.harold, people.bill);
      await verifyCategory(v101dbReadonly, cat1, "Category 1");
      await verifyCategory(v101dbReadonly, cat2);
      await v101db.close();

      // v2.0.0 was edited by Sarah. The manifest was not changed, so it should still have Harold as the contact. It has both SpatialCategories
      await verifyInfo(v20dbReadonly, "2.0.0", people.harold, people.sarah);
      await verifyCategory(v20dbReadonly, cat1, "Category 1");
      await verifyCategory(v20dbReadonly, cat2, "Category 2");
      await v20db.close();
    });
  });
}
