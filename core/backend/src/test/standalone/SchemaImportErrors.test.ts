/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import * as path from "path";
import * as fs from "fs";
import { IModelStatus } from "@itwin/core-bentley";
import { IModelError } from "@itwin/core-common";
import { IModelTestUtils } from "../IModelTestUtils";
import { KnownTestLocations } from "../KnownTestLocations";
import { SnapshotDb } from "../../core-backend";
import { ECDbTestHelper } from "../ecdb/ECDbTestHelper";

describe("Schema Import Errors", () => {
  const outDir = KnownTestLocations.outputDir;

  it("ECDb.importSchema should throw FileNotFound if file missing", () => {
    using ecdb = ECDbTestHelper.createECDb(outDir, "import_missing.ecdb");
    const missingPath = path.join(outDir, "MissingSchema.01.00.00.xml");
    try {
      ecdb.importSchema(missingPath);
      assert.fail("Should have thrown");
    } catch (err: any) {
        assert.instanceOf(err, IModelError);
        assert.equal(err.errorNumber, IModelStatus.FileNotFound);
        assert.include(err.message, "does not exist");
    }
  });

  it("IModelDb.importSchemas should throw FileNotFound if file missing", async () => {
     const iModelPath = IModelTestUtils.prepareOutputFile("SchemaImportErrors", "import_missing.bim");
     const iModel = SnapshotDb.createEmpty(iModelPath, { rootSubject: { name: "Test" } });
     const missingPath = path.join(outDir, "MissingSchema.01.00.00.xml");

     try {
        await iModel.importSchemas([missingPath]);
        assert.fail("Should have thrown");
     } catch(err: any) {
        assert.instanceOf(err, IModelError);
        assert.equal(err.errorNumber, IModelStatus.FileNotFound);
        assert.include(err.message, "does not exist");
     } finally {
        iModel.close();
     }
  });

  it("IModelDb.importSchemas should throw detailed error for invalid schema", async () => {
     const iModelPath = IModelTestUtils.prepareOutputFile("SchemaImportErrors", "import_invalid.bim");
     const iModel = SnapshotDb.createEmpty(iModelPath, { rootSubject: { name: "Test" } });
     
     // Create a dummy invalid schema file
     const invalidSchemaPath = path.join(outDir, "InvalidSchema.xml");
     fs.writeFileSync(invalidSchemaPath, "This is not a valid XML schema");

     try {
        await iModel.importSchemas([invalidSchemaPath]);
        assert.fail("Should have thrown");
     } catch(err: any) {
        assert.instanceOf(err, IModelError);
        // The error message should be enhanced
        assert.include(err.message, "Schema import failed");
        assert.include(err.message, "InvalidSchema.xml");
     } finally {
        iModel.close();
     }
  });
});
