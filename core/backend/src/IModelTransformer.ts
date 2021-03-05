/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModels
 */
import * as path from "path";
import { ClientRequestContext, DbResult, Guid, GuidString, Id64, Id64Set, Id64String, IModelStatus, Logger, LogLevel } from "@bentley/bentleyjs-core";
import { Point3d, Transform } from "@bentley/geometry-core";
import {
  Code, CodeSpec, ElementAspectProps, ElementProps, ExternalSourceAspectProps, FontProps, GeometricElement2dProps, GeometricElement3dProps, IModel,
  IModelError, ModelProps, Placement2d, Placement3d, PrimitiveTypeCode, PropertyMetaData,
} from "@bentley/imodeljs-common";
import { AuthorizedClientRequestContext } from "@bentley/itwin-client";
import { BackendLoggerCategory } from "./BackendLoggerCategory";
import { ECSqlStatement } from "./ECSqlStatement";
import { DefinitionPartition, Element, GeometricElement2d, GeometricElement3d, InformationPartitionElement, Subject } from "./Element";
import { ChannelRootAspect, ElementAspect, ElementMultiAspect, ElementUniqueAspect, ExternalSourceAspect } from "./ElementAspect";
import { IModelCloneContext } from "./IModelCloneContext";
import { IModelDb } from "./IModelDb";
import { IModelExporter, IModelExportHandler } from "./IModelExporter";
import { KnownLocations } from "./IModelHost";
import { IModelImporter } from "./IModelImporter";
import { IModelJsFs } from "./IModelJsFs";
import { DefinitionModel, Model } from "./Model";
import { ElementOwnsExternalSourceAspects } from "./NavigationRelationship";
import { ElementRefersToElements, Relationship, RelationshipProps } from "./Relationship";

const loggerCategory: string = BackendLoggerCategory.IModelTransformer;

/** Options provided to the [[IModelTransformer]] constructor.
 * @beta
 */
export interface IModelTransformOptions {
  /** The Id of the Element in the **target** iModel that represents the **source** repository as a whole and scopes its [ExternalSourceAspect]($backend) instances.
   * When the goal is to consolidate multiple source iModels into a single target iModel, this option must be specified.
   */
  targetScopeElementId?: Id64String;

  /** Set to true if IModelTransformer should not record provenance back to the source element in the sourceDb on the target element within the targetDb. */
  noProvenance?: boolean;

  /** Flag that indicates that the target iModel was created by copying the source iModel.
   * This is common when the target iModel is intended to be a *branch* of the source iModel.
   * This *hint* is essential to properly initialize the source to target element mapping and to cause provenance to be recorded for future synchronizations.
   * @note This *hint* is typically only set for the first synchronization after the iModel was copied since every other synchronization can utilize the provenance.
   */
  wasSourceIModelCopiedToTarget?: boolean;

  /** Flag that indicates that the current source and target iModels are now synchronizing in the reverse direction from a prior synchronization.
   * The most common example is to first synchronize master to branch, make changes to the branch, and then reverse directions to synchronize from branch to master.
   * This means that the provenance on the (current) source is used instead.
   * @note This also means that only [[processChanges]] can detect deletes.
   */
  isReverseSynchronization?: boolean;

  /** Flag that indicates whether or not the transformation process needs to consider the source geometry before cloning/transforming.
   * For standard cases, it is not required to load the source GeometryStream in JavaScript since the cloning happens in native code.
   * Also, the target GeometryStream will be available in JavaScript prior to insert.
   * @note If the source geometry affects the class mapping or transformation logic, then this flag should be set to `true`. The default is `false`.
   * @see [IModelExporter.wantGeometry]($backend)
   */
  loadSourceGeometry?: boolean;

  /** Flag that indicates whether or not the transformation process should clone using binary geometry.
   * Only transformations that need to manipulate geometry should consider setting this flag as it impacts performance.
   * @note The default is `true`.
   */
  cloneUsingBinaryGeometry?: boolean;
}

/** Base class used to transform a source iModel into a different target iModel.
 * @see [iModel Transformation and Data Exchange]($docs/learning/backend/IModelTransformation.md), [IModelExporter]($backend), [IModelImporter]($backend)
 * @beta
 */
export class IModelTransformer extends IModelExportHandler {
  /** The IModelExporter that will export from the source iModel. */
  public readonly exporter: IModelExporter;
  /** The IModelImporter that will import into the target iModel. */
  public readonly importer: IModelImporter;
  /** The read-only source iModel. */
  public readonly sourceDb: IModelDb;
  /** The read/write target iModel. */
  public readonly targetDb: IModelDb;
  /** The IModelTransformContext for this IModelTransformer. */
  public readonly context: IModelCloneContext;
  /** The Id of the Element in the **target** iModel that represents the **source** repository as a whole and scopes its [ExternalSourceAspect]($backend) instances. */
  public readonly targetScopeElementId: Id64String;

  /** The set of Elements that were deferred during a prior transformation pass. */
  protected _deferredElementIds = new Set<Id64String>();
  /** If true, IModelTransformer is being used in a clone-only mode and should not record provenance. */
  private readonly _noProvenance: boolean;
  /** @see [[IModelTransformOptions.cloneUsingBinaryGeometry]] */
  private readonly _cloneUsingBinaryGeometry: boolean;
  /** @see [[IModelTransformOptions.wasSourceIModelCopiedToTarget]] */
  private readonly _wasSourceIModelCopiedToTarget: boolean;
  /** @see [[IModelTransformOptions.isReverseSynchronization]] */
  private readonly _isReverseSynchronization: boolean;

