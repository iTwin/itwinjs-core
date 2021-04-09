/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Relationships
 */

import { DbOpcode, DbResult, Id64, Id64String, Logger } from "@bentley/bentleyjs-core";
import { IModelError, IModelStatus, RelationshipProps, SourceAndTarget } from "@bentley/imodeljs-common";
import { BackendLoggerCategory } from "./BackendLoggerCategory";
import { ECSqlStatement } from "./ECSqlStatement";
import { Entity } from "./Entity";
import { IModelDb } from "./IModelDb";

export { SourceAndTarget, RelationshipProps } from "@bentley/imodeljs-common"; // for backwards compatibility

const loggerCategory = BackendLoggerCategory.Relationship;

/** Base class for all link table ECRelationships
 * @public
 */
export class Relationship extends Entity implements RelationshipProps {
  /** @internal */
  public static get className(): string { return "Relationship"; }
  public readonly sourceId: Id64String;
  public readonly targetId: Id64String;

  /** @internal */
  constructor(props: RelationshipProps, iModel: IModelDb) {
    super(props, iModel);
    this.sourceId = Id64.fromJSON(props.sourceId);
    this.targetId = Id64.fromJSON(props.targetId);
  }

  /** @internal */
  public toJSON(): RelationshipProps {
    const val = super.toJSON() as RelationshipProps;
    val.sourceId = this.sourceId;
    val.targetId = this.targetId;
    return val;
  }

  /**
   * Callback invoked by saveChanges on an ElementDrivesElement relationship when either its input or output has changed or is the output of an upstream relationship.
   * This callback is invoked after the input element has been processed by upstream relationships.
   * A subclass of ElementDrivesElement can re-implement this static method to take some action. onRootChanged may modify the output element only.
   * @param _props The ElementDrivesElement relationship instance.
   * @param _iModel The iModel
   */
  public static onRootChanged(_props: RelationshipProps, _iModel: IModelDb): void { }

  /**
   * Callback invoked by saveChanges on an ElementDrivesElement relationship when targets the same element as some other ElementDrivesElement relationship.
   * A subclass of ElementDrivesElement can re-implement this static method to verify that the the output element is in an acceptable state. This prevents
   * one relationship from disturbing the results of another.
   * This callback is invoked after all relationships have received their onRootChanged callbacks and the output elements are supposed to be in their final state.
   * @param _props The ElementDrivesElement relationship instance.
   * @param _iModel The iModel
   */
  public static onValidateOutput(_props: RelationshipProps, _iModel: IModelDb): void { }

  /**
   * Callback invoked by saveChanges on an ElementDrivesElement relationship when the relationship instance has been deleted.
   * A subclass of ElementDrivesElement can re-implement this static method to take some action.
   * @param _props The deleted ElementDrivesElement relationship instance.
   * @param _iModel The iModel
   */
  public static onDeletedDependency(_props: RelationshipProps, _iModel: IModelDb): void { }

  /** Insert this Relationship into the iModel. */
  public insert(): Id64String { return this.iModel.relationships.insertInstance(this); }
  /** Update this Relationship in the iModel. */
  public update() { this.iModel.relationships.updateInstance(this); }
  /** Delete this Relationship from the iModel. */
  public delete() { this.iModel.relationships.deleteInstance(this); }

  public static getInstance<T extends Relationship>(iModel: IModelDb, criteria: Id64String | SourceAndTarget): T { return iModel.relationships.getInstance(this.classFullName, criteria); }

  /** Add a request for the locks that would be needed to carry out the specified operation.
   * @param opcode The operation that will be performed on the Relationship instance.
   */
  public buildConcurrencyControlRequest(opcode: DbOpcode): void {
    if (this.iModel.isBriefcaseDb()) {
      this.iModel.concurrencyControl.buildRequestForRelationship(this, opcode);
    }
  }
}

/** A Relationship where one Element refers to another Element
 * @public
 */
export class ElementRefersToElements extends Relationship {
  /** @internal */
  public static get className(): string { return "ElementRefersToElements"; }
  /** Create an instance of the Relationship.
   * @param iModel The iModel that will contain the relationship
   * @param sourceId The sourceId of the relationship, that is, the driver element
   * @param targetId The targetId of the relationship, that is, the driven element
   * @return an instance of the specified class.
   */
  public static create<T extends ElementRefersToElements>(iModel: IModelDb, sourceId: Id64String, targetId: Id64String): T {
    return iModel.relationships.createInstance({ sourceId, targetId, classFullName: this.classFullName }) as T;
  }
  /** Insert a new instance of the Relationship.
   * @param iModel The iModel that will contain the relationship
   * @param sourceId The sourceId of the relationship, that is, the driver element
   * @param targetId The targetId of the relationship, that is, the driven element
   * @return The Id of the inserted Relationship.
   */
  public static insert<T extends ElementRefersToElements>(iModel: IModelDb, sourceId: Id64String, targetId: Id64String): Id64String {
    const relationship: T = this.create(iModel, sourceId, targetId);
    return iModel.relationships.insertInstance(relationship);
  }
}

