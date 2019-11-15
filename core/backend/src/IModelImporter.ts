/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { Id64String, IModelStatus, Logger, Id64 } from "@bentley/bentleyjs-core";
import { ElementProps, IModelError, ModelProps, ElementAspectProps, Placement3d, GeometricElement3dProps, AxisAlignedBox3d } from "@bentley/imodeljs-common";
import { BackendLoggerCategory } from "./BackendLoggerCategory";
import { IModelDb } from "./IModelDb";
import { RelationshipProps, Relationship } from "./Relationship";
import { ElementMultiAspect, ElementAspect } from "./ElementAspect";
import { Element, GeometricElement3d } from "./Element";
import { Model } from "./Model";

const loggerCategory: string = BackendLoggerCategory.IModelImporter;

/** Options provided to the [[IModelImporter]] constructor.
 * @alpha
 */
export interface IModelImportOptions {
  /** If `true` (the default), auto-extend the projectExtents of the target iModel as elements are imported. If `false`, throw an Error if an element would be outside of the projectExtents. */
  autoExtendProjectExtents?: boolean;
}

/** Base class for importing data into an iModel.
 * @alpha
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
        this.updateModel(modelProps);
      }
    } catch (error) {
      // catch NotFound error and insertModel
      if ((error instanceof IModelError) && (error.errorNumber === IModelStatus.NotFound)) {
        this.insertModel(modelProps);
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

  /** Create a new Model from the specified ModelProps and insert it into the target iModel. */
  private insertModel(modelProps: ModelProps): void {
    this.targetDb.models.insertModel(modelProps);
    Logger.logInfo(loggerCategory, `Inserted ${this.formatModelForLogger(modelProps)}`);
  }

  /** Update an existing Model in the target iModel from the specified ModelProps. */
  private updateModel(modelProps: ModelProps): void {
    this.targetDb.models.updateModel(modelProps);
    Logger.logInfo(loggerCategory, `Updated ${this.formatModelForLogger(modelProps)}`);
  }

  /** Format a Model for the Logger. */
  private formatModelForLogger(modelProps: ModelProps): string {
    return `${modelProps.classFullName} [${modelProps.id!}]`;
  }

  /** Import the specified ElementProps (either as an insert or an update) into the target iModel. */
  public importElement(elementProps: ElementProps): Id64String {
    this.checkProjectExtents(elementProps);
    if (undefined !== elementProps.id) {
      this.updateElement(elementProps);
    } else {
      this.insertElement(elementProps); // targetElementProps.id assigned by insertElement
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
            Logger.logTrace(loggerCategory, "[Target] Auto-extending projectExtents");
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
   */
  private insertElement(elementProps: ElementProps): Id64String {
    const elementId: Id64String = this.targetDb.elements.insertElement(elementProps);
    Logger.logInfo(loggerCategory, `Inserted ${this.formatElementForLogger(elementProps)}`);
    return elementId;
  }

  /** Update an existing Element in the target iModel from the specified ElementProps. */
  private updateElement(elementProps: ElementProps): void {
    if (!elementProps.id) {
      throw new IModelError(IModelStatus.InvalidId, "ElementId not provided", Logger.logError, loggerCategory);
    }
    this.targetDb.elements.updateElement(elementProps);
    Logger.logInfo(loggerCategory, `Updated ${this.formatElementForLogger(elementProps)}`);
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
      this.insertElementAspect(aspectProps);
    } else if (this.hasElementAspectChanged(aspects[0], aspectProps)) {
      aspectProps.id = aspects[0].id;
      this.updateElementAspect(aspectProps);
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
              this.updateElementAspect(aspectProps);
            }
          } else {
            this.insertElementAspect(aspectProps);
          }
          index++;
        });
      } else {
        let index = 0;
        currentAspects.forEach((aspect: ElementMultiAspect) => {
          if (index < proposedAspects.length) {
            proposedAspects[index].id = aspect.id;
            if (this.hasElementAspectChanged(aspect, proposedAspects[index])) {
              this.updateElementAspect(proposedAspects[index]);
            }
          } else {
            this.deleteElementAspect(aspect);
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

  /** Insert the transformed ElementAspect into the target iModel. */
  private insertElementAspect(aspectProps: ElementAspectProps): void {
    this.targetDb.elements.insertAspect(aspectProps);
    Logger.logInfo(loggerCategory, `Inserted ${this.formatElementAspectForLogger(aspectProps)}`);
  }

  /** Update the transformed ElementAspect in the target iModel. */
  private updateElementAspect(aspectProps: ElementAspectProps): void {
    this.targetDb.elements.updateAspect(aspectProps);
    Logger.logInfo(loggerCategory, `Updated ${this.formatElementAspectForLogger(aspectProps)}`);
  }

  /** Delete the specified ElementAspect from the target iModel. */
  private deleteElementAspect(targetElementAspect: ElementAspect): void {
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
        this.updateRelationship(relationshipProps);
      }
      return relationshipProps.id;
    } catch (error) {
      // catch NotFound error and insert relationship
      if ((error instanceof IModelError) && (IModelStatus.NotFound === error.errorNumber)) {
        return this.insertRelationship(relationshipProps);
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
   */
  private insertRelationship(relationshipProps: RelationshipProps): Id64String {
    const targetRelInstanceId: Id64String = this.targetDb.relationships.insertInstance(relationshipProps);
    Logger.logInfo(loggerCategory, `Inserted ${this.formatRelationshipForLogger(relationshipProps)}`);
    return targetRelInstanceId;
  }

  /** Update an existing Relationship in the target iModel from the specified RelationshipProps. */
  private updateRelationship(relationshipProps: RelationshipProps): void {
    if (!relationshipProps.id) {
      throw new IModelError(IModelStatus.InvalidId, "Relationship instance Id not provided", Logger.logError, loggerCategory);
    }
    this.targetDb.relationships.updateInstance(relationshipProps);
    Logger.logInfo(loggerCategory, `Updated ${this.formatRelationshipForLogger(relationshipProps)}`);
  }

  /** Format a Relationship for the Logger. */
  private formatRelationshipForLogger(relProps: RelationshipProps): string {
    return `${relProps.classFullName} sourceId=[${relProps.sourceId}] targetId=[${relProps.targetId}]`;
  }
}
