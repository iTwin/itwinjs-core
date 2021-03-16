/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Models
 */

// cspell:ignore elid

import { assert, DbOpcode, DbResult, GuidString, Id64String, JsonUtils } from "@bentley/bentleyjs-core";
import { Point2d, Range3d } from "@bentley/geometry-core";
import { LockLevel } from "@bentley/imodelhub-client";
import {
  AxisAlignedBox3d, GeometricModel2dProps, GeometricModel3dProps, GeometricModelProps, IModel, IModelError, InformationPartitionElementProps,
  ModelProps, RelatedElement,
} from "@bentley/imodeljs-common";
import { ConcurrencyControl } from "./ConcurrencyControl";
import { DefinitionPartition, DocumentPartition, InformationRecordPartition, PhysicalPartition, SpatialLocationPartition } from "./Element";
import { Entity } from "./Entity";
import { IModelDb } from "./IModelDb";
import { SubjectOwnsPartitionElements } from "./NavigationRelationship";

/** A Model is a container for persisting a collection of related elements within an iModel.
 * See [[IModelDb.Models]] for how to query and manage the Models in an IModelDb.
 * See [Creating models]($docs/learning/backend/CreateModels.md)
 * @public
 */
export class Model extends Entity implements ModelProps {
  /** @internal */
  public static get className(): string { return "Model"; }
  /** @internal */
  public static get protectedOperations() { return ["onInsert", "onUpdate", "onDelete"]; }
  public readonly modeledElement!: RelatedElement;
  public readonly name: string;
  public readonly parentModel!: Id64String;
  public readonly jsonProperties: { [key: string]: any };
  public isPrivate: boolean;
  public isTemplate: boolean;

  /** @internal */
  constructor(props: ModelProps, iModel: IModelDb) {
    super(props, iModel);
    this.name = props.name ? props.name : ""; // NB this isn't really a property of Model (it's the code.value of the modeled element), but it comes in ModelProps because it's often needed
    this.isPrivate = JsonUtils.asBool(props.isPrivate);
    this.isTemplate = JsonUtils.asBool(props.isTemplate);
    this.jsonProperties = { ...props.jsonProperties }; // make sure we have our own copy
  }

  /** Add all properties of a Model to a json object.
   * @internal
   */
  public toJSON(): ModelProps {
    const val = super.toJSON() as ModelProps;
    val.name = this.name; // for cloning
    return val;
  }

  /** Disclose the codes and locks needed to perform the specified operation on this model
   * @param req The request to be populated
   * @param props The version of the model that will be written
   * @param iModel The iModel
   * @param opcode The operation that will be performed on the model
   * @beta
   */
  public static populateRequest(req: ConcurrencyControl.Request, props: ModelProps, iModel: IModelDb, opcode: DbOpcode): void {
    if (!iModel.isBriefcaseDb()) {
      assert(false);
      return;
    }
    switch (opcode) {
      case DbOpcode.Insert: {
        req.addLocks([ConcurrencyControl.Request.dbLock]);
        break;
      }
      case DbOpcode.Delete: {
        req.addLocks([ConcurrencyControl.Request.getModelLock(props.id!, LockLevel.Exclusive)]);
        // before we can delete a model, we must delete all of its elements. If that fails, we cannot continue.
        iModel.withPreparedStatement(`select ecinstanceid from BisCore.Element where model.id=?`, (stmt) => {
          stmt.bindId(1, props.id!);
          while (stmt.step() === DbResult.BE_SQLITE_ROW) {
            const elid = stmt.getValue(0).getId();
            const el = iModel.elements.getElement(elid);
            iModel.concurrencyControl.buildRequestForElementTo(req, el, DbOpcode.Delete);
          }
        });
        break;
      }
      case DbOpcode.Update: {
        req.addLocks([ConcurrencyControl.Request.getModelLock(props.id!, LockLevel.Exclusive)]);
        break;
      }
    }
  }

