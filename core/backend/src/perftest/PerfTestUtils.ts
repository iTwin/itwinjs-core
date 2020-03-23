/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Code, ColorDef, DbResult, IModel, SubCategoryAppearance } from "@bentley/imodeljs-common";
import { assert } from "chai";
import * as path from "path";
import { BackendRequestContext, IModelJsFs, SnapshotDb, SpatialCategory } from "../imodeljs-backend";
import { IModelTestUtils } from "../test/IModelTestUtils";

export class PerfTestDataMgr {
  public db: SnapshotDb | undefined;
  public modelId: any;
  public catId: any;

  public constructor(imodelPath: string, createNew: boolean = false) {
    if (createNew) {
      if (IModelJsFs.existsSync(imodelPath))
        IModelJsFs.removeSync(imodelPath);
    }
    const fName = path.basename(imodelPath);
    const dirName = path.basename(path.dirname(imodelPath));
    this.db = SnapshotDb.createEmpty(IModelTestUtils.prepareOutputFile(dirName, fName), { rootSubject: { name: "PerfTest" } });
  }
  public async importSchema(scehamPath: string, testCName: string = "") {
    assert(IModelJsFs.existsSync(scehamPath));
    if (this.db) {
      await this.db.importSchemas(new BackendRequestContext(), [scehamPath]);
      if (testCName)
        assert.isDefined(this.db.getMetaData(testCName), "Class Name " + testCName + "is not present in iModel.");
      this.db.saveChanges();
    }
  }
  public setup() {
    if (this.db) {
      this.modelId = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(this.db, Code.createEmpty(), true);
      this.catId = SpatialCategory.queryCategoryIdByName(this.db, IModel.dictionaryId, "MySpatialCategory");
      if (undefined === this.catId) {
        this.catId = SpatialCategory.insert(this.db, IModel.dictionaryId, "MySpatialCategory", new SubCategoryAppearance({ color: new ColorDef("rgb(255,0,0)") }));
      }
      const result: DbResult = this.db.nativeDb.setAsMaster();
      assert.equal(DbResult.BE_SQLITE_OK, result);
      this.db.saveChanges();
    }
  }
  public closeDb() {
    if (this.db)
      this.db.close();
  }
}
