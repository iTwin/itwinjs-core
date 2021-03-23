/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModels
 */
import { Id64, Id64String, IModelStatus, Logger } from "@bentley/bentleyjs-core";
import {
  AxisAlignedBox3d, Base64EncodedString, ElementAspectProps, ElementProps, EntityProps, IModel, IModelError, ModelProps, PrimitiveTypeCode,
  PropertyMetaData, RelatedElement,
} from "@bentley/imodeljs-common";
import { BackendLoggerCategory } from "./BackendLoggerCategory";
import { ElementAspect, ElementMultiAspect } from "./ElementAspect";
import { Entity } from "./Entity";
import { IModelDb } from "./IModelDb";
import { Model } from "./Model";
import { Relationship, RelationshipProps, SourceAndTarget } from "./Relationship";

const loggerCategory: string = BackendLoggerCategory.IModelImporter;

/** Options provided to the [[IModelImporter]] constructor.
 * @beta
 */
export interface IModelImportOptions {
  /** If `true` (the default), compute the projectExtents of the target iModel after elements are imported.
   * The computed projectExtents will either include or exclude *outliers* depending on the `excludeOutliers` flag that defaults to `false`.
   */
  autoExtendProjectExtents?: boolean | { excludeOutliers: boolean };
}

/** Base class for importing data into an iModel.
 * @see [iModel Transformation and Data Exchange]($docs/learning/backend/IModelTransformation.md)
 * @see [IModelExporter]($backend)
 * @see [IModelTransformer]($backend)
 * @beta
 */
export class IModelImporter {
  /** The read/write target iModel. */
  public readonly targetDb: IModelDb;
  /** If `true` (the default), compute the projectExtents of the target iModel after elements are imported.
   * The computed projectExtents will either include or exclude *outliers* depending on the `excludeOutliers` flag that defaults to `false`.
   */
  public autoExtendProjectExtents: boolean | { excludeOutliers: boolean };
  /** If `true`, simplify the element geometry for visualization purposes. For example, convert b-reps into meshes.
   * @note `false` is the default
   */
  public simplifyElementGeometry: boolean = false;
  /** The set of elements that should not be updated by this IModelImporter.
   * @note Adding an element to this set is typically necessary when remapping a source element to one that already exists in the target and already has the desired properties.
   */
  public readonly doNotUpdateElementIds = new Set<Id64String>();
  /** The number of entity changes before incremental progress should be reported via the [[onProgress]] callback. */
  public progressInterval: number = 1000;
  /** Tracks the current total number of entity changes. */
  private _progressCounter: number = 0;
  /** */
  private _modelPropertiesToIgnore = new Set<string>();

  /** Construct a new IModelImporter
   * @param targetDb The target IModelDb
   * @param options The options that specify how the import should be done.
   */
  public constructor(targetDb: IModelDb, options?: IModelImportOptions) {
    this.targetDb = targetDb;
    this.autoExtendProjectExtents = options?.autoExtendProjectExtents ?? true;
    // Add in the elements that are always present (even in an "empty" iModel) and therefore do not need to be updated
    this.doNotUpdateElementIds.add(IModel.rootSubjectId);
    this.doNotUpdateElementIds.add(IModel.dictionaryId);
    this.doNotUpdateElementIds.add("0xe"); // RealityDataSources LinkPartition
    this._modelPropertiesToIgnore.add("geometryGuid"); // cannot compare GeometricModel.GeometryGuid values across iModels
  }

  /** Import the specified ModelProps (either as an insert or an update) into the target iModel. */
  public importModel(modelProps: ModelProps): void {
    if ((undefined === modelProps.id) || !Id64.isValidId64(modelProps.id)) {
      throw new IModelError(IModelStatus.InvalidId, "Model Id not provided, should be the same as the ModeledElementId", Logger.logError, loggerCategory);
    }
    if (this.doNotUpdateElementIds.has(modelProps.id)) {
      Logger.logInfo(loggerCategory, `Do not update target model ${modelProps.id}`);
      return;
    }
    try {
      const model: Model = this.targetDb.models.getModel(modelProps.id); // throws IModelError.NotFound if model does not exist
      if (hasEntityChanged(model, modelProps, this._modelPropertiesToIgnore)) {
        this.onUpdateModel(modelProps);
      }
    } catch (error) {
      // catch NotFound error and insertModel
      if ((error instanceof IModelError) && (error.errorNumber === IModelStatus.NotFound)) {
        this.onInsertModel(modelProps);
        return;
      }
      throw error;
    }
  }

