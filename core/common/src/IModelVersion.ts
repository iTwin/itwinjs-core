/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModels
 */

import { ChangesetId } from "./ChangesetProps";

/** Properties for IModelVersion
 * @public
 */
export type IModelVersionProps =
  { first: true, latest?: never, afterChangeSetId?: never, versionName?: never } |
  { latest: true, first?: never, afterChangeSetId?: never, versionName?: never } |
  { afterChangeSetId: string, first?: never, latest?: never, versionName?: never } |
  { versionName: string, first?: never, latest?: never, afterChangeSetId?: never };

/** Option to specify the version of the iModel to be acquired and used
 * @public
 */
export class IModelVersion {
  private _first?: boolean;
  private _latest?: boolean;
  private _afterChangeSetId?: string;
  private _versionName?: string;

  private constructor() { }

  /** Describes the first version of the iModel */
  public static first(): IModelVersion {
    const version = new IModelVersion();
    version._first = true;
    return version;
  }

  /** Describes the latest version of the iModel  */
  public static latest(): IModelVersion {
    const version = new IModelVersion();
    version._latest = true;
    return version;
  }

  /** Describes a version of the iModel by the last change set that needs
   * to be applied or merged to the iModel.
   * Note that all ChangeSets up to and and including the specified ChangeSet
   * needs to be applied.
   * If the changesetId is an empty string, it is assumed to be the first version
   * before any change sets have been applied.
   */
  public static asOfChangeSet(changesetId: string): IModelVersion {
    const version = new IModelVersion();

    if (changesetId === "") {
      version._first = true;
      return version;
    }

    version._afterChangeSetId = changesetId;
    return version;
  }

  /** Describes a version of the iModel with the specified version name  */
  public static named(versionName: string): IModelVersion {
    const version = new IModelVersion();
    version._versionName = versionName;
    return version;
  }

  public toJSON(): IModelVersionProps {
    return this._versionName ? { versionName: this._versionName } :
      this._afterChangeSetId ? { afterChangeSetId: this._afterChangeSetId } :
        this._first ? { first: this._first } :
          { latest: true };
  }

  /** Creates a version from an IModelVersionProps */
  public static fromJSON(json: IModelVersionProps): IModelVersion {
    const version = new IModelVersion();
    version._first = json.first;
    version._afterChangeSetId = json.afterChangeSetId;
    version._latest = json.latest;
    version._versionName = json.versionName;
    return version;
  }

  /** Returns true if this describes the first version */
  public get isFirst(): boolean { return !!this._first; }

  /** Returns true if this describes the latest version */
  public get isLatest(): boolean { return !!this._latest; }

  /** Returns the last change set id to be applied to the iModel
   * to get to this specified version. @see asOfChangeSet().
   * Note that this method does not attempt to resolve the change set
   * if this describes the first version, last version, named version, etc.
   * @see evaluateChangeSet() for those use cases.
   */
  public getAsOfChangeSet(): ChangesetId | undefined { return this._afterChangeSetId; }

  /** Returns the name of the version if this describes a named version. @see named() */
  public getName(): string | undefined { return this._versionName; }
}
