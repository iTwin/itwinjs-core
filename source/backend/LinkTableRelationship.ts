/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Entity } from "./Entity";
import { IModelDb } from "./IModelDb";
import { EntityProps } from "../common/EntityProps";
import { Id64 } from "@bentley/bentleyjs-core/lib/Id";
import { assert, IModelError, IModelStatus } from "../common/IModelError";
import { Logger } from "@bentley/bentleyjs-core/lib/Logger";
import { BriefcaseManager } from "./BriefcaseManager";
import { DbOpcode, DbResult } from "@bentley/bentleyjs-core/lib/BeSQLite";
import { ECSqlStatement } from "./ECSqlStatement";

/** Properties that are common to all types of link table ECRelationships */
export interface LinkTableRelationshipProps extends EntityProps {
  sourceId: Id64;
  targetId: Id64;
  sourceClassName?: string;
  targetClassName?: string;
}

/** Base class for all link table ECRelationships */
export class LinkTableRelationship extends Entity implements LinkTableRelationshipProps {
  public readonly sourceId: Id64; // Warning: Do not change these property names. They must match the internal names that EC/ECSql assigns to source and target.
  public readonly targetId: Id64;
  public readonly sourceClassName?: string;
  public readonly targetClassName?: string;

  protected constructor(props: LinkTableRelationshipProps, iModel: IModelDb) {
    super(props, iModel);
    this.id = Id64.fromJSON(props.id);
    this.sourceId = props.sourceId;
    this.targetId = props.targetId;
    if (props.sourceClassName !== undefined)
      this.sourceClassName = props.sourceClassName;
    if (props.targetClassName !== undefined)
      this.targetClassName = props.targetClassName;
  }

  public toJSON(): LinkTableRelationshipProps {
    const val = super.toJSON() as LinkTableRelationshipProps;
    if (this.id !== undefined)
      val.id = this.id;
    if (this.sourceId !== undefined)
      val.sourceId = this.sourceId;
    if (this.targetId !== undefined)
      val.targetId = this.targetId;
    if (this.sourceClassName !== undefined)
      val.sourceClassName = this.sourceClassName;
    if (this.targetClassName !== undefined)
      val.targetClassName = this.targetClassName;
    return val;
    }

  // TODO: Expose properties for 'strength' and 'direction'

 /**
  * Add the resource request that would be needed in order to carry out the specified operation.
  * @param req The request object, which accumulates requests.
  * @param opcode The operation that will be performed on the LinkTableRelationship instance.
  */
  public buildResourcesRequest(req: BriefcaseManager.ResourcesRequest, opcode: DbOpcode): void {
    this.iModel.buildResourcesRequestForLinkTableRelationship(req, this, opcode);
  }
}

 /**
  * BisCore:ElementRefersToElements
  */
export class ElementRefersToElements extends LinkTableRelationship {

  /** @hidden */
  constructor(props: LinkTableRelationshipProps, iModel: IModelDb) {
    super(props, iModel);
  }

  /** Create an instance of the ElementRefersToElements relationship.
   * @param iModel The iModel that will contain the relationship
   * @param sourceIn The sourceId of the relationship, that is, the driver element
   * @param targetIn The targetId of teh relationship, that is, the driven element
   * @param fullClassNameIn The full name of the ElementRefersToElements class. Must be specified in order to create an instance of a derived class. May be omitted to create an instance of the ElementRefersToElements base class.
   * @return an instance of the specified class.
   */
  public static create(iModel: IModelDb, sourceIn: Id64, targetIn: Id64, fullClassNameIn: string = "BisCore:ElementRefersToElements"): ElementRefersToElements {
    return iModel.linkTableRelationships.createInstance({
      sourceId: sourceIn,
      targetId: targetIn,
      classFullName: fullClassNameIn,
      id: new Id64(),
    }) as ElementRefersToElements;
  }
}

/** Properties that are common to all types of link table ECRelationships */
export interface ElementGroupsMembersProps extends LinkTableRelationshipProps {
  memberPriority: number;
}

 /**
  * BisCore:ElementGroupsMembers
  */
export class ElementGroupsMembers extends ElementRefersToElements {
  public memberPriority: number;

  /** @hidden */
  constructor(props: ElementGroupsMembersProps, iModel: IModelDb) {
    super(props, iModel);
  }

  /** Create an instance of the ElementGroupsMembers relationship.
   * @param iModel The iModel that will contain the relationship
   * @param sourceIn The sourceId of the relationship, that is, the driver element
   * @param targetIn The targetId of teh relationship, that is, the driven element
   * @param fullClassNameIn The full name of the ElementGroupsMembers class. Must be specified in order to create an instance of a derived class. May be omitted to create an instance of the ElementGroupsMembers base class.
   * @return an instance of the specified class.
   */
  public static create(iModel: IModelDb, sourceIn: Id64, targetIn: Id64, fullClassNameIn: string = "BisCore:ElementGroupsMembers", memberPriorityIn: number = 0): ElementGroupsMembers {
    return iModel.linkTableRelationships.createInstance({
      sourceId: sourceIn,
      targetId: targetIn,
      memberPriority: memberPriorityIn,
      classFullName: fullClassNameIn,
      id: new Id64(),
    }) as ElementGroupsMembers;
  }
}