  /** Create a new Model from the specified ModelProps and insert it into the target iModel.
   * @note A subclass may override this method to customize insert behavior but should call `super.onInsertModel`.
   */
  protected onInsertModel(modelProps: ModelProps): Id64String {
    try {
      const modelId: Id64String = this.targetDb.models.insertModel(modelProps);
      Logger.logInfo(loggerCategory, `Inserted ${this.formatModelForLogger(modelProps)}`);
      this.trackProgress();
      return modelId;
    } catch (error) {
      if (!this.targetDb.containsClass(modelProps.classFullName)) {
        // replace standard insert error with something more helpful
        const errorMessage = `Model class "${modelProps.classFullName}" not found in the target iModel. Was the latest version of the schema imported?`;
        throw new IModelError(IModelStatus.InvalidName, errorMessage, Logger.logError, loggerCategory);
      }
      throw error; // throw original error
    }
  }

  /** Update an existing Model in the target iModel from the specified ModelProps.
   * @note A subclass may override this method to customize update behavior but should call `super.onUpdateModel`.
   */
  protected onUpdateModel(modelProps: ModelProps): void {
    this.targetDb.models.updateModel(modelProps);
    Logger.logInfo(loggerCategory, `Updated ${this.formatModelForLogger(modelProps)}`);
    this.trackProgress();
  }

  /** Format a Model for the Logger. */
  private formatModelForLogger(modelProps: ModelProps): string {
    return `${modelProps.classFullName} [${modelProps.id!}]`;
  }

  /** Import the specified ElementProps (either as an insert or an update) into the target iModel. */
  public importElement(elementProps: ElementProps): Id64String {
    if (undefined !== elementProps.id) {
      if (this.doNotUpdateElementIds.has(elementProps.id)) {
        Logger.logInfo(loggerCategory, `Do not update target element ${elementProps.id}`);
        return elementProps.id;
      }
      this.onUpdateElement(elementProps);
    } else {
      this.onInsertElement(elementProps); // targetElementProps.id assigned by insertElement
    }
    return elementProps.id!;
  }

  /** Create a new Element from the specified ElementProps and insert it into the target iModel.
   * @returns The Id of the newly inserted Element.
   * @note A subclass may override this method to customize insert behavior but should call `super.onInsertElement`.
   */
  protected onInsertElement(elementProps: ElementProps): Id64String {
    try {
      const elementId: Id64String = this.targetDb.elements.insertElement(elementProps);
      Logger.logInfo(loggerCategory, `Inserted ${this.formatElementForLogger(elementProps)}`);
      this.trackProgress();
      if (this.simplifyElementGeometry) {
        this.targetDb.nativeDb.simplifyElementGeometry({ id: elementId, convertBReps: true });
        Logger.logInfo(loggerCategory, `Simplified element geometry for ${this.formatElementForLogger(elementProps)}`);
      }
      return elementId;
    } catch (error) {
      if (!this.targetDb.containsClass(elementProps.classFullName)) {
        // replace standard insert error with something more helpful
        const errorMessage = `Element class "${elementProps.classFullName}" not found in the target iModel. Was the latest version of the schema imported?`;
        throw new IModelError(IModelStatus.InvalidName, errorMessage, Logger.logError, loggerCategory);
      }
      throw error; // throw original error
    }
  }

  /** Update an existing Element in the target iModel from the specified ElementProps.
   * @note A subclass may override this method to customize update behavior but should call `super.onUpdateElement`.
   */
  protected onUpdateElement(elementProps: ElementProps): void {
    if (!elementProps.id) {
      throw new IModelError(IModelStatus.InvalidId, "ElementId not provided", Logger.logError, loggerCategory);
    }
    this.targetDb.elements.updateElement(elementProps);
    Logger.logInfo(loggerCategory, `Updated ${this.formatElementForLogger(elementProps)}`);
    this.trackProgress();
    if (this.simplifyElementGeometry) {
      this.targetDb.nativeDb.simplifyElementGeometry({ id: elementProps.id, convertBReps: true });
      Logger.logInfo(loggerCategory, `Simplified element geometry for ${this.formatElementForLogger(elementProps)}`);
    }
  }

  /** Delete the specified Element from the target iModel.
   * @note A subclass may override this method to customize delete behavior but should call `super.onDeleteElement`.
   */
  protected onDeleteElement(elementId: Id64String): void {
    this.targetDb.elements.deleteElement(elementId);
    Logger.logInfo(loggerCategory, `Deleted element ${elementId}`);
    this.trackProgress();
  }

