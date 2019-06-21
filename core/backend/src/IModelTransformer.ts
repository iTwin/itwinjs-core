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

const loggerCategory: string = BackendLoggerCategory.IModelTransformer;

/** @alpha */
export class IModelTransformer {
  /** The read-only source iModel. */
  protected _sourceDb: IModelDb;
  /** The read/write target iModel. */
  protected _targetDb: IModelDb;
  /** The native import context */
  private _importContext: IModelJsNative.ImportContext;
  /** The set of CodeSpecs to exclude from transformation to the target iModel. */
  protected _excludedCodeSpecNames = new Set<string>();
  /** The set of specific Elements to exclude from transformation to the target iModel. */
  protected _excludedElementIds = new Set<Id64String>();
  /** The set of Categories where Elements in that Category will be excluded from transformation to the target iModel. */
  protected _excludedElementCategoryIds = new Set<Id64String>();
  /** The set of classes of Elements that will be excluded (polymorphically) from transformation to the target iModel. */
  protected _excludedElementClasses = new Set<typeof Element>();

  /** Construct a new IModelImporter
   * @param sourceDb The source IModelDb
   * @param targetDb The target IModelDb
   */
  public constructor(sourceDb: IModelDb, targetDb: IModelDb) {
    this._sourceDb = sourceDb;
    this._targetDb = targetDb;
    this._importContext = new IModelHost.platform.ImportContext(this._sourceDb.nativeDb, this._targetDb.nativeDb);
  }

  /** Dispose any native resources associated with this IModelImporter. */
  public dispose(): void {
    this._importContext.dispose();
  }

  /** Add a rule that remaps the specified source CodeSpec to the specified target CodeSpec.
   * @param sourceCodeSpecName The name of the CodeSpec from the source iModel.
   * @param targetCodeSpecName The name of the CodeSpec from the target iModel.
   */
  public remapCodeSpec(sourceCodeSpecName: string, targetCodeSpecName: string): void {
    const sourceCodeSpec: CodeSpec = this._sourceDb.codeSpecs.getByName(sourceCodeSpecName);
    const targetCodeSpec: CodeSpec = this._targetDb.codeSpecs.getByName(targetCodeSpecName);
    this._importContext.addCodeSpecId(sourceCodeSpec.id, targetCodeSpec.id);
  }

  /** Add a rule that remaps the specified source class to the specified target class. */
  public remapElementClass(sourceClassFullName: string, targetClassFullName: string): void {
    this._importContext.addClass(sourceClassFullName, targetClassFullName);
  }

  /** Add a rule that remaps the specified source Element to the specified target Element. */
  public remapElement(sourceId: Id64String, targetId: Id64String): void {
    this._importContext.addElementId(sourceId, targetId);
  }

  /** Look up a target CodeSpecId from the source CodeSpecId.
   * @returns the target CodeSpecId
   */
  public findTargetCodeSpecId(sourceId: Id64String): Id64String {
    return this._importContext.findCodeSpecId(sourceId);
  }

  /** Look up a target ElementId from the source ElementId.
   * @returns the target ElementId
   */
  public findTargetElementId(sourceElementId: Id64String): Id64String {
    return this._importContext.findElementId(sourceElementId);
  }

  /** Add a rule to exclude a CodeSpec */
  public excludeCodeSpec(codeSpecName: string): void {
    this._excludedCodeSpecNames.add(codeSpecName);
  }

  /** Add a rule to exclude a specific Element.
   * @param sourceElementId The Id of the Element from the source iModel.
   */
  public excludeElement(sourceElementId: Id64String): void {
    this._excludedElementIds.add(sourceElementId);
  }

  /** Add a rule to exclude a Subject based on its path */
  public excludeSubject(subjectPath: string): void {
    const subjectId: Id64String | undefined = IModelTransformer.resolveSubjectId(this._sourceDb, subjectPath);
    if (subjectId && Id64.isValidId64(subjectId)) {
      this._excludedElementIds.add(subjectId);
    }
  }

