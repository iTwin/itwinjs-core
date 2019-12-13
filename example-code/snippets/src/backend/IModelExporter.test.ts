/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
// __PUBLISH_EXTRACT_START__ IModelExporter_CodeExporter.code
import { CodeSpec } from "@bentley/imodeljs-common";
import { Element, IModelDb, IModelExporter, IModelExportHandler, IModelJsFs as fs } from "@bentley/imodeljs-backend";

/** CodeExporter creates a CSV output file containing all Codes from the specified iModel. */
class CodeExporter extends IModelExportHandler {
  public outputFileName: string;

  /** Initiate the export of codes. */
  public static exportCodes(iModelDb: IModelDb, outputFileName: string): void {
    const exporter = new IModelExporter(iModelDb);
    const exportHandler = new CodeExporter(outputFileName);
    exporter.registerHandler(exportHandler);
    exporter.exportAll();
  }

  /** Construct a new CodeExporter */
  private constructor(outputFileName: string) {
    super();
    this.outputFileName = outputFileName;
  }

  /** Override of IModelExportHandler.onExportElement that outputs a line of a CSV file when the Element has a Code. */
  protected onExportElement(element: Element, isUpdate: boolean | undefined): void {
    const codeValue: string = element.code.getValue();
    if ("" !== codeValue) { // only output when Element has a Code
      const codeSpec: CodeSpec = element.iModel.codeSpecs.getById(element.code.spec);
      fs.appendFileSync(this.outputFileName, `${element.id}, ${codeSpec.name}, ${codeValue}\n`);
    }
    super.onExportElement(element, isUpdate);
  }
}
// __PUBLISH_EXTRACT_END__
import * as path from "path";
import { IModelTestUtils } from "./IModelTestUtils";

describe("IModelExporter", () => {
  let iModelDb: IModelDb;
  before(() => { iModelDb = IModelTestUtils.openIModel("test.bim"); });
  after(() => { iModelDb.closeStandalone(); });

  it("call CodeExporter example code", () => {
    const outputDirName = path.join(__dirname, "output");
    const outputFileName = path.join(outputDirName, "test.bim.codes.csv");
    if (!fs.existsSync(outputDirName)) {
      fs.mkdirSync(outputDirName);
    }
    if (fs.existsSync(outputFileName)) {
      fs.removeSync(outputFileName);
    }
    CodeExporter.exportCodes(iModelDb, outputFileName);
  });
});