/** Properties that are common to all types of ElementDrivesElements */
export interface ElementDrivesElementProps extends LinkTableRelationshipProps {
  status: number;
  priority: number;
}

 /**
  * BisCore:ElementDrivesElement
  */
export class ElementDrivesElement extends LinkTableRelationship implements ElementDrivesElementProps {

  public status: number;
  public priority: number;

  /** @hidden */
  constructor(props: ElementDrivesElementProps, iModel: IModelDb) {
    super(props, iModel);
  }

  /** Create an instance of the ElementDrivesElement relationship.
   * @param iModel The iModel that will contain the relationship
   * @param sourceIn The sourceId of the relationship, that is, the driver element
   * @param targetIn The targetId of teh relationship, that is, the driven element
   * @param fullClassNameIn The full name of the ElementDrivesElement class. Must be specified in order to create an instance of a derived class. May be omitted to create an instance of the ElementDrivesElement base class.
   * @return an instance of the specified class.
   */
  public static create(iModel: IModelDb, sourceIn: Id64, targetIn: Id64, priorityIn: number = 0, fullClassNameIn: string = "BisCore:ElementDrivesElement"): ElementDrivesElement {
    return iModel.linkTableRelationships.createInstance({
      sourceId: sourceIn,
      targetId: targetIn,
      priority: priorityIn,
      status: 0,
      classFullName: fullClassNameIn,
      id: new Id64(),
    }) as ElementDrivesElement;
  }
}

export interface SourceAndTarget {
  sourceId: Id64;
  targetId: Id64;
}

export class IModelDbLinkTableRelationships {
  private _iModel: IModelDb;

  /** @hidden */
  public constructor(iModel: IModelDb) { this._iModel = iModel; }

  /**
   * Create a new instance of a LinkTableRelationship.
   * @param props The properties of the new LinkTableRelationship.
   * @throws [[IModelError]] if there is a problem creating the eleLinkTableRelationshipment.
   */
  public createInstance(elProps: LinkTableRelationshipProps): LinkTableRelationship {
    const rel: LinkTableRelationship = this._iModel.constructEntity(elProps) as LinkTableRelationship;
    assert(rel instanceof LinkTableRelationship);
    return rel;
  }

  /**
   * Insert a new relationship instance into the iModel.
   * @param props The properties of the new relationship instance.
   * @returns The Id of the newly inserted relationship instance.
   * @remarks The id property of the props object is set as a side effect of this function.
   * @throws [[IModelError]] if unable to insert the relationship instance.
   */
  public insertInstance(props: LinkTableRelationshipProps): Id64 {
    if (!this._iModel.briefcaseInfo)
      throw this._iModel._newNotOpenError();

    const { error, result: json } = this._iModel.briefcaseInfo.nativeDb.insertLinkTableRelationship(JSON.stringify(props));
    if (error)
      throw new IModelError(error.status, "Problem inserting relationship instance", Logger.logWarning);

    props.id = new Id64(json);
    return props.id;
  }

  /**
   * Update the properties of an existing relationship instance in the iModel.
   * @param props the properties of the relationship instance to update. Any properties that are not present will be left unchanged.
   * @throws [[IModelError]] if unable to update the relationship instance.
   */
  public updateInstance(props: LinkTableRelationshipProps): void {
    if (!this._iModel.briefcaseInfo)
      throw this._iModel._newNotOpenError();

    const error: DbResult = this._iModel.briefcaseInfo.nativeDb.updateLinkTableRelationship(JSON.stringify(props));
    if (error !== DbResult.BE_SQLITE_OK)
      throw new IModelError(error, "", Logger.logWarning);
  }

  /**
   * Delete an relationship instance from this iModel.
   * @param id The Id of the relationship instance to be deleted
   * @throws [[IModelError]]
   */
  public deleteInstance(props: LinkTableRelationshipProps): void {
    if (!this._iModel.briefcaseInfo)
      throw this._iModel._newNotOpenError();

    const error: DbResult = this._iModel.briefcaseInfo.nativeDb.deleteLinkTableRelationship(JSON.stringify(props));
    if (error !== DbResult.BE_SQLITE_DONE)
      throw new IModelError(error, "", Logger.logWarning);
  }

  /** get the props of a relationship instance */
  private getInstanceProps(relClassSqlName: string, criteria: Id64 | SourceAndTarget): LinkTableRelationshipProps {

    if (criteria instanceof Id64) {

      return this._iModel.withPreparedStatement("SELECT * FROM " + relClassSqlName + " WHERE ecinstanceid=?", (stmt: ECSqlStatement) => {
        stmt.bindValues([criteria as Id64]);
        if (DbResult.BE_SQLITE_ROW !== stmt.step())
          throw new IModelError(IModelStatus.NotFound);
        return stmt.getRow() as LinkTableRelationshipProps;
      });

    }

    if ("sourceId" in criteria && "targetId" in criteria) {

      const st: SourceAndTarget = criteria as SourceAndTarget;
      return this._iModel.withPreparedStatement("SELECT * FROM " + relClassSqlName + " WHERE SourceECInstanceId=? AND TargetECInstanceId=?", (stmt: ECSqlStatement) => {
        stmt.bindValues([st.sourceId, st.targetId]);
        if (DbResult.BE_SQLITE_ROW !== stmt.step())
          throw new IModelError(IModelStatus.NotFound);
        return stmt.getRow() as LinkTableRelationshipProps;
      });
    }

    throw new IModelError(IModelStatus.BadArg);
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
