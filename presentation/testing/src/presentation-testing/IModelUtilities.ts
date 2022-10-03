/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module IModel
 */

import { IModelDb, IModelJsFs, SnapshotDb } from "@itwin/core-backend";
import { Id64String } from "@itwin/core-bentley";
import { BisCodeSpec, Code, CodeScopeProps, CodeSpec, ElementAspectProps, ElementProps, LocalFileName, ModelProps } from "@itwin/core-common";
import { IModelConnection, SnapshotConnection } from "@itwin/core-frontend";
import path from "path";
import { getTestOutputDir } from "./Helpers";

/**
 * Interface for IModel builder pattern. Used for building IModels to test rulesets.
 *
 * @public
 */
export interface TestIModelBuilder {
  insertModel<TProps extends ModelProps>(props: TProps): Id64String;
  insertElement<TProps extends ElementProps>(props: TProps): Id64String;
  insertAspect<TProps extends ElementAspectProps>(props: TProps): void;
  /** codeValue has to be unique */
  createCode(scopeModelId: CodeScopeProps, codeSpecName: BisCodeSpec, codeValue: string): Code;
}

/**
 * Function that takes builder actions and returns a connection to the build database.
 * @param name Name of test IModel
 * @param cb Callback function that executes all given builder actions
 *
 * @public
 */
export async function buildTestIModel(name: string, cb: (builder: TestIModelBuilder) => void): Promise<IModelConnection> {
  const outputFile = setupOutputFileLocation(name);
  const db = SnapshotDb.createEmpty(outputFile, { rootSubject: { name } });
  const builder: TestIModelBuilder = new IModelBuilder(db);
  try {
    cb(builder);
  } finally {
    db.saveChanges("Created test IModel");
    db.close();
  }
  return SnapshotConnection.openFile(outputFile);
}

/**
 * Default implementation of IModel builder pattern. Used for building IModels to test rulesets.
 *
 * @public
 */
export class IModelBuilder implements TestIModelBuilder{
  private _iModel: IModelDb;

  constructor(iModel: IModelDb) {
    this._iModel = iModel;
  }

  public insertModel<TProps extends ModelProps>(props: TProps): Id64String {
    const newModelId = this._iModel.models.insertModel(props);
    return newModelId;
  }

  public insertElement<TProps extends ElementProps>(props: TProps): Id64String {
    const elementId = this._iModel.elements.insertElement(props);
    return elementId;
  }

  public insertAspect<TProps extends ElementAspectProps>(props: TProps): void {
    this._iModel.elements.insertAspect(props);
  }

  public createCode(scopeModelId: CodeScopeProps, codeSpecName: BisCodeSpec, codeValue: string): Code {
    const codeSpec: CodeSpec = this._iModel.codeSpecs.getByName(codeSpecName);
    return new Code({ spec: codeSpec.id, scope: scopeModelId, value: codeValue });
  }
}

/** Prepare for an output file by:
  * - Resolving the output file name under the known test output directory
  * - Making directories as necessary
  * - Removing a previous copy of the output file
  * @param fileName Name of output file
  */
function setupOutputFileLocation(fileName: string): LocalFileName {
  const testOutputDir = getTestOutputDir();
  !IModelJsFs.existsSync(testOutputDir) && IModelJsFs.mkdirSync(testOutputDir);

  const outputFile = path.join(testOutputDir, `${fileName}.bim`);
  IModelJsFs.existsSync(outputFile) && IModelJsFs.unlinkSync(outputFile);
  return outputFile;
}
