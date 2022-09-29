/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module IModel
 */

import { IModelDb, IModelJsFs, InformationPartitionElement, SnapshotDb } from "@itwin/core-backend";
import { Id64String } from "@itwin/core-bentley";
import { Code, CodeScopeProps, CodeSpec, ElementAspectProps, ElementProps, IModel, LocalFileName, ModelProps } from "@itwin/core-common";
import { IModelConnection, SnapshotConnection } from "@itwin/core-frontend";
import path from "path";
import { TEST_OUTPUT_DIR } from "./Helpers";

export interface TestIModelBuilder {
  insertModel<TProps extends ModelProps>(props: TProps): Id64String;
  insertElement<TProps extends ElementProps>(props: TProps): Id64String;
  insertAspect<TProps extends ElementAspectProps>(props: TProps): void;
  createCode(scopeModelId: CodeScopeProps, codeSpecName: string, codeValue: string): Code;
  getUniqueModelCode(newModelCodeBase: string): Code;
}

export async function buildTestIModel(name: string, cb: (builder: TestIModelBuilder) => void): Promise<IModelConnection> {
  const outputFile = IModelBuilder.prepareOutputFile(name);
  const db = SnapshotDb.createEmpty(outputFile, { rootSubject: { name } });
  const builder: TestIModelBuilder = new IModelBuilder(db);
  try {
    cb(builder);
  } finally {
    db.close();
  }
  return SnapshotConnection.openFile(outputFile);
}

export class IModelBuilder implements TestIModelBuilder{
  private _iModel!: IModelDb;

  constructor(iModel: IModelDb) { this._iModel = iModel; }

  public insertModel<TProps extends ModelProps>(props: TProps): Id64String {
    const newModelId = this._iModel.models.insertModel(props);
    this._iModel.saveChanges("Added test model");
    return newModelId;
  }

  public insertElement<TProps extends ElementProps>(props: TProps): Id64String {
    const elementId = this._iModel.elements.insertElement(props);
    this._iModel.saveChanges("Added test element");
    return elementId;
  }

  public insertAspect<TProps extends ElementAspectProps>(props: TProps): void {
    this._iModel.elements.insertAspect(props);
    this._iModel.saveChanges("Added test element aspect");
  }

  public createCode(scopeModelId: CodeScopeProps, codeSpecName: string, codeValue: string): Code {
    const codeSpec: CodeSpec = this._iModel.codeSpecs.getByName(codeSpecName);
    return new Code({ spec: codeSpec.id, scope: scopeModelId, value: codeValue });
  }

  public getUniqueModelCode(newModelCodeBase: string): Code {
    let newModelCode: string = newModelCodeBase;
    let iter: number = 0;
    while (true) {
      const modelCode = InformationPartitionElement.createCode(this._iModel, IModel.rootSubjectId, newModelCode);
      if (this._iModel.elements.queryElementIdByCode(modelCode) === undefined)
        return modelCode;

      newModelCode = newModelCodeBase + iter;
      ++iter;
    }
  }

  /** Prepare for an output file by:
    * - Resolving the output file name under the known test output directory
    * - Making directories as necessary
    * - Removing a previous copy of the output file
    * @param fileName Name of output file
    */
  public static prepareOutputFile(fileName: string): LocalFileName {
    !IModelJsFs.existsSync(TEST_OUTPUT_DIR) && IModelJsFs.mkdirSync(TEST_OUTPUT_DIR);

    const outputFile = path.join(TEST_OUTPUT_DIR, `${fileName}.bim`);
    IModelJsFs.existsSync(outputFile) && IModelJsFs.unlinkSync(outputFile);
    return outputFile;
  }
}
