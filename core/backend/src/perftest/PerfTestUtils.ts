/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { IModelDb, SpatialCategory } from "../imodeljs-backend";
import { IModelTestUtils } from "../test/IModelTestUtils";
import { BackendRequestContext } from "../BackendRequestContext";
// import { KnownTestLocations } from "../test/KnownTestLocations";
// import { IModelJson as GeomJson } from "@bentley/geometry-core/lib/serialization/IModelJsonSchema";
import { assert } from "chai";
import * as path from "path";
import { IModelJsFs } from "../IModelJsFs";
import { Code, IModel, SubCategoryAppearance, ColorDef } from "@bentley/imodeljs-common";
// import { Id64, Id64String, DbResult } from "@bentley/bentleyjs-core";
// import { Arc3d, Point3d } from "@bentley/geometry-core";
// import { Reporter } from "@bentley/perf-tools/lib/Reporter";

export class PerfTestDataMgr {
  public db: IModelDb | undefined;
  public modelId: any;
  public catId: any;

  public constructor(imodelPath: string, createNew: boolean = false) {
    if (createNew) {
      if (IModelJsFs.existsSync(imodelPath))
        IModelJsFs.removeSync(imodelPath);
    }
    const fName = path.basename(imodelPath);
    const dirName = path.basename(path.dirname(imodelPath));
    this.db = IModelDb.createSnapshot(IModelTestUtils.prepareOutputFile(dirName, fName), { rootSubject: { name: "PerfTest" } });
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
      if (undefined === this.catId)
        this.catId = SpatialCategory.insert(this.db, IModel.dictionaryId, "MySpatialCategory", new SubCategoryAppearance({ color: new ColorDef("rgb(255,0,0)") }));
      this.db.setAsMaster();
      this.db.saveChanges();
    }
  }
  public closeDb() {
    if (this.db)
      this.db.closeSnapshot();
  }
}