  /** Construct a new IModelTransformer
   * @param source Specifies the source IModelExporter or the source IModelDb that will be used to construct the source IModelExporter.
   * @param target Specifies the target IModelImporter or the target IModelDb that will be used to construct the target IModelImporter.
   * @param options The options that specify how the transformation should be done.
   */
  public constructor(source: IModelDb | IModelExporter, target: IModelDb | IModelImporter, options?: IModelTransformOptions) {
    super();
    // initialize IModelTransformOptions
    this.targetScopeElementId = options?.targetScopeElementId ?? IModel.rootSubjectId;
    this._noProvenance = options?.noProvenance ?? false;
    this._cloneUsingBinaryGeometry = options?.cloneUsingBinaryGeometry ?? true;
    this._wasSourceIModelCopiedToTarget = options?.wasSourceIModelCopiedToTarget ?? false;
    this._isReverseSynchronization = options?.isReverseSynchronization ?? false;
    // initialize exporter and sourceDb
    if (source instanceof IModelDb) {
      this.exporter = new IModelExporter(source);
    } else {
      this.exporter = source;
    }
    this.sourceDb = this.exporter.sourceDb;
    this.exporter.registerHandler(this);
    this.exporter.wantGeometry = options?.loadSourceGeometry ?? false; // optimization to not load source GeometryStreams by default
    this.exporter.excludeElementAspectClass(ExternalSourceAspect.classFullName); // Provenance specific to the source iModel is not relevant to the target iModel
    this.exporter.excludeElementAspectClass(ChannelRootAspect.classFullName); // Channel boundaries within the source iModel are not relevant to the target iModel
    this.exporter.excludeElementAspectClass("BisCore:TextAnnotationData"); // This ElementAspect is auto-created by the BisCore:TextAnnotation2d/3d element handlers
    // initialize importer and targetDb
    if (target instanceof IModelDb) {
      this.importer = new IModelImporter(target);
    } else {
      this.importer = target;
    }
    this.targetDb = this.importer.targetDb;
    // initialize the IModelCloneContext
    this.context = new IModelCloneContext(this.sourceDb, this.targetDb);
  }

  /** Dispose any native resources associated with this IModelTransformer. */
  public dispose(): void {
    Logger.logTrace(loggerCategory, "dispose()");
    this.context.dispose();
  }

  /** Log current settings that affect IModelTransformer's behavior. */
  private logSettings(): void {
    Logger.logInfo(BackendLoggerCategory.IModelExporter, `this.exporter.wantGeometry=${this.exporter.wantGeometry}`);
    Logger.logInfo(BackendLoggerCategory.IModelExporter, `this.exporter.wantSystemSchemas=${this.exporter.wantSystemSchemas}`);
    Logger.logInfo(BackendLoggerCategory.IModelExporter, `this.exporter.wantTemplateModels=${this.exporter.wantTemplateModels}`);
    Logger.logInfo(loggerCategory, `this.targetScopeElementId=${this.targetScopeElementId}`);
    Logger.logInfo(loggerCategory, `this._noProvenance=${this._noProvenance}`);
    Logger.logInfo(loggerCategory, `this._cloneUsingBinaryGeometry=${this._cloneUsingBinaryGeometry}`);
    Logger.logInfo(BackendLoggerCategory.IModelImporter, `this.importer.autoExtendProjectExtents=${this.importer.autoExtendProjectExtents}`);
    Logger.logInfo(BackendLoggerCategory.IModelImporter, `this.importer.simplifyElementGeometry=${this.importer.simplifyElementGeometry}`);
  }

  /** Create an ExternalSourceAspectProps in a standard way for an Element in an iModel --> iModel transformation. */
  private initElementProvenance(sourceElementId: Id64String, targetElementId: Id64String): ExternalSourceAspectProps {
    const elementId = this._isReverseSynchronization ? sourceElementId : targetElementId;
    const aspectIdentifier = this._isReverseSynchronization ? targetElementId : sourceElementId;
    const aspectProps: ExternalSourceAspectProps = {
      classFullName: ExternalSourceAspect.classFullName,
      element: { id: elementId, relClassName: ElementOwnsExternalSourceAspects.classFullName },
      scope: { id: this.targetScopeElementId },
      identifier: aspectIdentifier,
      kind: ExternalSourceAspect.Kind.Element,
      version: this.sourceDb.elements.queryLastModifiedTime(sourceElementId),
    };
    const sql = `SELECT ECInstanceId FROM ${ExternalSourceAspect.classFullName} a WHERE a.Element.Id=:elementId AND a.Scope.Id=:scopeId AND a.Kind=:kind AND a.Identifier=:identifier LIMIT 1`;
    const iModelDb = this._isReverseSynchronization ? this.sourceDb : this.targetDb;
    aspectProps.id = iModelDb.withPreparedStatement(sql, (statement: ECSqlStatement): Id64String | undefined => {
      statement.bindId("elementId", elementId);
      statement.bindId("scopeId", this.targetScopeElementId);
      statement.bindString("kind", ExternalSourceAspect.Kind.Element);
      statement.bindString("identifier", aspectIdentifier); // ExternalSourceAspect.Identifier is of type string
      return (DbResult.BE_SQLITE_ROW === statement.step()) ? statement.getValue(0).getId() : undefined;
    });
    return aspectProps;
  }

  /** Create an ExternalSourceAspectProps in a standard way for a Relationship in an iModel --> iModel transformations.
   * The ExternalSourceAspect is meant to be owned by the Element in the target iModel that is the `sourceId` of transformed relationship.
   * The `identifier` property of the ExternalSourceAspect will be the ECInstanceId of the relationship in the source iModel.
   * The ECInstanceId of the relationship in the target iModel will be stored in the JsonProperties of the ExternalSourceAspect.
   */
  private initRelationshipProvenance(sourceRelationship: Relationship, targetRelInstanceId: Id64String): ExternalSourceAspectProps {
    const targetRelationship: Relationship = this.targetDb.relationships.getInstance(ElementRefersToElements.classFullName, targetRelInstanceId);
    const elementId = this._isReverseSynchronization ? sourceRelationship.sourceId : targetRelationship.sourceId;
    const aspectIdentifier = this._isReverseSynchronization ? targetRelInstanceId : sourceRelationship.id;
    const aspectProps: ExternalSourceAspectProps = {
      classFullName: ExternalSourceAspect.classFullName,
      element: { id: elementId, relClassName: ElementOwnsExternalSourceAspects.classFullName },
      scope: { id: this.targetScopeElementId },
      identifier: aspectIdentifier,
      kind: ExternalSourceAspect.Kind.Relationship,
      jsonProperties: JSON.stringify({ targetRelInstanceId }),
    };
    const sql = `SELECT ECInstanceId FROM ${ExternalSourceAspect.classFullName} aspect` +
      ` WHERE aspect.Element.Id=:elementId AND aspect.Scope.Id=:scopeId AND aspect.Kind=:kind AND aspect.Identifier=:identifier LIMIT 1`;
    const iModelDb = this._isReverseSynchronization ? this.sourceDb : this.targetDb;
    aspectProps.id = iModelDb.withPreparedStatement(sql, (statement: ECSqlStatement): Id64String | undefined => {
      statement.bindId("elementId", elementId);
      statement.bindId("scopeId", this.targetScopeElementId);
      statement.bindString("kind", ExternalSourceAspect.Kind.Relationship);
      statement.bindString("identifier", aspectIdentifier);
      return (DbResult.BE_SQLITE_ROW === statement.step()) ? statement.getValue(0).getId() : undefined;
    });
    return aspectProps;
  }

