/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Framework
 */

import { assert, BentleyStatus, ClientRequestContext } from "@bentley/bentleyjs-core";
import { AuthorizedClientRequestContext } from "@bentley/itwin-client";
import { Synchronizer } from "./Synchronizer";
import { Subject } from "@bentley/imodeljs-backend";
import { BridgeJobDefArgs } from "./BridgeRunner";

/** Abstract implementation of the IModelBridge.
 * @beta
 */
export abstract class IModelBridge {
  private _synchronizer: Synchronizer | undefined;
  private _jobSubject?: Subject;

  /** Any initialization steps that the bridge must do in order to begin synchronization. */
  public abstract initialize(params: BridgeJobDefArgs): any;

  /** If the bridge needs to perform any steps once the imodel has been opened */
  public async onOpenIModel(): Promise<BentleyStatus> {
    return BentleyStatus.SUCCESS;
  }

  /** This is only called the first time this source data is synchronized.  Allows the bridge to perform any steps after the Job Subject has been created.  It
   * must call synchronizer.recordDocument on the source data.
   */
  public abstract async initializeJob(): Promise<void>;

  /** The source data can be an actual source file on disk (json, csv, xml, etc), a data dump of a native source (IFC), a URL for a rest API, etc.
   * The bridge creates a connection to this source data and performs any steps necessary before reading.
   */
  public abstract async openSourceData(sourcePath: string): Promise<void>;

  /** Import any elements that belong in a DefinitionModel (Categories, LineStyles, Materials, etc).  This includes elements necessary for all
   * imodels created by this bridge as well as any that are unique to this source data.
   */
  public abstract async importDefinitions(): Promise<any>;

  /** Import schema(s) that every imodel synchronized by this bridge will use */
  public abstract async importDynamicSchema(requestContext?: AuthorizedClientRequestContext | ClientRequestContext): Promise<any>;

  /** Import schema(s) that are specific to this particular source, in addition to the previously imported domain schema(s) */
  public abstract async importDomainSchema(requestContext?: AuthorizedClientRequestContext | ClientRequestContext): Promise<any>;

  /** Convert the source data to BIS and insert into the imodel.  Use the Synchronizer to determine whether an item is new, changed, or unchanged. */
  public abstract async updateExistingData(): Promise<any>;

  /**
   * A bridge can operate in one of two ways with regards to source files and channels:
   * I.	1:1 - Each source file gets its own distinct channel (this is more common)
   * II.	n:1 – A bridge can map multiple files into a single channel (this is rare)
   * In the case of #2, it is up to the bridge to supply the jobSubject name.
   */
  public supportsMultipleFilesPerChannel(): boolean {
    return false;
  }

  /** Returns the name to be used for the job subject. This only needs to be overridden if the bridge supports multiple files per channel, in which case it must be overridden. */
  public getJobSubjectName(sourcePath: string): string {
    return `${this.getBridgeName()}:${sourcePath}`;
  }

  public set synchronizer(sync: Synchronizer) {
    assert(this._synchronizer === undefined);
    this._synchronizer = sync;
  }

  public get synchronizer(): Synchronizer {
    assert(this._synchronizer !== undefined);
    return this._synchronizer;
  }

  public set jobSubject(subject: Subject) {
    assert(this._jobSubject === undefined);
    this._jobSubject = subject;
  }

  public get jobSubject(): Subject {
    assert(this._jobSubject !== undefined);
    return this._jobSubject;
  }

  public abstract getApplicationId(): string;
  public abstract getApplicationVersion(): string;
  public abstract getBridgeName(): string;

  /** Returns the description for data changeset. If method is undefined, "Data changes" is used for the description. */
  public getDataChangesDescription?(): string;
}
