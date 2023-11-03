/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Elements
 */

import { DbResult, Id64String, IModelStatus, RepositoryStatus } from "@itwin/core-bentley";
import { ChannelRootAspectProps, IModel, IModelError } from "@itwin/core-common";
import { Subject } from "./Element";
import { IModelDb } from "./IModelDb";

/** The key for a compartment. Used for "allowed compartments" in [[CompartmentControl]]
 * @beta
 */
export type CompartmentKey = string;

/** @internal */
export interface CompartmentControl {
  /** Determine whether this [[IModelDb]] has any compartments in it. */
  get hasCompartments(): boolean;
  /** Add a new compartment to the list of allowed compartments of the [[IModelDb]] for this session.
   * @param compartmentKey The key for the compartment to become editable in this session.
   */
  addAllowedCompartment(compartmentKey: CompartmentKey): void;
  /** Remove a compartment from the list of allowed compartments of the [[IModelDb]] for this session.
   * @param compartmentKey The key of the compartment that should no longer be editable in this session.
   */
  removeAllowedCompartment(compartmentKey: CompartmentKey): void;
  /** Get the compartmentKey of the compartment for an element by ElementId.
   * @throws if the element does not exist
   */
  getCompartmentKey(elementId: Id64String): CompartmentKey;
  /** Make an existing element a new Compartment root.
   * @note if the element is already in a compartment, this will throw an error.
   */
  makeCompartmentRoot(args: { elementId: Id64String, compartmentKey: CompartmentKey }): void;
  /** Insert a new Subject element that is a Compartment root in this iModel.
   * @returns the ElementId of the new Subject element.
   * @note if the parentSubject element is already in a compartment, this will add the Subject element and then throw an error without making it a Compartment root.
   */
  insertCompartmentSubject(args: {
    /** The name of the new Subject element */
    subjectName: string;
    /** The compartment key for the new [[Subject]]. This is the string to pass to [[addAllowedCompartment]]*/
    compartmentKey: CompartmentKey;
    /** the Id of the parent of the new Subject. Default is [[IModel.rootSubjectId]]. */
    parentSubjectId?: Id64String;
    /** Optional description for new Subject. */
    description?: string;
  }): Id64String;

  /** @internal */
  verifyCompartment(modelId: Id64String): void;

  /** @deprecated in 4.3 use CompartmentControl
   * @internal
   */
  get hasChannels(): boolean;
  /** @deprecated in 4.3 use CompartmentControl
   * @internal
   */
  addAllowedChannel(channelKey: CompartmentKey): void;
  /** @deprecated in 4.3 use CompartmentControl
   * @internal
   */
  removeAllowedChannel(channelKey: CompartmentKey): void;
  /** @deprecated in 4.3 use CompartmentControl
   * @internal
   */
  getChannelKey(elementId: Id64String): CompartmentKey;
  /** @deprecated in 4.3 use CompartmentControl
   * @internal
   */
  makeChannelRoot(args: { elementId: Id64String, channelKey: CompartmentKey }): void;
  /** @deprecated in 4.3 use CompartmentControl
   * @internal
   */
  insertChannelSubject(args: { subjectName: string, channelKey: CompartmentKey, parentSubjectId?: Id64String, description?: string }): Id64String;
}

/** @beta */
export namespace CompartmentControl {
  /** the name of the special "shared" compartment holding information that is editable by any application. */
  export const sharedCompartmentName = "shared";
}

/** @internal */
export class CompartmentAdmin implements CompartmentControl {
  public static readonly sharedCompartment = "shared";
  public static readonly compartmentClassName = "bis:ChannelRootAspect";
  private _allowedCompartments = new Set<CompartmentKey>();
  private _allowedModels = new Set<Id64String>();
  private _deniedModels = new Map<Id64String, CompartmentKey>();
  private _hasCompartments?: boolean;

