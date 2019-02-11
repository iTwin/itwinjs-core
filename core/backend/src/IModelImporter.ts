/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { DbResult, Id64, Id64Array, Id64String, IModelStatus, Logger } from "@bentley/bentleyjs-core";
import { Code, CodeSpec, ElementProps, IModel, IModelError } from "@bentley/imodeljs-common";
import { ECSqlStatement } from "./ECSqlStatement";
import { DefinitionPartition, Drawing, Element, InformationPartitionElement, Sheet, Subject } from "./Element";
import { IModelDb } from "./IModelDb";
import { IModelJsNative } from "./IModelJsNative";
import { IModelHost } from "./IModelHost";
import { ElementRefersToElements, RelationshipProps } from "./Relationship";

const logCategory = "IModelImporter";

export class IModelImporter {
  private _sourceDb: IModelDb;
  private _targetDb: IModelDb;
  private _importContext: IModelJsNative.ImportContext;

  protected _excludedCodeSpecNames = new Set<string>();
  protected _excludedCodeSpecIds = new Set<Id64String>();
  protected _excludedElementIds = new Set<Id64String>();
  protected _excludedElementClassNames = new Set<string>();

  /** */
  public constructor(sourceDb: IModelDb, targetDb: IModelDb) {
    this._sourceDb = sourceDb;
    this._targetDb = targetDb;
    this._importContext = new IModelHost.platform.ImportContext(this._sourceDb.nativeDb, this._targetDb.nativeDb);
    this._importContext.addElementId(IModel.rootSubjectId, IModel.rootSubjectId);
  }
  /** */
  public dispose(): void {
    this._importContext.dispose();
  }
  /** */
  public addCodeSpecId(sourceId: Id64String, targetId: Id64String): void {
    this._importContext.addCodeSpecId(sourceId, targetId);
  }
  /** */
  public findCodeSpecId(sourceId: Id64String): Id64String {
    return this._importContext.findCodeSpecId(sourceId);
  }
  /** */
  public excludeCodeSpec(codeSpecName: string): void {
    this._excludedCodeSpecNames.add(codeSpecName);
  }
  /** */
  public importCodeSpecs(): void {
    const sql = `SELECT ECInstanceId AS id FROM BisCore:CodeSpec`;
    this._sourceDb.withPreparedStatement(sql, (statement: ECSqlStatement) => {
      while (DbResult.BE_SQLITE_ROW === statement.step()) {
        const sourceCodeSpecId = statement.getRow().id;
        const codeSpec: CodeSpec = this._sourceDb.codeSpecs.getById(sourceCodeSpecId);
        if (this._excludedCodeSpecNames.has(codeSpec.name)) {
          Logger.logInfo(logCategory, `Excluding CodeSpec: ${codeSpec.name}`);
          this._excludedCodeSpecIds.add(codeSpec.id);
          continue;
        }
        const targetCodeSpecId = this._importContext.importCodeSpec(sourceCodeSpecId);
        if (!Id64.isValidId64(targetCodeSpecId)) {
          throw new IModelError(IModelStatus.InvalidCodeSpec, `Error importing CodeSpec: ${codeSpec.name}`, Logger.logError, logCategory);
        }
      }
    });
  }
  /** */
  public importCodeSpec(sourceId: Id64String): Id64String {
    return this._importContext.importCodeSpec(sourceId);
  }
  /** */
  public importFonts(): void {
    for (const font of this._sourceDb.fontMap.fonts.values()) {
      this._importContext.importFont(font.id);
    }
  }
  /** */
  public excludeElementId(elementId: Id64String): void {
    this._excludedElementIds.add(elementId);
  }
  /** */
  public excludeElementClass(classFullName: string): void {
    this._excludedElementClassNames.add(classFullName);
  }
  /** */
  public addElementId(sourceId: Id64String, targetId: Id64String): void {
    this._importContext.addElementId(sourceId, targetId);
  }
  /** */
  public findElementId(sourceId: Id64String): Id64String {
    return this._importContext.findElementId(sourceId);
  }
  /** */
  public static resolveSubjectId(iModelDb: IModelDb, subjectPath: string): Id64String | undefined {
    let subjectId: Id64String | undefined = IModel.rootSubjectId;
    const subjectNames: string[] = subjectPath.split("/");
    for (const subjectName of subjectNames) {
      if ("" === subjectName) {
        continue;
      }
      const subjectCode: Code = Subject.createCode(iModelDb, subjectId!, subjectName);
      subjectId = iModelDb.elements.queryElementIdByCode(subjectCode);
      if (undefined === subjectId) {
        break;
      }
    }
    return subjectId;
  }
  /** */
  public excludeSubject(subjectPath: string): void {
    const subjectId: Id64String | undefined = IModelImporter.resolveSubjectId(this._sourceDb, subjectPath);
    if (subjectId && Id64.isValidId64(subjectId)) {
      this._excludedElementIds.add(subjectId);
    }
  }
  /** */
  public import(): void {
    this.importCodeSpecs();
    this.importFonts();
    this.importElement(IModel.rootSubjectId);
    this.importModels(DefinitionPartition.classFullName);
    this.importModels(InformationPartitionElement.classFullName);
    this.importModels(Drawing.classFullName);
    this.importModels(Sheet.classFullName);
    this.importRelationships();
  }
  /** */
  public importElement(sourceElementId: Id64String): Id64String {
    let targetElementId: Id64String | undefined = this._importContext.findElementId(sourceElementId);
    if (!Id64.isValidId64(targetElementId)) {
      if (this._excludedElementIds.has(sourceElementId)) {
        Logger.logInfo(logCategory, `Excluding Element(${sourceElementId})`);
        return Id64.invalid; // already excluded
      }
      const sourceElementProps = this._sourceDb.elements.getElementProps({ id: sourceElementId, wantGeometry: false });
      if (this._excludedElementClassNames.has(sourceElementProps.classFullName)) { // WIP: handle subclasses
        Logger.logInfo(logCategory, `Excluding Element(${sourceElementId}) by Class(${sourceElementProps.classFullName})`);
        this.excludeElementId(sourceElementId);
        return Id64.invalid; // excluded by class
      }
      if (this._excludedCodeSpecIds.has(sourceElementProps.code.spec)) {
        Logger.logInfo(logCategory, `Excluding Element(${sourceElementId}) by CodeSpec(${sourceElementProps.code.spec})`);
        this.excludeElementId(sourceElementId);
        return Id64.invalid; // excluded by CodeSpec
      }
      if (sourceElementProps.category) {
        if (this._excludedElementIds.has(sourceElementProps.category)) {
          Logger.logInfo(logCategory, `Excluding Element(${sourceElementId}) by Category(${sourceElementProps.category})`);
          this.excludeElementId(sourceElementId);
          return Id64.invalid; // excluded by Category
        }
      }
      const targetElementProps: ElementProps = this._importContext.cloneElement(sourceElementId);
      targetElementId = this._targetDb.elements.queryElementIdByCode(new Code(targetElementProps.code));
      if (targetElementId === undefined) {
        try {
          targetElementId = this._targetDb.elements.insertElement(targetElementProps); // insert from TypeScript so TypeScript handlers are called
          this.addElementId(sourceElementId, targetElementId);
          Logger.logInfo(logCategory, `Inserted ${targetElementProps.classFullName}-${targetElementProps.code.value}-${targetElementId}`);
        } catch (error) {
          Logger.logError(logCategory, "Error inserting Element into target iModel");
        }
      } else {
        try {
          targetElementProps.id = targetElementId;
          this._targetDb.elements.updateElement(targetElementProps);
          this.addElementId(sourceElementId, targetElementId);
        } catch (error) {
          Logger.logError(logCategory, "Error updating Element within target iModel");
        }
      }
    }
    this._importChildElements(sourceElementId);
    return targetElementId!;
  }
  /** */
  private _importChildElements(elementId: Id64String): void {
    const childElementIds: Id64Array = this._sourceDb.elements.queryChildren(elementId);
    for (const childElementId of childElementIds) {
      this.importElement(childElementId);
    }
  }
  /** */
  public importModels(modeledElementClass: string): void {
    const sql = `SELECT ECInstanceId AS id FROM ${modeledElementClass}`;
    this._sourceDb.withPreparedStatement(sql, (statement: ECSqlStatement) => {
      while (DbResult.BE_SQLITE_ROW === statement.step()) {
        const modeledElementId = statement.getRow().id;
        this.importModel(modeledElementId);
        this.importModelContents(modeledElementId);
      }
    });
  }
  /** */
  public importModel(sourceModeledElementId: Id64String): void {
    const targetModeledElementId = this._importContext.findElementId(sourceModeledElementId);
    try {
      if (this._targetDb.models.getModelProps(targetModeledElementId)) {
        return; // already imported
      }
    } catch (error) {
      // catch NotFound error and insertModel
      const modelProps = this._sourceDb.models.getModelProps(sourceModeledElementId);
      modelProps.modeledElement.id = targetModeledElementId;
      modelProps.id = targetModeledElementId;
      modelProps.parentModel = this._importContext.findElementId(modelProps.parentModel!);
      this._targetDb.models.insertModel(modelProps);
    }
  }
  /** */
  public importModelContents(modelId: Id64String): void {
    const sql = `SELECT ECInstanceId AS id FROM ${Element.classFullName} WHERE Parent.Id IS NULL AND Model.Id=:modelId`;
    this._sourceDb.withPreparedStatement(sql, (statement: ECSqlStatement) => {
      statement.bindId("modelId", modelId);
      while (DbResult.BE_SQLITE_ROW === statement.step()) {
        const row = statement.getRow();
        this.importElement(row.id);
      }
    });
  }
  /** */
  public importRelationships(): void {
    const sql = `SELECT ECInstanceId AS id FROM ${ElementRefersToElements.classFullName}`;
    this._sourceDb.withPreparedStatement(sql, (statement: ECSqlStatement) => {
      while (DbResult.BE_SQLITE_ROW === statement.step()) {
        const row = statement.getRow();
        const relationshipProps = this._sourceDb.relationships.getInstanceProps<RelationshipProps>(ElementRefersToElements.classFullName, row.id);
        relationshipProps.sourceId = this._importContext.findElementId(relationshipProps.sourceId);
        relationshipProps.targetId = this._importContext.findElementId(relationshipProps.targetId);
        if (Id64.isValidId64(relationshipProps.sourceId) && Id64.isValidId64(relationshipProps.targetId)) {
          try {
            // check for an existing relationship
            this._targetDb.relationships.getInstanceProps<RelationshipProps>(relationshipProps.classFullName, { sourceId: relationshipProps.sourceId, targetId: relationshipProps.targetId });
          } catch (error) {
            // catch NotFound error and insert relationship
            this._targetDb.relationships.insertInstance(relationshipProps);
          }
        }
      }
    });
  }
}
