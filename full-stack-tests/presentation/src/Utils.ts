/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import path from "path";
import sanitize from "sanitize-filename";
import { IModelDb, IModelJsFs, SnapshotDb } from "@itwin/core-backend";
import { BisCodeSpec, Code, IModel, LocalFileName } from "@itwin/core-common";
import { IModelConnection, SnapshotConnection } from "@itwin/core-frontend";
import { Field } from "@itwin/presentation-common";
import { GuidString } from "@itwin/core-bentley";

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

function createValidIModelFileName(imodelName: string) {
  return sanitize(imodelName.replace(/[ ]+/g, "-").replaceAll("`", "").replaceAll("'", "")).toLocaleLowerCase();
}

/**
 * Create an imodel with given name and invoke a callback to fill it with data required for a test.
 */
export async function buildTestIModelDb(name: string, cb: (db: IModelDb) => Promise<void>) {
  const outputFile = setupOutputFileLocation(createValidIModelFileName(name));
  const db = SnapshotDb.createEmpty(outputFile, { rootSubject: { name } });
  try {
    await cb(db);
  } catch (e) {
    db.close();
    throw e;
  }
  db.saveChanges("Created test IModel");
  return { db, fileName: outputFile };
}

/**
 * Create an imodel with given name and invoke a callback to fill it with data required for a test. Return a
 * frontend connection to the imodel.
 */
export async function buildTestIModelConnection(name: string, cb: (db: IModelDb) => Promise<void>): Promise<IModelConnection> {
  const { db, fileName } = await buildTestIModelDb(name, cb);
  db.close();
  return SnapshotConnection.openFile(fileName);
}

/** Insert a document partition element into created imodel. Return created element's className and Id. */
export function insertDocumentPartition(db: IModelDb, code: string, label?: string, federationGuid?: GuidString) {
  const id = db.elements.insertElement({
    classFullName: "BisCore:DocumentPartition",
    model: IModel.repositoryModelId,
    parent: { relClassName: "BisCore:SubjectOwnsPartitionElements", id: IModel.rootSubjectId },
    code: new Code({ spec: db.codeSpecs.getByName(BisCodeSpec.informationPartitionElement).id, scope: IModel.rootSubjectId, value: code }),
    userLabel: label,
    federationGuid,
  });
  return { className: "BisCore:DocumentPartition", id };
}

function setupOutputFileLocation(fileName: string): LocalFileName {
  const testOutputDir = path.join(__dirname, ".imodels");
  !IModelJsFs.existsSync(testOutputDir) && IModelJsFs.mkdirSync(testOutputDir);

  const ext = ".bim";
  let allowedFileNameLength: number | undefined;
  if (process.platform === "win32") {
    allowedFileNameLength = 260 - 12 - 1 - ext.length - (testOutputDir.length + 1);
  }
  if (allowedFileNameLength) {
    if (allowedFileNameLength <= 0)
      throw new Error("Trying to create an iModel too deep in the directory structure, file name is going to be too long");

    const pieceLength = (allowedFileNameLength - 3) / 2;
    fileName = `${fileName.slice(0, pieceLength)}...${fileName.slice(fileName.length - pieceLength)}`;
  }
  const outputFilePath = path.join(testOutputDir, `${fileName}${ext}`);

  IModelJsFs.existsSync(outputFilePath) && IModelJsFs.unlinkSync(outputFilePath);
  return outputFilePath;
}

/** Get path to a directory that is safe to use for read-write scenarios when running the tests */
export function getOutputRoot() {
  return path.join("out", process.pid.toString());
}

/** Given a file name, returns a path that is safe to use for read-write scenarios when running the tests */
export function prepareOutputFilePath(fileName: string): string {
  const filePath = path.join(getOutputRoot(), fileName);
  IModelJsFs.removeSync(filePath);
  return filePath;
}
