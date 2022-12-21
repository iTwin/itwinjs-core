/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import path from "path";
import { IModelDb, IModelJsFs, SnapshotDb } from "@itwin/core-backend";
import { Id64String } from "@itwin/core-bentley";
import { BisCodeSpec, Code, CodeScopeProps, CodeSpec, ElementAspectProps, ElementProps, LocalFileName, ModelProps } from "@itwin/core-common";
import { IModelConnection, SnapshotConnection } from "@itwin/core-frontend";
import { Field } from "@itwin/presentation-common";

/**
 * Simplified type for `sinon.SinonSpy`.
 * @internal
 */
export type SinonSpy<T extends (...args: any) => any> = sinon.SinonSpy<Parameters<T>, ReturnType<T>>;

/** Returns field by given label. */
function tryGetFieldByLabelInternal(fields: Field[], label: string, allFields: Field[]): Field | undefined {
  for (const field of fields) {
    if (field.label === label)
      return field;

    if (field.isNestedContentField()) {
      const nestedMatchingField = tryGetFieldByLabelInternal(field.nestedFields, label, allFields);
      if (nestedMatchingField)
        return nestedMatchingField;
    }

    allFields.push(field);
  }
  return undefined;
}

/** Looks up a field by given label. Returns `undefined` if not found. */
export function tryGetFieldByLabel(fields: Field[], label: string): Field | undefined {
  return tryGetFieldByLabelInternal(fields, label, []);
}

/**
 * Returns field by given label.
 * @throws An error if the field is not found
 */
export function getFieldByLabel(fields: Field[], label: string): Field {
  const allFields = new Array<Field>();
  const result = tryGetFieldByLabelInternal(fields, label, allFields);
  if (!result)
    throw new Error(`Field '${label}' not found. Available fields: [${allFields.map((f) => `"${f.label}"`).join(", ")}]`);
  return result;
}

/**
 * Returns fields by given label.
 */
export function getFieldsByLabel(rootFields: Field[], label: string): Field[] {
  const foundFields = new Array<Field>();
  const handleFields = (fields: Field[]) => {
    for (const field of fields) {
      if (field.label === label)
        foundFields.push(field);
      if (field.isNestedContentField())
        handleFields(field.nestedFields);
    }
  };
  handleFields(rootFields);
  return foundFields;
}

export async function buildTestIModel(name: string, cb: (builder: IModelBuilder) => void): Promise<IModelConnection> {
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

function setupOutputFileLocation(fileName: string): LocalFileName {
  const testOutputDir = path.join(__dirname, ".imodels");
  !IModelJsFs.existsSync(testOutputDir) && IModelJsFs.mkdirSync(testOutputDir);

  const outputFile = path.join(testOutputDir, `${fileName}.bim`);
  IModelJsFs.existsSync(outputFile) && IModelJsFs.unlinkSync(outputFile);
  return outputFile;
}

export class IModelBuilder {
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
