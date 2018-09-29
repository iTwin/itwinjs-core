/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Relationships */

import { Entity } from "./Entity";
import { IModelDb } from "./IModelDb";
import { EntityProps, IModelError, IModelStatus } from "@bentley/imodeljs-common";
import { Id64, Id64String, Logger, DbOpcode, DbResult } from "@bentley/bentleyjs-core";
import { ECSqlStatement } from "./ECSqlStatement";

const loggingCategory = "imodeljs-backend.LinkTableRelationship";

/** Properties that are common to all types of link table ECRelationships */
export interface LinkTableRelationshipProps extends EntityProps {
  sourceId: Id64String;
  targetId: Id64String;
  sourceClassName?: string;
  targetClassName?: string;
}

/** Base class for all link table ECRelationships */
export class LinkTableRelationship extends Entity implements LinkTableRelationshipProps {
  public readonly sourceId: Id64; // Warning: Do not change these property names. They must match the internal names that EC/ECSQL assigns to source and target.
  public readonly targetId: Id64;
  public readonly sourceClassName?: string;
  public readonly targetClassName?: string;

  /** @hidden */
  protected constructor(props: LinkTableRelationshipProps, iModel: IModelDb) {
    super(props, iModel);
    this.id = Id64.fromJSON(props.id);
    this.sourceId = Id64.fromJSON(props.sourceId);
    this.targetId = Id64.fromJSON(props.targetId);
    this.sourceClassName = props.sourceClassName;
    this.targetClassName = props.targetClassName;
  }

  /** @hidden */
  public toJSON(): LinkTableRelationshipProps {
    const val = super.toJSON() as LinkTableRelationshipProps;
    val.id = this.id;
    val.sourceId = this.sourceId;
    val.targetId = this.targetId;
    val.sourceClassName = this.sourceClassName;
    val.targetClassName = this.targetClassName;
    return val;
  }

  // TODO: Expose properties for 'strength' and 'direction'

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
  /** Create an instance of the ElementRefersToElements relationship.
   * @param iModel The iModel that will contain the relationship
   * @param sourceId The sourceId of the relationship, that is, the driver element
   * @param targetId The targetId of the relationship, that is, the driven element
   * @param classFullName The full name of the ElementRefersToElements class. Must be specified to create an instance of a derived class. May be omitted to create an instance of the ElementRefersToElements base class.
   * @return an instance of the specified class.
   */
  public static create(iModel: IModelDb, sourceId: Id64, targetId: Id64, classFullName: string = ElementRefersToElements.classFullName): ElementRefersToElements {
    return iModel.linkTableRelationships.createInstance({ sourceId, targetId, classFullName }) as ElementRefersToElements;
  }
}

/** Properties that are common to all types of link table ECRelationships */
export interface ElementGroupsMembersProps extends LinkTableRelationshipProps {
  memberPriority: number;
}

/**
 * An ElementRefersToElements relationship where one Element *groups* a set of other Elements.
 */
export class ElementGroupsMembers extends ElementRefersToElements {
  public memberPriority!: number;

  /** @hidden */
  constructor(props: ElementGroupsMembersProps, iModel: IModelDb) { super(props, iModel); }

  /** Create an instance of the ElementGroupsMembers relationship.
   * @param iModel The iModel that will contain the relationship
   * @param sourceId The sourceId of the relationship, that is, the driver element
   * @param targetId The targetId of the relationship, that is, the driven element
   * @param classFullName The full name of the ElementGroupsMembers class. Must be specified to create an instance of a derived class. May be omitted to create an instance of the ElementGroupsMembers base class.
   * @return an instance of the specified class.
   */
  public static create(iModel: IModelDb, sourceId: Id64, targetId: Id64, classFullName: string = ElementGroupsMembers.classFullName, memberPriority: number = 0): ElementGroupsMembers {
    return iModel.linkTableRelationships.createInstance({ sourceId, targetId, memberPriority, classFullName }) as ElementGroupsMembers;
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
  public status!: number;
  public priority!: number;

  /** @hidden */
  constructor(props: ElementDrivesElementProps, iModel: IModelDb) { super(props, iModel); }

  /** Create an instance of the ElementDrivesElement relationship.
   * @param iModel The iModel that will contain the relationship
   * @param sourceId The sourceId of the relationship, that is, the driver element
   * @param targetId The targetId of the relationship, that is, the driven element
   * @param classFullName The full name of the ElementDrivesElement class. Must be specified to create an instance of a derived class. May be omitted to create an instance of the ElementDrivesElement base class.
   * @return an instance of the specified class.
   */
  public static create(iModel: IModelDb, sourceId: Id64, targetId: Id64, priority: number = 0, classFullName: string = ElementDrivesElement.classFullName): ElementDrivesElement {
    return iModel.linkTableRelationships.createInstance({ sourceId, targetId, priority, classFullName }) as ElementDrivesElement;
  }
}

/** Specifies the source and target elements of a [[IModelDbLinkTableRelationships]] instance. */
export interface SourceAndTarget {
  sourceId: Id64;
  targetId: Id64;
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
  public createInstance(elProps: LinkTableRelationshipProps): LinkTableRelationship { return this._iModel.constructEntity(elProps) as LinkTableRelationship; }

