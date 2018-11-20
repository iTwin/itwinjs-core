/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Relationships */

import { Entity } from "./Entity";
import { IModelDb } from "./IModelDb";
import { EntityProps, IModelError, IModelStatus } from "@bentley/imodeljs-common";
import { Id64, Id64String, Logger, DbOpcode, DbResult } from "@bentley/bentleyjs-core";
import { ECSqlStatement } from "./ECSqlStatement";

/** @hidden */
const loggingCategory = "imodeljs-backend.LinkTableRelationship";

/** Specifies the source and target elements of a [[LinkTableRelationship]] instance. */
export interface SourceAndTarget {
  sourceId: Id64String;
  targetId: Id64String;
}

/** Properties that are common to all types of link table ECRelationships */
export interface LinkTableRelationshipProps extends EntityProps, SourceAndTarget {
}

/** Base class for all link table ECRelationships */
export class LinkTableRelationship extends Entity implements LinkTableRelationshipProps {
  public readonly sourceId: Id64String;
  public readonly targetId: Id64String;

  /** @hidden */
  protected constructor(props: LinkTableRelationshipProps, iModel: IModelDb) {
    super(props, iModel);
    this.sourceId = Id64.fromJSON(props.sourceId);
    this.targetId = Id64.fromJSON(props.targetId);
  }

  /** @hidden */
  public toJSON(): LinkTableRelationshipProps {
    const val = super.toJSON() as LinkTableRelationshipProps;
    val.sourceId = this.sourceId;
    val.targetId = this.targetId;
    return val;
  }

  public static onRootChanged(_props: LinkTableRelationshipProps): void { }
  public static onValidateOutput(_props: LinkTableRelationshipProps): void { }
  public static onDeletedDependency(_props: LinkTableRelationshipProps): void { }

  /** Insert this LinkTableRelationship into the iModel. */
  public insert(): Id64String { return this.iModel.linkTableRelationships.insertInstance(this); }
  /** Update this LinkTableRelationship in the iModel. */
  public update() { this.iModel.linkTableRelationships.updateInstance(this); }
  /** Delete this LinkTableRelationship from the iModel. */
  public delete() { this.iModel.linkTableRelationships.deleteInstance(this); }

  public static getInstance<T extends LinkTableRelationship>(iModel: IModelDb, criteria: Id64String | SourceAndTarget): T {
    return iModel.linkTableRelationships.getInstance(this.classFullName, criteria);
  }

  /**
   * Add a request for the locks that would be needed to carry out the specified operation.
   * @param opcode The operation that will be performed on the LinkTableRelationship instance.
   */
  public buildConcurrencyControlRequest(opcode: DbOpcode): void { this.iModel.concurrencyControl.buildRequestForLinkTableRelationship(this, opcode); }
}

/**
 * A LinkTableRelationship where one Element refers to another Element
 */
export class ElementRefersToElements extends LinkTableRelationship {
  /** Create an instance of the LinkTableRelationship.
   * @param iModel The iModel that will contain the relationship
   * @param sourceId The sourceId of the relationship, that is, the driver element
   * @param targetId The targetId of the relationship, that is, the driven element
   * @return an instance of the specified class.
   */
  public static create<T extends ElementRefersToElements>(iModel: IModelDb, sourceId: Id64String, targetId: Id64String): T {
    return iModel.linkTableRelationships.createInstance({ sourceId, targetId, classFullName: this.classFullName }) as T;
  }
}

/** Relates a [[DrawingGraphic]] to the [[Element]] that it represents */
export class DrawingGraphicRepresentsElement extends ElementRefersToElements {
}

/** Properties that are common to all types of link table ECRelationships */
export interface ElementGroupsMembersProps extends LinkTableRelationshipProps {
  memberPriority: number;
}

/**
 * An ElementRefersToElements relationship where one Element *groups* a set of other Elements.
 */
export class ElementGroupsMembers extends ElementRefersToElements {
  public memberPriority: number;

  constructor(props: ElementGroupsMembersProps, iModel: IModelDb) {
    super(props, iModel);
    this.memberPriority = props.memberPriority;
  }

  public static create<T extends ElementRefersToElements>(iModel: IModelDb, sourceId: Id64String, targetId: Id64String, memberPriority: number = 0): T {
    const props: ElementGroupsMembersProps = { sourceId, targetId, memberPriority, classFullName: this.classFullName };
    return iModel.linkTableRelationships.createInstance(props) as T;
  }
}

/** Properties that are common to all types of ElementDrivesElements */
export interface ElementDrivesElementProps extends LinkTableRelationshipProps {
  status: number;
  priority: number;
}

/**
 * A LinkTableRelationship where one Element *drives* another Element
 */
