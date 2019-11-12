/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { ClientRequestContext, DbResult, Guid, Id64, Id64Array, Id64Set, Id64String, IModelStatus, Logger, LogLevel } from "@bentley/bentleyjs-core";
import { AuthorizedClientRequestContext } from "@bentley/imodeljs-clients";
import { AxisAlignedBox3d, Code, ElementAspectProps, ElementProps, ExternalSourceAspectProps, GeometricElement3dProps, IModel, IModelError, ModelProps, Placement3d, PrimitiveTypeCode, PropertyMetaData } from "@bentley/imodeljs-common";
import * as path from "path";
import { BackendLoggerCategory } from "./BackendLoggerCategory";
import { ECSqlStatement } from "./ECSqlStatement";
import { DefinitionPartition, Element, GeometricElement, GeometricElement3d, InformationPartitionElement, Subject } from "./Element";
import { ElementAspect, ElementMultiAspect, ElementUniqueAspect, ExternalSourceAspect } from "./ElementAspect";
import { IModelCloneContext } from "./IModelCloneContext";
import { IModelDb } from "./IModelDb";
import { KnownLocations } from "./IModelHost";
import { IModelJsFs } from "./IModelJsFs";
import { DefinitionModel, Model } from "./Model";
import { ElementOwnsExternalSourceAspects } from "./NavigationRelationship";
import { ElementRefersToElements, Relationship, RelationshipProps } from "./Relationship";

const loggerCategory: string = BackendLoggerCategory.IModelTransformer;

/** Options provided to the [[IModelTransformer]] constructor.
 * @alpha
 */
export interface IModelTransformOptions {
  /** The Id of the Element in the **target** iModel that represents the **source** repository as a whole and scopes its [ExternalSourceAspect]($backend) instances. */
  targetScopeElementId?: Id64String;
  /** If `true` (the default), auto-extend the projectExtents of the target iModel as elements are inserted. If `false`, throw an Error if an element would be outside of the projectExtents. */
  autoExtendProjectExtents?: boolean;
}

/** Base class used to transform a source iModel into a different target iModel.
 * @alpha
 */
export class IModelTransformer {
  /** The read-only source iModel. */
  public readonly sourceDb: IModelDb;
  /** The read/write target iModel. */
  public readonly targetDb: IModelDb;
  /** The IModelTransformContext for this IModelTransformer. */
  public readonly context: IModelCloneContext;
  /** The Id of the Element in the **target** iModel that represents the **source** repository as a whole and scopes its [ExternalSourceAspect]($backend) instances. */
  public readonly targetScopeElementId: Id64String = IModel.rootSubjectId;
  /** If `true` (the default), auto-extend the projectExtents of the target iModel as elements are inserted. If `false`, throw an Error if an element would be outside of the projectExtents. */
  public readonly autoExtendProjectExtents: boolean = true;

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
   * @param options The options that specify how the transformation should be done.
   */
  public constructor(sourceDb: IModelDb, targetDb: IModelDb, options?: IModelTransformOptions) {
    this.sourceDb = sourceDb;
    this.targetDb = targetDb;
    this.context = new IModelCloneContext(sourceDb, targetDb);
    if (undefined !== options) {
      if (undefined !== options.targetScopeElementId) this.targetScopeElementId = options.targetScopeElementId;
      if (undefined !== options.autoExtendProjectExtents) this.autoExtendProjectExtents = options.autoExtendProjectExtents;
    }
    this.excludeElementAspectClass(ExternalSourceAspect.classFullName);
    this.excludeElementAspectClass("BisCore:TextAnnotationData"); // This ElementAspect is auto-created by the BisCore:TextAnnotation2d/3d element handlers
  }

  /** Dispose any native resources associated with this IModelTransformer. */
  public dispose(): void {
    Logger.logTrace(loggerCategory, "dispose()");
    this.context.dispose();
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
    const subjectId: Id64String | undefined = IModelTransformer.resolveSubjectId(this.sourceDb, subjectPath);
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
    this._excludedElementClasses.add(this.sourceDb.getJsClass<typeof Element>(sourceClassFullName));
  }

  /** Add a rule to exclude all ElementAspects of a specified class. */
  public excludeElementAspectClass(sourceClassFullName: string): void {
    this._excludedElementAspectClasses.add(this.sourceDb.getJsClass<typeof ElementAspect>(sourceClassFullName));
  }