  /** Iterate all matching ExternalSourceAspects in the target iModel and call a function for each one. */
  private forEachExternalSourceAspect(fn: (sourceElementId: Id64String, targetElementId: Id64String) => void): void {
    const iModelDb = this._isReverseSynchronization ? this.sourceDb : this.targetDb;
    if (!iModelDb.containsClass(ExternalSourceAspect.classFullName)) {
      throw new IModelError(IModelStatus.BadSchema, "The BisCore schema version of the target database is too old", Logger.logError, loggerCategory);
    }
    const sql = `SELECT aspect.Identifier,aspect.Element.Id FROM ${ExternalSourceAspect.classFullName} aspect WHERE aspect.Scope.Id=:scopeId AND aspect.Kind=:kind`;
    iModelDb.withPreparedStatement(sql, (statement: ECSqlStatement): void => {
      statement.bindId("scopeId", this.targetScopeElementId);
      statement.bindString("kind", ExternalSourceAspect.Kind.Element);
      while (DbResult.BE_SQLITE_ROW === statement.step()) {
        const aspectIdentifier: Id64String = statement.getValue(0).getString(); // ExternalSourceAspect.Identifier is of type string
        const elementId: Id64String = statement.getValue(1).getId();
        if (this._isReverseSynchronization) {
          fn(elementId, aspectIdentifier); // provenance coming from the sourceDb
        } else {
          fn(aspectIdentifier, elementId); // provenance coming from the targetDb
        }
      }
    });
  }

  /** Initialize the source to target Element mapping from ExternalSourceAspects in the target iModel.
   * @note This method is called from [[processChanges]] and [[processAll]], so it only needs to be called directly when processing a subset of an iModel.
   */
  public initFromExternalSourceAspects(): void {
    this.forEachExternalSourceAspect((sourceElementId: Id64String, targetElementId: Id64String) => {
      this.context.remapElement(sourceElementId, targetElementId);
    });
  }

  /** Detect Element deletes using ExternalSourceAspects in the target iModel and a *brute force* comparison against Elements in the source iModel.
   * @see processChanges
   * @note This method is called from [[processAll]] and is not needed by [[processChanges]], so it only needs to be called directly when processing a subset of an iModel.
   * @throws [[IModelError]] If the required provenance information is not available to detect deletes.
   */
  public async detectElementDeletes(): Promise<void> {
    if (this._isReverseSynchronization) {
      throw new IModelError(IModelStatus.BadRequest, "Cannot detect deletes when isReverseSynchronization=true", Logger.logError, loggerCategory);
    }
    const targetElementsToDelete: Id64String[] = [];
    this.forEachExternalSourceAspect((sourceElementId: Id64String, targetElementId: Id64String) => {
      if (undefined === this.sourceDb.elements.tryGetElementProps(sourceElementId)) {
        // if the sourceElement is not found, then it must have been deleted, so propagate the delete to the target iModel
        targetElementsToDelete.push(targetElementId);
      }
    });
    targetElementsToDelete.forEach((targetElementId: Id64String) => {
      this.importer.deleteElement(targetElementId);
    });
  }

  /** Format an Element for the Logger. */
  private formatElementForLogger(elementProps: ElementProps): string {
    const namePiece: string = elementProps.code.value ? `${elementProps.code.value} ` : elementProps.userLabel ? `${elementProps.userLabel} ` : "";
    return `${elementProps.classFullName} ${namePiece}[${elementProps.id!}]`;
  }

  /** Mark the specified Element so its processing can be deferred. */
  protected skipElement(sourceElement: Element): void {
    this._deferredElementIds.add(sourceElement.id);
    Logger.logInfo(loggerCategory, `Deferred ${this.formatElementForLogger(sourceElement)}`);
  }