  /** Called before a new model is inserted.
   * @throws [[IModelError]] if there is a problem
   * @beta
   */
  protected static onInsert(props: Readonly<ModelProps>, iModel: IModelDb): void {
    if (iModel.isBriefcaseDb()) {
      iModel.concurrencyControl.onModelWrite(this, props, DbOpcode.Insert);
    }
  }
  /** Called after a new model is inserted.
   * @throws [[IModelError]] if there is a problem
   * @beta
   */
  protected static onInserted(id: string, iModel: IModelDb): void {
    if (iModel.isBriefcaseDb()) {
      iModel.concurrencyControl.onModelWritten(this, id, DbOpcode.Insert);
    }
  }
  /** Called before a model is updated.
   * @throws [[IModelError]] if there is a problem
   * @beta
   */
  protected static onUpdate(props: Readonly<ModelProps>, iModel: IModelDb): void {
    if (iModel.isBriefcaseDb()) {
      iModel.concurrencyControl.onModelWrite(this, props, DbOpcode.Update);
    }
  }
  /** Called after a model is updated.
   * @throws [[IModelError]] if there is a problem
   * @beta
   */
  protected static onUpdated(props: Readonly<ModelProps>, iModel: IModelDb): void {
    if (iModel.isBriefcaseDb()) {
      iModel.concurrencyControl.onModelWritten(this, props.id!, DbOpcode.Update);
    }
  }
  /** Called before a model is deleted.
   * @throws [[IModelError]] if there is a problem
   * @beta
   */
  protected static onDelete(props: Readonly<ModelProps>, iModel: IModelDb): void {
    if (iModel.isBriefcaseDb()) {
      iModel.concurrencyControl.onModelWrite(this, props, DbOpcode.Delete);
    }
  }
  /** Called after a model is deleted.
   * @throws [[IModelError]] if there is a problem
   * @beta
   */
  protected static onDeleted(_props: Readonly<ModelProps>, _iModel: IModelDb): void { }

  private getAllUserProperties(): any { if (!this.jsonProperties.UserProps) this.jsonProperties.UserProps = new Object(); return this.jsonProperties.UserProps; }

  /** Get a set of JSON user properties by namespace */
  public getUserProperties(namespace: string) { return this.getAllUserProperties()[namespace]; }

  /** Change a set of user JSON properties of this Element by namespace. */
  public setUserProperties(nameSpace: string, value: any) { this.getAllUserProperties()[nameSpace] = value; }

  /** Remove a set of JSON user properties, specified by namespace, from this Element */
  public removeUserProperties(nameSpace: string) { delete this.getAllUserProperties()[nameSpace]; }

  public getJsonProperty(name: string): any { return this.jsonProperties[name]; }
  public setJsonProperty(name: string, value: any) { this.jsonProperties[name] = value; }

  /** Add a request for the locks that would be needed to carry out the specified operation.
   * @param opcode The operation that will be performed on the element.
   */
  public buildConcurrencyControlRequest(opcode: DbOpcode): void {
    if (this.iModel.isBriefcaseDb()) {
      this.iModel.concurrencyControl.buildRequestForModel(this, opcode);
    }
  }

  /** Insert this Model in the iModel */
  public insert() { return this.iModel.models.insertModel(this); }
  /** Update this Model in the iModel. */
  public update() { this.iModel.models.updateModel(this); }
  /** Delete this Model from the iModel. */
  public delete() { this.iModel.models.deleteModel(this.id); }
}

/** A container for persisting geometric elements.
 * @public
 */
export class GeometricModel extends Model implements GeometricModelProps {
  public geometryGuid?: GuidString; // Initialized by the Entity constructor

  /** @internal */
  public static get className(): string { return "GeometricModel"; }
  /** @internal */
  constructor(props: GeometricModelProps, iModel: IModelDb) { super(props, iModel); }

  /** Query for the union of the extents of the elements contained by this model. */
  public queryExtents(): AxisAlignedBox3d {
    const { error, result } = this.iModel.nativeDb.queryModelExtents(JSON.stringify({ id: this.id.toString() }));
    if (error)
      throw new IModelError(error.status, "Error querying model extents");
    return Range3d.fromJSON(JSON.parse(result!).modelExtents);
  }
}

/** A container for persisting 3d geometric elements.
 * @public
 */
