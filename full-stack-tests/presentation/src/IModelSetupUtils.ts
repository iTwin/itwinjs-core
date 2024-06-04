/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import path from "path";
import sanitize from "sanitize-filename";
import { IModelDb, IModelJsFs, SnapshotDb } from "@itwin/core-backend";
import { GuidString, Id64String } from "@itwin/core-bentley";
import {
  BisCodeSpec,
  CategoryProps,
  Code,
  ElementAspectProps,
  GeometricModel3dProps,
  IModel,
  InformationPartitionElementProps,
  LocalFileName,
  PhysicalElementProps,
} from "@itwin/core-common";
import { IModelConnection, SnapshotConnection } from "@itwin/core-frontend";
import { XMLParser } from "fast-xml-parser";

export function createValidIModelFileName(imodelName: string) {
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

/** Import an ECSchema into given iModel. */
export function importSchema(mochaContext: Mocha.Context, imodel: { importSchemaStrings: (xmls: string[]) => void }, schemaContentXml: string) {
  const schemaName = `SCHEMA_${mochaContext.test!.fullTitle()}`.replace(/[^\w\d_]/gi, "_").replace(/_+/g, "_");
  const schemaAlias = `test`;
  const schemaXml = `
    <?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="${schemaName}" alias="${schemaAlias}" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
      <ECSchemaReference name="CoreCustomAttributes" version="01.00.03" alias="CoreCA" />
      <ECSchemaReference name="ECDbMap" version="02.00.01" alias="ecdbmap" />
      ${schemaContentXml}
    </ECSchema>
  `;
  imodel.importSchemaStrings([schemaXml]);

  const parsedSchema = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
    isArray: (_, jpath) => jpath.startsWith("ECSchema."),
  }).parse(schemaXml);
  const schemaItems = Object.values(parsedSchema.ECSchema)
    .flatMap<any>((itemDef) => itemDef)
    .filter((itemDef: any) => !!itemDef.typeName);

  return {
    schemaName,
    schemaAlias,
    items: schemaItems.reduce<{ [className: string]: { name: string; fullName: string; label: string } }>((classesObj, schemaItemDef) => {
      const name = schemaItemDef.typeName;
      return {
        ...classesObj,
        [name]: {
          fullName: `${schemaName}:${name}`,
          name,
          label: schemaItemDef.displayLabel,
        },
      };
    }, {}),
  };
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

export function insertPhysicalModelWithPartition(props: { db: IModelDb; codeValue: string; partitionParentId?: Id64String }) {
  const { codeValue, partitionParentId, ...baseProps } = props;
  const partitionKey = insertPhysicalPartition({ ...baseProps, codeValue, parentId: partitionParentId ?? IModel.rootSubjectId });
  return insertPhysicalSubModel({ ...baseProps, modeledElementId: partitionKey.id });
}

export function insertPhysicalPartition(
  props: { db: IModelDb; codeValue: string; parentId: Id64String } & Partial<Omit<InformationPartitionElementProps, "id" | "parent" | "code">>,
) {
  const { db, classFullName, codeValue, parentId, ...partitionProps } = props;
  const defaultModelClassName = `BisCore:PhysicalPartition`;
  const className = classFullName ?? defaultModelClassName;
  const partitionId = db.elements.insertElement({
    classFullName: className,
    model: IModel.repositoryModelId,
    code: new Code({ spec: BisCodeSpec.informationPartitionElement, scope: parentId, value: codeValue }),
    parent: {
      id: parentId,
      relClassName: `BisCore:SubjectOwnsPartitionElements`,
    },
    ...partitionProps,
  });
  return { className, id: partitionId };
}

export function insertPhysicalSubModel(
  props: { db: IModelDb; modeledElementId: Id64String } & Partial<Omit<GeometricModel3dProps, "id" | "modeledElement" | "parentModel">>,
) {
  const { db, classFullName, modeledElementId, ...modelProps } = props;
  const defaultModelClassName = `BisCore:PhysicalModel`;
  const className = classFullName ?? defaultModelClassName;
  const modelId = db.models.insertModel({
    classFullName: className,
    modeledElement: { id: modeledElementId },
    ...modelProps,
  });
  return { className, id: modelId };
}

/** Insert a spatial category element into created imodel. Return created element's className and Id. */
export function insertSpatialCategory(
  props: { db: IModelDb; codeValue: string; modelId?: Id64String } & Partial<Omit<CategoryProps, "id" | "model" | "parent" | "code">>,
) {
  const { db, classFullName, modelId, codeValue, ...categoryProps } = props;
  const defaultClassName = `BisCore:SpatialCategory`;
  const className = classFullName ?? defaultClassName;
  const model = modelId ?? IModel.dictionaryId;
  const id = db.elements.insertElement({
    classFullName: className,
    model,
    code: new Code({ spec: BisCodeSpec.spatialCategory, scope: model, value: codeValue }),
    ...categoryProps,
  });
  return { className, id };
}

/** Insert a physical element into created imodel. Return created element's className and Id. */
export function insertPhysicalElement<TAdditionalProps extends {}>(
  props: { db: IModelDb; modelId: Id64String; categoryId: Id64String; parentId?: Id64String } & Partial<
    Omit<PhysicalElementProps, "id" | "model" | "category" | "parent">
  > &
    TAdditionalProps,
) {
  const { db, classFullName, modelId, categoryId, parentId, ...elementProps } = props;
  const defaultClassName = "Generic:PhysicalObject";
  const className = classFullName ?? defaultClassName;
  const id = db.elements.insertElement({
    classFullName: className,
    model: modelId,
    category: categoryId,
    code: Code.createEmpty(),
    ...(parentId
      ? {
          parent: {
            id: parentId,
            relClassName: `BisCore:PhysicalElementAssemblesElements`,
          },
        }
      : undefined),
    ...elementProps,
  } as PhysicalElementProps);
  return { className, id };
}

/** Insert an aspect into created imodel, return its key */
export function insertElementAspect<TAdditionalProps extends {}>(
  props: { db: IModelDb; elementId: Id64String } & Partial<Omit<ElementAspectProps, "element">> & TAdditionalProps,
) {
  const { db, classFullName, elementId, ...aspectProps } = props;
  const defaultClassName = "BisCore:ElementMultiAspect";
  const className = classFullName ?? defaultClassName;
  const id = db.elements.insertAspect({
    classFullName: className,
    element: {
      id: elementId,
    },
    ...aspectProps,
  } as ElementAspectProps);
  return { className, id };
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
    if (allowedFileNameLength <= 0) {
      throw new Error("Trying to create an iModel too deep in the directory structure, file name is going to be too long");
    }

    const pieceLength = (allowedFileNameLength - 3) / 2;
    fileName = `${fileName.slice(0, pieceLength)}...${fileName.slice(fileName.length - pieceLength)}`;
  }
  const outputFilePath = path.join(testOutputDir, `${fileName}${ext}`);

  IModelJsFs.existsSync(outputFilePath) && IModelJsFs.unlinkSync(outputFilePath);
  return outputFilePath;
}
