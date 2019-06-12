/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { DbResult, Id64, Id64Array, Id64String, IModelStatus, Logger } from "@bentley/bentleyjs-core";
import { Code, CodeSpec, ElementProps, ExternalSourceAspectProps, IModel, IModelError } from "@bentley/imodeljs-common";
import { BackendLoggerCategory } from "./BackendLoggerCategory";
import { ECSqlStatement } from "./ECSqlStatement";
import { DefinitionPartition, Drawing, Element, InformationPartitionElement, Sheet, Subject } from "./Element";
import { ExternalSourceAspect, ElementAspect } from "./ElementAspect";
import { IModelDb } from "./IModelDb";
import { IModelHost } from "./IModelHost";
import { IModelJsNative } from "./IModelJsNative";
import { ElementRefersToElements, RelationshipProps } from "./Relationship";

const loggerCategory: string = BackendLoggerCategory.IModelImporter;

/** @alpha */
export class IModelImporter {
  private _sourceDb: IModelDb;
  private _targetDb: IModelDb;
  private _importContext: IModelJsNative.ImportContext;

  protected _excludedCodeSpecNames = new Set<string>();
  protected _excludedCodeSpecIds = new Set<Id64String>();
  protected _excludedElementIds = new Set<Id64String>();
  protected _excludedElementClassNames = new Set<string>();

  /** Construct a new IModelImporter
   * @param sourceDb The source IModelDb
   * @param targetDb The target IModelDb
   */
  public constructor(sourceDb: IModelDb, targetDb: IModelDb) {
    this._sourceDb = sourceDb;
    this._targetDb = targetDb;
    this._importContext = new IModelHost.platform.ImportContext(this._sourceDb.nativeDb, this._targetDb.nativeDb);
    this._importContext.addElementId(IModel.rootSubjectId, IModel.rootSubjectId);
  }

  /** Dispose any native resources associated with this IModelImporter. */
  public dispose(): void {
    this._importContext.dispose();
  }

  /** Add a mapping of source CodeSpecId to target CodeSpecId to the import context. */
  public addCodeSpecId(sourceId: Id64String, targetId: Id64String): void {
    this._importContext.addCodeSpecId(sourceId, targetId);
  }

  /** Look up a target CodeSpecId from the source CodeSpecId using the import context mapping.
   * @returns the target CodeSpecId
   */
  public findCodeSpecId(sourceId: Id64String): Id64String {
    return this._importContext.findCodeSpecId(sourceId);
  }

  public excludeCodeSpec(codeSpecName: string): void {
    this._excludedCodeSpecNames.add(codeSpecName);
  }

  public importCodeSpecs(): void {
    const sql = `SELECT ECInstanceId AS id FROM BisCore:CodeSpec`;
    this._sourceDb.withPreparedStatement(sql, (statement: ECSqlStatement) => {
      while (DbResult.BE_SQLITE_ROW === statement.step()) {
        const sourceCodeSpecId = statement.getRow().id;
        const codeSpec: CodeSpec = this._sourceDb.codeSpecs.getById(sourceCodeSpecId);
        if (this._excludedCodeSpecNames.has(codeSpec.name)) {
          Logger.logInfo(loggerCategory, `Excluding CodeSpec: ${codeSpec.name}`);
          this._excludedCodeSpecIds.add(codeSpec.id);
          continue;
        }
        const targetCodeSpecId = this._importContext.importCodeSpec(sourceCodeSpecId);
        if (!Id64.isValidId64(targetCodeSpecId)) {
          throw new IModelError(IModelStatus.InvalidCodeSpec, `Error importing CodeSpec: ${codeSpec.name}`, Logger.logError, loggerCategory);
        }
      }
    });
  }

  public importCodeSpec(sourceId: Id64String): Id64String {
    return this._importContext.importCodeSpec(sourceId);
  }

  public importFonts(): void {
    for (const font of this._sourceDb.fontMap.fonts.values()) {
      this._importContext.importFont(font.id);
    }
  }

  public excludeElementId(elementId: Id64String): void {
    this._excludedElementIds.add(elementId);
  }

  public excludeElementClass(classFullName: string): void {
    this._excludedElementClassNames.add(classFullName);
  }

  /** Add a mapping of source ElementId to target ElementId to the import context. */
  public addElementId(sourceId: Id64String, targetId: Id64String): void {
    this._importContext.addElementId(sourceId, targetId);
  }