  /** Transform the specified sourceElement into ElementProps for the target iModel.
   * @param sourceElement The Element from the source iModel to transform.
   * @returns ElementProps for the target iModel.
   * @note A subclass can override this method to provide custom transform behavior.
   */
  protected onTransformElement(sourceElement: Element): ElementProps {
    Logger.logTrace(loggerCategory, `onTransformElement(${sourceElement.id}) "${sourceElement.getDisplayLabel()}"`);
    const targetElementProps: ElementProps = this.context.cloneElement(sourceElement, { binaryGeometry: this._cloneUsingBinaryGeometry });
    if (sourceElement instanceof Subject) {
      if (targetElementProps.jsonProperties?.Subject?.Job) {
        // don't propagate source channels into target (legacy bridge case)
        targetElementProps.jsonProperties.Subject.Job = undefined;
      }
    }
    return targetElementProps;
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

  /** Determine if any predecessors have not been imported yet.
   * @param sourceElement The Element from the source iModel
   */
  private findMissingPredecessors(sourceElement: Element): Id64Set {
    const predecessorIds: Id64Set = sourceElement.getPredecessorIds();
    predecessorIds.forEach((sourceElementId: Id64String) => {
      if (Id64.invalid === sourceElementId) {
        predecessorIds.delete(sourceElementId);
      } else {
        const targetElementId: Id64String = this.context.findTargetElementId(sourceElementId);
        if (Id64.isValidId64(targetElementId)) {
          predecessorIds.delete(sourceElementId);
        }
      }
    });
    return predecessorIds;
  }

  /** Cause the specified Element and its child Elements (if applicable) to be exported from the source iModel and imported into the target iModel.
   * @param sourceElementId Identifies the Element from the source iModel to import.
   * @note This method is called from [[processChanges]] and [[processAll]], so it only needs to be called directly when processing a subset of an iModel.
   */
  public async processElement(sourceElementId: Id64String): Promise<void> {
    if (sourceElementId === IModel.rootSubjectId) {
      throw new IModelError(IModelStatus.BadRequest, "The root Subject should not be directly imported", Logger.logError, loggerCategory);
    }
    return this.exporter.exportElement(sourceElementId);
  }

  /** Import child elements into the target IModelDb
   * @param sourceElementId Import the child elements of this element in the source IModelDb.
   * @note This method is called from [[processChanges]] and [[processAll]], so it only needs to be called directly when processing a subset of an iModel.
   */
  public async processChildElements(sourceElementId: Id64String): Promise<void> {
    return this.exporter.exportChildElements(sourceElementId);
  }

  /** Override of [IModelExportHandler.shouldExportElement]($backend) that is called to determine if an element should be exported from the source iModel.
   * @note Reaching this point means that the element has passed the standard exclusion checks in IModelExporter.
   */
  protected shouldExportElement(_sourceElement: Element): boolean { return true; }

  /** Override of [IModelExportHandler.onExportElement]($backend) that imports an element into the target iModel when it is exported from the source iModel.
   * This override calls [[onTransformElement]] and then [IModelImporter.importElement]($backend) to update the target iModel.
   */
  protected onExportElement(sourceElement: Element): void {
    let targetElementId: Id64String | undefined;
    let targetElementProps: ElementProps;
    if (this._wasSourceIModelCopiedToTarget) {
      targetElementId = sourceElement.id;
      targetElementProps = this.targetDb.elements.getElementProps(targetElementId);
    } else {
      targetElementId = this.context.findTargetElementId(sourceElement.id);
      targetElementProps = this.onTransformElement(sourceElement);
    }
    if (!Id64.isValidId64(targetElementId)) {
      targetElementId = this.targetDb.elements.queryElementIdByCode(new Code(targetElementProps.code));
      if (undefined !== targetElementId) {
        const targetElement: Element = this.targetDb.elements.getElement(targetElementId);
        if (targetElement.classFullName === targetElementProps.classFullName) { // ensure code remapping doesn't change the target class
          this.context.remapElement(sourceElement.id, targetElementId); // record that the targeElement was found by Code
        } else {
          targetElementId = undefined;
          targetElementProps.code = Code.createEmpty(); // clear out invalid code
        }
      }
    }
    if (undefined !== targetElementId) {
      // compare LastMod of sourceElement to ExternalSourceAspect of targetElement to see there are changes to import
      if (!this.hasElementChanged(sourceElement, targetElementId)) {
        return;
      }
    } else {
      const missingPredecessorIds: Id64Set = this.findMissingPredecessors(sourceElement);
      if (missingPredecessorIds.size > 0) {
        this.skipElement(sourceElement);
        if (Logger.isEnabled(loggerCategory, LogLevel.Trace)) {
          for (const missingPredecessorId of missingPredecessorIds) {
            const missingPredecessorElement: Element | undefined = this.sourceDb.elements.tryGetElement(missingPredecessorId);
            if (missingPredecessorElement) {
              Logger.logTrace(loggerCategory, `Remapping not found for predecessor ${this.formatElementForLogger(missingPredecessorElement)}`);
            }
          }
        }
        return;
      }
    }
    targetElementProps.id = targetElementId; // targetElementId will be valid (indicating update) or undefined (indicating insert)
    if (!this._wasSourceIModelCopiedToTarget) {
      this.importer.importElement(targetElementProps); // don't need to import if iModel was copied
    }
    this.context.remapElement(sourceElement.id, targetElementProps.id!); // targetElementProps.id assigned by importElement
    if (!this._noProvenance) {
      const aspectProps: ExternalSourceAspectProps = this.initElementProvenance(sourceElement.id, targetElementProps.id!);
      const iModelDb = this._isReverseSynchronization ? this.sourceDb : this.targetDb;
      if (aspectProps.id === undefined) {
        iModelDb.elements.insertAspect(aspectProps);
      } else {
        iModelDb.elements.updateAspect(aspectProps);
      }
    }
  }

  /** Override of [IModelExportHandler.onDeleteElement]($backend) that is called when [IModelExporter]($backend) detects that an Element has been deleted from the source iModel.
   * This override propagates the delete to the target iModel via [IModelImporter.deleteElement]($backend).
   */
  protected onDeleteElement(sourceElementId: Id64String): void {
    const targetElementId: Id64String = this.context.findTargetElementId(sourceElementId);
    if (Id64.isValidId64(targetElementId)) {
      this.importer.deleteElement(targetElementId);
    }
  }

  /** Override of [IModelExportHandler.onExportModel]($backend) that is called when a Model should be exported from the source iModel.
   * This override calls [[onTransformModel]] and then [IModelImporter.importModel]($backend) to update the target iModel.
   */
  protected onExportModel(sourceModel: Model): void {
    if (IModel.repositoryModelId === sourceModel.id) {
      return; // The RepositoryModel should not be directly imported
    }
    const targetModeledElementId: Id64String = this.context.findTargetElementId(sourceModel.id);
    const targetModelProps: ModelProps = this.onTransformModel(sourceModel, targetModeledElementId);
    this.importer.importModel(targetModelProps);
  }

  /** Override of [IModelExportHandler.onDeleteModel]($backend) that is called when [IModelExporter]($backend) detects that a [Model]($backend) has been deleted from the source iModel. */
  protected onDeleteModel(_sourceModelId: Id64String): void {
    // WIP: currently ignored
  }

  /** Cause the model container, contents, and sub-models to be exported from the source iModel and imported into the target iModel.
   * @param sourceModeledElementId Import this [Model]($backend) from the source IModelDb.
   * @note This method is called from [[processChanges]] and [[processAll]], so it only needs to be called directly when processing a subset of an iModel.
   */
  public async processModel(sourceModeledElementId: Id64String): Promise<void> {
    return this.exporter.exportModel(sourceModeledElementId);
  }

  /** Cause the model contents to be exported from the source iModel and imported into the target iModel.
   * @param sourceModelId Import the contents of this model from the source IModelDb.
   * @param targetModelId Import into this model in the target IModelDb. The target model must exist prior to this call.
   * @param elementClassFullName Optional classFullName of an element subclass to limit import query against the source model.
   * @note This method is called from [[processChanges]] and [[processAll]], so it only needs to be called directly when processing a subset of an iModel.
   */
  public async processModelContents(sourceModelId: Id64String, targetModelId: Id64String, elementClassFullName: string = Element.classFullName): Promise<void> {
    this.targetDb.models.getModel(targetModelId); // throws if Model does not exist
    this.context.remapElement(sourceModelId, targetModelId); // set remapping in case importModelContents is called directly
    return this.exporter.exportModelContents(sourceModelId, elementClassFullName);
  }

  /** Cause all sub-models that recursively descend from the specified Subject to be exported from the source iModel and imported into the target iModel. */
  private async processSubjectSubModels(sourceSubjectId: Id64String): Promise<void> {
    // import DefinitionModels first
    const childDefinitionPartitionSql = `SELECT ECInstanceId FROM ${DefinitionPartition.classFullName} WHERE Parent.Id=:subjectId`;
    await this.sourceDb.withPreparedStatement(childDefinitionPartitionSql, async (statement: ECSqlStatement) => {
      statement.bindId("subjectId", sourceSubjectId);
      while (DbResult.BE_SQLITE_ROW === statement.step()) {
        await this.processModel(statement.getValue(0).getId());
      }
    });
    // import other partitions next
    const childPartitionSql = `SELECT ECInstanceId FROM ${InformationPartitionElement.classFullName} WHERE Parent.Id=:subjectId`;
    await this.sourceDb.withPreparedStatement(childPartitionSql, async (statement: ECSqlStatement) => {
      statement.bindId("subjectId", sourceSubjectId);
      while (DbResult.BE_SQLITE_ROW === statement.step()) {
        const modelId: Id64String = statement.getValue(0).getId();
        const model: Model = this.sourceDb.models.getModel(modelId);
        if (!(model instanceof DefinitionModel)) {
          await this.processModel(modelId);
        }
      }
    });
    // recurse into child Subjects
    const childSubjectSql = `SELECT ECInstanceId FROM ${Subject.classFullName} WHERE Parent.Id=:subjectId`;
    await this.sourceDb.withPreparedStatement(childSubjectSql, async (statement: ECSqlStatement) => {
      statement.bindId("subjectId", sourceSubjectId);
      while (DbResult.BE_SQLITE_ROW === statement.step()) {
        await this.processSubjectSubModels(statement.getValue(0).getId());
      }
    });
  }

  /** Transform the specified sourceModel into ModelProps for the target iModel.
   * @param sourceModel The Model from the source iModel to be transformed.
   * @param targetModeledElementId The transformed Model will *break down* or *detail* this Element in the target iModel.
   * @returns ModelProps for the target iModel.
   * @note A subclass can override this method to provide custom transform behavior.
   */
  protected onTransformModel(sourceModel: Model, targetModeledElementId: Id64String): ModelProps {
    const targetModelProps: ModelProps = sourceModel.toJSON();
    targetModelProps.modeledElement.id = targetModeledElementId;
    targetModelProps.id = targetModeledElementId;
    targetModelProps.parentModel = this.context.findTargetElementId(targetModelProps.parentModel!);
    return targetModelProps;
  }

  /** Import elements that were deferred in a prior pass.
   * @note This method is called from [[processChanges]] and [[processAll]], so it only needs to be called directly when processing a subset of an iModel.
   */
  public async processDeferredElements(numRetries: number = 3): Promise<void> {
    Logger.logTrace(loggerCategory, `processDeferredElements(), numDeferred=${this._deferredElementIds.size}`);
    const copyOfDeferredElementIds: Id64Set = this._deferredElementIds;
    this._deferredElementIds = new Set<Id64String>();
    for (const elementId of copyOfDeferredElementIds) {
      await this.processElement(elementId);
    }
    if (this._deferredElementIds.size > 0) {
      if (--numRetries > 0) {
        Logger.logTrace(loggerCategory, "Retrying processDeferredElements()");
        await this.processDeferredElements(numRetries);
      } else {
        throw new IModelError(IModelStatus.BadRequest, "Not all deferred elements could be processed", Logger.logError, loggerCategory);
      }
    }
  }

  /** Imports all relationships that subclass from the specified base class.
   * @param baseRelClassFullName The specified base relationship class.
   * @note This method is called from [[processChanges]] and [[processAll]], so it only needs to be called directly when processing a subset of an iModel.
   */
  public async processRelationships(baseRelClassFullName: string): Promise<void> {
    return this.exporter.exportRelationships(baseRelClassFullName);
  }

  /** Override of [IModelExportHandler.shouldExportRelationship]($backend) that is called to determine if a [Relationship]($backend) should be exported.
   * @note Reaching this point means that the relationship has passed the standard exclusion checks in [IModelExporter]($backend).
   */
  protected shouldExportRelationship(_sourceRelationship: Relationship): boolean { return true; }

  /** Override of [IModelExportHandler.onExportRelationship]($backend) that imports a relationship into the target iModel when it is exported from the source iModel.
   * This override calls [[onTransformRelationship]] and then [IModelImporter.importRelationship]($backend) to update the target iModel.
   */
  protected onExportRelationship(sourceRelationship: Relationship): void {
    const targetRelationshipProps: RelationshipProps = this.onTransformRelationship(sourceRelationship);
    const targetRelationshipInstanceId: Id64String = this.importer.importRelationship(targetRelationshipProps);
    if (!this._noProvenance && Id64.isValidId64(targetRelationshipInstanceId)) {
      const aspectProps: ExternalSourceAspectProps = this.initRelationshipProvenance(sourceRelationship, targetRelationshipInstanceId);
      if (undefined === aspectProps.id) {
        if (this._isReverseSynchronization) {
          this.sourceDb.elements.insertAspect(aspectProps);
        } else {
          this.targetDb.elements.insertAspect(aspectProps);
        }
      }
    }
  }

  /** Override of [IModelExportHandler.onDeleteRelationship]($backend) that is called when [IModelExporter]($backend) detects that a [Relationship]($backend) has been deleted from the source iModel.
   * This override propagates the delete to the target iModel via [IModelImporter.deleteRelationship]($backend).
   */
  protected onDeleteRelationship(sourceRelInstanceId: Id64String): void {
    const sql = `SELECT ECInstanceId,JsonProperties FROM ${ExternalSourceAspect.classFullName} aspect` +
      ` WHERE aspect.Scope.Id=:scopeId AND aspect.Kind=:kind AND aspect.Identifier=:identifier LIMIT 1`;
    this.targetDb.withPreparedStatement(sql, (statement: ECSqlStatement): void => {
      statement.bindId("scopeId", this.targetScopeElementId);
      statement.bindString("kind", ExternalSourceAspect.Kind.Relationship);
      statement.bindString("identifier", sourceRelInstanceId);
      if (DbResult.BE_SQLITE_ROW === statement.step()) {
        const json: any = JSON.parse(statement.getValue(1).getString());
        if (undefined !== json.targetRelInstanceId) {
          const targetRelationship: Relationship = this.targetDb.relationships.getInstance(ElementRefersToElements.classFullName, json.targetRelInstanceId);
          this.importer.deleteRelationship(targetRelationship);
          this.targetDb.elements.deleteAspect(statement.getValue(0).getId());
        }
      }
    });
  }

  /** Detect Relationship deletes using ExternalSourceAspects in the target iModel and a *brute force* comparison against relationships in the source iModel.
   * @see processChanges
   * @note This method is called from [[processAll]] and is not needed by [[processChanges]], so it only needs to be called directly when processing a subset of an iModel.
   * @throws [[IModelError]] If the required provenance information is not available to detect deletes.
   */
  public async detectRelationshipDeletes(): Promise<void> {
    if (this._isReverseSynchronization) {
      throw new IModelError(IModelStatus.BadRequest, "Cannot detect deletes when isReverseSynchronization=true", Logger.logError, loggerCategory);
    }
    const aspectDeleteIds: Id64String[] = [];
    const sql = `SELECT ECInstanceId,Identifier,JsonProperties FROM ${ExternalSourceAspect.classFullName} aspect WHERE aspect.Scope.Id=:scopeId AND aspect.Kind=:kind`;
    this.targetDb.withPreparedStatement(sql, (statement: ECSqlStatement): void => {
      statement.bindId("scopeId", this.targetScopeElementId);
      statement.bindString("kind", ExternalSourceAspect.Kind.Relationship);
      while (DbResult.BE_SQLITE_ROW === statement.step()) {
        const sourceRelInstanceId: Id64String = Id64.fromJSON(statement.getValue(1).getString());
        if (undefined === this.sourceDb.relationships.tryGetInstanceProps(ElementRefersToElements.classFullName, sourceRelInstanceId)) {
          const json: any = JSON.parse(statement.getValue(2).getString());
          if (undefined !== json.targetRelInstanceId) {
            const targetRelationship: Relationship = this.targetDb.relationships.getInstance(ElementRefersToElements.classFullName, json.targetRelInstanceId);
            this.importer.deleteRelationship(targetRelationship);
          }
          aspectDeleteIds.push(statement.getValue(0).getId());
        }
      }
    });
    this.targetDb.elements.deleteAspect(aspectDeleteIds);
  }

  /** Transform the specified sourceRelationship into RelationshipProps for the target iModel.
   * @param sourceRelationship The Relationship from the source iModel to be transformed.
   * @returns RelationshipProps for the target iModel.
   * @note A subclass can override this method to provide custom transform behavior.
   */
  protected onTransformRelationship(sourceRelationship: Relationship): RelationshipProps {
    const targetRelationshipProps: RelationshipProps = sourceRelationship.toJSON();
    targetRelationshipProps.sourceId = this.context.findTargetElementId(sourceRelationship.sourceId);
    targetRelationshipProps.targetId = this.context.findTargetElementId(sourceRelationship.targetId);
    sourceRelationship.forEachProperty((propertyName: string, propertyMetaData: PropertyMetaData) => {
      if ((PrimitiveTypeCode.Long === propertyMetaData.primitiveType) && ("Id" === propertyMetaData.extendedType)) {
        (targetRelationshipProps as any)[propertyName] = this.context.findTargetElementId(sourceRelationship.asAny[propertyName]);
      }
    });
    return targetRelationshipProps;
  }

  /** Override of [IModelExportHandler.shouldExportElementAspect]($backend) that is called to determine if an ElementAspect should be exported from the source iModel.
   * @note Reaching this point means that the ElementAspect has passed the standard exclusion checks in [IModelExporter]($backend).
   */
  protected shouldExportElementAspect(_sourceAspect: ElementAspect): boolean { return true; }

  /** Override of [IModelExportHandler.onExportElementUniqueAspect]($backend) that imports an ElementUniqueAspect into the target iModel when it is exported from the source iModel.
   * This override calls [[onTransformElementAspect]] and then [IModelImporter.importElementUniqueAspect]($backend) to update the target iModel.
   */
  protected onExportElementUniqueAspect(sourceAspect: ElementUniqueAspect): void {
    const targetElementId: Id64String = this.context.findTargetElementId(sourceAspect.element.id);
    const targetAspectProps: ElementAspectProps = this.onTransformElementAspect(sourceAspect, targetElementId);
    this.importer.importElementUniqueAspect(targetAspectProps);
  }

  /** Override of [IModelExportHandler.onExportElementMultiAspects]($backend) that imports ElementMultiAspects into the target iModel when they are exported from the source iModel.
   * This override calls [[onTransformElementAspect]] for each ElementMultiAspect and then [IModelImporter.importElementMultiAspects]($backend) to update the target iModel.
   * @note ElementMultiAspects are handled as a group to make it easier to differentiate between insert, update, and delete.
   */
  protected onExportElementMultiAspects(sourceAspects: ElementMultiAspect[]): void {
    const targetElementId: Id64String = this.context.findTargetElementId(sourceAspects[0].element.id);
    // Transform source ElementMultiAspects into target ElementAspectProps
    const targetAspectPropsArray: ElementAspectProps[] = sourceAspects.map((sourceAspect: ElementMultiAspect) => {
      return this.onTransformElementAspect(sourceAspect, targetElementId);
    });
    this.importer.importElementMultiAspects(targetAspectPropsArray);
  }

  /** Transform the specified sourceElementAspect into ElementAspectProps for the target iModel.
   * @param sourceElementAspect The ElementAspect from the source iModel to be transformed.
   * @param targetElementId The ElementId of the target Element that will own the ElementAspects after transformation.
   * @returns ElementAspectProps for the target iModel.
   * @note A subclass can override this method to provide custom transform behavior.
   */
  protected onTransformElementAspect(sourceElementAspect: ElementAspect, targetElementId: Id64String): ElementAspectProps {
    const targetElementAspectProps: ElementAspectProps = sourceElementAspect.toJSON();
    targetElementAspectProps.id = undefined;
    targetElementAspectProps.element.id = targetElementId;
    sourceElementAspect.forEachProperty((propertyName: string, propertyMetaData: PropertyMetaData) => {
      if ((PrimitiveTypeCode.Long === propertyMetaData.primitiveType) && ("Id" === propertyMetaData.extendedType)) {
        (targetElementAspectProps as any)[propertyName] = this.context.findTargetElementId(sourceElementAspect.asAny[propertyName]);
      }
    });
    return targetElementAspectProps;
  }

  /** Cause all schemas to be exported from the source iModel and imported into the target iModel.
   * @note For performance reasons, it is recommended that [IModelDb.saveChanges]($backend) be called after `processSchemas` is complete.
   * It is more efficient to process *data* changes after the schema changes have been saved.
   */
  public async processSchemas(requestContext: ClientRequestContext | AuthorizedClientRequestContext): Promise<void> {
    requestContext.enter();
    const schemasDir: string = path.join(KnownLocations.tmpdir, Guid.createValue());
    IModelJsFs.mkdirSync(schemasDir);
    try {
      this.sourceDb.nativeDb.exportSchemas(schemasDir);
      const schemaFiles: string[] = IModelJsFs.readdirSync(schemasDir);
      await this.targetDb.importSchemas(requestContext, schemaFiles.map((fileName) => path.join(schemasDir, fileName)));
    } finally {
      requestContext.enter();
      IModelJsFs.removeSync(schemasDir);
    }
  }

  /** Cause all fonts to be exported from the source iModel and imported into the target iModel.
   * @note This method is called from [[processChanges]] and [[processAll]], so it only needs to be called directly when processing a subset of an iModel.
   */
  public async processFonts(): Promise<void> {
    return this.exporter.exportFonts();
  }

  /** Override of [IModelExportHandler.onExportFont]($backend) that imports a font into the target iModel when it is exported from the source iModel. */
  protected onExportFont(font: FontProps, _isUpdate: boolean | undefined): void {
    this.context.importFont(font.id);
  }

  /** Cause all CodeSpecs to be exported from the source iModel and imported into the target iModel.
   * @note This method is called from [[processChanges]] and [[processAll]], so it only needs to be called directly when processing a subset of an iModel.
   */
  public async processCodeSpecs(): Promise<void> {
    return this.exporter.exportCodeSpecs();
  }

  /** Cause a single CodeSpec to be exported from the source iModel and imported into the target iModel.
   * @note This method is called from [[processChanges]] and [[processAll]], so it only needs to be called directly when processing a subset of an iModel.
   */
  public async processCodeSpec(codeSpecName: string): Promise<void> {
    return this.exporter.exportCodeSpecByName(codeSpecName);
  }

  /** Override of [IModelExportHandler.shouldExportCodeSpec]($backend) that is called to determine if a CodeSpec should be exported from the source iModel.
   * @note Reaching this point means that the CodeSpec has passed the standard exclusion checks in [IModelExporter]($backend).
   */
  protected shouldExportCodeSpec(_sourceCodeSpec: CodeSpec): boolean { return true; }

  /** Override of [IModelExportHandler.onExportCodeSpec]($backend) that imports a CodeSpec into the target iModel when it is exported from the source iModel. */
  protected onExportCodeSpec(sourceCodeSpec: CodeSpec): void {
    this.context.importCodeSpec(sourceCodeSpec.id);
  }

  /** Recursively import all Elements and sub-Models that descend from the specified Subject */
  public async processSubject(sourceSubjectId: Id64String, targetSubjectId: Id64String): Promise<void> {
    this.sourceDb.elements.getElement(sourceSubjectId, Subject); // throws if sourceSubjectId is not a Subject
    this.targetDb.elements.getElement(targetSubjectId, Subject); // throws if targetSubjectId is not a Subject
    this.context.remapElement(sourceSubjectId, targetSubjectId);
    await this.processChildElements(sourceSubjectId);
    await this.processSubjectSubModels(sourceSubjectId);
    return this.processDeferredElements();
  }

  /** Export everything from the source iModel and import the transformed entities into the target iModel.
   * @note [[processSchemas]] is not called automatically since the target iModel may want a different collection of schemas.
   */
  public async processAll(): Promise<void> {
    Logger.logTrace(loggerCategory, "processAll()");
    this.logSettings();
    this.initFromExternalSourceAspects();
    await this.exporter.exportCodeSpecs();
    await this.exporter.exportFonts();
    // The RepositoryModel and root Subject of the target iModel should not be transformed.
    await this.exporter.exportChildElements(IModel.rootSubjectId); // start below the root Subject
    await this.exporter.exportRepositoryLinks();
    await this.exporter.exportSubModels(IModel.repositoryModelId); // start below the RepositoryModel
    await this.exporter.exportRelationships(ElementRefersToElements.classFullName);
    await this.processDeferredElements();
    if (!this._isReverseSynchronization) {
      await this.detectElementDeletes();
      await this.detectRelationshipDeletes();
    }
    this.importer.computeProjectExtents();
  }

  /** Export changes from the source iModel and import the transformed entities into the target iModel.
   * Inserts, updates, and deletes are determined by inspecting the changeset(s).
   * @param requestContext The request context
   * @param startChangeSetId Include changes from this changeset up through and including the current changeset.
   * If this parameter is not provided, then just the current changeset will be exported.
   * @note To form a range of versions to process, set `startChangeSetId` for the start of the desired range and open the source iModel as of the end of the desired range.
   */
  public async processChanges(requestContext: AuthorizedClientRequestContext, startChangeSetId?: GuidString): Promise<void> {
    requestContext.enter();
    Logger.logTrace(loggerCategory, "processChanges()");
    this.logSettings();
    this.initFromExternalSourceAspects();
    await this.exporter.exportChanges(requestContext, startChangeSetId);
    requestContext.enter();
    await this.processDeferredElements();
    this.importer.computeProjectExtents();
  }
}

/** IModelTransformer that clones the contents of a template model.
 * @beta
 */
export class TemplateModelCloner extends IModelTransformer {
  /** The Placement to apply to the template. */
  private _transform3d?: Transform;
  /** Accumulates the mapping of sourceElementIds to targetElementIds from the elements in the template model that were cloned. */
  private _sourceIdToTargetIdMap?: Map<Id64String, Id64String>;
  /** Construct a new TemplateModelCloner
   * @param sourceDb The source IModelDb that contains the templates to clone
   * @param targetDb The target IModelDb where the cloned template will be inserted
   */
  public constructor(sourceDb: IModelDb, targetDb: IModelDb) {
    super(sourceDb, targetDb, { noProvenance: true });
  }
  /** Place a template from the sourceDb at the specified placement in the target model within the targetDb.
   * @param sourceTemplateModelId The Id of the template model in the sourceDb
   * @param targetModelId The Id of the target model (must be a subclass of GeometricModel3d) where the cloned component will be inserted.
   * @param placement The placement for the cloned component.
   * @note *Predecessors* like the SpatialCategory must be remapped before calling this method.
   * @returns The mapping of sourceElementIds from the template model to the instantiated targetElementIds in the targetDb in case further processing is required.
   */
  public async placeTemplate3d(sourceTemplateModelId: Id64String, targetModelId: Id64String, placement: Placement3d): Promise<Map<Id64String, Id64String>> {
    this.context.remapElement(sourceTemplateModelId, targetModelId);
    this._transform3d = Transform.createOriginAndMatrix(placement.origin, placement.angles.toMatrix3d());
    this._sourceIdToTargetIdMap = new Map<Id64String, Id64String>();
    await this.exporter.exportModelContents(sourceTemplateModelId);
    // Note: the source --> target mapping was needed during the template model cloning phase (remapping parent/child, for example), but needs to be reset afterwards
    for (const sourceElementId of this._sourceIdToTargetIdMap.keys()) {
      const targetElementId = this.context.findTargetElementId(sourceElementId);
      this._sourceIdToTargetIdMap.set(sourceElementId, targetElementId);
      this.context.removeElement(sourceElementId); // clear the underlying native remapping context for the next clone operation
    }
    return this._sourceIdToTargetIdMap; // return the sourceElementId -> targetElementId Map in case further post-processing is required.
  }
  /** Place a template from the sourceDb at the specified placement in the target model within the targetDb.
   * @param sourceTemplateModelId The Id of the template model in the sourceDb
   * @param targetModelId The Id of the target model (must be a subclass of GeometricModel2d) where the cloned component will be inserted.
   * @param placement The placement for the cloned component.
   * @note *Predecessors* like the DrawingCategory must be remapped before calling this method.
   * @returns The mapping of sourceElementIds from the template model to the instantiated targetElementIds in the targetDb in case further processing is required.
   */
  public async placeTemplate2d(sourceTemplateModelId: Id64String, targetModelId: Id64String, placement: Placement2d): Promise<Map<Id64String, Id64String>> {
    this.context.remapElement(sourceTemplateModelId, targetModelId);
    this._transform3d = Transform.createOriginAndMatrix(Point3d.createFrom(placement.origin), placement.rotation);
    this._sourceIdToTargetIdMap = new Map<Id64String, Id64String>();
    await this.exporter.exportModelContents(sourceTemplateModelId);
    // Note: the source --> target mapping was needed during the template model cloning phase (remapping parent/child, for example), but needs to be reset afterwards
    for (const sourceElementId of this._sourceIdToTargetIdMap.keys()) {
      const targetElementId = this.context.findTargetElementId(sourceElementId);
      this._sourceIdToTargetIdMap.set(sourceElementId, targetElementId);
      this.context.removeElement(sourceElementId); // clear the underlying native remapping context for the next clone operation
    }
    return this._sourceIdToTargetIdMap; // return the sourceElementId -> targetElementId Map in case further post-processing is required.
  }
  /** Cloning from a template requires this override of onTransformElement. */
  protected onTransformElement(sourceElement: Element): ElementProps {
    const predecessorIds: Id64Set = sourceElement.getPredecessorIds();
    predecessorIds.forEach((predecessorId: Id64String) => {
      if (Id64.invalid === this.context.findTargetElementId(predecessorId)) {
        throw new IModelError(IModelStatus.BadRequest, "Required dependency not found in target iModel", Logger.logError, BackendLoggerCategory.IModelTransformer);
      }
    });
    const targetElementProps: ElementProps = super.onTransformElement(sourceElement);
    targetElementProps.federationGuid = undefined; // clone from template should not maintain federationGuid
    targetElementProps.code = Code.createEmpty(); // clone from template should not maintain codes
    if (sourceElement instanceof GeometricElement3d) {
      const placement = Placement3d.fromJSON((targetElementProps as GeometricElement3dProps).placement);
      if (placement.isValid) {
        placement.multiplyTransform(this._transform3d!);
        (targetElementProps as GeometricElement3dProps).placement = placement;
      }
    } else if (sourceElement instanceof GeometricElement2d) {
      const placement = Placement2d.fromJSON((targetElementProps as GeometricElement2dProps).placement);
      if (placement.isValid) {
        placement.multiplyTransform(this._transform3d!);
        (targetElementProps as GeometricElement2dProps).placement = placement;
      }
    }
    this._sourceIdToTargetIdMap!.set(sourceElement.id, Id64.invalid); // keep track of (source) elementIds from the template model, but the target hasn't been inserted yet
    return targetElementProps;
  }
}