/** Relates a [[DrawingGraphic]] to the [[Element]] that it represents
 * @public
 */
export class DrawingGraphicRepresentsElement extends ElementRefersToElements {
  /** @internal */
  public static get className(): string { return "DrawingGraphicRepresentsElement"; }
}

/** Relates a [[GraphicalElement3d]] to the [[Element]] that it represents
 * @public
 */
export class GraphicalElement3dRepresentsElement extends ElementRefersToElements {
  /** @internal */
  public static get className(): string { return "GraphicalElement3dRepresentsElement"; }
}

/** Relates a [[SynchronizationConfigLink]] to N [[ExternalSource]] instances.
 * Each relationship instance represents an external source processed by the synchronization configuration.
 * @note The associated ECClass was added to the BisCore schema in version 1.0.13
 * @beta
 */
export class SynchronizationConfigProcessesSources extends ElementRefersToElements {
  /** @internal */
  public static get className(): string { return "SynchronizationConfigProcessesSources"; }
}

/** Relates a [[SynchronizationConfigLink]] to *root* [[ExternalSource]] instances.
 * @note The associated ECClass was added to the BisCore schema in version 1.0.13
 * @beta
 */
export class SynchronizationConfigSpecifiesRootSources extends SynchronizationConfigProcessesSources {
  /** @internal */
  public static get className(): string { return "SynchronizationConfigSpecifiesRootSources"; }
}

/** Properties that are common to all types of link table ECRelationships
 * @public
 */
export interface ElementGroupsMembersProps extends RelationshipProps {
  memberPriority: number;
}

/** An ElementRefersToElements relationship where one Element *groups* a set of other Elements.
 * @public
 */
export class ElementGroupsMembers extends ElementRefersToElements {
  /** @internal */
  public static get className(): string { return "ElementGroupsMembers"; }
  public memberPriority: number;

  constructor(props: ElementGroupsMembersProps, iModel: IModelDb) {
    super(props, iModel);
    this.memberPriority = props.memberPriority;
  }

  public static create<T extends ElementRefersToElements>(iModel: IModelDb, sourceId: Id64String, targetId: Id64String, memberPriority: number = 0): T {
    const props: ElementGroupsMembersProps = { sourceId, targetId, memberPriority, classFullName: this.classFullName };
    return iModel.relationships.createInstance(props) as T;
  }
}

/** Relates a [[DefinitionGroup]] to its [[DefinitionElement]] members.
 * @note The associated ECClass was added to the BisCore schema in version 1.0.10
 * @public
 */
export class DefinitionGroupGroupsDefinitions extends ElementGroupsMembers {
  /** @internal */
  public static get className(): string { return "DefinitionGroupGroupsDefinitions"; }
}

/** Represents group membership where the group Element (and its properties) impart information about the member Elements above mere membership.
 * Implies that properties of the group should be considered as properties of its members.
 * @note The associated ECClass was added to the BisCore schema in version 1.0.11
 * @public
 */
export class GroupImpartsToMembers extends ElementGroupsMembers {
  /** @internal */
  public static get className(): string { return "GroupImpartsToMembers"; }
}

/** Relates an [[ExternalSourceGroup]] to its [[ExternalSource]] members.
 * @note The associated ECClass was added to the BisCore schema in version 1.0.13
 * @beta
 */
export class ExternalSourceGroupGroupsSources extends ElementGroupsMembers {
  /** @internal */
  public static get className(): string { return "ExternalSourceGroupGroupsSources"; }
}

/** Properties that are common to all types of ElementDrivesElements
 * @beta
 */
export interface ElementDrivesElementProps extends RelationshipProps {
  status: number;
  priority: number;
}