  /** Delete the specified Element from the target iModel. */
  public deleteElement(elementId: Id64String): void {
    if (this.doNotUpdateElementIds.has(elementId)) {
      Logger.logInfo(loggerCategory, `Do not delete target element ${elementId}`);
      return;
    }
    this.onDeleteElement(elementId);
  }

  /** Format an Element for the Logger. */
  private formatElementForLogger(elementProps: ElementProps): string {
    const namePiece: string = elementProps.code.value ? `${elementProps.code.value} ` : elementProps.userLabel ? `${elementProps.userLabel} ` : "";
    return `${elementProps.classFullName} ${namePiece}[${elementProps.id}]`;
  }

  /** Import an ElementUniqueAspect into the target iModel. */
  public importElementUniqueAspect(aspectProps: ElementAspectProps): void {
    const aspects: ElementAspect[] = this.targetDb.elements.getAspects(aspectProps.element.id, aspectProps.classFullName);
    if (aspects.length === 0) {
      this.onInsertElementAspect(aspectProps);
    } else if (hasEntityChanged(aspects[0], aspectProps)) {
      aspectProps.id = aspects[0].id;
      this.onUpdateElementAspect(aspectProps);
    }
  }

  /** Import the collection of ElementMultiAspects into the target iModel.
   * @note For insert vs. update reasons, it is important to process all ElementMultiAspects owned by an Element at once.
   */
  public importElementMultiAspects(aspectPropsArray: ElementAspectProps[]): void {
    if (aspectPropsArray.length === 0) {
      return;
    }
    const elementId: Id64String = aspectPropsArray[0].element.id;
    // Determine the set of ElementMultiAspect classes to consider
    const aspectClassFullNames = new Set<string>();
    aspectPropsArray.forEach((aspectsProps: ElementAspectProps): void => {
      aspectClassFullNames.add(aspectsProps.classFullName);
    });
    // Handle ElementMultiAspects in groups by class
    aspectClassFullNames.forEach((aspectClassFullName: string) => {
      const proposedAspects = aspectPropsArray.filter((aspectProps) => aspectClassFullName === aspectProps.classFullName);
      const currentAspects: ElementMultiAspect[] = this.targetDb.elements.getAspects(elementId, aspectClassFullName);
      if (proposedAspects.length >= currentAspects.length) {
        let index = 0;
        proposedAspects.forEach((aspectProps: ElementAspectProps) => {
          if (index < currentAspects.length) {
            aspectProps.id = currentAspects[index].id;
            if (hasEntityChanged(currentAspects[index], aspectProps)) {
              this.onUpdateElementAspect(aspectProps);
            }
          } else {
            this.onInsertElementAspect(aspectProps);
          }
          index++;
        });
      } else {
        let index = 0;
        currentAspects.forEach((aspect: ElementMultiAspect) => {
          if (index < proposedAspects.length) {
            proposedAspects[index].id = aspect.id;
            if (hasEntityChanged(aspect, proposedAspects[index])) {
              this.onUpdateElementAspect(proposedAspects[index]);
            }
          } else {
            this.onDeleteElementAspect(aspect);
          }
          index++;
        });
      }
    });
  }

  /** Insert the ElementAspect into the target iModel.
   * @note A subclass may override this method to customize insert behavior but should call `super.onInsertElementAspect`.
   */
  protected onInsertElementAspect(aspectProps: ElementAspectProps): void {
    try {
      this.targetDb.elements.insertAspect(aspectProps);
      Logger.logInfo(loggerCategory, `Inserted ${this.formatElementAspectForLogger(aspectProps)}`);
      this.trackProgress();
    } catch (error) {
      if (!this.targetDb.containsClass(aspectProps.classFullName)) {
        // replace standard insert error with something more helpful
        const errorMessage = `ElementAspect class "${aspectProps.classFullName}" not found in the target iModel. Was the latest version of the schema imported?`;
        throw new IModelError(IModelStatus.InvalidName, errorMessage, Logger.logError, loggerCategory);
      }
      throw error; // throw original error
    }
  }

  /** Update the ElementAspect within the target iModel.
   * @note A subclass may override this method to customize update behavior but should call `super.onUpdateElementAspect`.
   */
  protected onUpdateElementAspect(aspectProps: ElementAspectProps): void {
    this.targetDb.elements.updateAspect(aspectProps);
    Logger.logInfo(loggerCategory, `Updated ${this.formatElementAspectForLogger(aspectProps)}`);
    this.trackProgress();
  }

  /** Delete the specified ElementAspect from the target iModel.
   * @note A subclass may override this method to customize delete behavior but should call `super.onDeleteElementAspect`.
   */
  protected onDeleteElementAspect(targetElementAspect: ElementAspect): void {
    this.targetDb.elements.deleteAspect(targetElementAspect.id);
    Logger.logInfo(loggerCategory, `Deleted ${this.formatElementAspectForLogger(targetElementAspect)}`);
    this.trackProgress();
  }