  /**
   * Insert a new relationship instance into the iModel.
   * @param props The properties of the new relationship instance.
   * @returns The Id of the newly inserted relationship instance.
   * @note The id property of the props object is set as a side effect of this function.
   * @throws [[IModelError]] if unable to insert the relationship instance.
   */
  public insertInstance(props: LinkTableRelationshipProps): Id64 {
    if (!this._iModel.briefcase)
      throw this._iModel.newNotOpenError();

    const { error, result } = this._iModel.briefcase.nativeDb.insertLinkTableRelationship(JSON.stringify(props));
    if (error)
      throw new IModelError(error.status, "Problem inserting relationship instance", Logger.logWarning, loggingCategory);

    props.id = new Id64(result);
    return props.id;
  }

  /**
   * Update the properties of an existing relationship instance in the iModel.
   * @param props the properties of the relationship instance to update. Any properties that are not present will be left unchanged.
   * @throws [[IModelError]] if unable to update the relationship instance.
   */
  public updateInstance(props: LinkTableRelationshipProps): void {
    if (!this._iModel.briefcase)
      throw this._iModel.newNotOpenError();

    const error: DbResult = this._iModel.briefcase.nativeDb.updateLinkTableRelationship(JSON.stringify(props));
    if (error !== DbResult.BE_SQLITE_OK)
      throw new IModelError(error, "", Logger.logWarning, loggingCategory);
  }

  /**
   * Delete an relationship instance from this iModel.
   * @param id The Id of the relationship instance to be deleted
   * @throws [[IModelError]]
   */
  public deleteInstance(props: LinkTableRelationshipProps): void {
    if (!this._iModel.briefcase)
      throw this._iModel.newNotOpenError();

    const error: DbResult = this._iModel.briefcase.nativeDb.deleteLinkTableRelationship(JSON.stringify(props));
    if (error !== DbResult.BE_SQLITE_DONE)
      throw new IModelError(error, "", Logger.logWarning, loggingCategory);
  }

  /** get the props of a relationship instance */
  private getInstanceProps(relClassSqlName: string, criteria: Id64 | SourceAndTarget): LinkTableRelationshipProps {
    if (criteria instanceof Id64) {
      return this._iModel.withPreparedStatement("SELECT * FROM " + relClassSqlName + " WHERE ecinstanceid=?", (stmt: ECSqlStatement) => {
        stmt.bindId(1, criteria);
        if (DbResult.BE_SQLITE_ROW !== stmt.step())
          throw new IModelError(IModelStatus.NotFound);
        return stmt.getRow() as LinkTableRelationshipProps;
      });
    }

    return this._iModel.withPreparedStatement("SELECT * FROM " + relClassSqlName + " WHERE SourceECInstanceId=? AND TargetECInstanceId=?", (stmt: ECSqlStatement) => {
      stmt.bindId(1, criteria.sourceId);
      stmt.bindId(2, criteria.targetId);
      if (DbResult.BE_SQLITE_ROW !== stmt.step())
        throw new IModelError(IModelStatus.NotFound);
      return stmt.getRow() as LinkTableRelationshipProps;
    });
  }

  /** get a relationship instance */
  public getInstance(relClassSqlName: string, criteria: Id64 | SourceAndTarget): LinkTableRelationship {
    const props = this.getInstanceProps(relClassSqlName, criteria);
    props.classFullName = props.className.replace(".", ":");
    if (props.sourceClassName !== undefined)
      props.sourceClassName = props.sourceClassName.replace(".", ":");
    if (props.targetClassName !== undefined)
      props.targetClassName = props.targetClassName.replace(".", ":");
    return this._iModel.constructEntity(props) as LinkTableRelationship;
  }
}