/** A Relationship indicating that one Element *drives* another Element.
 * Using ElementDrivesElements, an app can create and store a graph of dependencies between elements in an iModel.
 * An ElementDrivesElement relationship indicates a one-way driving relationship from the source to the target.
 * When the input to an ElementDrivesElement relationship changes, the ElementDrivesElement itself can get a callback, and both the input and output elements can get callbacks.
 *
 * For example, to make element e1 drive element e2, create a relationship between them like this:
 * ```ts
 *  const ede = ElementDrivesElement.create(iModel, e1id, e2id);
 *  ede.insert();
 * ```
 * All of the ElementDrivesElement relationships in an iModel make up a graph.
 * You could create many such relationships to define a more complex graph like this, for example:
 * ```
 *       e21
 *          \
 * e1 --> e2 --> e3 --> e4
 *    /
 * e11
 * ```
 * This graph has the following ElementDrivesElement relationships:
 * * e1 -> e2
 * * e11 -> e2
 * * e2 -> e3
 * * e21 -> e3
 * * e3 -> e4
 *
 * Callbacks:
 * Callbacks are invoked by BriefcaseDb.saveChanges to notify handlers about changes.
 * They are invoked in dependency (topological) order.
 *
 * The following callbacks are invoked in an ElementDrivesElement relationship class:
 * * onRootChanged
 * * onValidateOutput
 * * onDeletedDependency
 * Note that these are static methods. Their default implementations do nothing.
 * To receive and act on these callbacks, and app should define a subclass of ElementDrivesElement and use that to create relationships.
 * The subclass should then implement any of the callbacks listed above that it would like to act on.
 *
 * A ElementDrivesElement callback is expected to make changes to the output element only!
 *
 * Input and output elements can also receive callbacks. See
 * * Element.onDirectChangeHandled
 * * Element.onBeforeOutputsHandled
 * * Element.onAllInputsHandled
 *
 * These are static methods that an Element subclass may re-implement.
 *
 * The ElementDrivesElement are the "edges" of the graph, and the Elements are the "nodes".
 *
 * Note that while an ElementDrivesElement relationship is between one input element and one output element, there is no limit to how
 * many inputs can flow into a given element or how many outputs can flow out of it. By implementing callbacks on elements,
 * you can define many:many driving relationships.
 *
 * @beta
 */
export class ElementDrivesElement extends Relationship implements ElementDrivesElementProps {
  /** @internal */
  public static get className(): string { return "ElementDrivesElement"; }
  public status: number;
  public priority: number;

  /** @internal */
  constructor(props: ElementDrivesElementProps, iModel: IModelDb) {
    super(props, iModel);
    this.status = props.status;
    this.priority = props.priority;
  }

  public static create<T extends ElementRefersToElements>(iModel: IModelDb, sourceId: Id64String, targetId: Id64String, priority: number = 0): T {
    const props: ElementDrivesElementProps = { sourceId, targetId, priority, status: 0, classFullName: this.classFullName };
    return iModel.relationships.createInstance(props) as T;
  }
}

/** Manages [[Relationship]]s.
 * @public
 */
export class Relationships {
  private _iModel: IModelDb;

  /** @internal */
  constructor(iModel: IModelDb) { this._iModel = iModel; }

  /** Create a new instance of a Relationship.
   * @param props The properties of the new Relationship.
   * @throws [[IModelError]] if there is a problem creating the Relationship.
   */
  public createInstance(props: RelationshipProps): Relationship { return this._iModel.constructEntity<Relationship>(props); }

  /** Check classFullName to ensure it is a link table relationship class. */
  private checkRelationshipClass(classFullName: string) {
    if (!this._iModel.nativeDb.isLinkTableRelationship(classFullName.replace(".", ":"))) {
      throw new IModelError(DbResult.BE_SQLITE_ERROR, `Class '${classFullName}' must be a relationship class and it should be subclass of BisCore:ElementRefersToElements or BisCore:ElementDrivesElement.`, Logger.logWarning, loggerCategory);
    }
  }

  /** Insert a new relationship instance into the iModel. The relationship provided must be subclass of BisCore:ElementRefersToElements or BisCore:ElementDrivesElement.
   * @param props The properties of the new relationship.
   * @returns The Id of the newly inserted relationship.
   * @note The id property of the props object is set as a side effect of this function.
   * @throws [[IModelError]] if unable to insert the relationship instance.
   */
  public insertInstance(props: RelationshipProps): Id64String {
    this.checkRelationshipClass(props.classFullName);
    const val = this._iModel.nativeDb.insertLinkTableRelationship(props);
    if (val.error)
      throw new IModelError(val.error.status, "Error inserting relationship instance", Logger.logWarning, loggerCategory);

    props.id = Id64.fromJSON(val.result);
    return props.id;
  }

