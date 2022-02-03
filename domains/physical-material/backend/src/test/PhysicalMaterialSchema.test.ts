/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import * as path from "path";
import { DbResult } from "@itwin/core-bentley";
import type { ECSqlStatement, IModelDb} from "@itwin/core-backend";
import { IModelHost, IModelJsFs, PhysicalMaterial, SnapshotDb } from "@itwin/core-backend";
import { IModel } from "@itwin/core-common";
import { Aggregate, Aluminum, Asphalt, Concrete, PhysicalMaterialSchema, Steel } from "../physical-material-backend";

describe("PhysicalMaterialSchema", () => {
  const outputDir = path.join(__dirname, "output");

  before(async () => {
    await IModelHost.startup();
    PhysicalMaterialSchema.registerSchema();
    if (!IModelJsFs.existsSync(outputDir)) {
      IModelJsFs.mkdirSync(outputDir);
    }
  });

  function count(iModelDb: IModelDb, classFullName: string): number {
    return iModelDb.withPreparedStatement(`SELECT COUNT(*) FROM ${classFullName}`, (statement: ECSqlStatement): number => {
      return DbResult.BE_SQLITE_ROW === statement.step() ? statement.getValue(0).getInteger() : 0;
    });
  }

  it("should import", async () => {
    const iModelFileName: string = path.join(outputDir, "PhysicalMaterialSchema.bim");
    if (IModelJsFs.existsSync(iModelFileName)) {
      IModelJsFs.removeSync(iModelFileName);
    }
    const iModelDb = SnapshotDb.createEmpty(iModelFileName, { rootSubject: { name: "PhysicalMaterialSchema" }, createClassViews: true });
    await iModelDb.importSchemas([PhysicalMaterialSchema.schemaFilePath]);
    for (let i = 1; i <= 3; i++) {
      Aggregate.create(iModelDb, IModel.dictionaryId, `${Aggregate.className}${i}`).insert();
      Aluminum.create(iModelDb, IModel.dictionaryId, `${Aluminum.className}${i}`).insert();
      Asphalt.create(iModelDb, IModel.dictionaryId, `${Asphalt.className}${i}`).insert();
      Concrete.create(iModelDb, IModel.dictionaryId, `${Concrete.className}${i}`).insert();
      Steel.create(iModelDb, IModel.dictionaryId, `${Steel.className}${i}`).insert();
    }
    assert.equal(3, count(iModelDb, Aggregate.classFullName));
    assert.equal(3, count(iModelDb, Aluminum.classFullName));
    assert.equal(3, count(iModelDb, Asphalt.classFullName));
    assert.equal(3, count(iModelDb, Concrete.classFullName));
    assert.equal(3, count(iModelDb, Steel.classFullName));
    assert.equal(15, count(iModelDb, PhysicalMaterial.classFullName));
    iModelDb.saveChanges();
    iModelDb.close();
  });
});
