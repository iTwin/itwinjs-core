/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Id64 } from "@bentley/bentleyjs-core/lib/Id";
import { JsonUtils } from "@bentley/bentleyjs-core/lib/JsonUtils";
import { ModelProps, GeometricModel2dProps } from "../common/ModelProps";
import { Entity } from "./Entity";
import { IModelDb } from "./IModelDb";
import { DbOpcode } from "@bentley/bentleyjs-core/lib/BeSQLite";
import { BriefcaseManager } from "./BriefcaseManager";

/**
 * A Model is a container for persisting a collection of related elements within an iModel.
 */
export class Model extends Entity implements ModelProps {
  public modeledElement: Id64;
  public jsonProperties: any;
  public isPrivate: boolean;
  public isTemplate: boolean;

  constructor(props: ModelProps, iModel: IModelDb) {
    super(props, iModel);
    this.id = Id64.fromJSON(props.id);
    this.modeledElement = Id64.fromJSON(props.modeledElement)!;
    this.isPrivate = JsonUtils.asBool(props.isPrivate);
    this.isTemplate = JsonUtils.asBool(props.isTemplate);
    this.jsonProperties = Object.assign({}, props.jsonProperties); // make sure we have our own copy
  }

  /** Add all custom-handled properties of a Model to a json object. */
  public toJSON(): ModelProps {
    const val = super.toJSON() as ModelProps;
    val.id = this.id;
    val.modeledElement = this.modeledElement;
    if (this.parentModel)
      val.parentModel = this.parentModel;
    if (this.isPrivate)
      val.isPrivate = this.isPrivate;
    if (this.isTemplate)
      val.isTemplate = this.isTemplate;
    if (Object.keys(this.jsonProperties).length > 0)
      val.jsonProperties = this.jsonProperties;
    return val;
  }

  /** Get the Id of the special dictionary model */
  public static getDictionaryId(): Id64 { return new Id64("0x10"); }

 /**
  * Add the lock, code, and other resource requests that would be needed in order to carry out the specified operation.
  * @param req The request object, which accumulates requests.
  * @param opcode The operation that will be performed on the element.
  */
  public buildResourcesRequest(req: BriefcaseManager.ResourcesRequest, opcode: DbOpcode): void {
    this.iModel.buildResourcesRequestForModel(req, this, opcode);
  }
}

/**
 * A container for persisting geometric elements.
 */
export class GeometricModel extends Model {
  constructor(props: ModelProps, iModel: IModelDb) {
    super(props, iModel);
  }
}

/**
 * A container for persisting 3D geometric elements.
 */
export abstract class GeometricModel3d extends GeometricModel {
  constructor(props: ModelProps, iModel: IModelDb) {
    super(props, iModel);
  }
}

/**
 * A container for persisting 2D geometric elements.
 */
export abstract class GeometricModel2d extends GeometricModel implements GeometricModel2dProps {
  constructor(props: GeometricModel2dProps, iModel: IModelDb) {
    super(props, iModel);
  }
}
/**
 * A container for persisting 2D graphical elements.
 */
export abstract class GraphicalModel2d extends GeometricModel2d {
  constructor(props: GeometricModel2dProps, iModel: IModelDb) {
    super(props, iModel);
  }
}

/**
 * A container for persisting 3D geometric elements that are spatially located.
 */
export abstract class SpatialModel extends GeometricModel3d {
  constructor(props: ModelProps, iModel: IModelDb) {
    super(props, iModel);
  }
}

/**
 * A container for persisting physical elements that model physical space.
 */
export class PhysicalModel extends SpatialModel {
  constructor(props: ModelProps, iModel: IModelDb) {
    super(props, iModel);
  }
}

/**
 * A container for persisting spatial location elements.
 */
export class SpatialLocationModel extends SpatialModel {
  constructor(props: ModelProps, iModel: IModelDb) {
    super(props, iModel);
  }
}

/**
 * A container for persisting drawing graphics.
 */
export class DrawingModel extends GraphicalModel2d {
  constructor(props: GeometricModel2dProps, iModel: IModelDb) {
    super(props, iModel);
  }
}

/**
 * A container for persisting section drawing graphics.
 */
export class SectionDrawingModel extends DrawingModel {
  constructor(props: GeometricModel2dProps, iModel: IModelDb) {
    super(props, iModel);
  }
}

/**
 * A container for persisting sheet views and graphics.
 */
export class SheetModel extends GraphicalModel2d {
  constructor(props: GeometricModel2dProps, iModel: IModelDb) {
    super(props, iModel);
  }
}

/**
 * A container for persisting role elements.
 */
export class RoleModel extends Model {
  constructor(props: ModelProps, iModel: IModelDb) {
    super(props, iModel);
  }
}

/**
 * A container for persisting information elements.
 */
export abstract class InformationModel extends Model {
  constructor(props: ModelProps, iModel: IModelDb) {
    super(props, iModel);
  }
}

/**
 * A container for persisting group information elements.
 */
export abstract class GroupInformationModel extends InformationModel {
  constructor(props: ModelProps, iModel: IModelDb) {
    super(props, iModel);
  }
}

/**
 * A container for persisting Information Record Elements
 */
export class InformationRecordModel extends InformationModel {
  constructor(props: ModelProps, iModel: IModelDb) {
    super(props, iModel);
  }
}

/**
 * A container for persisting definition elements.
 */
export class DefinitionModel extends InformationModel {
  constructor(props: ModelProps, iModel: IModelDb) {
    super(props, iModel);
  }
}

/**
 * The singleton container of repository-related information elements.
 */
export class RepositoryModel extends DefinitionModel {
  constructor(props: ModelProps, iModel: IModelDb) {
    super(props, iModel);
  }
}

/**
 * Contains a list of document elements.
 */
export class DocumentListModel extends InformationModel {
  constructor(props: ModelProps, iModel: IModelDb) {
    super(props, iModel);
  }
}

/**
 * A container for persisting link elements.
 */
export class LinkModel extends InformationModel {
  constructor(props: ModelProps, iModel: IModelDb) {
    super(props, iModel);
  }
}

/**
 * The singleton container for repository-specific definition elements.
 */
export class DictionaryModel extends DefinitionModel {
  constructor(props: ModelProps, iModel: IModelDb) {
    super(props, iModel);
  }
}

export class WebMercatorModel extends SpatialModel {
  constructor(props: ModelProps, iModel: IModelDb) {
    super(props, iModel);
  }
}
