/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Id64, Guid } from "@bentley/bentleyjs-core/lib/Id";
import { EntityProps } from "./EntityProps";
import { IModel } from "./IModel";
import { ModelProps, GeometricModel2dProps } from "./ModelProps";
import { JsonUtils } from "@bentley/bentleyjs-core/lib/JsonUtils";
import { Range2d } from "@bentley/geometry-core/lib/Range";
import { ElementProps, RelatedElement } from "./ElementProps";
import { Code } from "./Code";

/** the constructor for an EntityState (for cloning). */
interface EntityStateCtor extends FunctionConstructor {
  new(args: EntityProps, iModel: IModel, state?: EntityState): EntityState;
}

export class EntityState implements EntityProps {
  public readonly id: Id64;
  public readonly iModel: IModel;
  public readonly classFullName: string;
  public readonly jsonProperties: any;
  public static schemaName = "BisCore";

  constructor(props: EntityProps, iModel: IModel) {
    this.classFullName = props.classFullName;
    this.iModel = iModel;
    this.id = Id64.fromJSON(props.id);
    this.jsonProperties = !props.jsonProperties ? {} : JSON.parse(JSON.stringify(props.jsonProperties)); // make sure we have our own copy
  }

  public toJSON(): EntityProps {
    const val: any = {};
    val.classFullName = this.classFullName;
    if (this.id.isValid())
      val.id = this.id;
    if (Object.keys(this.jsonProperties).length > 0)
      val.jsonProperties = this.jsonProperties;
    return val;
  }

  public equals(other: EntityState): boolean { return JSON.stringify(this.toJSON()) === JSON.stringify(other.toJSON()); }

  /** Make an independent copy of this EntityState */
  public clone<T extends EntityState>() { return new (this.constructor as EntityStateCtor)(this.toJSON(), this.iModel, this) as T; }

  /**
   * Get full class name of this Entity in the form "schema:class".
   * @note This relies on all EntityState subclasses using their exact ECClass name as their class name, <em>with "State" appended to the end</em>.
   * @note Subclasses from other than the BisCore domain should override the static member "schemaName" with their domain prefix.
   */
  public static getClassFullName(): string { return this.schemaName + ":" + this.name.slice(0, this.name.lastIndexOf("State")); }
}

/** the state of a Model */
export abstract class ModelState extends EntityState implements ModelProps {
  public readonly modeledElement: Id64;
  public readonly jsonProperties: any;
  public readonly isPrivate: boolean;
  public readonly isTemplate: boolean;

  constructor(props: ModelProps, iModel: IModel) {
    super(props, iModel);
    this.modeledElement = Id64.fromJSON(props.modeledElement);
    this.isPrivate = JsonUtils.asBool(props.isPrivate);
    this.isTemplate = JsonUtils.asBool(props.isTemplate);
  }

  /** Add all custom-handled properties of a Model to a json object. */
  public toJSON(): ModelProps {
    const val = super.toJSON() as ModelProps;
    val.modeledElement = this.modeledElement;
    if (this.isPrivate)
      val.isPrivate = this.isPrivate;
    if (this.isTemplate)
      val.isTemplate = this.isTemplate;
    return val;
  }
}

/** the state of a 2d Model */
export class Model2dState extends ModelState implements GeometricModel2dProps {
  public readonly extents: Range2d;
  constructor(props: GeometricModel2dProps, iModel: IModel) {
    super(props, iModel);
  }
  public toJSON(): GeometricModel2dProps {
    const val = super.toJSON() as GeometricModel2dProps;
    return val;
  }
}

export class ElementState extends EntityState implements ElementProps {
  public readonly model: Id64;
  public readonly code: Code;
  public readonly parent?: RelatedElement;
  public readonly federationGuid?: Guid;
  public readonly userLabel?: string;

  constructor(props: ElementProps, iModel: IModel) {
    super(props, iModel);
    this.code = Code.fromJSON(props.code);
    this.model = Id64.fromJSON(props.model);
    this.parent = RelatedElement.fromJSON(props.parent);
    this.federationGuid = Guid.fromJSON(props.federationGuid);
    this.userLabel = props.userLabel;
  }

  public toJSON(): ElementProps {
    const val = super.toJSON() as ElementProps;
    if (this.code.spec.isValid())
      val.code = this.code;
    val.model = this.model;
    if (this.parent)
      val.parent = this.parent;
    if (this.federationGuid)
      val.federationGuid = this.federationGuid;
    if (this.userLabel)
      val.userLabel = this.userLabel;
    return val;
  }
}