export abstract class GeometricModel3d extends GeometricModel implements GeometricModel3dProps {
  /** If true, then the elements in this GeometricModel3d are expected to be in an XY plane.
   * @note The associated ECProperty was added to the BisCore schema in version 1.0.8
   */
  public readonly isPlanProjection: boolean;
  /** If true, then the elements in this GeometricModel3d are not in real-world coordinates and will not be in the spatial index.
   * @note The associated ECProperty was added to the BisCore schema in version 1.0.8
   */
  public readonly isNotSpatiallyLocated: boolean;
  /** If true, then the elements in this GeometricModel3d are in real-world coordinates and will be in the spatial index. */
  public get isSpatiallyLocated(): boolean { return !this.isNotSpatiallyLocated; }
  /** @deprecated use [[isSpatiallyLocated]] */
  public get iSpatiallyLocated(): boolean { return !this.isNotSpatiallyLocated; }

  /** @internal */
  public static get className(): string { return "GeometricModel3d"; }
  /** @internal */
  constructor(props: GeometricModel3dProps, iModel: IModelDb) {
    super(props, iModel);
    this.isNotSpatiallyLocated = JsonUtils.asBool(props.isNotSpatiallyLocated);
    this.isPlanProjection = JsonUtils.asBool(props.isPlanProjection);
  }
  /** @internal */
  public toJSON(): GeometricModel3dProps {
    const val = super.toJSON() as GeometricModel3dProps;
    if (this.isNotSpatiallyLocated) val.isNotSpatiallyLocated = true;
    if (this.isPlanProjection) val.isPlanProjection = true;
    return val;
  }
}

/** A container for persisting 2d geometric elements.
 * @public
 */
export abstract class GeometricModel2d extends GeometricModel implements GeometricModel2dProps {
  /** The actual coordinates of (0,0) in modeling coordinates. An offset applied to all modeling coordinates. */
  public globalOrigin?: Point2d; // Initialized by the Entity constructor
  /** @internal */
  public static get className(): string { return "GeometricModel2d"; }
  /** @internal */
  constructor(props: GeometricModel2dProps, iModel: IModelDb) { super(props, iModel); }
  /** @internal */
  public toJSON(): GeometricModel2dProps {
    const val = super.toJSON() as GeometricModel2dProps;
    if (undefined !== this.globalOrigin) val.globalOrigin = Point2d.fromJSON(this.globalOrigin);
    return val;
  }
}

/** A container for persisting 2d graphical elements.
 * @public
 */
export abstract class GraphicalModel2d extends GeometricModel2d {
  /** @internal */
  public static get className(): string { return "GraphicalModel2d"; }
}

/** A container for persisting GraphicalElement3d instances.
 * @note The associated ECClass was added to the BisCore schema in version 1.0.8
 * @see [[GraphicalPartition3d]]
 * @public
 */
export abstract class GraphicalModel3d extends GeometricModel3d {
  /** @internal */
  public static get className(): string { return "GraphicalModel3d"; }
}

/** A container for persisting 3d geometric elements that are spatially located.
 * @public
 */
export abstract class SpatialModel extends GeometricModel3d {
  /** @internal */
  public static get className(): string { return "SpatialModel"; }
}

/** A container for persisting physical elements that model physical space.
 * @see [[PhysicalPartition]]
 * @public
 */
export class PhysicalModel extends SpatialModel {
  /** @internal */
  public static get className(): string { return "PhysicalModel"; }
  /** Insert a PhysicalPartition and a PhysicalModel that sub-models it.
   * @param iModelDb Insert into this iModel
   * @param parentSubjectId The PhysicalPartition will be inserted as a child of this Subject element.
   * @param name The name of the PhysicalPartition that the new PhysicalModel will sub-model.
   * @param isPlanProjection Optional value (default is false) that indicates if the contents of this model are expected to be in an XY plane.
   * @returns The Id of the newly inserted PhysicalPartition and PhysicalModel (same value).
   * @throws [[IModelError]] if there is an insert problem.
   */
  public static insert(iModelDb: IModelDb, parentSubjectId: Id64String, name: string, isPlanProjection?: boolean): Id64String {
    const partitionProps: InformationPartitionElementProps = {
      classFullName: PhysicalPartition.classFullName,
      model: IModel.repositoryModelId,
      parent: new SubjectOwnsPartitionElements(parentSubjectId),
      code: PhysicalPartition.createCode(iModelDb, parentSubjectId, name),
    };
    const partitionId = iModelDb.elements.insertElement(partitionProps);
    const modelProps: GeometricModel3dProps = {
      classFullName: this.classFullName,
      modeledElement: { id: partitionId },
      isPlanProjection,
    };
    return iModelDb.models.insertModel(modelProps);
  }
}