  /** Add a rule to exclude all Elements of a specified Category. */
  public excludeElementCategory(sourceCategoryId: Id64String): void {
    this._excludedElementCategoryIds.add(sourceCategoryId);
  }

  /** Add a rule to exclude all Elements of a specified class. */
  public excludeElementClass(sourceClassFullName: string): void {
    this._excludedElementClasses.add(this._sourceDb.getJsClass<typeof Element>(sourceClassFullName));
  }

  /** Resolve the Subject's ElementId from the specified subjectPath. */
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

  // WIP: Missing targetScopeElementId
  /** Initialize the source to target Element mapping from ExternalSourceAspects in the target iModel. */
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

  /** Called after the decision has been made to exclude a source CodeSpec from the target iModel.
   * @param _codeSpecName The name of the source CodeSpec that was excluded from transformation.
   * @note A subclass can override this method to be notified after a CodeSpec has been excluded.
   */
  protected onCodeSpecExcluded(_codeSpecName: string): void { }

  /** Called after processing a source Element when that processing caused an Element or Elements to be inserted in the target iModel.
   * @param _sourceElement The sourceElement that was processed
   * @param _targetElementIds An array of ElementIds that identify the Elements that were inserted into the target iModel because of processing the source Element.
   * @note A subclass can override this method to be notified after Elements have been inserted. This can be used to establish relationships or for other operations that require knowing ElementIds.
   */
  protected onElementInserted(_sourceElement: Element, _targetElementIds: Id64Array): void { }

  /** Called after processing a source Element when that processing caused an Element or Elements to be updated in the target iModel.
   * @param _sourceElement The sourceElement that was processed
   * @param _targetElementIds An array of ElementIds that identify the Elements that were updated in the target iModel because of processing the source Element.
   * @note A subclass can override this method to be notified after Elements have been updated. This can be used to establish relationships or for other operations that require knowing ElementIds.
   */
  protected onElementUpdated(_sourceElement: Element, _targetElementIds: Id64Array): void { }

  /** Called after processing a source Element when that processing caused an Element to be excluded from the target iModel.
   * @param _sourceElement The source Element that was excluded from transformation.
   * @note A subclass can override this method to be notified after an Element has been excluded.
   */
  protected onElementExcluded(_sourceElement: Element): void { }

  /** Returns true if the specified sourceElement should be excluded from the target iModel.
   * @param sourceElement The Element from the source iModel to consider
   * @returns `true` if sourceElement should be excluded from the target iModel or `false` if sourceElement should be transformed into the target iModel.
   * @note A subclass can override this method to provide custom Element exclusion behavior.
   */
  protected shouldExcludeElement(sourceElement: Element): boolean {
    if (this._excludedElementIds.has(sourceElement.id)) {
      Logger.logInfo(loggerCategory, `Exclude ${sourceElement.classFullName} [${sourceElement.id}] by Id`);
      return true;
    }
    if (sourceElement.category) {
      if (this._excludedElementCategoryIds.has(sourceElement.category)) {
        Logger.logInfo(loggerCategory, `Exclude ${sourceElement.classFullName} [${sourceElement.id}] by Category [${sourceElement.category}]`);
        return true;
      }
    }
    for (const excludedElementClass of this._excludedElementClasses) {
      if (sourceElement instanceof excludedElementClass) {
        Logger.logInfo(loggerCategory, `Exclude ${sourceElement.classFullName} [${sourceElement.id}] by class`);
        return true;
      }
    }
    return false;
  }