  public constructor(private _iModel: IModelDb) {
    this._allowedCompartments.add(CompartmentControl.sharedCompartmentName);
  }
  public addAllowedCompartment(compartmentKey: CompartmentKey) {
    this._allowedCompartments.add(compartmentKey);
    this._deniedModels.clear();
  }
  public removeAllowedCompartment(compartmentKey: CompartmentKey) {
    this._allowedCompartments.delete(compartmentKey);
    this._allowedModels.clear();
  }
  public get hasCompartments(): boolean {
    if (undefined === this._hasCompartments) {
      try {
        this._hasCompartments = this._iModel.withStatement(`SELECT 1 FROM ${CompartmentAdmin.compartmentClassName}`, (stmt) => stmt.step() === DbResult.BE_SQLITE_ROW, false);
      } catch (e) {
        // iModel doesn't have compartment class in its BIS schema
        this._hasCompartments = false;
      }
    }
    return this._hasCompartments;
  }
  public getCompartmentKey(elementId: Id64String): CompartmentKey {
    if (!this.hasCompartments || elementId === IModel.rootSubjectId)
      return CompartmentControl.sharedCompartmentName;

    const compartment = this._iModel.withPreparedStatement(`SELECT Owner FROM ${CompartmentAdmin.compartmentClassName} WHERE Element.Id=?`, (stmt) => {
      stmt.bindId(1, elementId);
      return DbResult.BE_SQLITE_ROW === stmt.step() ? stmt.getValue(0).getString() : undefined;
    });
    if (compartment !== undefined)
      return compartment;
    const parentId = this._iModel.withPreparedSqliteStatement("SELECT ParentId,ModelId FROM bis_Element WHERE id=?", (stmt) => {
      stmt.bindId(1, elementId);
      if (DbResult.BE_SQLITE_ROW !== stmt.step())
        throw new IModelError(IModelStatus.NotFound, "Element does not exist");
      return stmt.getValueId(0) ?? stmt.getValueId(1); // if parent is undefined, use modelId
    });
    return this.getCompartmentKey(parentId);
  }
  public verifyCompartment(modelId: Id64String): void {
    // Note: indirect changes are permitted to change any compartment
    if (!this.hasCompartments || this._allowedModels.has(modelId) || this._iModel.nativeDb.isIndirectChanges())
      return;

    const deniedCompartment = this._deniedModels.get(modelId);
    if (undefined !== deniedCompartment)
      throw new IModelError(RepositoryStatus.CompartmentConstraintViolation, `compartment "${deniedCompartment}" is not allowed`);

    const compartment = this.getCompartmentKey(modelId);
    if (this._allowedCompartments.has(compartment)) {
      this._allowedModels.add(modelId);
      return;
    }
    this._deniedModels.set(modelId, compartment);
    return this.verifyCompartment(modelId);
  }
  public makeCompartmentRoot(args: { elementId: Id64String, compartmentKey: CompartmentKey }) {
    if (CompartmentControl.sharedCompartmentName !== this.getCompartmentKey(args.elementId))
      throw new Error("compartments may not nest");

    const props: ChannelRootAspectProps = { classFullName: CompartmentAdmin.compartmentClassName, element: { id: args.elementId }, owner: args.compartmentKey };
    this._iModel.elements.insertAspect(props);
    this._hasCompartments = true;
  }
  public insertCompartmentSubject(args: { subjectName: string, compartmentKey: CompartmentKey, parentSubjectId?: Id64String, description?: string }): Id64String {
    const elementId = Subject.insert(this._iModel, args.parentSubjectId ?? IModel.rootSubjectId, args.subjectName, args.description);
    this.makeCompartmentRoot({ elementId, compartmentKey: args.compartmentKey });
    return elementId;
  }

  public get hasChannels(): boolean { return this.hasCompartments; }
  public addAllowedChannel(channelKey: CompartmentKey): void { this.addAllowedCompartment(channelKey); }
  public removeAllowedChannel(channelKey: CompartmentKey): void { this.removeAllowedCompartment(channelKey); }
  public getChannelKey(elementId: Id64String): CompartmentKey { return this.getCompartmentKey(elementId); }
  public makeChannelRoot(args: { elementId: Id64String, channelKey: CompartmentKey }): void { this.makeCompartmentRoot({ elementId: args.elementId, compartmentKey: args.channelKey }); }
  public insertChannelSubject(args: { subjectName: string, channelKey: CompartmentKey, parentSubjectId?: Id64String, description?: string }): Id64String {
    return this.insertCompartmentSubject({ ...args, compartmentKey: args.channelKey });
  }
}