/** A container for persisting spatial location elements.
 * @see [[SpatialLocationPartition]]
 * @public
 */
export class SpatialLocationModel extends SpatialModel {
  /** @internal */
  public static get className(): string { return "SpatialLocationModel"; }
  /** Insert a SpatialLocationPartition and a SpatialLocationModel that sub-models it.
   * @param iModelDb Insert into this iModel
   * @param parentSubjectId The SpatialLocationPartition will be inserted as a child of this Subject element.
   * @param name The name of the SpatialLocationPartition that the new SpatialLocationModel will sub-model.
   * @param isPlanProjection Optional value (default is false) that indicates if the contents of this model are expected to be in an XY plane.
   * @returns The Id of the newly inserted SpatialLocationPartition and SpatialLocationModel (same value).
   * @throws [[IModelError]] if there is an insert problem.
   */
  public static insert(iModelDb: IModelDb, parentSubjectId: Id64String, name: string, isPlanProjection?: boolean): Id64String {
    const partitionProps: InformationPartitionElementProps = {
      classFullName: SpatialLocationPartition.classFullName,
      model: IModel.repositoryModelId,
      parent: new SubjectOwnsPartitionElements(parentSubjectId),
      code: SpatialLocationPartition.createCode(iModelDb, parentSubjectId, name),
    };
    const partitionId = iModelDb.elements.insertElement(partitionProps);
    const modelProps: GeometricModel3dProps = {
      classFullName: this.classFullName,
      modeledElement: { id: partitionId },
      isPlanProjection,
    };
    return iModelDb.models.insertModel(modelProps);
  }
}

/** A 2d model that holds [[DrawingGraphic]]s. DrawingModels may be dimensional or non-dimensional.
 * @public
 */
export class DrawingModel extends GraphicalModel2d {
  /** @internal */
  public static get className(): string { return "DrawingModel"; }
}

/** A container for persisting section [[DrawingGraphic]]s.
 * @public
 */
export class SectionDrawingModel extends DrawingModel {
  /** @internal */
  public static get className(): string { return "SectionDrawingModel"; }
}

/** A container for persisting [[ViewAttachment]]s and [[DrawingGraphic]]s.
 * A SheetModel is a digital representation of a *sheet of paper*. SheetModels are 2d models in bounded paper coordinates.
 * SheetModels may contain annotation Elements as well as references to 2d or 3d Views.
 * @public
 */
export class SheetModel extends GraphicalModel2d {
  /** @internal */
  public static get className(): string { return "SheetModel"; }
}

/** A container for persisting role elements.
 * @public
 */
export class RoleModel extends Model {
  /** @internal */
  public static get className(): string { return "RoleModel"; }
}

/** A container for persisting information elements.
 * @public
 */
export abstract class InformationModel extends Model {
  /** @internal */
  public static get className(): string { return "InformationModel"; }
}

/** A container for persisting group information elements.
 * @see [[GroupInformationPartition]]
 * @public
 */
export abstract class GroupInformationModel extends InformationModel {
  /** @internal */
  public static get className(): string { return "GroupInformationModel"; }
}

/** A container for persisting Information Record Elements
 * @see [[InformationRecordPartition]]
 * @public
 */
export class InformationRecordModel extends InformationModel {
  /** @internal */
  public static get className(): string { return "InformationRecordModel"; }

