/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { DbResult, Id64String, OpenMode } from "@bentley/bentleyjs-core";
import { ECSqlStatement, Element, IModelDb, Model /*, PhysicalPartition, Subject*/ } from "@bentley/imodeljs-backend";
import { IModelTestUtils } from "./IModelTestUtils";
import { IModelJsFs as fs } from "@bentley/imodeljs-backend/lib/IModelJsFs";
import * as path from "path";

// __PUBLISH_EXTRACT_START__ WireFormat_DumpIModel.code
/**
 * This example code shows one possible way to dump an iModel to JSON.
 * The strategy employed by this example is as follows:
 * - Use the GUID of the iModel to create a new directory
 * - Create a JSON file per Model under that directory
 * - Output a JSON string and newline character per Element into the Model JSON file
 *
 * > Note: The Model JSON file is formatted in such a way that it can either be loaded as JSON or optionally read line-by-line to conserve memory.
 */
class DumpIModel {
  public static dump(iModel: IModelDb, baseDir: string): void {
    // Use the GUID of the iModel to create a new directory
    const outputDir = path.join(baseDir, iModel.getGuid().toString());
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
    }
    // Iterate each Model
    const sql = `SELECT ECInstanceId AS id FROM ${Model.classFullName}`;
    iModel.withPreparedStatement(sql, (statement: ECSqlStatement) => {
      while (DbResult.BE_SQLITE_ROW === statement.step()) {
        const row = statement.getRow();
        DumpIModel.dumpModel(iModel, row.id, outputDir);
      }
    });
  }

  private static dumpModel(iModel: IModelDb, modelId: Id64String, outputDir: string): void {
    // Use the Id of the Model to create a JSON output file
    const outputFile = path.join(outputDir, `${modelId.toString()}.json`);
    fs.writeFileSync(outputFile, "[");
    // ECSQL to SELECT every Element in the specified Model
    const sql = `SELECT ECInstanceId AS id FROM ${Element.classFullName} WHERE Model.Id=:modelId`;
    iModel.withPreparedStatement(sql, (statement: ECSqlStatement) => {
      statement.bindId("modelId", modelId);
      let isFirstEntry = true;
      while (DbResult.BE_SQLITE_ROW === statement.step()) {
        isFirstEntry ? fs.appendFileSync(outputFile, "\n") : fs.appendFileSync(outputFile, ",\n");
        isFirstEntry = false;
        const row = statement.getRow();
        // Get the ElementProps (including the geometry detail) for the specified Element
        const elementProps = iModel.elements.getElementProps({ id: row.id, wantGeometry: true });
        // Output the ElementProps as a JSON string
        fs.appendFileSync(outputFile, JSON.stringify(elementProps));
      }
    });
    fs.appendFileSync(outputFile, "\n]");
  }
}
// __PUBLISH_EXTRACT_END__

describe("DumpIModel", () => {
  let iModel: IModelDb;

  before(async () => {
    iModel = IModelTestUtils.openIModel("test.bim", { copyFilename: "dump.bim", openMode: OpenMode.Readonly });
  });

  after(() => {
    iModel.closeStandalone();
  });

  it("should dump iModel to JSON", () => {
    const outputDir = path.join(__dirname, "output", "dump");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
    }
    assert.isTrue(fs.existsSync(outputDir));
    DumpIModel.dump(iModel, outputDir);
  });
});
