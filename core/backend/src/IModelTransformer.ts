/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { ClientRequestContext, DbResult, Guid, Id64, Id64Array, Id64Set, Id64String, IModelStatus, Logger } from "@bentley/bentleyjs-core";
import { AuthorizedClientRequestContext } from "@bentley/imodeljs-clients";
import { Code, CodeSpec, ElementAspectProps, ElementProps, ExternalSourceAspectProps, IModel, IModelError, ModelProps, PrimitiveTypeCode, PropertyMetaData } from "@bentley/imodeljs-common";
import { IModelJsNative } from "@bentley/imodeljs-native";
import * as path from "path";
import { BackendLoggerCategory } from "./BackendLoggerCategory";
import { ECSqlStatement } from "./ECSqlStatement";
import { DefinitionPartition, Element, InformationPartitionElement, Subject } from "./Element";
import { ElementAspect, ElementMultiAspect, ElementUniqueAspect, ExternalSourceAspect } from "./ElementAspect";
import { IModelDb } from "./IModelDb";
import { IModelHost, KnownLocations } from "./IModelHost";
import { IModelJsFs } from "./IModelJsFs";
import { Model } from "./Model";
import { ElementRefersToElements, Relationship, RelationshipProps } from "./Relationship";

const loggerCategory: string = BackendLoggerCategory.IModelTransformer;