  /** Add a rule to exclude all Relationships of a specified class. */
  public excludeRelationshipClass(sourceClassFullName: string): void {
    this._excludedRelationshipClasses.add(this.sourceDb.getJsClass<typeof Relationship>(sourceClassFullName));
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

  /** Create an ExternalSourceAspectProps in a standard way for an Element in an iModel --> iModel transformation.
   * @param sourceElement The new ExternalSourceAspectProps will be tracking this Element from the source iModel.
   * @param targetDb The target iModel where this ExternalSourceAspect will be persisted.
   * @param targetScopeElementId The Id of an Element in the target iModel that provides a scope for source Ids.
   * @param targetElementId The optional Id of the Element that will own the ExternalSourceAspect. If not provided, it will be set to Id64.invalid.
   * @alpha
   */
  private static initExternalSourceAspect(sourceElement: Element, targetDb: IModelDb, targetScopeElementId: Id64String, targetElementId: Id64String = Id64.invalid): ExternalSourceAspectProps {
    const aspectProps: ExternalSourceAspectProps = {
      classFullName: ExternalSourceAspect.classFullName,
      element: { id: targetElementId, relClassName: ElementOwnsExternalSourceAspects.classFullName },
      scope: { id: targetScopeElementId },
      identifier: sourceElement.id,
      kind: ExternalSourceAspect.Kind.Element,
      version: sourceElement.iModel.elements.queryLastModifiedTime(sourceElement.id),
    };
    const sql = `SELECT ECInstanceId FROM ${ExternalSourceAspect.classFullName} aspect WHERE aspect.Element.Id=:elementId AND aspect.Scope.Id=:scopeId AND aspect.Kind=:kind LIMIT 1`;
    aspectProps.id = targetDb.withPreparedStatement(sql, (statement: ECSqlStatement): Id64String | undefined => {
      statement.bindId("elementId", targetElementId);
      statement.bindId("scopeId", targetScopeElementId);
      statement.bindString("kind", ExternalSourceAspect.Kind.Element);
      return (DbResult.BE_SQLITE_ROW === statement.step()) ? statement.getValue(0).getId() : undefined;
    });
    return aspectProps;
  }

  /** Iterate all matching ExternalSourceAspects in the target iModel and call a function for each one. */
  private forEachExternalSourceAspect(fn: (sourceElementId: Id64String, targetElementId: Id64String) => void): void {
    const sql = `SELECT aspect.Identifier,aspect.Element.Id FROM ${ExternalSourceAspect.classFullName} aspect WHERE aspect.Scope.Id=:scopeId AND aspect.Kind=:kind`;
    this.targetDb.withPreparedStatement(sql, (statement: ECSqlStatement): void => {
      statement.bindId("scopeId", this.targetScopeElementId);
      statement.bindString("kind", Element.className);
      while (DbResult.BE_SQLITE_ROW === statement.step()) {
        const sourceElementId: Id64String = statement.getValue(0).getString(); // ExternalSourceAspect.Identifier is of type string
        const targetElementId: Id64String = statement.getValue(1).getId();
        fn(sourceElementId, targetElementId);
      }
    });
  }

  /** Initialize the source to target Element mapping from ExternalSourceAspects in the target iModel. */
  public initFromExternalSourceAspects(): void {
    this.forEachExternalSourceAspect((sourceElementId: Id64String, targetElementId: Id64String) => {
      this.context.remapElement(sourceElementId, targetElementId);
    });
  }

  /** Detect source element deletes from unmatched ExternalSourceAspects in the target iModel. */
  public detectElementDeletes(): void {
    const targetElementIds: Id64String[] = [];
    this.forEachExternalSourceAspect((sourceElementId: Id64String, targetElementId: Id64String) => {
      try {
        this.sourceDb.elements.getElementProps(sourceElementId);
      } catch (error) {
        if ((error instanceof IModelError) && (error.errorNumber === IModelStatus.NotFound)) {
          targetElementIds.push(targetElementId);
        }
      }
    });
    targetElementIds.forEach((targetElementId: Id64String) => {
      const targetElement: Element = this.targetDb.elements.getElement(targetElementId);
      if (this.shouldDeleteElement(targetElement)) {
        this.deleteElement(targetElement);
        this.onElementDeleted(targetElement);
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

  /** Called after processing a source Model when it caused a Model to be updated in the target iModel.
   * @param _sourceModel The source Model that was processed
   * @param _targetModelProps The ModelProps that were updated into the target iModel.
   * @note A subclass can override this method to be notified after Models have been updated.
   */
  protected onModelUpdated(_sourceModel: Model, _targetModelProps: ModelProps): void { }

  /** Called after processing a source Element when it caused an Element to be inserted in the target iModel.
   * @param _sourceElement The sourceElement that was processed
   * @param _targetElementProps The ElementProps that were inserted into the target iModel because of processing the source Element.
   * @note A subclass can override this method to be notified after Elements have been inserted. This can be used to establish relationships or for other operations that require knowing ElementIds.
   */
  protected onElementInserted(_sourceElement: Element, _targetElementProps: ElementProps): void { }

  /** Called after processing a source Element when it caused an Element to be updated in the target iModel.
   * @param _sourceElement The sourceElement that was processed
   * @param _targetElementProps The ElementProps that were updated in the target iModel because of processing the source Element.
   * @note A subclass can override this method to be notified after Elements have been updated. This can be used to establish relationships or for other operations that require knowing ElementIds.
   */
  protected onElementUpdated(_sourceElement: Element, _targetElementProps: ElementProps): void { }

  /** Called after a delete within the source iModel was detected and propagated to the target iModel.
   * @param _targetElement The Element that was deleted from the target iModel.
   * @note A subclass can override this method to be notified after Elements have been deleted.
   */
  protected onElementDeleted(_targetElement: Element): void { }

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
      Logger.logInfo(loggerCategory, `[Source] Excluded ${this.formatElementForLogger(sourceElement)} by Id`);
      return true;
    }
    if (sourceElement instanceof GeometricElement) {
      if (this._excludedElementCategoryIds.has(sourceElement.category)) {
        Logger.logInfo(loggerCategory, `[Source] Excluded ${this.formatElementForLogger(sourceElement)} by Category [${this.formatIdForLogger(sourceElement.category)}]`);
        return true;
      }
    }
    for (const excludedElementClass of this._excludedElementClasses) {
      if (sourceElement instanceof excludedElementClass) {
        Logger.logInfo(loggerCategory, `[Source] Excluded ${this.formatElementForLogger(sourceElement)} by class`);
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

  /** Mark the specified Element as skipped so its processing can be deferred. */
  protected skipElement(sourceElement: Element): void {
    this._skippedElementIds.add(sourceElement.id);
    Logger.logInfo(loggerCategory, `[Source] Skipped ${this.formatElementForLogger(sourceElement)}`);
  }

  /** Transform the specified sourceElement into ElementProps for the target iModel.
   * @param sourceElement The Element from the source iModel to transform.
   * @returns ElementProps for the target iModel.
   * @note A subclass can override this method to provide custom transform behavior.
   */
  protected transformElement(sourceElement: Element): ElementProps {
    return this.context.cloneElement(sourceElement);
  }

  /** Insert the transformed Element into the target iModel.
   * @param targetElementProps The ElementProps for the Element that will be inserted into the target iModel.
   * @returns The ElementId of the newly inserted Element.
   * @note A subclass can override this method to provide custom insert behavior.
   */
  protected insertElement(targetElementProps: ElementProps): Id64String {
    const targetElementId: Id64String = this.targetDb.elements.insertElement(targetElementProps); // insert from TypeScript so TypeScript handlers are called
    Logger.logInfo(loggerCategory, `[Target] Inserted ${this.formatElementForLogger(targetElementProps)}`);
    return targetElementId;
  }

  /** Transform the specified sourceElement and update result into the target iModel.
   * @param targetElementId The Element in the target iModel to update
   * @note A subclass can override this method to provide custom update behavior.
   */
  protected updateElement(targetElementProps: ElementProps): void {
    if (!targetElementProps.id) {
      throw new IModelError(IModelStatus.InvalidId, "ElementId not provided", Logger.logError, loggerCategory);
    }
    this.targetDb.elements.updateElement(targetElementProps);
    Logger.logInfo(loggerCategory, `[Target] Updated ${this.formatElementForLogger(targetElementProps)}`);
  }

  /** Delete the specified Element from the target iModel.
   * @param targetElement The Element in the target iModel to delete
   * @note A subclass can override this method to provide custom delete behavior.
   */
  protected deleteElement(targetElement: Element): void {
    this.targetDb.elements.deleteElement(targetElement.id);
    Logger.logInfo(loggerCategory, `[Target] Deleted element ${this.formatElementForLogger(targetElement)}`);
  }

  /** Returns true if the detected potential delete of the specified target Element should happen.
   * @param targetElement The Element from the target iModel to consider
   * @returns `true` if target Element should be deleted from the target iModel or `false` if not.
   * @note A subclass can override this method to provide custom Element delete behavior.
   */
  protected shouldDeleteElement(_targetElement: Element): boolean {
    return true;
  }

  /** Returns true if a change within sourceElement is detected.
   * @param sourceElement The Element from the source iModel
   * @param targetElementId The Element from the target iModel to compare against.
   * @note A subclass can override this method to provide custom change detection behavior.
   */
  protected hasElementChanged(sourceElement: Element, targetElementId: Id64String): boolean {
    const aspects: ElementAspect[] = this.targetDb.elements.getAspects(targetElementId, ExternalSourceAspect.classFullName);
    for (const aspect of aspects) {
      const sourceAspect = aspect as ExternalSourceAspect;
      if ((sourceAspect.identifier === sourceElement.id) && (sourceAspect.scope.id === this.targetScopeElementId) && (sourceAspect.kind === ExternalSourceAspect.Kind.Element)) {
        const lastModifiedTime: string = sourceElement.iModel.elements.queryLastModifiedTime(sourceElement.id);
        return (lastModifiedTime !== sourceAspect.version);
      }
    }
    return true;
  }

  /** Called before inserting or updating an element in the target iModel to make sure that it is within the projectExtents. */
  private checkProjectExtents(sourceElement: Element, targetElementProps: ElementProps): void {
    const targetElementClass: typeof Element = this.targetDb.getJsClass<typeof Element>(targetElementProps.classFullName);
    if (targetElementClass.prototype instanceof GeometricElement3d) {
      const targetElementPlacement: Placement3d = Placement3d.fromJSON((targetElementProps as GeometricElement3dProps).placement);
      if (targetElementPlacement.isValid) {
        const targetExtents: AxisAlignedBox3d = targetElementPlacement.calculateRange();
        if (!targetExtents.isNull && !this.targetDb.projectExtents.containsRange(targetExtents)) {
          if (this.autoExtendProjectExtents) {
            Logger.logTrace(loggerCategory, "[Target] Auto-extending projectExtents");
            targetExtents.extendRange(this.targetDb.projectExtents);
            this.targetDb.updateProjectExtents(targetExtents);
          } else {
            throw new IModelError(IModelStatus.BadElement, "Target element would be outside of projectExtents", Logger.logError, loggerCategory, () => ({
              sourceElementClass: sourceElement.classFullName,
              sourceElementId: sourceElement.id,
              targetElementClass: targetElementProps.classFullName,
            }));
          }
        }
      }
    }
  }

  /** Determine if any predecessors have not been imported yet.
   * @param sourceElement The Element from the source iModel
   */
  public findMissingPredecessors(sourceElement: Element): Id64Set {
    const predecessorIds: Id64Set = sourceElement.getPredecessorIds();
    predecessorIds.forEach((elementId: Id64String) => {
      const targetElementId: Id64String = this.context.findTargetElementId(elementId);
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
    if (sourceElementId === IModel.rootSubjectId) {
      throw new IModelError(IModelStatus.BadRequest, "The root Subject should not be directly imported", Logger.logError, loggerCategory);
    }
    const sourceElement: Element = this.sourceDb.elements.getElement({ id: sourceElementId, wantGeometry: true });
    Logger.logTrace(loggerCategory, `[Source] importElement() for ${this.formatElementForLogger(sourceElement)})`);
    if (this.shouldExcludeElement(sourceElement)) {
      this.onElementExcluded(sourceElement);
      return; // excluding an element will also exclude its children or sub-models
    }
    let targetElementId: Id64String | undefined = this.context.findTargetElementId(sourceElementId);
    if (Id64.isValidId64(targetElementId)) {
      if (this.hasElementChanged(sourceElement, targetElementId)) {
        const targetElementProps: ElementProps = this.transformElement(sourceElement);
        targetElementProps.id = targetElementId;
        this.checkProjectExtents(sourceElement, targetElementProps);
        this.updateElement(targetElementProps);
        this.onElementUpdated(sourceElement, targetElementProps);
        this.updateElementProvenance(sourceElement, targetElementId);
      }
    } else {
      const missingPredecessorIds: Id64Set = this.findMissingPredecessors(sourceElement); // WIP: move into transformElement?
      if (missingPredecessorIds.size > 0) {
        this.skipElement(sourceElement);
        this.onElementSkipped(sourceElement);
        if (Logger.isEnabled(loggerCategory, LogLevel.Trace)) {
          for (const missingPredecessorId of missingPredecessorIds) {
            const missingPredecessorElement: Element = this.sourceDb.elements.getElement(missingPredecessorId);
            Logger.logTrace(loggerCategory, `[Source] - Remapping not found for predecessor ${this.formatElementForLogger(missingPredecessorElement)}`);
          }
        }
        return; // skipping an element will also skip its children or sub-models
      }
      const targetElementProps: ElementProps = this.transformElement(sourceElement);
      targetElementId = this.targetDb.elements.queryElementIdByCode(new Code(targetElementProps.code));
      if (targetElementId === undefined) {
        this.checkProjectExtents(sourceElement, targetElementProps);
        targetElementId = this.insertElement(targetElementProps);
        this.context.remapElement(sourceElement.id, targetElementId!);
        this.onElementInserted(sourceElement, targetElementProps);
        this.insertElementProvenance(sourceElement, targetElementId);
      } else if (this.hasElementChanged(sourceElement, targetElementId)) {
        this.context.remapElement(sourceElement.id, targetElementId); // record that the targeElement was found by Code
        targetElementProps.id = targetElementId;
        this.checkProjectExtents(sourceElement, targetElementProps);
        this.updateElement(targetElementProps);
        this.onElementUpdated(sourceElement, targetElementProps);
        this.updateElementProvenance(sourceElement, targetElementId);
      }
    }
    this.importElementAspects(sourceElementId, targetElementId);
    this.importChildElements(sourceElementId);
  }

  /** Import child elements into the target IModelDb
   * @param sourceElementId Import the child elements of this element in the source IModelDb.
   */
  public importChildElements(sourceElementId: Id64String): void {
    const childElementIds: Id64Array = this.sourceDb.elements.queryChildren(sourceElementId);
    if (childElementIds.length > 0) {
      Logger.logTrace(loggerCategory, `[Source] importChildElements(${this.formatIdForLogger(sourceElementId)})`);
    }
    for (const childElementId of childElementIds) {
      this.importElement(childElementId);
    }
  }

  /** Record provenance about the source Element for change detection.
   * @param sourceElement The source Element that was processed to cause the insert into the target iModel.
   * @param targetElementId The Id of the target Element that was inserted.
   */
  protected insertElementProvenance(sourceElement: Element, targetElementId: Id64String): void {
    this.targetDb.elements.insertAspect(IModelTransformer.initExternalSourceAspect(sourceElement, this.targetDb, this.targetScopeElementId, targetElementId));
  }

  /** Record provenance about the source Element for change detection.
   * @param sourceElement The source Element that was processed to cause the update within the target iModel.
   * @param targetElementId The Id of the target Element that was updated.
   */
  protected updateElementProvenance(sourceElement: Element, targetElementId: Id64String): void {
    const aspectProps: ExternalSourceAspectProps = IModelTransformer.initExternalSourceAspect(sourceElement, this.targetDb, this.targetScopeElementId, targetElementId);
    if (aspectProps.id === undefined) {
      this.targetDb.elements.insertAspect(aspectProps);
    } else {
      this.targetDb.elements.updateAspect(aspectProps);
    }
  }

  /** Import the model container, contents, and sub-models into the target IModelDb
   * @param sourceModeledElementId Import this model from the source IModelDb.
   */
  public importModel(sourceModeledElementId: Id64String): void {
    if (sourceModeledElementId === IModel.repositoryModelId) {
      throw new IModelError(IModelStatus.BadRequest, "The RepositoryModel should not be directly imported", Logger.logError, loggerCategory);
    }
    const modeledElement: Element = this.sourceDb.elements.getElement({ id: sourceModeledElementId, wantGeometry: true });
    Logger.logTrace(loggerCategory, `[Source] importModel() for ${this.formatElementForLogger(modeledElement)}`);
    if (this.shouldExcludeElement(modeledElement)) {
      this.onElementExcluded(modeledElement);
    } else {
      const targetModeledElementId: Id64String = this.context.findTargetElementId(sourceModeledElementId);
      this.importModelContainer(sourceModeledElementId, targetModeledElementId);
      this.importModelContents(sourceModeledElementId, targetModeledElementId);
      this.importSubModels(sourceModeledElementId);
    }
  }

  /** Import the model (the container only) into the target IModelDb
   * @param sourceModeledElementId Import this model from the source IModelDb.
   */
  private importModelContainer(sourceModeledElementId: Id64String, targetModeledElementId: Id64String): void {
    const sourceModel: Model = this.sourceDb.models.getModel(sourceModeledElementId);
    try {
      const targetModel: Model = this.targetDb.models.getModel(targetModeledElementId); // throws IModelError.NotFound if model does not exist
      const targetModelProps: ModelProps = this.transformModel(sourceModel, targetModeledElementId);
      if (this.hasModelChanged(targetModel, targetModelProps)) {
        this.updateModel(targetModelProps);
        this.onModelUpdated(sourceModel, targetModelProps);
      }
    } catch (error) {
      // catch NotFound error and insertModel
      if ((error instanceof IModelError) && (error.errorNumber === IModelStatus.NotFound)) {
        const targetModelProps: ModelProps = this.transformModel(sourceModel, targetModeledElementId);
        this.insertModel(targetModelProps);
        this.onModelInserted(sourceModel, targetModelProps);
        return;
      }
      throw error;
    }
  }

  /** Import the model contents into the target IModelDb
   * @param sourceModelId Import the contents of this model from the source IModelDb.
   * @param targetModelId Import into this model in the target IModelDb. The target model must exist prior to this call.
   * @param elementClassFullName Optional classFullName of an element subclass to limit import query against the source model.
   */
  public importModelContents(sourceModelId: Id64String, targetModelId: Id64String, elementClassFullName: string = Element.classFullName): void {
    this.targetDb.models.getModel(targetModelId); // throws if Model does not exist
    this.context.remapElement(sourceModelId, targetModelId); // set remapping in case importModelContents is called directly
    Logger.logTrace(loggerCategory, `[Source] importModelContents(${this.formatIdForLogger(sourceModelId)}, ${this.formatIdForLogger(targetModelId)}, ${elementClassFullName})`);
    const sql = `SELECT ECInstanceId FROM ${elementClassFullName} WHERE Parent.Id IS NULL AND Model.Id=:modelId`;
    this.sourceDb.withPreparedStatement(sql, (statement: ECSqlStatement): void => {
      statement.bindId("modelId", sourceModelId);
      while (DbResult.BE_SQLITE_ROW === statement.step()) {
        this.importElement(statement.getValue(0).getId());
      }
    });
  }

  /** Import the sub-models below the specified model. */
  private importSubModels(sourceParentModelId: Id64String): void {
    const definitionModelIds: Id64String[] = [];
    const otherModelIds: Id64String[] = [];
    const sql = `SELECT ECInstanceId FROM ${Model.classFullName} WHERE ParentModel.Id=:parentModelId`;
    this.sourceDb.withPreparedStatement(sql, (statement: ECSqlStatement): void => {
      statement.bindId("parentModelId", sourceParentModelId);
      while (DbResult.BE_SQLITE_ROW === statement.step()) {
        const modelId: Id64String = statement.getValue(0).getId();
        const model: Model = this.sourceDb.models.getModel(modelId);
        if (model instanceof DefinitionModel) {
          definitionModelIds.push(modelId);
        } else {
          otherModelIds.push(modelId);
        }
      }
    });
    // import DefinitionModels before other types of Models
    definitionModelIds.forEach((modelId: Id64String) => this.importModel(modelId));
    otherModelIds.forEach((modelId: Id64String) => this.importModel(modelId));
  }

  /** Import all sub-models that recursively descend from the specified Subject in the source iModel. */
  private importSubjectSubModels(sourceSubjectId: Id64String): void {
    // import DefinitionModels first
    const childDefinitionPartitionSql = `SELECT ECInstanceId FROM ${DefinitionPartition.classFullName} WHERE Parent.Id=:subjectId`;
    this.sourceDb.withPreparedStatement(childDefinitionPartitionSql, (statement: ECSqlStatement) => {
      statement.bindId("subjectId", sourceSubjectId);
      while (DbResult.BE_SQLITE_ROW === statement.step()) {
        this.importModel(statement.getValue(0).getId());
      }
    });
    // import other partitions next
    const childPartitionSql = `SELECT ECInstanceId FROM ${InformationPartitionElement.classFullName} WHERE Parent.Id=:subjectId`;
    this.sourceDb.withPreparedStatement(childPartitionSql, (statement: ECSqlStatement) => {
      statement.bindId("subjectId", sourceSubjectId);
      while (DbResult.BE_SQLITE_ROW === statement.step()) {
        const modelId: Id64String = statement.getValue(0).getId();
        const model: Model = this.sourceDb.models.getModel(modelId);
        if (!(model instanceof DefinitionModel)) {
          this.importModel(modelId);
        }
      }
    });
    // recurse into child Subjects
    const childSubjectSql = `SELECT ECInstanceId FROM ${Subject.classFullName} WHERE Parent.Id=:subjectId`;
    this.sourceDb.withPreparedStatement(childSubjectSql, (statement: ECSqlStatement) => {
      statement.bindId("subjectId", sourceSubjectId);
      while (DbResult.BE_SQLITE_ROW === statement.step()) {
        this.importSubjectSubModels(statement.getValue(0).getId());
      }
    });
  }

  /** Returns true if a change within a Model is detected.
   * @param model The current persistent Model
   * @param modelProps The new ModelProps to compare against
   * @returns `true` if a change is detected
   */
  private hasModelChanged(model: Model, modelProps: ModelProps): boolean {
    let changed: boolean = false;
    model.forEachProperty((propertyName: string) => {
      if (!changed) {
        if (propertyName === "geometryGuid") {
          // skip because GeometricModel.GeometryGuid values cannot be compared across iModels
        } else if ((propertyName === "jsonProperties") || (propertyName === "modeledElement")) {
          changed = JSON.stringify(model[propertyName]) !== JSON.stringify(modelProps[propertyName]);
        } else {
          changed = model.asAny[propertyName] !== (modelProps as any)[propertyName];
        }
      }
    }, true);
    return changed;
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
    targetModelProps.parentModel = this.context.findTargetElementId(targetModelProps.parentModel!);
    return targetModelProps;
  }

  /** Insert the transformed Model into the target iModel.
   * @param targetModelProps The ModelProps that will be inserted into the target iModel.
   * @note A subclass can override this method to provide custom insert behavior.
   */
  protected insertModel(targetModelProps: ModelProps): void {
    this.targetDb.models.insertModel(targetModelProps);
    Logger.logInfo(loggerCategory, `[Target] Inserted ${this.formatModelForLogger(targetModelProps)}`);
  }

  /** Update the transformed Model within the target iModel.
   * @param targetModelProps The ModelProps that will be updated in the target iModel.
   * @note A subclass can override this method to provide custom update behavior.
   */
  protected updateModel(targetModelProps: ModelProps): void {
    this.targetDb.models.updateModel(targetModelProps);
    Logger.logInfo(loggerCategory, `[Target] Updated ${this.formatModelForLogger(targetModelProps)}`);
  }

  /** Import elements that were skipped in a prior pass */
  public importSkippedElements(numRetries: number = 3): void {
    Logger.logTrace(loggerCategory, `[Source] importSkippedElements(), numSkipped=${this._skippedElementIds.size}`);
    const copyOfSkippedElementIds: Id64Set = this._skippedElementIds;
    this._skippedElementIds = new Set<Id64String>();
    copyOfSkippedElementIds.forEach((elementId: Id64String) => this.importElement(elementId));
    if (this._skippedElementIds.size > 0) {
      if (--numRetries > 0) {
        Logger.logTrace(loggerCategory, "[Source] Retrying importSkippedElements()");
        this.importSkippedElements(numRetries);
      } else {
        throw new IModelError(IModelStatus.BadRequest, "Not all skipped elements could be processed", Logger.logError, loggerCategory);
      }
    }
  }

  /** Imports all relationships that subclass from the specified base class.
   * @param baseRelClassFullName The specified base relationship class.
   */
  public importRelationships(baseRelClassFullName: string): void {
    Logger.logTrace(loggerCategory, `[Source] importRelationships(${baseRelClassFullName})`);
    const sql = `SELECT ECInstanceId FROM ${baseRelClassFullName}`;
    this.sourceDb.withPreparedStatement(sql, (statement: ECSqlStatement) => {
      while (DbResult.BE_SQLITE_ROW === statement.step()) {
        const sourceRelInstanceId: Id64String = statement.getValue(0).getId();
        const sourceRelProps: RelationshipProps = this.sourceDb.relationships.getInstanceProps(baseRelClassFullName, sourceRelInstanceId);
        this.importRelationship(sourceRelProps.classFullName, sourceRelInstanceId);
      }
    });
  }

  /** Import a relationship from the source iModel into the target iModel. */
  public importRelationship(sourceRelClassFullName: string, sourceRelInstanceId: Id64String): void {
    Logger.logTrace(loggerCategory, `[Source] importRelationship(${sourceRelClassFullName}, ${this.formatIdForLogger(sourceRelInstanceId)})`);
    const sourceRelationship: Relationship = this.sourceDb.relationships.getInstance(sourceRelClassFullName, sourceRelInstanceId);
    if (this.shouldExcludeRelationship(sourceRelationship)) {
      this.onRelationshipExcluded(sourceRelationship);
      return;
    }
    const targetRelationshipProps: RelationshipProps = this.transformRelationship(sourceRelationship);
    if (Id64.isValidId64(targetRelationshipProps.sourceId) && Id64.isValidId64(targetRelationshipProps.targetId)) {
      try {
        // check for an existing relationship
        const relSourceAndTarget = { sourceId: targetRelationshipProps.sourceId, targetId: targetRelationshipProps.targetId };
        const targetRelationship = this.targetDb.relationships.getInstance(targetRelationshipProps.classFullName, relSourceAndTarget);
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
        Logger.logInfo(loggerCategory, `[Source] Excluded ${this.formatRelationshipForLogger(sourceRelationship)} by class`);
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
    targetRelationshipProps.sourceId = this.context.findTargetElementId(sourceRelationship.sourceId);
    targetRelationshipProps.targetId = this.context.findTargetElementId(sourceRelationship.targetId);
    sourceRelationship.forEachProperty((propertyName: string, propertyMetaData: PropertyMetaData) => {
      if ((PrimitiveTypeCode.Long === propertyMetaData.primitiveType) && ("Id" === propertyMetaData.extendedType)) {
        (targetRelationshipProps as any)[propertyName] = this.context.findTargetElementId(sourceRelationship.asAny[propertyName]);
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
    const targetRelInstanceId: Id64String = this.targetDb.relationships.insertInstance(targetRelationshipProps);
    Logger.logInfo(loggerCategory, `[Target] Inserted ${this.formatRelationshipForLogger(targetRelationshipProps)}`);
    return targetRelInstanceId;
  }

  /** Update the specified relationship in the target iModel.
   * @note A subclass can override this method to provide custom update behavior.
   */
  protected updateRelationship(targetRelationshipProps: RelationshipProps): void {
    if (!targetRelationshipProps.id) {
      throw new IModelError(IModelStatus.InvalidId, "Relationship instance Id not provided", Logger.logError, loggerCategory);
    }
    this.targetDb.relationships.updateInstance(targetRelationshipProps);
    Logger.logInfo(loggerCategory, `[Target] Updated ${this.formatRelationshipForLogger(targetRelationshipProps)}`);
  }

  /** Returns true if a change within a Relationship is detected.
   * @param relationship The current persistent Relationship
   * @param relationshipProps The new RelationshipProps to compare against
   * @returns `true` if a change is detected
   */
  private hasRelationshipChanged(relationship: Relationship, relationshipProps: RelationshipProps): boolean {
    let changed: boolean = false;
    relationship.forEachProperty((propertyName: string) => {
      if (!changed && (relationship.asAny[propertyName] !== (relationshipProps as any)[propertyName])) {
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
    const sourceUniqueAspects: ElementAspect[] = this.sourceDb.elements.getAspects(sourceElementId, ElementUniqueAspect.classFullName);
    const targetUniqueAspectClasses = new Set<string>();
    sourceUniqueAspects.forEach((sourceUniqueAspect: ElementAspect) => {
      Logger.logTrace(loggerCategory, `[Source] importUniqueAspects() for ${this.formatElementAspectForLogger(sourceUniqueAspect)})`);
      if (this.shouldExcludeElementAspect(sourceUniqueAspect)) {
        this.onElementAspectExcluded(sourceUniqueAspect);
      } else {
        const targetUniqueAspectProps: ElementAspectProps = this.transformElementAspect(sourceUniqueAspect, targetElementId);
        targetUniqueAspectClasses.add(targetUniqueAspectProps.classFullName);
        const targetAspects: ElementAspect[] = this.targetDb.elements.getAspects(targetElementId, targetUniqueAspectProps.classFullName);
        if (targetAspects.length === 0) {
          this.insertElementAspect(targetUniqueAspectProps);
          this.onElementAspectInserted(targetUniqueAspectProps);
        } else if (this.hasElementAspectChanged(targetAspects[0], targetUniqueAspectProps)) {
          targetUniqueAspectProps.id = targetAspects[0].id;
          this.updateElementAspect(targetUniqueAspectProps);
          this.onElementAspectUpdated(targetUniqueAspectProps);
        }
      }
    });
    const targetUniqueAspects: ElementAspect[] = this.targetDb.elements.getAspects(targetElementId, ElementUniqueAspect.classFullName);
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
    const sourceMultiAspects: ElementAspect[] = this.sourceDb.elements.getAspects(sourceElementId, ElementMultiAspect.classFullName);

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
      const targetAspects: ElementAspect[] = this.targetDb.elements.getAspects(targetElementId, aspectClassFullName);
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
    const targetMultiAspects: ElementAspect[] = this.targetDb.elements.getAspects(targetElementId, ElementMultiAspect.classFullName);
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
        Logger.logInfo(loggerCategory, `[Source] Excluded ${this.formatElementAspectForLogger(sourceElementAspect)} by class`);
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
    targetElementAspectProps.id = undefined;
    targetElementAspectProps.element.id = targetElementId;
    sourceElementAspect.forEachProperty((propertyName: string, propertyMetaData: PropertyMetaData) => {
      if ((PrimitiveTypeCode.Long === propertyMetaData.primitiveType) && ("Id" === propertyMetaData.extendedType)) {
        (targetElementAspectProps as any)[propertyName] = this.context.findTargetElementId(sourceElementAspect.asAny[propertyName]);
      }
    }, true);
    return targetElementAspectProps;
  }

  /** Insert the transformed ElementAspect into the target iModel.
   * @param targetElementAspectProps The ElementAspectProps to be inserted into the target iModel.
   * @note A subclass can override this method to provide custom insert behavior.
   */
  protected insertElementAspect(targetElementAspectProps: ElementAspectProps): void {
    this.targetDb.elements.insertAspect(targetElementAspectProps);
    Logger.logInfo(loggerCategory, `[Target] Inserted ${this.formatElementAspectForLogger(targetElementAspectProps)}`);
  }

  /** Update the transformed ElementAspect in the target iModel.
   * @param targetElementAspectProps The ElementAspectProps to be updated in the target iModel.
   * @note A subclass can override this method to provide custom update behavior.
   */
  protected updateElementAspect(targetElementAspectProps: ElementAspectProps): void {
    this.targetDb.elements.updateAspect(targetElementAspectProps);
    Logger.logInfo(loggerCategory, `[Target] Updated ${this.formatElementAspectForLogger(targetElementAspectProps)}`);
  }

  /** Delete the specified ElementAspect from the target iModel.
   * @param targetElementAspect The ElementAspectProps to be updated in the target iModel.
   * @note A subclass can override this method to provide custom update behavior.
   */
  protected deleteElementAspect(targetElementAspect: ElementAspect): void {
    this.targetDb.elements.deleteAspect(targetElementAspect.id);
    Logger.logInfo(loggerCategory, `[Target] Deleted ${this.formatElementAspectForLogger(targetElementAspect)}`);
  }

  /** Returns true if a change within an ElementAspect is detected.
   * @param aspect The current persistent ElementAspect
   * @param aspectProps The new ElementAspectProps to compare against
   * @returns `true` if a change is detected
   */
  private hasElementAspectChanged(aspect: ElementAspect, aspectProps: ElementAspectProps): boolean {
    let changed: boolean = false;
    aspect.forEachProperty((propertyName: string) => {
      if (!changed && (propertyName !== "element") && (aspect.asAny[propertyName] !== (aspectProps as any)[propertyName])) {
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
      this.sourceDb.nativeDb.exportSchemas(schemasDir);
      const schemaFiles: string[] = IModelJsFs.readdirSync(schemasDir);
      await this.targetDb.importSchemas(requestContext, schemaFiles.map((fileName) => path.join(schemasDir, fileName)));
    } finally {
      IModelJsFs.removeSync(schemasDir);
    }
  }

  /** Import all fonts from the source iModel into the target iModel. */
  public importFonts(): void {
    Logger.logTrace(loggerCategory, `[Source] importFonts()`);
    for (const font of this.sourceDb.fontMap.fonts.values()) {
      this.context.importFont(font.id);
    }
  }

  /** Import all CodeSpecs from the source iModel into the target iModel. */
  public importCodeSpecs(): void {
    Logger.logTrace(loggerCategory, `[Source] importCodeSpecs()`);
    const sql = `SELECT Name FROM BisCore:CodeSpec`;
    this.sourceDb.withPreparedStatement(sql, (statement: ECSqlStatement) => {
      while (DbResult.BE_SQLITE_ROW === statement.step()) {
        const codeSpecName: string = statement.getRow().name;
        this.importCodeSpec(codeSpecName);
      }
    });
  }

  /** Import a single CodeSpec from the source iModel into the target iModel. */
  public importCodeSpec(codeSpecName: string): void {
    if (this._excludedCodeSpecNames.has(codeSpecName)) {
      Logger.logInfo(loggerCategory, `[Source] Excluding CodeSpec: ${codeSpecName}`);
      this.onCodeSpecExcluded(codeSpecName);
      return;
    }
    const sourceCodeSpecId: Id64String = this.sourceDb.codeSpecs.queryId(codeSpecName);
    this.context.importCodeSpec(sourceCodeSpecId);
  }

  /** Recursively import all Elements and sub-Models that descend from the specified Subject */
  public importSubject(sourceSubjectId: Id64String, targetSubjectId: Id64String): void {
    this.sourceDb.elements.getElement<Subject>(sourceSubjectId); // throws if sourceSubjectId is not a Subject
    this.targetDb.elements.getElement<Subject>(targetSubjectId); // throws if targetSubjectId is not a Subject
    this.context.remapElement(sourceSubjectId, targetSubjectId);
    this.importChildElements(sourceSubjectId);
    this.importSubjectSubModels(sourceSubjectId);
    this.importSkippedElements();
  }

  /** Import everything from the source iModel into the target iModel. */
  public importAll(): void {
    this.initFromExternalSourceAspects();
    this.importCodeSpecs();
    this.importFonts();
    this.importChildElements(IModel.rootSubjectId);
    this.importSubModels(IModel.repositoryModelId);
    this.importSkippedElements();
    this.importRelationships(ElementRefersToElements.classFullName);
    this.detectElementDeletes();
  }
}