  /** Insert a InformationRecordPartition and a InformationRecordModel that sub-models it.
   * @param iModelDb Insert into this iModel
   * @param parentSubjectId The InformationRecordPartition will be inserted as a child of this Subject element.
   * @param name The name of the InformationRecordPartition that the new InformationRecordModel will sub-model.
   * @returns The Id of the newly inserted InformationRecordModel.
   * @throws [[IModelError]] if there is an insert problem.
   */
  public static insert(iModelDb: IModelDb, parentSubjectId: Id64String, name: string): Id64String {
    const partitionProps: InformationPartitionElementProps = {
      classFullName: InformationRecordPartition.classFullName,
      model: IModel.repositoryModelId,
      parent: new SubjectOwnsPartitionElements(parentSubjectId),
      code: InformationRecordPartition.createCode(iModelDb, parentSubjectId, name),
    };
    const partitionId = iModelDb.elements.insertElement(partitionProps);
    return iModelDb.models.insertModel({
      classFullName: this.classFullName,
      modeledElement: { id: partitionId },
    });
  }
}

/** A container for persisting definition elements.
 * @see [[DefinitionPartition]]
 * @public
 */
export class DefinitionModel extends InformationModel {
  /** @internal */
  public static get className(): string { return "DefinitionModel"; }

  /** Insert a DefinitionPartition and a DefinitionModel that sub-models it.
   * @param iModelDb Insert into this iModel
   * @param parentSubjectId The DefinitionPartition will be inserted as a child of this Subject element.
   * @param name The name of the DefinitionPartition that the new DefinitionModel will sub-model.
   * @returns The Id of the newly inserted DefinitionModel.
   * @throws [[IModelError]] if there is an insert problem.
   */
  public static insert(iModelDb: IModelDb, parentSubjectId: Id64String, name: string): Id64String {
    const partitionProps: InformationPartitionElementProps = {
      classFullName: DefinitionPartition.classFullName,
      model: IModel.repositoryModelId,
      parent: new SubjectOwnsPartitionElements(parentSubjectId),
      code: DefinitionPartition.createCode(iModelDb, parentSubjectId, name),
    };
    const partitionId = iModelDb.elements.insertElement(partitionProps);
    return iModelDb.models.insertModel({
      classFullName: this.classFullName,
      modeledElement: { id: partitionId },
    });
  }
}

/** The singleton container of repository-related information elements.
 * @public
 */
export class RepositoryModel extends DefinitionModel {
  /** @internal */
  public static get className(): string { return "RepositoryModel"; }
}

/** Contains a list of document elements.
 * @see [[DocumentPartition]]
 * @public
 */
export class DocumentListModel extends InformationModel {
  /** @internal */
  public static get className(): string { return "DocumentListModel"; }
  /** Insert a DocumentPartition and a DocumentListModel that sub-models it.
   * @param iModelDb Insert into this iModel
   * @param parentSubjectId The DocumentPartition will be inserted as a child of this Subject element.
   * @param name The name of the DocumentPartition that the new DocumentListModel will sub-model.
   * @returns The Id of the newly inserted DocumentPartition and DocumentListModel (same value)
   * @throws [[IModelError]] if there is an insert problem.
   */
  public static insert(iModelDb: IModelDb, parentSubjectId: Id64String, name: string): Id64String {
    const partitionProps: InformationPartitionElementProps = {
      classFullName: DocumentPartition.classFullName,
      model: IModel.repositoryModelId,
      parent: new SubjectOwnsPartitionElements(parentSubjectId),
      code: DocumentPartition.createCode(iModelDb, parentSubjectId, name),
    };
    const partitionId: Id64String = iModelDb.elements.insertElement(partitionProps);
    return iModelDb.models.insertModel({
      classFullName: this.classFullName,
      modeledElement: { id: partitionId },
    });
  }
}

/** A container for persisting link elements.
 * @see [[LinkPartition]]
 * @public
 */
export class LinkModel extends InformationModel {
  /** @internal */
  public static get className(): string { return "LinkModel"; }
}

/** The singleton container for repository-specific definition elements.
 * @public
 */
export class DictionaryModel extends DefinitionModel {
  /** @internal */
  public static get className(): string { return "DictionaryModel"; }
}

/** Obtains and displays multi-resolution tiled raster organized according to the WebMercator tiling system.
 * @public
 */
export class WebMercatorModel extends SpatialModel {
  /** @internal */
  public static get className(): string { return "WebMercatorModel"; }
}
