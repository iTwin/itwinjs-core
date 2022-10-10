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
 * @beta
 */
export interface TestIModelBuilder {
  /** Insert a model into the builder's iModel */
  insertModel<TProps extends ModelProps>(props: TProps): Id64String;
  /** Insert an element into the builder's iModel */
  insertElement<TProps extends ElementProps>(props: TProps): Id64String;
  /** Insert an element aspect into the specified element */
  insertAspect<TProps extends ElementAspectProps>(props: TProps): void;
  /**
   * Create code for specified element.
   * Code value has to be unique within its scope (see [Codes documentation page]($docs/bis/guide/fundamentals/codes.md)).
   */
  createCode(scopeModelId: CodeScopeProps, codeSpecName: BisCodeSpec, codeValue: string): Code;
}

/**
 * Function that creates an iModel and returns a connection to it.
 * @param name Name of test IModel
 * @param cb Callback function that receives an [[TestIModelBuilder]] to fill the iModel with data
 *
 * @beta
 */
export async function buildTestIModel(name: string, cb: (builder: TestIModelBuilder) => void): Promise<IModelConnection> {
  const outputFile = setupOutputFileLocation(name);
  const db = SnapshotDb.createEmpty(outputFile, { rootSubject: { name } });
  const builder = new IModelBuilder(db);
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
 * @internal
 */
export class IModelBuilder implements TestIModelBuilder {
  private _iModel: IModelDb;

  constructor(iModel: IModelDb) {
    this._iModel = iModel;
  }

  public insertModel<TProps extends ModelProps>(props: TProps): Id64String {
    return this._iModel.models.insertModel(props);
  }

  public insertElement<TProps extends ElementProps>(props: TProps): Id64String {
    return this._iModel.elements.insertElement(props);
  }

  public insertAspect<TProps extends ElementAspectProps>(props: TProps): void {
    this._iModel.elements.insertAspect(props);
  }

  public createCode(scopeModelId: CodeScopeProps, codeSpecName: BisCodeSpec, codeValue: string): Code {
    const codeSpec: CodeSpec = this._iModel.codeSpecs.getByName(codeSpecName);
    return new Code({ spec: codeSpec.id, scope: scopeModelId, value: codeValue });
  }
}

/**
 * Prepare for an output file by:
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