  /** Update the properties of an existing relationship instance in the iModel.The relationship provided must be subclass of BisCore:ElementRefersToElements or BisCore:ElementDrivesElement.
   * @param props the properties of the relationship instance to update. Any properties that are not present will be left unchanged.
   * @throws [[IModelError]] if unable to update the relationship instance.
   */
  public updateInstance(props: RelationshipProps): void {
    this.checkRelationshipClass(props.classFullName);
    const error = this._iModel.nativeDb.updateLinkTableRelationship(props);
    if (error !== DbResult.BE_SQLITE_OK)
      throw new IModelError(error, "Error updating relationship instance", Logger.logWarning, loggerCategory);
  }

  /** Delete an Relationship instance from this iModel.The relationship provided must be subclass of BisCore:ElementRefersToElements or BisCore:ElementDrivesElement.
   * @param id The Id of the Relationship to be deleted
   * @throws [[IModelError]]
   */
  public deleteInstance(props: RelationshipProps): void {
    this.checkRelationshipClass(props.classFullName);
    const error = this._iModel.nativeDb.deleteLinkTableRelationship(props);
    if (error !== DbResult.BE_SQLITE_DONE)
      throw new IModelError(error, "", Logger.logWarning, loggerCategory);
  }

  /** Get the props of a Relationship instance
   * @param relClassFullName The full class name of the relationship in the form of "schema:class"
   * @param criteria Either the relationship instanceId or the source and target Ids
   * @throws [IModelError]($common) if the relationship is not found or cannot be loaded.
   * @see tryGetInstanceProps
   */
  public getInstanceProps<T extends RelationshipProps>(relClassFullName: string, criteria: Id64String | SourceAndTarget): T {
    const relationshipProps = this.tryGetInstanceProps<T>(relClassFullName, criteria);
    if (undefined === relationshipProps) {
      throw new IModelError(IModelStatus.NotFound, "Relationship not found", Logger.logWarning, loggerCategory);
    }
    return relationshipProps;
  }

  /** Get the props of a Relationship instance
   * @param relClassFullName The full class name of the relationship in the form of "schema:class"
   * @param criteria Either the relationship instanceId or the source and target Ids
   * @returns The RelationshipProps or `undefined` if the relationship is not found.
   * @note Useful for cases when a relationship may or may not exist and throwing an `Error` would be overkill.
   * @see getInstanceProps
   */
  public tryGetInstanceProps<T extends RelationshipProps>(relClassFullName: string, criteria: Id64String | SourceAndTarget): T | undefined {
    let props: T | undefined;
    if (typeof criteria === "string") {
      props = this._iModel.withPreparedStatement(`SELECT * FROM ${relClassFullName} WHERE ecinstanceid=?`, (stmt: ECSqlStatement) => {
        stmt.bindId(1, criteria);
        return DbResult.BE_SQLITE_ROW === stmt.step() ? stmt.getRow() as T : undefined;
      });
    } else {
      props = this._iModel.withPreparedStatement(`SELECT * FROM ${relClassFullName} WHERE SourceECInstanceId=? AND TargetECInstanceId=?`, (stmt: ECSqlStatement) => {
        stmt.bindId(1, criteria.sourceId);
        stmt.bindId(2, criteria.targetId);
        return DbResult.BE_SQLITE_ROW === stmt.step() ? stmt.getRow() as T : undefined;
      });
    }
    if (undefined !== props) {
      props.classFullName = (props as any).className.replace(".", ":");
    }
    return props;
  }

  /** Get a Relationship instance
   * @param relClassFullName The full class name of the relationship in the form of "schema:class"
   * @param criteria Either the relationship instanceId or the source and target Ids
   * @throws [IModelError]($common) if the relationship is not found or cannot be loaded.
   * @see tryGetInstance
   */
  public getInstance<T extends Relationship>(relClassSqlName: string, criteria: Id64String | SourceAndTarget): T {
    return this._iModel.constructEntity<T>(this.getInstanceProps(relClassSqlName, criteria));
  }

  /** Get a Relationship instance
   * @param relClassFullName The full class name of the relationship in the form of "schema:class"
   * @param criteria Either the relationship instanceId or the source and target Ids
   * @returns The relationship or `undefined` if the relationship is not found.
   * @note Useful for cases when a relationship may or may not exist and throwing an `Error` would be overkill.
   * @see getInstance
   */
  public tryGetInstance<T extends Relationship>(relClassFullName: string, criteria: Id64String | SourceAndTarget): T | undefined {
    const relationshipProps = this.tryGetInstanceProps<T>(relClassFullName, criteria);
    return undefined !== relationshipProps ? this._iModel.constructEntity<T>(relationshipProps) : undefined;
  }
}
