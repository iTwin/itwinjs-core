/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module ElementState */

import { Id64, Guid } from "@bentley/bentleyjs-core";
import { EntityProps, Code, ElementProps, RelatedElement } from "@bentley/imodeljs-common";
import { IModelConnection } from "./IModelConnection";

/** The "state" of an Entity as represented in a web browser. */
export class EntityState implements EntityProps {
  public readonly id: Id64;
  public readonly iModel: IModelConnection;
  public readonly classFullName: string;
  public readonly jsonProperties: any;
  public static schemaName = "BisCore";

  /**
   * constructor for EntityState
   * @param props the properties of the Entity for this EntityState
   * @param iModel the iModel from which this EntityState is to be constructed
   * @param _state source EntityState for clone
   */
  constructor(props: EntityProps, iModel: IModelConnection, _state?: EntityState) {
    this.classFullName = props.classFullName;
    this.iModel = iModel;
    this.id = Id64.fromJSON(props.id);
    this.jsonProperties = props.jsonProperties ? JSON.parse(JSON.stringify(props.jsonProperties)) : {}; // make sure we have our own copy
  }

  public toJSON(): EntityProps {
    const val: any = {};
    val.classFullName = this.classFullName;
    if (this.id.isValid)
      val.id = this.id;
    if (this.jsonProperties && Object.keys(this.jsonProperties).length > 0)
      val.jsonProperties = this.jsonProperties;
    return val;
  }

  public equals(other: EntityState): boolean { return JSON.stringify(this.toJSON()) === JSON.stringify(other.toJSON()); }

  /** Make an independent copy of this EntityState */
  public clone<T extends EntityState>() { return new (this.constructor as typeof EntityState)(this.toJSON(), this.iModel, this) as T; }

  /**
   * Get full class name of this Entity in the form "SchemaName:ClassName".
   * @note Subclasses from other than the BisCore domain should override their static member "schemaName" with their schema name.
   */
  public static getClassFullName(): string { return this.schemaName + ":" + this.className; }

  public static get sqlName(): string { return this.schemaName + "." + this.className; }

  /**
   * Get the ECClass name for this EntityState.
   * @note This default implementation relies on all EntityState subclasses using their ECClass name as their JavaScript class name, <em>with "State" appended to the end </em>.
   * If this is not true, you must override this method.
   */
  public static get className(): string { return this.name.slice(0, this.name.lastIndexOf("State")); }
}

/** The "state" of an Element as represented in a web browser. */
export class ElementState extends EntityState implements ElementProps {
  public readonly model: Id64;
  public readonly code: Code;
  public readonly parent?: RelatedElement;
  public readonly federationGuid?: Guid;
  public readonly userLabel?: string;

  constructor(props: ElementProps, iModel: IModelConnection) {
    super(props, iModel);
    this.code = Code.fromJSON(props.code);
    this.model = RelatedElement.idFromJson(props.model);
    this.parent = RelatedElement.fromJSON(props.parent);
    this.federationGuid = Guid.fromJSON(props.federationGuid);
    this.userLabel = props.userLabel;
  }

  public toJSON(): ElementProps {
    const val = super.toJSON() as ElementProps;
    if (this.code.spec.isValid)
      val.code = this.code;
    val.model = this.model;
    val.parent = this.parent;
    val.federationGuid = this.federationGuid;
    val.userLabel = this.userLabel;
    return val;
  }
}
