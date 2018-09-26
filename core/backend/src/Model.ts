/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Models */

import { Id64, DbOpcode, JsonUtils } from "@bentley/bentleyjs-core";
import { AxisAlignedBox3d, GeometricModel2dProps, IModelError, ModelProps, RelatedElement } from "@bentley/imodeljs-common";
import { Point2d } from "@bentley/geometry-core";
import { Entity } from "./Entity";
import { IModelDb } from "./IModelDb";

/**
 * A Model is a container for persisting a collection of related elements within an iModel.
 * See [[IModelDb.Models]] for how to query and manage the Models in an IModelDB.
 * See [Creating models]($docs/learning/backend/CreateModels.md)
 */
export class Model extends Entity implements ModelProps {
  public readonly modeledElement: RelatedElement;
  public readonly name: string;
  public readonly parentModel: Id64;
  public readonly jsonProperties: any;
  public isPrivate: boolean;
  public isTemplate: boolean;

  /** @hidden */
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
   * @hidden
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

/**
 * A container for persisting geometric elements.
 */
export class GeometricModel extends Model {
  /** Query for the union of the extents of the elements contained by this model. */
  public queryExtents(): AxisAlignedBox3d {
    const { error, result } = this.iModel.nativeDb.queryModelExtents(JSON.stringify({ id: this.id.toString() }));
    if (error)
      throw new IModelError(error.status);
    return AxisAlignedBox3d.fromJSON(JSON.parse(result!).modelExtents);
  }
}

/**
 * A container for persisting 3d geometric elements.
 */
export abstract class GeometricModel3d extends GeometricModel {
}

/**
 * A container for persisting 2d geometric elements.
 */
export abstract class GeometricModel2d extends GeometricModel implements GeometricModel2dProps {
  public globalOrigin?: Point2d;
}

/**
 * A container for persisting 2d graphical elements.
 */
export abstract class GraphicalModel2d extends GeometricModel2d {
}

/**
 * A container for persisting 3d geometric elements that are spatially located.
 */
export abstract class SpatialModel extends GeometricModel3d {
}

/**
 * A container for persisting physical elements that model physical space.
 */
export class PhysicalModel extends SpatialModel {
}
/**
 * A container for persisting spatial location elements.
 */
export class SpatialLocationModel extends SpatialModel {
}

/**
 * A 2d model that holds [[DrawingGraphic]]s. DrawingModels may be dimensional or non-dimensional.
 */
export class DrawingModel extends GraphicalModel2d {
}

/**
 * A container for persisting section [[DrawingGraphic]]s.
 */
export class SectionDrawingModel extends DrawingModel {
}

/**
 * A container for persisting [[ViewAttachment]]s and [[DrawingGraphic]]s.
 * A SheetModel is a digital representation of a *sheet of paper*. SheetModels are 2d models in bounded paper coordinates.
 * SheetModels may contain annotation Elements as well as references to 2d or 3d Views.
 */
export class SheetModel extends GraphicalModel2d {
}

/**
 * A container for persisting role elements.
 */
export class RoleModel extends Model {
}

/**
 * A container for persisting information elements.
 */
export abstract class InformationModel extends Model {
}

/**
 * A container for persisting group information elements.
 */
export abstract class GroupInformationModel extends InformationModel {
}

/**
 * A container for persisting Information Record Elements
 */
export class InformationRecordModel extends InformationModel {
}

/**
 * A container for persisting definition elements.
 */
export class DefinitionModel extends InformationModel {
}

/**
 * The singleton container of repository-related information elements.
 */
export class RepositoryModel extends DefinitionModel {
}

/**
 * Contains a list of document elements.
 */
export class DocumentListModel extends InformationModel {
}

/**
 * A container for persisting link elements.
 */
export class LinkModel extends InformationModel {
}

/**
 * The singleton container for repository-specific definition elements.
 */
export class DictionaryModel extends DefinitionModel {
}

/** Obtains and displays multi-resolution tiled raster organized according to the WebMercator tiling system. */
export class WebMercatorModel extends SpatialModel {
}