  /** Look up a target ElementId from the source ElementId using the import context mapping.
   * @returns the target ElementId
   */
  public findElementId(sourceId: Id64String): Id64String {
    return this._importContext.findElementId(sourceId);
  }

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

  public excludeSubject(subjectPath: string): void {
    const subjectId: Id64String | undefined = IModelImporter.resolveSubjectId(this._sourceDb, subjectPath);
    if (subjectId && Id64.isValidId64(subjectId)) {
      this._excludedElementIds.add(subjectId);
    }
  }

  public initFromExternalSourceAspects(): void {
    const sql = `SELECT Element.Id AS elementId FROM ${ExternalSourceAspect.classFullName}`;
    this._targetDb.withPreparedStatement(sql, (statement: ECSqlStatement): void => {
      while (DbResult.BE_SQLITE_ROW === statement.step()) {
        const row = statement.getRow();
        const aspects: ElementAspect[] = this._targetDb.elements.getAspects(row.elementId, ExternalSourceAspect.classFullName);
        for (const aspect of aspects) {
          if (aspect.kind === Element.className) {
            this._importContext.addElementId(aspect.identifier, row.elementId);
          }
        }
      }
    });
  }

  public import(): void {
    const targetScopeElementId: Id64String = IModel.rootSubjectId;
    this.initFromExternalSourceAspects();
    this.importCodeSpecs();
    this.importFonts();
    this.importElement(IModel.rootSubjectId, targetScopeElementId);
    this.importModels(DefinitionPartition.classFullName, targetScopeElementId);
    this.importModels(InformationPartitionElement.classFullName, targetScopeElementId);
    this.importModels(Drawing.classFullName, targetScopeElementId);
    this.importModels(Sheet.classFullName, targetScopeElementId);
    this.importRelationships();
  }

  /** Returns true if the specified sourceElement should be excluded from the target iModel. */
  protected excludeElement(sourceElement: Element): boolean {
    if (this._excludedElementIds.has(sourceElement.id)) {
      Logger.logInfo(loggerCategory, `Exclude ${sourceElement.classFullName} [${sourceElement.id}] by Id`);
      return true;
    }
    if (this._excludedElementClassNames.has(sourceElement.classFullName)) { // WIP: handle subclasses
      Logger.logInfo(loggerCategory, `Exclude ${sourceElement.classFullName} [${sourceElement.id}] by class`);
      this.excludeElementId(sourceElement.id); // remember exclusion in case we encounter this sourceElement again
      return true;
    }
    if (this._excludedCodeSpecIds.has(sourceElement.code.spec)) {
      Logger.logInfo(loggerCategory, `Exclude ${sourceElement.classFullName} [${sourceElement.id}] by CodeSpec [${sourceElement.code.spec}]`);
      this.excludeElementId(sourceElement.id); // remember exclusion in case we encounter this sourceElement again
      return true;
    }
    if (sourceElement.category) {
      if (this._excludedElementIds.has(sourceElement.category)) {
        Logger.logInfo(loggerCategory, `Exclude ${sourceElement.classFullName} [${sourceElement.id}] by Category [${sourceElement.category}]`);
        this.excludeElementId(sourceElement.id); // remember exclusion in case we encounter this sourceElement again
        return true;
      }
    }
    return false;
  }

  /** Transform the specified sourceElement into ElementProps for the target iModel.
   * The most common case is 1 sourceElement transformed to 1 targetElement, but there are cases where a single sourceElement is transformed into multiple target Elements.
   * @param sourceElement The Element from the source iModel to transform.
   * @returns An array of ElementProps for the target iModel.
   */
  protected transformElement(sourceElement: Element): ElementProps[] {
    const array: ElementProps[] = [];
    const targetElementProps: ElementProps = this._importContext.cloneElement(sourceElement.id);
    targetElementProps.federationGuid = sourceElement.federationGuid; // cloneElement strips off federationGuid
    array.push(targetElementProps);
    return array;
  }