export class ElementDrivesElement extends LinkTableRelationship implements ElementDrivesElementProps {
  public status: number;
  public priority: number;

  /** @hidden */
  constructor(props: ElementDrivesElementProps, iModel: IModelDb) {
    super(props, iModel);
    this.status = props.status;
    this.priority = props.priority;
  }

  public static create<T extends ElementRefersToElements>(iModel: IModelDb, sourceId: Id64String, targetId: Id64String, priority: number = 0): T {
    const props: ElementDrivesElementProps = { sourceId, targetId, priority, status: 0, classFullName: this.classFullName };
    return iModel.linkTableRelationships.createInstance(props) as T;
  }
}

/** Manages [[LinkTableRelationship]]s. */
export class IModelDbLinkTableRelationships {
  private _iModel: IModelDb;

  /** @hidden */
  public constructor(iModel: IModelDb) { this._iModel = iModel; }

  /**
   * Create a new instance of a LinkTableRelationship.
   * @param props The properties of the new LinkTableRelationship.
   * @throws [[IModelError]] if there is a problem creating the LinkTableRelationship.
   */
  public createInstance(props: LinkTableRelationshipProps): LinkTableRelationship { return this._iModel.constructEntity(props) as LinkTableRelationship; }

  /**
   * Insert a new relationship instance into the iModel.
   * @param props The properties of the new relationship instance.
   * @returns The Id of the newly inserted relationship instance.
   * @note The id property of the props object is set as a side effect of this function.
   * @throws [[IModelError]] if unable to insert the relationship instance.
   */
  public insertInstance(props: LinkTableRelationshipProps): Id64String {
    const val = this._iModel.briefcase.nativeDb.insertLinkTableRelationship(JSON.stringify(props));
    if (val.error)
      throw new IModelError(val.error.status, "Problem inserting relationship instance", Logger.logWarning, loggingCategory);

    props.id = Id64.fromJSON(val.result);
    return props.id;
  }

  /**
   * Update the properties of an existing relationship instance in the iModel.
   * @param props the properties of the relationship instance to update. Any properties that are not present will be left unchanged.
   * @throws [[IModelError]] if unable to update the relationship instance.
   */
  public updateInstance(props: LinkTableRelationshipProps): void {
    const error = this._iModel.briefcase.nativeDb.updateLinkTableRelationship(JSON.stringify(props));
    if (error !== DbResult.BE_SQLITE_OK)
      throw new IModelError(error, "", Logger.logWarning, loggingCategory);
  }

  /**
   * Delete an relationship instance from this iModel.
   * @param id The Id of the relationship instance to be deleted
   * @throws [[IModelError]]
   */
  public deleteInstance(props: LinkTableRelationshipProps): void {
    const error = this._iModel.briefcase.nativeDb.deleteLinkTableRelationship(JSON.stringify(props));
    if (error !== DbResult.BE_SQLITE_DONE)
      throw new IModelError(error, "", Logger.logWarning, loggingCategory);
  }

  /** get the props of a relationship instance */
  public getInstanceProps<T extends LinkTableRelationshipProps>(relClassSqlName: string, criteria: Id64String | SourceAndTarget): T {
    if (typeof criteria === "string") {
      return this._iModel.withPreparedStatement(`SELECT * FROM ${relClassSqlName} WHERE ecinstanceid=?`, (stmt: ECSqlStatement) => {
        stmt.bindId(1, criteria);
        if (DbResult.BE_SQLITE_ROW !== stmt.step())
          throw new IModelError(IModelStatus.NotFound, "LinkTableRelationship not found", Logger.logWarning, loggingCategory);
        return stmt.getRow() as T;
      });
    }

    return this._iModel.withPreparedStatement("SELECT * FROM " + relClassSqlName + " WHERE SourceECInstanceId=? AND TargetECInstanceId=?", (stmt: ECSqlStatement) => {
      stmt.bindId(1, criteria.sourceId);
      stmt.bindId(2, criteria.targetId);
      if (DbResult.BE_SQLITE_ROW !== stmt.step())
        throw new IModelError(IModelStatus.NotFound, "LinkTableRelationship not found", Logger.logWarning, loggingCategory);
      return stmt.getRow() as T;
    });
  }

  /** get a relationship instance */
  public getInstance<T extends LinkTableRelationship>(relClassSqlName: string, criteria: Id64String | SourceAndTarget): T {
    const props = this.getInstanceProps(relClassSqlName, criteria);
    props.classFullName = props.className.replace(".", ":");
    if (props.sourceClassName !== undefined)
      props.sourceClassName = props.sourceClassName.replace(".", ":");
    if (props.targetClassName !== undefined)
      props.targetClassName = props.targetClassName.replace(".", ":");
    return this._iModel.constructEntity(props) as T;
  }
}