  /** Format an ElementAspect for the Logger. */
  private formatElementAspectForLogger(elementAspectProps: ElementAspectProps): string {
    return `${elementAspectProps.classFullName} elementId=[${elementAspectProps.element.id}]`;
  }

  /** Import the specified RelationshipProps (either as an insert or an update) into the target iModel.
   * @returns The instance Id of the inserted or updated Relationship.
   */
  public importRelationship(relationshipProps: RelationshipProps): Id64String {
    if ((undefined === relationshipProps.sourceId) || !Id64.isValidId64(relationshipProps.sourceId)) {
      Logger.logInfo(loggerCategory, `Ignoring ${relationshipProps.classFullName} instance because of invalid RelationshipProps.sourceId`);
      return Id64.invalid;
    }
    if ((undefined === relationshipProps.targetId) || !Id64.isValidId64(relationshipProps.targetId)) {
      Logger.logInfo(loggerCategory, `Ignoring ${relationshipProps.classFullName} instance because of invalid RelationshipProps.targetId`);
      return Id64.invalid;
    }
    // check for an existing relationship
    const relSourceAndTarget: SourceAndTarget = { sourceId: relationshipProps.sourceId, targetId: relationshipProps.targetId };
    const relationship: Relationship | undefined = this.targetDb.relationships.tryGetInstance(relationshipProps.classFullName, relSourceAndTarget);
    if (undefined !== relationship) { // if relationship found, update it
      relationshipProps.id = relationship.id;
      if (hasEntityChanged(relationship, relationshipProps)) {
        this.onUpdateRelationship(relationshipProps);
      }
      return relationshipProps.id;
    } else {
      return this.onInsertRelationship(relationshipProps);
    }
  }

  /** Create a new Relationship from the specified RelationshipProps and insert it into the target iModel.
   * @returns The instance Id of the newly inserted relationship.
   * @note A subclass may override this method to customize insert behavior but should call `super.onInsertRelationship`.
   */
  protected onInsertRelationship(relationshipProps: RelationshipProps): Id64String {
    try {
      const targetRelInstanceId: Id64String = this.targetDb.relationships.insertInstance(relationshipProps);
      Logger.logInfo(loggerCategory, `Inserted ${this.formatRelationshipForLogger(relationshipProps)}`);
      this.trackProgress();
      return targetRelInstanceId;
    } catch (error) {
      if (!this.targetDb.containsClass(relationshipProps.classFullName)) {
        // replace standard insert error with something more helpful
        const errorMessage = `Relationship class "${relationshipProps.classFullName}" not found in the target iModel. Was the latest version of the schema imported?`;
        throw new IModelError(IModelStatus.InvalidName, errorMessage, Logger.logError, loggerCategory);
      }
      throw error; // throw original error
    }
  }

  /** Update an existing Relationship in the target iModel from the specified RelationshipProps.
   * @note A subclass may override this method to customize update behavior but should call `super.onUpdateRelationship`.
   */
  protected onUpdateRelationship(relationshipProps: RelationshipProps): void {
    if (!relationshipProps.id) {
      throw new IModelError(IModelStatus.InvalidId, "Relationship instance Id not provided", Logger.logError, loggerCategory);
    }
    this.targetDb.relationships.updateInstance(relationshipProps);
    Logger.logInfo(loggerCategory, `Updated ${this.formatRelationshipForLogger(relationshipProps)}`);
    this.trackProgress();
  }

  /** Delete the specified Relationship from the target iModel. */
  protected onDeleteRelationship(relationshipProps: RelationshipProps): void {
    this.targetDb.relationships.deleteInstance(relationshipProps);
    Logger.logInfo(loggerCategory, `Deleted relationship ${this.formatRelationshipForLogger(relationshipProps)}`);
    this.trackProgress();
  }

  /** Delete the specified Relationship from the target iModel. */
  public deleteRelationship(relationshipProps: RelationshipProps): void {
    this.onDeleteRelationship(relationshipProps);
  }

  /** Format a Relationship for the Logger. */
  private formatRelationshipForLogger(relProps: RelationshipProps): string {
    return `${relProps.classFullName} sourceId=[${relProps.sourceId}] targetId=[${relProps.targetId}]`;
  }

  /** Tracks incremental progress */
  private trackProgress(): void {
    this._progressCounter++;
    if (0 === (this._progressCounter % this.progressInterval)) {
      this.onProgress();
    }
  }