/** Base class used to transform a source iModel into a different target iModel.
 * @alpha
 */
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
  /** The set of Elements that were skipped during a prior transformation pass. */
  protected _skippedElementIds = new Set<Id64String>();
  /** The set of classes of ElementAspects that will be excluded (polymorphically) from transformation to the target iModel. */
  protected _excludedElementAspectClasses = new Set<typeof ElementAspect>();
  /** The set of classes of Relationships that will be excluded (polymorphically) from transformation to the target iModel. */
  protected _excludedRelationshipClasses = new Set<typeof Relationship>();

  /** Construct a new IModelImporter
   * @param sourceDb The source IModelDb
   * @param targetDb The target IModelDb
   */
  public constructor(sourceDb: IModelDb, targetDb: IModelDb) {
    this._sourceDb = sourceDb;
    this._targetDb = targetDb;
    this._importContext = new IModelHost.platform.ImportContext(this._sourceDb.nativeDb, this._targetDb.nativeDb);
    this.excludeElementAspectClass(ExternalSourceAspect.classFullName);
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

  /** Add a rule to exclude all ElementAspects of a specified class. */
  public excludeElementAspectClass(sourceClassFullName: string): void {
    this._excludedElementAspectClasses.add(this._sourceDb.getJsClass<typeof ElementAspect>(sourceClassFullName));
  }

  /** Add a rule to exclude all Relationships of a specified class. */
  public excludeRelationshipClass(sourceClassFullName: string): void {
    this._excludedRelationshipClasses.add(this._sourceDb.getJsClass<typeof Relationship>(sourceClassFullName));
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

  /** Called after processing a source Relationship when that processing caused a new Relationship to be inserted in the target iModel.
   * @param _sourceRelationship The sourceRelationship that was processed
   * @param _targetRelationshipProps The RelationshipProps that were inserted into the target iModel.
   * @note A subclass can override this method to be notified after Relationships have been inserted.
   */
  protected onRelationshipInserted(_sourceRelationship: Relationship, _targetRelationshipProps: RelationshipProps): void { }

  /** Called after processing a source Relationship when that processing caused an existing Relationship to be updated in the target iModel.
   * @param _sourceRelationship The sourceRelationship that was processed
   * @param _targetRelationshipProps The RelationshipProps that were updated in the target iModel.
   * @note A subclass can override this method to be notified after Relationships have been inserted.
   */
  protected onRelationshipUpdated(_sourceRelationship: Relationship, _targetRelationshipProps: RelationshipProps): void { }

  /** Called after a source Relationship was purposely excluded from the target iModel.
   * @param _sourceRelationship The source Relationship that was excluded from transformation.
   * @note A subclass can override this method to be notified after a Relationship has been excluded.
   */
  protected onRelationshipExcluded(_sourceRelationship: Relationship): void { }

  /** Called after processing a source Model when it caused a Model to be inserted in the target iModel.
   * @param _sourceModel The source Model that was processed
   * @param _targetModelProps The ModelProps that were inserted into the target iModel.
   * @note A subclass can override this method to be notified after Models have been inserted.
   */
  protected onModelInserted(_sourceModel: Model, _targetModelProps: ModelProps): void { }

  /** Called after processing a source Element when it caused an Element to be inserted in the target iModel.
   * @param _sourceElement The sourceElement that was processed
   * @param _targetElementProps The ElementProps that were inserted into the target iModel because of processing the source Element.
   * @note A subclass can override this method to be notified after Elements have been inserted. This can be used to establish relationships or for other operations that require knowing ElementIds.
   */
  protected onElementInserted(_sourceElement: Element, _targetElementProps: ElementProps): void { }

  /** Called after processing a source Element when it caused an Element or Elements to be updated in the target iModel.
   * @param _sourceElement The sourceElement that was processed
   * @param _targetElementProps The ElementProps that were updated in the target iModel because of processing the source Element.
   * @note A subclass can override this method to be notified after Elements have been updated. This can be used to establish relationships or for other operations that require knowing ElementIds.
   */
  protected onElementUpdated(_sourceElement: Element, _targetElementProps: ElementProps): void { }

  /** Called after it was determined that it was not possible to import a source Element. This is usually because one or more required predecessors has not been imported yet.
   * @param _sourceElement The source Element that was skipped.
   * @note A subclass can override this method to be notified after an Element has been skipped.
   */
  protected onElementSkipped(_sourceElement: Element): void { }

  /** Called after processing a source Element when that processing caused an Element to be purposely excluded from the target iModel.
   * @param _sourceElement The source Element that was excluded from transformation.
   * @note A subclass can override this method to be notified after an Element has been excluded.
   */
  protected onElementExcluded(_sourceElement: Element): void { }

  /** Called after a source ElementAspect was purposely excluded from the target iModel.
   * @param _sourceElementAspect The source ElementAspect that was excluded from transformation.
   * @note A subclass can override this method to be notified after an ElementAspect has been excluded.
   */
  protected onElementAspectExcluded(_sourceElementAspect: ElementAspect): void { }

  /** Called after an ElementAspect was inserted into the target iModel.
   * @param _targetElementAspect The ElementAspectProps that were inserted into the target iModel.
   * @note A subclass can override this method to be notified after ElementAspects have been inserted.
   */
  protected onElementAspectInserted(_targetElementAspect: ElementAspectProps): void { }

  /** Called after an ElementAspect was updated in the target iModel.
   * @param _targetElementAspect The ElementAspectProps that were updated in the target iModel.
   * @note A subclass can override this method to be notified after ElementAspects have been updated.
   */
  protected onElementAspectUpdated(_targetElementAspect: ElementAspectProps): void { }

  /** Called after an ElementAspect was deleted from the target iModel.
   * @param _targetElementAspect The target ElementAspect that was deleted.
   * @note A subclass can override this method to be notified after an ElementAspect has been deleted.
   */
  protected onElementAspectDeleted(_targetElementAspect: ElementAspect): void { }

  /** Returns true if the specified sourceElement should be excluded from the target iModel.
   * @param sourceElement The Element from the source iModel to consider
   * @returns `true` if sourceElement should be excluded from the target iModel or `false` if sourceElement should be transformed into the target iModel.
   * @note A subclass can override this method to provide custom Element exclusion behavior.
   */
  protected shouldExcludeElement(sourceElement: Element): boolean {
    if (this._excludedElementIds.has(sourceElement.id)) {
      Logger.logInfo(loggerCategory, `(Source) Excluded ${this.formatElementForLogger(sourceElement)} by Id`);
      return true;
    }
    if (sourceElement.category) {
      if (this._excludedElementCategoryIds.has(sourceElement.category)) {
        Logger.logInfo(loggerCategory, `(Source) Excluded ${this.formatElementForLogger(sourceElement)} by Category [${this.formatIdForLogger(sourceElement.category)}]`);
        return true;
      }
    }
    for (const excludedElementClass of this._excludedElementClasses) {
      if (sourceElement instanceof excludedElementClass) {
        Logger.logInfo(loggerCategory, `(Source) Excluded ${this.formatElementForLogger(sourceElement)} by class`);
        return true;
      }
    }
    return false;
  }

  /** Format an Id for the Logger. The base implementation returns a hex string.
   * @note This can be overridden if an integer (to match SQLite Expert) or a base-36 string (to match UI) is desired instead.
   */
  protected formatIdForLogger(id: Id64String): string {
    return id;
  }

  /** Format a Relationship for the Logger. */
  protected formatRelationshipForLogger(relProps: RelationshipProps): string {
    return `${relProps.classFullName} sourceId=[${this.formatIdForLogger(relProps.sourceId)}] targetId=[${this.formatIdForLogger(relProps.targetId)}]`;
  }

  /** Format a Model for the Logger. */
  protected formatModelForLogger(modelProps: ModelProps): string {
    return `${modelProps.classFullName} [${this.formatIdForLogger(modelProps.id!)}]`;
  }

  /** Format an Element for the Logger. */
  protected formatElementForLogger(elementProps: ElementProps): string {
    const namePiece: string = elementProps.code.value ? `${elementProps.code.value} ` : elementProps.userLabel ? `${elementProps.userLabel} ` : "";
    return `${elementProps.classFullName} ${namePiece}[${this.formatIdForLogger(elementProps.id!)}]`;
  }

  /** Format an ElementAspect for the Logger. */
  protected formatElementAspectForLogger(elementAspectProps: ElementAspectProps): string {
    return `${elementAspectProps.classFullName} elementId=[${this.formatIdForLogger(elementAspectProps.element.id)}]`;
  }

  /** Return the Id of the Element in the **target** iModel that represents the **source** repository as a whole and scopes its [ExternalSourceAspect]($backend) instances.
   * @note A subclass must override this method if multiple iModels are being combined into a single iModel.
   */
  protected getTargetScopeElementId(): Id64String {
    return IModel.rootSubjectId;
  }

  /** Mark the specified Element as skipped so its processing can be deferred. */
  protected skipElement(sourceElement: Element): void {
    this._skippedElementIds.add(sourceElement.id);
    Logger.logInfo(loggerCategory, `(Source) Skipped ${this.formatElementForLogger(sourceElement)}`);
  }

  /** Transform the specified sourceElement into ElementProps for the target iModel.
   * @param sourceElement The Element from the source iModel to transform.
   * @returns ElementProps for the target iModel.
   * @note A subclass can override this method to provide custom transform behavior.
   */
  protected transformElement(sourceElement: Element): ElementProps {
    const targetElementProps: ElementProps = this._importContext.cloneElement(sourceElement.id);
    targetElementProps.federationGuid = sourceElement.federationGuid; // cloneElement strips off federationGuid
    return targetElementProps;
  }

  /** Insert the transformed Element into the target iModel.
   * @param targetElementProps The ElementProps for the Element that will be inserted into the target iModel.
   * @returns The ElementId of the newly inserted Element.
   * @note A subclass can override this method to provide custom insert behavior.
   */
  protected insertElement(targetElementProps: ElementProps): Id64String {
    const targetElementId: Id64String = this._targetDb.elements.insertElement(targetElementProps); // insert from TypeScript so TypeScript handlers are called
    Logger.logInfo(loggerCategory, `(Target) Inserted ${this.formatElementForLogger(targetElementProps)}`);
    return targetElementId;
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
    Logger.logInfo(loggerCategory, `(Target) Updated ${this.formatElementForLogger(targetElementProps)}`);
    ExternalSourceAspect.deleteForElement(this._targetDb, sourceAspectProps.scope.id, targetElementProps.id);
    this._targetDb.elements.insertAspect(sourceAspectProps);
  }

  /** Returns true if a change within sourceElement is detected.
   * @param sourceElement The Element from the source iModel
   * @param targetElementId The Element from the target iModel to compare against.
   * @note A subclass can override this method to provide custom change detection behavior.
   */
  protected hasElementChanged(sourceElement: Element, targetElementId: Id64String): boolean {
    const aspects: ElementAspect[] = this._targetDb.elements.getAspects(targetElementId, ExternalSourceAspect.classFullName);
    const targetScopeElementId: Id64String = this.getTargetScopeElementId();
    for (const aspect of aspects) {
      const sourceAspect = aspect as ExternalSourceAspect;
      if ((sourceAspect.identifier === sourceElement.id) && (sourceAspect.scope.id === targetScopeElementId) && (sourceAspect.kind === ExternalSourceAspect.Kind.Element)) {
        const lastModifiedTime: string = sourceElement.iModel.elements.queryLastModifiedTime(sourceElement.id);
        return (lastModifiedTime !== sourceAspect.version) || (sourceElement.computeHash() !== sourceAspect.checksum);
      }
    }
    return true;
  }

  /** Determine if any predecessors have not been imported yet.
   * @param sourceElement The Element from the source iModel
   */
  public findMissingPredecessors(sourceElement: Element): Id64Set {
    const predecessorIds: Id64Set = sourceElement.getPredecessorIds();
    predecessorIds.forEach((elementId: Id64String) => {
      const targetElementId: Id64String = this.findTargetElementId(elementId);
      if (Id64.isValidId64(targetElementId)) {
        predecessorIds.delete(elementId);
      }
    });
    return predecessorIds;
  }

  /** Import the specified Element and its child Elements (if applicable).
   * @param sourceElementId Identifies the Element from the source iModel to import.
   */
  public importElement(sourceElementId: Id64String): void {
    Logger.logTrace(loggerCategory, `--> importElement(${this.formatIdForLogger(sourceElementId)})`);
    const sourceElement: Element = this._sourceDb.elements.getElement({ id: sourceElementId, wantGeometry: true });
    if (this.shouldExcludeElement(sourceElement)) {
      this.onElementExcluded(sourceElement);
      return; // excluding an element will also exclude its children or sub-models
    }
    let targetElementId: Id64String | undefined = this.findTargetElementId(sourceElementId);
    const targetScopeElementId: Id64String = this.getTargetScopeElementId();
    if (Id64.isValidId64(targetElementId)) {
      if (this.hasElementChanged(sourceElement, targetElementId)) {
        const targetElementProps: ElementProps = this.transformElement(sourceElement);
        targetElementProps.id = targetElementId;
        const sourceAspectProps: ExternalSourceAspectProps = ExternalSourceAspect.initPropsForElement(sourceElement, targetScopeElementId, targetElementId);
        this.updateElement(targetElementProps, sourceAspectProps);
        this.onElementUpdated(sourceElement, targetElementProps);
      }
    } else {
      const missingPredecessorIds: Id64Set = this.findMissingPredecessors(sourceElement); // WIP: move into transformElement?
      if (missingPredecessorIds.size > 0) {
        this.skipElement(sourceElement);
        this.onElementSkipped(sourceElement);
        return; // skipping an element will also skip its children or sub-models
      }
      const targetElementProps: ElementProps = this.transformElement(sourceElement);
      targetElementId = this._targetDb.elements.queryElementIdByCode(new Code(targetElementProps.code));
      if (targetElementId === undefined) {
        targetElementId = this.insertElement(targetElementProps);
        this.remapElement(sourceElement.id, targetElementId!);
        this.onElementInserted(sourceElement, targetElementProps);
        this._targetDb.elements.insertAspect(ExternalSourceAspect.initPropsForElement(sourceElement, targetScopeElementId, targetElementId));
      } else if (this.hasElementChanged(sourceElement, targetElementId)) {
        this.remapElement(sourceElement.id, targetElementId); // record that the targeElement was found by Code
        targetElementProps.id = targetElementId;
        const sourceAspectProps: ExternalSourceAspectProps = ExternalSourceAspect.initPropsForElement(sourceElement, targetScopeElementId, targetElementId);
        this.updateElement(targetElementProps, sourceAspectProps);
        this.onElementUpdated(sourceElement, targetElementProps);
      }
    }
    this.importElementAspects(sourceElementId, targetElementId);
    this.importChildElements(sourceElementId);
  }

  /** Import child elements into the target IModelDb
   * @param sourceElementId Import the child elements of this element in the source IModelDb.
   */
  public importChildElements(sourceElementId: Id64String): void {
    const childElementIds: Id64Array = this._sourceDb.elements.queryChildren(sourceElementId);
    if (childElementIds.length > 0) {
      Logger.logTrace(loggerCategory, `--> importChildElements(${this.formatIdForLogger(sourceElementId)})`);
    }
    for (const childElementId of childElementIds) {
      this.importElement(childElementId);
    }
  }

  /** Import matching sub-models into the target IModelDb
   * @param modeledElementClass The [Element.classFullName]($backend) to use to query for which sub-models to import.
   */
  public importModels(modeledElementClass: string): void {
    Logger.logTrace(loggerCategory, `--> importModels(${modeledElementClass})`);
    const sql = `SELECT ECInstanceId FROM ${modeledElementClass}`;
    this._sourceDb.withPreparedStatement(sql, (statement: ECSqlStatement) => {
      while (DbResult.BE_SQLITE_ROW === statement.step()) {
        this.importModel(statement.getValue(0).getId());
      }
    });
  }

  /** Import the model container, contents, and sub-models into the target IModelDb
   * @param sourceModeledElementId Import this model from the source IModelDb.
   */
  public importModel(sourceModeledElementId: Id64String): void {
    Logger.logTrace(loggerCategory, `--> importModel(${this.formatIdForLogger(sourceModeledElementId)})`);
    const modeledElement: Element = this._sourceDb.elements.getElement({ id: sourceModeledElementId, wantGeometry: true });
    if (this.shouldExcludeElement(modeledElement)) {
      this.onElementExcluded(modeledElement);
    } else {
      this.importModelContainer(sourceModeledElementId);
      this.importModelContents(sourceModeledElementId);
      this.importSubModels(sourceModeledElementId);
    }
  }

  /** Import the model (the container only) into the target IModelDb
   * @param sourceModeledElementId Import this model from the source IModelDb.
   */
  private importModelContainer(sourceModeledElementId: Id64String): void {
    const targetModeledElementId = this.findTargetElementId(sourceModeledElementId);
    try {
      if (this._targetDb.models.getModelProps(targetModeledElementId)) {
        return; // already imported
      }
    } catch (error) {
      // catch NotFound error and insertModel
      const sourceModel: Model = this._sourceDb.models.getModel(sourceModeledElementId);
      const targetModelProps: ModelProps = this.transformModel(sourceModel, targetModeledElementId);
      this.insertModel(targetModelProps);
      this.onModelInserted(sourceModel, targetModelProps);
    }
  }

  /** Import the model contents into the target IModelDb
   * @param sourceModeledElementId Import the contents of this model from the source IModelDb.
   */
  private importModelContents(sourceModeledElementId: Id64String): void {
    Logger.logTrace(loggerCategory, `--> importModelContents(${this.formatIdForLogger(sourceModeledElementId)})`);
    const sql = `SELECT ECInstanceId FROM ${Element.classFullName} WHERE Parent.Id IS NULL AND Model.Id=:modelId`;
    this._sourceDb.withPreparedStatement(sql, (statement: ECSqlStatement) => {
      statement.bindId("modelId", sourceModeledElementId);
      while (DbResult.BE_SQLITE_ROW === statement.step()) {
        this.importElement(statement.getValue(0).getId());
      }
    });
  }

  /** Import the sub-models below the specified model. */
  private importSubModels(sourceParentModelId: Id64String): void {
    const sql = `SELECT ECInstanceId FROM ${Model.classFullName} WHERE ParentModel.Id=:parentModelId`;
    this._sourceDb.withPreparedStatement(sql, (statement: ECSqlStatement) => {
      statement.bindId("parentModelId", sourceParentModelId);
      while (DbResult.BE_SQLITE_ROW === statement.step()) {
        this.importModel(statement.getValue(0).getId());
      }
    });
  }

  /** Transform the specified sourceModel into ModelProps for the target iModel.
   * @param sourceModel The Model from the source iModel to be transformed.
   * @param targetModeledElementId The transformed Model will *break down* or *detail* this Element in the target iModel.
   * @returns ModelProps for the target iModel.
   * @note A subclass can override this method to provide custom transform behavior.
   */
  protected transformModel(sourceModel: Model, targetModeledElementId: Id64String): ModelProps {
    const targetModelProps: ModelProps = sourceModel.toJSON();
    targetModelProps.modeledElement.id = targetModeledElementId;
    targetModelProps.id = targetModeledElementId;
    targetModelProps.parentModel = Id64.invalid; // insertModel will properly initialize
    return targetModelProps;
  }

  /** Insert the transformed Model into the target iModel.
   * @param targetModelProps The ModelProps that will be inserted into the target iModel.
   * @note A subclass can override this method to provide custom insert behavior.
   */
  protected insertModel(targetModelProps: ModelProps): void {
    this._targetDb.models.insertModel(targetModelProps);
    Logger.logInfo(loggerCategory, `(Target) Inserted ${this.formatModelForLogger(targetModelProps)}`);
  }

  /** Import elements that were skipped in a prior pass */
  public importSkippedElements(): void {
    Logger.logTrace(loggerCategory, `--> importSkippedElements(), numSkipped=${this._skippedElementIds.size}`);
    this._skippedElementIds.forEach((elementId: Id64String) => {
      this._skippedElementIds.delete(elementId);
      this.importElement(elementId);
    });
    if (this._skippedElementIds.size > 0) {
      throw new IModelError(IModelStatus.BadRequest, "Not all skipped elements could be processed", Logger.logError, loggerCategory);
    }
  }

  /** Imports all relationships that subclass from the specified base class.
   * @param baseRelClassFullName The specified base relationship class.
   */
  public importRelationships(baseRelClassFullName: string): void {
    Logger.logTrace(loggerCategory, `--> importRelationships(${baseRelClassFullName})`);
    const sql = `SELECT ECInstanceId FROM ${baseRelClassFullName}`;
    this._sourceDb.withPreparedStatement(sql, (statement: ECSqlStatement) => {
      while (DbResult.BE_SQLITE_ROW === statement.step()) {
        const sourceRelInstanceId: Id64String = statement.getValue(0).getId();
        const sourceRelProps: RelationshipProps = this._sourceDb.relationships.getInstanceProps(baseRelClassFullName, sourceRelInstanceId);
        this.importRelationship(sourceRelProps.classFullName, sourceRelInstanceId);
      }
    });
  }

  /** Import a relationship from the source iModel into the target iModel. */
  public importRelationship(sourceRelClassFullName: string, sourceRelInstanceId: Id64String): void {
    Logger.logTrace(loggerCategory, `--> importRelationship(${sourceRelClassFullName}, ${this.formatIdForLogger(sourceRelInstanceId)})`);
    const sourceRelationship: Relationship = this._sourceDb.relationships.getInstance(sourceRelClassFullName, sourceRelInstanceId);
    if (this.shouldExcludeRelationship(sourceRelationship)) {
      this.onRelationshipExcluded(sourceRelationship);
      return;
    }
    const targetRelationshipProps: RelationshipProps = this.transformRelationship(sourceRelationship);
    if (Id64.isValidId64(targetRelationshipProps.sourceId) && Id64.isValidId64(targetRelationshipProps.targetId)) {
      try {
        // check for an existing relationship
        const relSourceAndTarget = { sourceId: targetRelationshipProps.sourceId, targetId: targetRelationshipProps.targetId };
        const targetRelationship = this._targetDb.relationships.getInstance(targetRelationshipProps.classFullName, relSourceAndTarget);
        // if relationship found, update it
        targetRelationshipProps.id = targetRelationship.id;
        if (this.hasRelationshipChanged(targetRelationship, targetRelationshipProps)) {
          this.updateRelationship(targetRelationshipProps);
          this.onRelationshipUpdated(sourceRelationship, targetRelationshipProps);
        }
      } catch (error) {
        // catch NotFound error and insert relationship
        if ((error instanceof IModelError) && (IModelStatus.NotFound === error.errorNumber)) {
          this.insertRelationship(targetRelationshipProps);
          this.onRelationshipInserted(sourceRelationship, targetRelationshipProps);
        } else {
          throw error;
        }
      }
    }
  }

  /** Returns true if the specified sourceRelationship should be excluded from the target iModel.
   * @param sourceRelationship The Relationship from the source iModel to consider
   * @returns `true` if sourceRelationship should be excluded from the target iModel or `false` if sourceRelationship should be transformed into the target iModel.
   * @note A subclass can override this method to provide custom Relationship exclusion behavior.
   */
  protected shouldExcludeRelationship(sourceRelationship: Relationship): boolean {
    for (const excludedRelationshipClass of this._excludedRelationshipClasses) {
      if (sourceRelationship instanceof excludedRelationshipClass) {
        Logger.logInfo(loggerCategory, `(Source) Excluded ${this.formatRelationshipForLogger(sourceRelationship)} by class`);
        return true;
      }
    }
    return false;
  }

  /** Transform the specified sourceRelationship into RelationshipProps for the target iModel.
   * @param sourceRelationship The Relationship from the source iModel to be transformed.
   * @returns RelationshipProps for the target iModel.
   * @note A subclass can override this method to provide custom transform behavior.
   */
  protected transformRelationship(sourceRelationship: Relationship): RelationshipProps {
    const targetRelationshipProps: RelationshipProps = sourceRelationship.toJSON();
    targetRelationshipProps.sourceId = this.findTargetElementId(sourceRelationship.sourceId);
    targetRelationshipProps.targetId = this.findTargetElementId(sourceRelationship.targetId);
    sourceRelationship.forEachProperty((propertyName: string, propertyMetaData: PropertyMetaData) => {
      if ((PrimitiveTypeCode.Long === propertyMetaData.primitiveType) && ("Id" === propertyMetaData.extendedType)) {
        targetRelationshipProps[propertyName] = this.findTargetElementId(sourceRelationship[propertyName]);
      }
    }, true);
    return targetRelationshipProps;
  }

  /** Insert the transformed Relationship into the target iModel.
   * @param targetRelationshipProps The RelationshipProps to be inserted into the target iModel.
   * @returns The instance Id of the newly inserted relationship.
   * @note A subclass can override this method to provide custom insert behavior.
   */
  protected insertRelationship(targetRelationshipProps: RelationshipProps): Id64String {
    const targetRelInstanceId: Id64String = this._targetDb.relationships.insertInstance(targetRelationshipProps);
    Logger.logInfo(loggerCategory, `(Target) Inserted ${this.formatRelationshipForLogger(targetRelationshipProps)}`);
    return targetRelInstanceId;
  }

  /** Update the specified relationship in the target iModel.
   * @note A subclass can override this method to provide custom update behavior.
   */
  protected updateRelationship(targetRelationshipProps: RelationshipProps): void {
    if (!targetRelationshipProps.id) {
      throw new IModelError(IModelStatus.InvalidId, "Relationship instance Id not provided", Logger.logError, loggerCategory);
    }
    this._targetDb.relationships.updateInstance(targetRelationshipProps);
    Logger.logInfo(loggerCategory, `(Target) Updated ${this.formatRelationshipForLogger(targetRelationshipProps)}`);
  }

  /** Returns true if a change within a Relationship is detected.
   * @param relationship The current persistent Relationship
   * @param relationshipProps The new RelationshipProps to compare against
   * @returns `true` if a change is detected
   */
  private hasRelationshipChanged(relationship: Relationship, relationshipProps: RelationshipProps): boolean {
    let changed: boolean = false;
    relationship.forEachProperty((propertyName: string) => {
      if (!changed && (relationship[propertyName] !== relationshipProps[propertyName])) {
        changed = true;
      }
    }, true);
    return changed;
  }

  /** Import ElementAspects from the specified source Element into the target iModel.
   * @param sourceElementId The ElementId of the source Element that owns the ElementAspects to be transformed.
   * @param targetElementId The ElementId of the target Element that will own the ElementAspects after transformation.
   */
  private importElementAspects(sourceElementId: Id64String, targetElementId: Id64String): void {
    this.importUniqueAspects(sourceElementId, targetElementId);
    this.importMultiAspects(sourceElementId, targetElementId);
  }

  /** Import ElementUniqueAspects from the specified source Element into the target iModel.
   * @param sourceElementId The ElementId of the source Element that owns the ElementUniqueAspects to be transformed.
   * @param targetElementId The ElementId of the target Element that will own the ElementUniqueAspects after transformation.
   */
  private importUniqueAspects(sourceElementId: Id64String, targetElementId: Id64String): void {
    const sourceUniqueAspects: ElementAspect[] = this._sourceDb.elements.getAspects(sourceElementId, ElementUniqueAspect.classFullName);
    const targetUniqueAspectClasses = new Set<string>();
    sourceUniqueAspects.forEach((sourceUniqueAspect: ElementAspect) => {
      if (this.shouldExcludeElementAspect(sourceUniqueAspect)) {
        this.onElementAspectExcluded(sourceUniqueAspect);
      } else {
        const targetUniqueAspectProps: ElementAspectProps = this.transformElementAspect(sourceUniqueAspect, targetElementId);
        targetUniqueAspectClasses.add(targetUniqueAspectProps.classFullName);
        const targetAspects: ElementAspect[] = this._targetDb.elements.getAspects(targetElementId, targetUniqueAspectProps.classFullName);
        if (targetAspects.length === 0) {
          this.insertElementAspect(targetUniqueAspectProps);
          this.onElementAspectInserted(targetUniqueAspectProps);
        } else if (this.hasElementAspectChanged(targetAspects[0], targetUniqueAspectProps)) {
          this.updateElementAspect(targetUniqueAspectProps);
          this.onElementAspectUpdated(targetUniqueAspectProps);
        }
      }
    });
    const targetUniqueAspects: ElementAspect[] = this._targetDb.elements.getAspects(targetElementId, ElementUniqueAspect.classFullName);
    targetUniqueAspects.forEach((targetUniqueAspect: ElementAspect) => {
      if (!targetUniqueAspectClasses.has(targetUniqueAspect.classFullName)) {
        if (this.shouldDeleteElementAspect(targetUniqueAspect)) {
          this.deleteElementAspect(targetUniqueAspect);
          this.onElementAspectDeleted(targetUniqueAspect);
        }
      }
    });
  }

  /** Import ElementMultiAspects from the specified source Element into the target iModel.
   * @param sourceElementId The ElementId of the source Element that owns the ElementMultiAspects to be transformed.
   * @param targetElementId The ElementId of the target Element that will own the ElementMultiAspects after transformation.
   */
  private importMultiAspects(sourceElementId: Id64String, targetElementId: Id64String): void {
    // Get all source MultiAspects
    const sourceMultiAspects: ElementAspect[] = this._sourceDb.elements.getAspects(sourceElementId, ElementMultiAspect.classFullName);

    // Use exclusion rules to filter source MultiAspects
    const filteredSourceAspects: ElementAspect[] = sourceMultiAspects.filter((sourceMultiAspect: ElementAspect) => {
      if (this.shouldExcludeElementAspect(sourceMultiAspect)) {
        this.onElementAspectExcluded(sourceMultiAspect);
        return false;
      }
      return true;
    });

    // Transform remaining source MultiAspects into target ElementAspectProps
    const targetAspectPropsArray: ElementAspectProps[] = filteredSourceAspects.map((sourceMultiAspect: ElementAspect) => {
      return this.transformElementAspect(sourceMultiAspect, targetElementId);
    });

    // Determine the set of MultiAspect classes to consider
    const targetMultiAspectClasses = new Set<string>();
    targetAspectPropsArray.forEach((targetMultiAspectsProps: ElementAspectProps) => targetMultiAspectClasses.add(targetMultiAspectsProps.classFullName));

    // Handle MultiAspects in groups by class
    targetMultiAspectClasses.forEach((aspectClassFullName: string) => {
      const filteredTargetAspectPropsArray = targetAspectPropsArray.filter((aspectProps) => aspectClassFullName === aspectProps.classFullName);
      const targetAspects: ElementAspect[] = this._targetDb.elements.getAspects(targetElementId, aspectClassFullName);
      if (filteredTargetAspectPropsArray.length >= targetAspects.length) {
        let index = 0;
        filteredTargetAspectPropsArray.forEach((aspectProps: ElementAspectProps) => {
          if (index < targetAspects.length) {
            aspectProps.id = targetAspects[index].id;
            if (this.hasElementAspectChanged(targetAspects[index], aspectProps)) {
              this.updateElementAspect(aspectProps);
              this.onElementAspectUpdated(aspectProps);
            }
          } else {
            this.insertElementAspect(aspectProps);
            this.onElementAspectInserted(aspectProps);
          }
          index++;
        });
      } else {
        let index = 0;
        targetAspects.forEach((aspect: ElementAspect) => {
          if (index < filteredTargetAspectPropsArray.length) {
            filteredTargetAspectPropsArray[index].id = aspect.id;
            if (this.hasElementAspectChanged(aspect, filteredTargetAspectPropsArray[index])) {
              this.updateElementAspect(filteredTargetAspectPropsArray[index]);
              this.onElementAspectUpdated(filteredTargetAspectPropsArray[index]);
            }
          } else if (this.shouldDeleteElementAspect(aspect)) {
            this.deleteElementAspect(aspect);
            this.onElementAspectDeleted(aspect);
          }
          index++;
        });
      }
    });

    // Detect deletes
    const targetMultiAspects: ElementAspect[] = this._targetDb.elements.getAspects(targetElementId, ElementMultiAspect.classFullName);
    targetMultiAspects.forEach((targetMultiAspect: ElementAspect) => {
      if (!targetMultiAspectClasses.has(targetMultiAspect.classFullName)) {
        if (this.shouldDeleteElementAspect(targetMultiAspect)) {
          this.deleteElementAspect(targetMultiAspect);
          this.onElementAspectDeleted(targetMultiAspect);
        }
      }
    });
  }

  /** Returns true if the specified sourceElementAspect should be excluded from the target iModel.
   * @param sourceElementAspect The ElementAspect from the source iModel to consider
   * @returns `true` if sourceElementAspect should be excluded from the target iModel or `false` if sourceElementAspect should be transformed into the target iModel.
   * @note A subclass can override this method to provide custom ElementAspect exclusion behavior.
   */
  protected shouldExcludeElementAspect(sourceElementAspect: ElementAspect): boolean {
    for (const excludedElementAspectClass of this._excludedElementAspectClasses) {
      if (sourceElementAspect instanceof excludedElementAspectClass) {
        Logger.logInfo(loggerCategory, `(Source) Excluded ${this.formatElementAspectForLogger(sourceElementAspect)} by class`);
        return true;
      }
    }
    return false;
  }

  /** Transform the specified sourceElementAspect into ElementAspectProps for the target iModel.
   * @param sourceElementAspect The ElementAspect from the source iModel to be transformed.
   * @param targetElementId The ElementId of the target Element that will own the ElementAspects after transformation.
   * @returns ElementAspectProps for the target iModel.
   * @note A subclass can override this method to provide custom transform behavior.
   */
  protected transformElementAspect(sourceElementAspect: ElementAspect, targetElementId: Id64String): ElementAspectProps {
    const targetElementAspectProps: ElementAspectProps = sourceElementAspect.toJSON();
    targetElementAspectProps.id = Id64.invalid;
    targetElementAspectProps.element.id = targetElementId;
    sourceElementAspect.forEachProperty((propertyName: string, propertyMetaData: PropertyMetaData) => {
      if ((PrimitiveTypeCode.Long === propertyMetaData.primitiveType) && ("Id" === propertyMetaData.extendedType)) {
        targetElementAspectProps[propertyName] = this.findTargetElementId(sourceElementAspect[propertyName]);
      }
    }, true);
    return targetElementAspectProps;
  }

  /** Insert the transformed ElementAspect into the target iModel.
   * @param targetElementAspectProps The ElementAspectProps to be inserted into the target iModel.
   * @note A subclass can override this method to provide custom insert behavior.
   */
  protected insertElementAspect(targetElementAspectProps: ElementAspectProps): void {
    this._targetDb.elements.insertAspect(targetElementAspectProps);
    Logger.logInfo(loggerCategory, `(Target) Inserted ${this.formatElementAspectForLogger(targetElementAspectProps)}`);
  }

  /** Update the transformed ElementAspect in the target iModel.
   * @param targetElementAspectProps The ElementAspectProps to be updated in the target iModel.
   * @note A subclass can override this method to provide custom update behavior.
   */
  protected updateElementAspect(targetElementAspectProps: ElementAspectProps): void {
    this._targetDb.elements.updateAspect(targetElementAspectProps);
    Logger.logInfo(loggerCategory, `(Target) Updated ${this.formatElementAspectForLogger(targetElementAspectProps)}`);
  }

  /** Delete the specified ElementAspect from the target iModel.
   * @param targetElementAspect The ElementAspectProps to be updated in the target iModel.
   * @note A subclass can override this method to provide custom update behavior.
   */
  protected deleteElementAspect(targetElementAspect: ElementAspect): void {
    this._targetDb.elements.deleteAspect(targetElementAspect.id);
    Logger.logInfo(loggerCategory, `(Target) Deleted ${this.formatElementAspectForLogger(targetElementAspect)}`);
  }

  /** Returns true if a change within an ElementAspect is detected.
   * @param aspect The current persistent ElementAspect
   * @param aspectProps The new ElementAspectProps to compare against
   * @returns `true` if a change is detected
   */
  private hasElementAspectChanged(aspect: ElementAspect, aspectProps: ElementAspectProps): boolean {
    let changed: boolean = false;
    aspect.forEachProperty((propertyName: string) => {
      if (!changed && (propertyName !== "element") && (aspect[propertyName] !== aspectProps[propertyName])) {
        changed = true;
      }
    }, true);
    return changed;
  }

  /** Returns true if the detected potential delete of the specified targetElementAspect should happen.
   * @param targetElementAspect The ElementAspect from the target iModel to consider
   * @returns `true` if targetElementAspect should be deleted from the target iModel or `false` if not.
   * @note A subclass can override this method to provide custom ElementAspect delete behavior.
   */
  protected shouldDeleteElementAspect(targetElementAspect: ElementAspect): boolean {
    return (targetElementAspect instanceof ExternalSourceAspect) ? false : true;
  }

  /** Import all schemas from the source iModel into the target iModel. */
  public async importSchemas(requestContext: ClientRequestContext | AuthorizedClientRequestContext): Promise<void> {
    const schemasDir: string = path.join(KnownLocations.tmpdir, Guid.createValue());
    IModelJsFs.mkdirSync(schemasDir);
    try {
      this._sourceDb.nativeDb.exportSchemas(schemasDir);
      const schemaFiles: string[] = IModelJsFs.readdirSync(schemasDir);
      await this._targetDb.importSchemas(requestContext, schemaFiles.map((fileName) => path.join(schemasDir, fileName)));
    } finally {
      IModelJsFs.removeSync(schemasDir);
    }
  }

  /** Import all fonts from the source iModel into the target iModel. */
  public importFonts(): void {
    Logger.logTrace(loggerCategory, `--> importFonts()`);
    for (const font of this._sourceDb.fontMap.fonts.values()) {
      this._importContext.importFont(font.id);
    }
  }

  /** Import all CodeSpecs from the source iModel into the target iModel. */
  public importCodeSpecs(): void {
    Logger.logTrace(loggerCategory, `--> importCodeSpecs()`);
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
      Logger.logInfo(loggerCategory, `(Source) Excluding CodeSpec: ${codeSpecName}`);
      this.onCodeSpecExcluded(codeSpecName);
      return;
    }
    const sourceCodeSpecId: Id64String = this._sourceDb.codeSpecs.queryId(codeSpecName);
    this._importContext.importCodeSpec(sourceCodeSpecId);
  }

  /** Attempts to import everything from the source iModel into the target iModel. */
  public importAll(): void {
    this.initFromExternalSourceAspects();
    this.importCodeSpecs();
    this.importFonts();
    this.importElement(IModel.rootSubjectId);
    this.importModels(DefinitionPartition.classFullName);
    this.importModels(InformationPartitionElement.classFullName);
    this.importSkippedElements();
    this.importRelationships(ElementRefersToElements.classFullName);
  }
}
