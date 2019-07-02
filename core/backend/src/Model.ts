/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Models */

import { DbOpcode, Id64, Id64String, JsonUtils } from "@bentley/bentleyjs-core";
import { Point2d, Range3d } from "@bentley/geometry-core";
import { AxisAlignedBox3d, GeometricModel2dProps, IModel, IModelError, InformationPartitionElementProps, ModelProps, RelatedElement } from "@bentley/imodeljs-common";
import { DefinitionPartition, DocumentPartition, InformationRecordPartition, PhysicalPartition } from "./Element";
import { Entity } from "./Entity";
import { IModelDb } from "./IModelDb";
import { SubjectOwnsPartitionElements } from "./NavigationRelationship";

/** A Model is a container for persisting a collection of related elements within an iModel.
 * See [[IModelDb.Models]] for how to query and manage the Models in an IModelDB.
 * See [Creating models]($docs/learning/backend/CreateModels.md)
 * @public
 */
export class Model extends Entity implements ModelProps {
  /** @internal */
  public static get className(): string { return "Model"; }
  public readonly modeledElement: RelatedElement;
  public readonly name: string;
  public readonly parentModel: Id64String;
  public readonly jsonProperties: any;
  public isPrivate: boolean;
  public isTemplate: boolean;

  /** @internal */
  constructor(props: ModelProps, iModel: IModelDb) {
    super(props, iModel);
    this.id = Id64.fromJSON(props.id);
    this.name = props.name ? props.name : "";
    this.modeledElement = RelatedElement.fromJSON(props.modeledElement)!;
    this.parentModel = Id64.fromJSON(props.parentModel)!; // NB! Must always match the model of the modeledElement!
    this.isPrivate = JsonUtils.asBool(props.isPrivate);
    this.isTemplate = JsonUtils.asBool(props.isTemplate);
    this.jsonProperties = Object.assign({}, props.jsonProperties); // make sure we have our own copy
  }

  /** Add all custom-handled properties of a Model to a json object.
   * @internal
   */
  public toJSON(): ModelProps {
    const val = super.toJSON() as ModelProps;
    val.id = this.id;
    val.modeledElement = this.modeledElement;
    val.parentModel = this.parentModel;
    val.name = this.name;
    if (this.isPrivate)
      val.isPrivate = this.isPrivate;
    if (this.isTemplate)
      val.isTemplate = this.isTemplate;
    if (Object.keys(this.jsonProperties).length > 0)
      val.jsonProperties = this.jsonProperties;
    return val;
  }

  /** Called before a new model is inserted.
   * @throws [[IModelError]] if there is a problem
   * @beta
   */
  protected static onInsert(_props: ModelProps): void { }
  /** Called after a new model is inserted.
   * @throws [[IModelError]] if there is a problem
   * @beta
   */
  protected static onInserted(_id: string): void { }
  /** Called before a model is updated.
   * @throws [[IModelError]] if there is a problem
   * @beta
   */
  protected static onUpdate(_props: ModelProps): void { }
  /** Called after a model is updated.
   * @throws [[IModelError]] if there is a problem
   * @beta
   */
  protected static onUpdated(_props: ModelProps): void { }
  /** Called before a model is deleted.
   * @throws [[IModelError]] if there is a problem
   * @beta
   */
  protected static onDelete(_props: ModelProps): void { }
  /** Called after a model is deleted.
   * @throws [[IModelError]] if there is a problem
   * @beta
   */
  protected static onDeleted(_props: ModelProps): void { }

  private getAllUserProperties(): any { if (!this.jsonProperties.UserProps) this.jsonProperties.UserProps = new Object(); return this.jsonProperties.UserProps; }

  /** Get a set of JSON user properties by namespace */
  public getUserProperties(namespace: string) { return this.getAllUserProperties()[namespace]; }

  /** Change a set of user JSON properties of this Element by namespace. */
  public setUserProperties(nameSpace: string, value: any) { this.getAllUserProperties()[nameSpace] = value; }

  /** Remove a set of JSON user properties, specified by namespace, from this Element */
  public removeUserProperties(nameSpace: string) { delete this.getAllUserProperties()[nameSpace]; }

  public getJsonProperty(name: string): any { return this.jsonProperties[name]; }
  public setJsonProperty(name: string, value: any) { this.jsonProperties[name] = value; }

