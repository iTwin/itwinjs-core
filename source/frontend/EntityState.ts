/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Id64, Guid } from "@bentley/bentleyjs-core/lib/Id";
import { EntityProps } from "../common/EntityProps";
import { IModel } from "../common/IModel";
import { Code } from "../common/Code";
import { ElementProps, RelatedElement } from "../common/ElementProps";

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
  public static getClassFullName(): string { return this.schemaName + ":" + this.className; }
  public static get sqlName(): string { return this.schemaName + "." + this.className; }
  public static get className(): string { return this.name.slice(0, this.name.lastIndexOf("State")); }
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