  /** Insert the transformed Element into the target iModel.
   * @param targetElementProps The ElementProps for the Element that will be inserted into the target iModel.
   * @param sourceAspectProps The ExternalSourceAspect owned by the target Element that will track the source Element.
   */
  protected insertElement(targetElementProps: ElementProps, sourceAspectProps: ExternalSourceAspectProps): void {
    if (!Id64.isValidId64(sourceAspectProps.identifier)) {
      throw new IModelError(IModelStatus.InvalidId, "ExternalSourceAspect.identifier not provided", Logger.logError, loggerCategory);
    }
    const targetElementId: Id64String = this._targetDb.elements.insertElement(targetElementProps); // insert from TypeScript so TypeScript handlers are called
    this.addElementId(sourceAspectProps.identifier, targetElementId);
    Logger.logInfo(loggerCategory, `Inserted ${targetElementProps.classFullName}-${targetElementProps.code.value}-${targetElementId}`);
    sourceAspectProps.element.id = targetElementId;
    this._targetDb.elements.insertAspect(sourceAspectProps);
  }

  /** Transform the specified sourceElement and update result into the target iModel.
   * @param targetElementId The Element in the target iModel to update
   * @param sourceAspectProps The ExternalSourceAspect owned by the target Element that will track the source Element.
   */
  protected updateElement(targetElementProps: ElementProps, sourceAspectProps: ExternalSourceAspectProps): void {
    if (!targetElementProps.id) {
      throw new IModelError(IModelStatus.InvalidId, "ElementId not provided", Logger.logError, loggerCategory);
    }
    this._targetDb.elements.updateElement(targetElementProps);
    ExternalSourceAspect.deleteForElement(this._targetDb, sourceAspectProps.scope.id, targetElementProps.id);
    this._targetDb.elements.insertAspect(sourceAspectProps);
  }

  /** Returns true if a change within sourceElement is detected.
   * @param sourceElement The Element from the source iModel
   * @param targetScopeElementId Identifies an Element in the **target** iModel that represents the **source** repository as a whole and scopes its [ExternalSourceAspect]($backend) instances.
   * @param targetElementId The Element from the target iModel to compare against.
   */
  protected hasElementChanged(sourceElement: Element, targetScopeElementId: Id64String, targetElementId: Id64String): boolean {
    const aspects: ElementAspect[] = this._targetDb.elements.getAspects(targetElementId, ExternalSourceAspect.classFullName);
    for (const aspect of aspects) {
      const sourceAspect = aspect as ExternalSourceAspect;
      if ((ExternalSourceAspect.Kind.Element === sourceAspect.kind) && (sourceAspect.scope.id === targetScopeElementId)) {
        const lastModifiedTime: string = this._targetDb.elements.queryLastModifiedTime(sourceElement.id);
        if ((lastModifiedTime === sourceAspect.version) || (sourceElement.computeHash() === sourceAspect.checksum)) {
          return false;
        }
      }
    }
    return true;
  }

  /** Import the specified Element and its child Elements (if applicable).
   * @param sourceElementId Identifies the Element from the source iModel to import.
   * @param targetScopeElementId Identifies an Element in the **target** iModel that represents the **source** repository as a whole and scopes its [ExternalSourceAspect]($backend) instances.
   */
  public importElement(sourceElementId: Id64String, targetScopeElementId: Id64String): void {
    const sourceElement: Element = this._sourceDb.elements.getElement({ id: sourceElementId, wantGeometry: true });
    if (this.excludeElement(sourceElement)) {
      return; // excluding an element will also exclude its children or sub-models
    }
    let targetElementId: Id64String | undefined = this.findElementId(sourceElementId);
    if (Id64.isValidId64(targetElementId)) {
      if (this.hasElementChanged(sourceElement, targetScopeElementId, targetElementId)) {
        const sourceAspectProps: ExternalSourceAspectProps = ExternalSourceAspect.initPropsForElement(sourceElement, targetScopeElementId, targetElementId);
        for (const targetElementProps of this.transformElement(sourceElement)) {
          targetElementProps.id = targetElementId;
          this.updateElement(targetElementProps, sourceAspectProps);
          break; // shouldn't be more than 1 targetElement in the update case
        }
      }
    } else {
      const transformedElementProps: ElementProps[] = this.transformElement(sourceElement);
      targetElementId = this._targetDb.elements.queryElementIdByCode(new Code(transformedElementProps[0].code));
      if (targetElementId === undefined) {
        const sourceAspectProps: ExternalSourceAspectProps = ExternalSourceAspect.initPropsForElement(sourceElement, targetScopeElementId);
        for (const targetElementProps of transformedElementProps) {
          this.insertElement(targetElementProps, sourceAspectProps);
        }
      } else if (this.hasElementChanged(sourceElement, targetScopeElementId, targetElementId)) {
        const sourceAspectProps: ExternalSourceAspectProps = ExternalSourceAspect.initPropsForElement(sourceElement, targetScopeElementId, targetElementId);
        for (const targetElementProps of transformedElementProps) {
          targetElementProps.id = targetElementId;
          this.updateElement(targetElementProps, sourceAspectProps);
          this.addElementId(sourceElement.id, targetElementId);
          break; // shouldn't be more than 1 targetElement in the update case
        }
      }
    }
    this.importChildElements(sourceElementId, targetScopeElementId);
  }

