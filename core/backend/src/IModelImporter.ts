/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @module iModels */
import { Id64, Id64String, IModelStatus, Logger } from "@bentley/bentleyjs-core";
import { AxisAlignedBox3d, ElementAspectProps, ElementProps, GeometricElement3dProps, IModelError, ModelProps, Placement3d } from "@bentley/imodeljs-common";
import { BackendLoggerCategory } from "./BackendLoggerCategory";
import { Element, GeometricElement3d } from "./Element";
import { ElementAspect, ElementMultiAspect } from "./ElementAspect";
import { IModelDb } from "./IModelDb";
import { Model } from "./Model";
import { Relationship, RelationshipProps } from "./Relationship";

const loggerCategory: string = BackendLoggerCategory.IModelImporter;

/** Options provided to the [[IModelImporter]] constructor.
 * @beta
 */
export interface IModelImportOptions {
  /** If `true` (the default), auto-extend the projectExtents of the target iModel as elements are imported. If `false`, throw an Error if an element would be outside of the projectExtents. */
  autoExtendProjectExtents?: boolean;
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
  /** If `true` (the default), auto-extend the projectExtents of the target iModel as elements are imported. If `false`, throw an Error if an element would be outside of the projectExtents. */
  public readonly autoExtendProjectExtents: boolean = true;

  /** Construct a new IModelImporter
   * @param targetDb The target IModelDb
   * @param options The options that specify how the import should be done.
   */
  public constructor(targetDb: IModelDb, options?: IModelImportOptions) {
    this.targetDb = targetDb;
    if (undefined !== options) {
      if (undefined !== options.autoExtendProjectExtents) this.autoExtendProjectExtents = options.autoExtendProjectExtents;
    }
  }