  /** This method is called when IModelImporter has made incremental progress based on the [[progressInterval]] setting.
   * @note A subclass may override this method to report custom progress but should call `super.onProgress`.
   */
  protected onProgress(): void { }

  /** Optionally compute the projectExtents for the target iModel depending on the options for this IModelImporter.
   * @note This method is automatically called from [IModelTransformer.processChanges]($backend) and [IModelTransformer.processAll]($backend).
   * @see [IModelDb.computeProjectExtents]($backend), [[autoExtendProjectExtents]]
   */
  public computeProjectExtents(): void {
    const computedProjectExtents = this.targetDb.computeProjectExtents({ reportExtentsWithOutliers: true, reportOutliers: true });
    Logger.logInfo(loggerCategory, `Current projectExtents=${JSON.stringify(this.targetDb.projectExtents)}`);
    Logger.logInfo(loggerCategory, `Computed projectExtents without outliers=${JSON.stringify(computedProjectExtents.extents)}`);
    Logger.logInfo(loggerCategory, `Computed projectExtents with outliers=${JSON.stringify(computedProjectExtents.extentsWithOutliers)}`);
    if (this.autoExtendProjectExtents) {
      const excludeOutliers: boolean = typeof this.autoExtendProjectExtents === "object" ? this.autoExtendProjectExtents.excludeOutliers : false;
      const newProjectExtents: AxisAlignedBox3d = excludeOutliers ? computedProjectExtents.extents : computedProjectExtents.extentsWithOutliers!;
      if (!newProjectExtents.isAlmostEqual(this.targetDb.projectExtents)) {
        this.targetDb.updateProjectExtents(newProjectExtents);
        Logger.logInfo(loggerCategory, `Updated projectExtents=${JSON.stringify(this.targetDb.projectExtents)}`);
      }
      if (!excludeOutliers && computedProjectExtents.outliers && computedProjectExtents.outliers.length > 0) {
        Logger.logInfo(loggerCategory, `${computedProjectExtents.outliers.length} outliers detected within projectExtents`);
      }
    } else {
      if (!this.targetDb.projectExtents.containsRange(computedProjectExtents.extents)) {
        Logger.logWarning(loggerCategory, "Current project extents may be too small");
      }
      if (computedProjectExtents.outliers && computedProjectExtents.outliers.length > 0) {
        Logger.logInfo(loggerCategory, `${computedProjectExtents.outliers.length} outliers detected within projectExtents`);
      }
    }
  }
}

/** Returns true if a change within an Entity is detected.
 * @param entity The current persistent Entity.
 * @param entityProps The new EntityProps to compare against
 * @note This method should only be called if changeset information is not available.
 */
function hasEntityChanged(entity: Entity, entityProps: EntityProps, namesToIgnore?: Set<string>): boolean {
  let changed: boolean = false;
  entity.forEachProperty((propertyName: string, propertyMeta: PropertyMetaData) => {
    if (!changed) {
      if (namesToIgnore && namesToIgnore.has(propertyName)) {
        // skip
      } else if (PrimitiveTypeCode.Binary === propertyMeta.primitiveType) {
        changed = hasBinaryValueChanged(entity.asAny[propertyName], (entityProps as any)[propertyName]);
      } else if (propertyMeta.isNavigation) {
        changed = hasNavigationValueChanged(entity.asAny[propertyName], (entityProps as any)[propertyName]);
      } else {
        changed = hasValueChanged(entity.asAny[propertyName], (entityProps as any)[propertyName]);
      }
    }
  });
  return changed;
}

/** Returns true if the specified binary values are different. */
function hasBinaryValueChanged(binaryProperty1: any, binaryProperty2: any): boolean {
  const jsonString1 = JSON.stringify(binaryProperty1, Base64EncodedString.replacer);
  const jsonString2 = JSON.stringify(binaryProperty2, Base64EncodedString.replacer);
  return jsonString1 !== jsonString2;
}

/** Returns true if the specified navigation property values are different. */
function hasNavigationValueChanged(navigationProperty1: any, navigationProperty2: any): boolean {
  const relatedElement1 = RelatedElement.fromJSON(navigationProperty1);
  const relatedElement2 = RelatedElement.fromJSON(navigationProperty2);
  const jsonString1 = JSON.stringify(relatedElement1);
  const jsonString2 = JSON.stringify(relatedElement2);
  return jsonString1 !== jsonString2;
}

/** Returns true if the specified navigation property values are different. */
function hasValueChanged(property1: any, property2: any): boolean {
  return JSON.stringify(property1) !== JSON.stringify(property2);
}