  /**
   * Add a request for the locks that would be needed to carry out the specified operation.
   * @param opcode The operation that will be performed on the element.
   */
  public buildConcurrencyControlRequest(opcode: DbOpcode): void { this.iModel.concurrencyControl.buildRequestForModel(this, opcode); }
}

/** A container for persisting geometric elements.
 * @public
 */
export class GeometricModel extends Model {
  /** @internal */
  public static get className(): string { return "GeometricModel"; }

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
export abstract class GeometricModel3d extends GeometricModel {
  /** @internal */
  public static get className(): string { return "GeometricModel3d"; }
}

/** A container for persisting 2d geometric elements.
 * @public
 */
export abstract class GeometricModel2d extends GeometricModel implements GeometricModel2dProps {
  /** @internal */
  public static get className(): string { return "GeometricModel2d"; }
  public globalOrigin?: Point2d;
}

/** A container for persisting 2d graphical elements.
 * @public
 */
export abstract class GraphicalModel2d extends GeometricModel2d {
  /** @internal */
  public static get className(): string { return "GraphicalModel2d"; }
}

/** A container for persisting 3d geometric elements that are spatially located.
 * @public
 */
export abstract class SpatialModel extends GeometricModel3d {
  /** @internal */
  public static get className(): string { return "SpatialModel"; }
}

/** A container for persisting physical elements that model physical space.
 * @public
 */
export class PhysicalModel extends SpatialModel {
  /** @internal */
  public static get className(): string { return "PhysicalModel"; }
  /** Insert a PhysicalPartition and a PhysicalModel that breaks it down.
   * @param iModelDb Insert into this iModel
   * @param parentSubjectId The PhysicalPartition will be inserted as a child of this Subject element.
   * @param name The name of the PhysicalPartition that the new PhysicalModel will break down.
   * @returns The Id of the newly inserted PhysicalPartition and PhysicalModel (same value).
   * @throws [[IModelError]] if there is an insert problem.
   */
  public static insert(iModelDb: IModelDb, parentSubjectId: Id64String, name: string): Id64String {
    const partitionProps: InformationPartitionElementProps = {
      classFullName: PhysicalPartition.classFullName,
      model: IModel.repositoryModelId,
      parent: new SubjectOwnsPartitionElements(parentSubjectId),
      code: PhysicalPartition.createCode(iModelDb, parentSubjectId, name),
    };
    const partitionId = iModelDb.elements.insertElement(partitionProps);
    return iModelDb.models.insertModel({
      classFullName: this.classFullName,
      modeledElement: { id: partitionId },
    });
  }
}

/** A container for persisting spatial location elements.
 * @public
 */
export class SpatialLocationModel extends SpatialModel {
  /** @internal */
  public static get className(): string { return "SpatialLocationModel"; }
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
 * @public
 */
export abstract class GroupInformationModel extends InformationModel {
  /** @internal */
  public static get className(): string { return "GroupInformationModel"; }
}

/** A container for persisting Information Record Elements
 * @public
 */
export class InformationRecordModel extends InformationModel {
  /** @internal */
  public static get className(): string { return "InformationRecordModel"; }

  /** Insert a InformationRecordPartition and a InformationRecordModel that breaks it down.
   * @param iModelDb Insert into this iModel
   * @param parentSubjectId The InformationRecordPartition will be inserted as a child of this Subject element.
   * @param name The name of the InformationRecordPartition that the new InformationRecordModel will break down.
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
 * @public
 */
export class DefinitionModel extends InformationModel {
  /** @internal */
  public static get className(): string { return "DefinitionModel"; }

  /** Insert a DefinitionPartition and a DefinitionModel that breaks it down.
   * @param iModelDb Insert into this iModel
   * @param parentSubjectId The DefinitionPartition will be inserted as a child of this Subject element.
   * @param name The name of the DefinitionPartition that the new DefinitionModel will break down.
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
 * @public
 */
export class DocumentListModel extends InformationModel {
  /** @internal */
  public static get className(): string { return "DocumentListModel"; }
  /** Insert a DocumentPartition and a DocumentListModel that breaks it down.
   * @param iModelDb Insert into this iModel
   * @param parentSubjectId The DocumentPartition will be inserted as a child of this Subject element.
   * @param name The name of the DocumentPartition that the new DocumentListModel will break down.
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