  /** Import the specified ModelProps (either as an insert or an update) into the target iModel. */
  public importModel(modelProps: ModelProps): void {
    if ((undefined === modelProps.id) || !Id64.isValidId64(modelProps.id)) {
      throw new IModelError(IModelStatus.InvalidId, "Model Id not provided, should be the same as the ModeledElementId", Logger.logError, loggerCategory);
    }
    try {
      const model: Model = this.targetDb.models.getModel(modelProps.id); // throws IModelError.NotFound if model does not exist
      if (this.hasModelChanged(model, modelProps)) {
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

  /** Create a new Model from the specified ModelProps and insert it into the target iModel.
   * @note A subclass may override this method to customize insert behavior but should call `super.onInsertModel`.
   */
  protected onInsertModel(modelProps: ModelProps): Id64String {
    const modelId: Id64String = this.targetDb.models.insertModel(modelProps);
    Logger.logInfo(loggerCategory, `Inserted ${this.formatModelForLogger(modelProps)}`);
    return modelId;
  }

  /** Update an existing Model in the target iModel from the specified ModelProps.
   * @note A subclass may override this method to customize update behavior but should call `super.onUpdateModel`.
   */
  protected onUpdateModel(modelProps: ModelProps): void {
    this.targetDb.models.updateModel(modelProps);
    Logger.logInfo(loggerCategory, `Updated ${this.formatModelForLogger(modelProps)}`);
  }

  /** Format a Model for the Logger. */
  private formatModelForLogger(modelProps: ModelProps): string {
    return `${modelProps.classFullName} [${modelProps.id!}]`;
  }

  /** Import the specified ElementProps (either as an insert or an update) into the target iModel. */
  public importElement(elementProps: ElementProps): Id64String {
    if (undefined !== elementProps.id) {
      this.onUpdateElement(elementProps);
    } else {
      this.onInsertElement(elementProps); // targetElementProps.id assigned by insertElement
    }
    return elementProps.id!;
  }

  /** Called before inserting or updating an element in the target iModel to make sure that it is within the projectExtents. */
  private checkProjectExtents(targetElementProps: ElementProps): void {
    const targetElementClass: typeof Element = this.targetDb.getJsClass<typeof Element>(targetElementProps.classFullName);
    if (targetElementClass.prototype instanceof GeometricElement3d) {
      const targetElementPlacement: Placement3d = Placement3d.fromJSON((targetElementProps as GeometricElement3dProps).placement);
      if (targetElementPlacement.isValid) {
        const targetExtents: AxisAlignedBox3d = targetElementPlacement.calculateRange();
        if (!targetExtents.isNull && !this.targetDb.projectExtents.containsRange(targetExtents)) {
          if (this.autoExtendProjectExtents) {
            Logger.logTrace(loggerCategory, "Auto-extending projectExtents");
            targetExtents.extendRange(this.targetDb.projectExtents);
            this.targetDb.updateProjectExtents(targetExtents);
          } else {
            throw new IModelError(IModelStatus.BadElement, "Target element would be outside of projectExtents", Logger.logError, loggerCategory);
          }
        }
      }
    }
  }

  /** Create a new Element from the specified ElementProps and insert it into the target iModel.
   * @returns The Id of the newly inserted Element.
   * @note A subclass may override this method to customize insert behavior but should call `super.onInsertElement`.
   */
  protected onInsertElement(elementProps: ElementProps): Id64String {
    this.checkProjectExtents(elementProps);
    const elementId: Id64String = this.targetDb.elements.insertElement(elementProps);
    Logger.logInfo(loggerCategory, `Inserted ${this.formatElementForLogger(elementProps)}`);
    return elementId;
  }

  /** Update an existing Element in the target iModel from the specified ElementProps.
   * @note A subclass may override this method to customize update behavior but should call `super.onUpdateElement`.
   */
  protected onUpdateElement(elementProps: ElementProps): void {
    if (!elementProps.id) {
      throw new IModelError(IModelStatus.InvalidId, "ElementId not provided", Logger.logError, loggerCategory);
    }
    this.checkProjectExtents(elementProps);
    this.targetDb.elements.updateElement(elementProps);
    Logger.logInfo(loggerCategory, `Updated ${this.formatElementForLogger(elementProps)}`);
  }

  /** Delete the specified Element from the target iModel.
   * @note A subclass may override this method to customize delete behavior but should call `super.onDeleteElement`.
   */
  protected onDeleteElement(elementId: Id64String): void {
    this.targetDb.elements.deleteElement(elementId);
    Logger.logInfo(loggerCategory, `Deleted element ${elementId}`);
  }

  /** Delete the specified Element from the target iModel. */
  public deleteElement(elementId: Id64String): void {
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
    } else if (this.hasElementAspectChanged(aspects[0], aspectProps)) {
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
            if (this.hasElementAspectChanged(currentAspects[index], aspectProps)) {
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
            if (this.hasElementAspectChanged(aspect, proposedAspects[index])) {
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

  /** Insert the ElementAspect into the target iModel.
   * @note A subclass may override this method to customize insert behavior but should call `super.onInsertElementAspect`.
   */
  protected onInsertElementAspect(aspectProps: ElementAspectProps): void {
    this.targetDb.elements.insertAspect(aspectProps);
    Logger.logInfo(loggerCategory, `Inserted ${this.formatElementAspectForLogger(aspectProps)}`);
  }

  /** Update the ElementAspect within the target iModel.
   * @note A subclass may override this method to customize update behavior but should call `super.onUpdateElementAspect`.
   */
  protected onUpdateElementAspect(aspectProps: ElementAspectProps): void {
    this.targetDb.elements.updateAspect(aspectProps);
    Logger.logInfo(loggerCategory, `Updated ${this.formatElementAspectForLogger(aspectProps)}`);
  }

  /** Delete the specified ElementAspect from the target iModel.
   * @note A subclass may override this method to customize delete behavior but should call `super.onDeleteElementAspect`.
   */
  protected onDeleteElementAspect(targetElementAspect: ElementAspect): void {
    this.targetDb.elements.deleteAspect(targetElementAspect.id);
    Logger.logInfo(loggerCategory, `Deleted ${this.formatElementAspectForLogger(targetElementAspect)}`);
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
    try {
      // check for an existing relationship
      const relSourceAndTarget = { sourceId: relationshipProps.sourceId, targetId: relationshipProps.targetId };
      const relationship = this.targetDb.relationships.getInstance(relationshipProps.classFullName, relSourceAndTarget);
      // if relationship found, update it
      relationshipProps.id = relationship.id;
      if (this.hasRelationshipChanged(relationship, relationshipProps)) {
        this.onUpdateRelationship(relationshipProps);
      }
      return relationshipProps.id;
    } catch (error) {
      // catch NotFound error and insert relationship
      if ((error instanceof IModelError) && (IModelStatus.NotFound === error.errorNumber)) {
        return this.onInsertRelationship(relationshipProps);
      } else {
        throw error;
      }
    }
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

  /** Create a new Relationship from the specified RelationshipProps and insert it into the target iModel.
   * @returns The instance Id of the newly inserted relationship.
   * @note A subclass may override this method to customize insert behavior but should call `super.onInsertRelationship`.
   */
  protected onInsertRelationship(relationshipProps: RelationshipProps): Id64String {
    const targetRelInstanceId: Id64String = this.targetDb.relationships.insertInstance(relationshipProps);
    Logger.logInfo(loggerCategory, `Inserted ${this.formatRelationshipForLogger(relationshipProps)}`);
    return targetRelInstanceId;
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
  }

  /** Delete the specified Relationship from the target iModel. */
  protected onDeleteRelationship(relationshipProps: RelationshipProps): void {
    this.targetDb.relationships.deleteInstance(relationshipProps);
    Logger.logInfo(loggerCategory, `Deleted relationship ${this.formatRelationshipForLogger(relationshipProps)}`);
  }

  /** Delete the specified Relationship from the target iModel. */
  public deleteRelationship(relationshipProps: RelationshipProps): void {
    this.onDeleteRelationship(relationshipProps);
  }

  /** Format a Relationship for the Logger. */
  private formatRelationshipForLogger(relProps: RelationshipProps): string {
    return `${relProps.classFullName} sourceId=[${relProps.sourceId}] targetId=[${relProps.targetId}]`;
  }
}