  /** Import child elements into the target IModelDb
   * @param sourceElementId Import the child elements of this element in the source IModelDb.
   * @param targetScopeElementId Identifies an Element in the **target** iModel that represents the **source** repository as a whole and scopes its [ExternalSourceAspect]($backend) instances.
   */
  public importChildElements(sourceElementId: Id64String, targetScopeElementId: Id64String): void {
    const childElementIds: Id64Array = this._sourceDb.elements.queryChildren(sourceElementId);
    for (const childElementId of childElementIds) {
      this.importElement(childElementId, targetScopeElementId);
    }
  }

  /** Import matching sub-models into the target IModelDb
   * @param modeledElementClass The [Element.classFullName]($backend) to use to query for which sub-models to import.
   * @param targetScopeElementId Identifies an Element in the **target** iModel that represents the **source** repository as a whole and scopes its [ExternalSourceAspect]($backend) instances.
   */
  public importModels(modeledElementClass: string, targetScopeElementId: Id64String): void {
    const sql = `SELECT ECInstanceId AS id FROM ${modeledElementClass}`;
    this._sourceDb.withPreparedStatement(sql, (statement: ECSqlStatement) => {
      while (DbResult.BE_SQLITE_ROW === statement.step()) {
        const modeledElementId = statement.getRow().id;
        this.importModel(modeledElementId);
        this.importModelContents(modeledElementId, targetScopeElementId);
      }
    });
  }

  /** Import the model (the container only) into the target IModelDb
   * @param sourceModeledElementId Import this model from the source IModelDb.
   */
  public importModel(sourceModeledElementId: Id64String): void {
    const targetModeledElementId = this.findElementId(sourceModeledElementId);
    try {
      if (this._targetDb.models.getModelProps(targetModeledElementId)) {
        return; // already imported
      }
    } catch (error) {
      // catch NotFound error and insertModel
      const modelProps = this._sourceDb.models.getModelProps(sourceModeledElementId);
      modelProps.modeledElement.id = targetModeledElementId;
      modelProps.id = targetModeledElementId;
      modelProps.parentModel = this.findElementId(modelProps.parentModel!);
      this._targetDb.models.insertModel(modelProps);
    }
  }

  /** Import the model contents into the target IModelDb
   * @param sourceModeledElementId Import the contents of this model from the source IModelDb.
   * @param targetScopeElementId Identifies an Element in the **target** iModel that represents the **source** repository as a whole and scopes its [ExternalSourceAspect]($backend) instances.
   */
  public importModelContents(sourceModeledElementId: Id64String, targetScopeElementId: Id64String): void {
    const sql = `SELECT ECInstanceId AS id FROM ${Element.classFullName} WHERE Parent.Id IS NULL AND Model.Id=:modelId`;
    this._sourceDb.withPreparedStatement(sql, (statement: ECSqlStatement) => {
      statement.bindId("modelId", sourceModeledElementId);
      while (DbResult.BE_SQLITE_ROW === statement.step()) {
        const row = statement.getRow();
        this.importElement(row.id, targetScopeElementId);
      }
    });
  }

  public importRelationships(): void {
    const sql = `SELECT ECInstanceId AS id FROM ${ElementRefersToElements.classFullName}`;
    this._sourceDb.withPreparedStatement(sql, (statement: ECSqlStatement) => {
      while (DbResult.BE_SQLITE_ROW === statement.step()) {
        const row = statement.getRow();
        const relationshipProps = this._sourceDb.relationships.getInstanceProps<RelationshipProps>(ElementRefersToElements.classFullName, row.id);
        relationshipProps.sourceId = this.findElementId(relationshipProps.sourceId);
        relationshipProps.targetId = this.findElementId(relationshipProps.targetId);
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