  /** Transform the specified sourceElement into ElementProps for the target iModel.
   * The most common case is 1 sourceElement transformed to 1 targetElement, but there are cases where a single sourceElement is transformed into multiple target Elements.
   * @param sourceElement The Element from the source iModel to transform.
   * @returns An array of ElementProps for the target iModel.
   * @note A subclass can override this method to provide custom transform behavior.
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
   * @note A subclass can override this method to provide custom insert behavior.
   */
  protected insertElement(targetElementProps: ElementProps, sourceAspectProps: ExternalSourceAspectProps): void {
    if (!Id64.isValidId64(sourceAspectProps.identifier)) {
      throw new IModelError(IModelStatus.InvalidId, "ExternalSourceAspect.identifier not provided", Logger.logError, loggerCategory);
    }
    const targetElementId: Id64String = this._targetDb.elements.insertElement(targetElementProps); // insert from TypeScript so TypeScript handlers are called
    this.remapElement(sourceAspectProps.identifier, targetElementId);
    Logger.logInfo(loggerCategory, `Inserted ${targetElementProps.classFullName}-${targetElementProps.code.value}-${targetElementId}`);
    sourceAspectProps.element.id = targetElementId;
    this._targetDb.elements.insertAspect(sourceAspectProps);
  }

  /** Transform the specified sourceElement and update result into the target iModel.
   * @param targetElementId The Element in the target iModel to update
   * @param sourceAspectProps The ExternalSourceAspect owned by the target Element that will track the source Element.
   * @note A subclass can override this method to provide custom update behavior.
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
   * @note A subclass can override this method to provide custom change detection behavior.
   */
  protected hasElementChanged(sourceElement: Element, targetScopeElementId: Id64String, targetElementId: Id64String): boolean {
    const aspects: ElementAspect[] = this._targetDb.elements.getAspects(targetElementId, ExternalSourceAspect.classFullName);
    for (const aspect of aspects) {
      const sourceAspect = aspect as ExternalSourceAspect;
      if ((sourceAspect.identifier === sourceElement.id) && (sourceAspect.scope.id === targetScopeElementId) && (sourceAspect.kind === ExternalSourceAspect.Kind.Element)) {
        const lastModifiedTime: string = sourceElement.iModel.elements.queryLastModifiedTime(sourceElement.id);
        return (lastModifiedTime !== sourceAspect.version) || (sourceElement.computeHash() !== sourceAspect.checksum);
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
    if (this.shouldExcludeElement(sourceElement)) {
      this.onElementExcluded(sourceElement);
      return; // excluding an element will also exclude its children or sub-models
    }
    let targetElementId: Id64String | undefined = this.findTargetElementId(sourceElementId);
    if (Id64.isValidId64(targetElementId)) {
      if (this.hasElementChanged(sourceElement, targetScopeElementId, targetElementId)) {
        const transformedElementProps: ElementProps[] = this.transformElement(sourceElement);
        if (transformedElementProps.length > 0) {
          transformedElementProps[0].id = targetElementId;
          const sourceAspectProps: ExternalSourceAspectProps = ExternalSourceAspect.initPropsForElement(sourceElement, targetScopeElementId, targetElementId);
          for (const targetElementProps of transformedElementProps) {
            this.updateElement(targetElementProps, sourceAspectProps);
          }
          this.onElementUpdated(sourceElement, transformedElementProps.map((elementProps: ElementProps) => elementProps.id!));
        }
      }
    } else {
      const transformedElementProps: ElementProps[] = this.transformElement(sourceElement);
      targetElementId = this._targetDb.elements.queryElementIdByCode(new Code(transformedElementProps[0].code));
      if (targetElementId === undefined) {
        if (transformedElementProps.length > 0) {
          const sourceAspectProps: ExternalSourceAspectProps = ExternalSourceAspect.initPropsForElement(sourceElement, targetScopeElementId);
          for (const targetElementProps of transformedElementProps) {
            this.insertElement(targetElementProps, sourceAspectProps);
          }
          this.onElementInserted(sourceElement, transformedElementProps.map((elementProps: ElementProps) => elementProps.id!));
        }
      } else if (this.hasElementChanged(sourceElement, targetScopeElementId, targetElementId)) {
        if (transformedElementProps.length > 0) {
          this.remapElement(sourceElement.id, targetElementId); // record that the targeElement was found by Code
          transformedElementProps[0].id = targetElementId;
          const sourceAspectProps: ExternalSourceAspectProps = ExternalSourceAspect.initPropsForElement(sourceElement, targetScopeElementId, targetElementId);
          for (const targetElementProps of transformedElementProps) {
            this.updateElement(targetElementProps, sourceAspectProps);
          }
          this.onElementUpdated(sourceElement, transformedElementProps.map((elementProps: ElementProps) => elementProps.id!));
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
        const modeledElementId: Id64String = statement.getRow().id;
        const modeledElement: Element = this._sourceDb.elements.getElement({ id: modeledElementId, wantGeometry: true });
        if (this.shouldExcludeElement(modeledElement)) {
          this.onElementExcluded(modeledElement);
        } else {
          this.importModel(modeledElementId);
          this.importModelContents(modeledElementId, targetScopeElementId);
        }
      }
    });
  }

  /** Import the model (the container only) into the target IModelDb
   * @param sourceModeledElementId Import this model from the source IModelDb.
   */
  public importModel(sourceModeledElementId: Id64String): void {
    const targetModeledElementId = this.findTargetElementId(sourceModeledElementId);
    try {
      if (this._targetDb.models.getModelProps(targetModeledElementId)) {
        return; // already imported
      }
    } catch (error) {
      // catch NotFound error and insertModel
      const modelProps = this._sourceDb.models.getModelProps(sourceModeledElementId);
      modelProps.modeledElement.id = targetModeledElementId;
      modelProps.id = targetModeledElementId;
      modelProps.parentModel = this.findTargetElementId(modelProps.parentModel!);
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

  /** Imports all relationships that subclass from BisCore:ElementRefersToElements */
  public importRelationships(): void {
    const sql = `SELECT ECInstanceId AS id FROM ${ElementRefersToElements.classFullName}`;
    this._sourceDb.withPreparedStatement(sql, (statement: ECSqlStatement) => {
      while (DbResult.BE_SQLITE_ROW === statement.step()) {
        const row = statement.getRow();
        const relationshipProps = this._sourceDb.relationships.getInstanceProps<RelationshipProps>(ElementRefersToElements.classFullName, row.id);
        relationshipProps.sourceId = this.findTargetElementId(relationshipProps.sourceId);
        relationshipProps.targetId = this.findTargetElementId(relationshipProps.targetId);
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

  /** Import all fonts from the source iModel into the target iModel. */
  public importFonts(): void {
    for (const font of this._sourceDb.fontMap.fonts.values()) {
      this._importContext.importFont(font.id);
    }
  }

  /** Import all CodeSpecs from the source iModel into the target iModel. */
  public importCodeSpecs(): void {
    const sql = `SELECT Name FROM BisCore:CodeSpec`;
    this._sourceDb.withPreparedStatement(sql, (statement: ECSqlStatement) => {
      while (DbResult.BE_SQLITE_ROW === statement.step()) {
        const codeSpecName: string = statement.getRow().name;
        this.importCodeSpec(codeSpecName);
      }
    });
  }

  /** Import a single CodeSpec from the source iModel into the target iModel. */
  public importCodeSpec(codeSpecName: string): void {
    if (this._excludedCodeSpecNames.has(codeSpecName)) {
      Logger.logInfo(loggerCategory, `Excluding CodeSpec: ${codeSpecName}`);
      this.onCodeSpecExcluded(codeSpecName);
      return;
    }
    const sourceCodeSpecId: Id64String = this._sourceDb.codeSpecs.queryId(codeSpecName);
    this._importContext.importCodeSpec(sourceCodeSpecId);
  }

  /** Attempts to import everything from the source iModel into the target iModel. */
  public importAll(): void {
    const targetScopeElementId: Id64String = IModel.rootSubjectId; // WIP
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
}
