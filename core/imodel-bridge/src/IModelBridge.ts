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

/** Defines the base set of features that an IModelBridge needs to implement
 * @alpha
 */
export interface IModelBridge {
  /** Any initialization steps that the bridge must do in order to begin synchronization. */
  initialize(params: BridgeJobDefArgs): any;
  /** The source data can be an actual source file on disk (json, csv, xml, etc), a data dump of a native source (IFC), a URL for a rest API, etc.
   * The bridge creates a connection to this source data and performs any steps necessary before reading.
   */
  openSourceData(sourcePath: string): Promise<BentleyStatus>;
  /** If the bridge needs to perform any steps once the imodel has been opened */
  onOpenIModel(): Promise<BentleyStatus>;
  setJobSubject(subject: Subject): void;
  /** This is only called the first time this sourcedata is synchronized.  Allows the bridge to perform any steps after the Job Subject has been created.  It
   * must call synchronizer.recordDocument on the source data.
   */
  initializeJob(): Promise<void>;
  /** Import schema(s) that every imodel synchronized by this bridge will use */
  importDomainSchema(requestContext?: AuthorizedClientRequestContext | ClientRequestContext): Promise<any>;
  /** Import schema(s) that are specific to this particular source, in addition to the previously imported domain schema(s) */
  importDynamicSchema(requestContext?: AuthorizedClientRequestContext | ClientRequestContext): Promise<any>;
  /** Import any elements that belong in a DefinitionModel (Categories, LineStyles, Materials, etc).  This includes elements necessary for all
   * imodels created by this bridge as well as any that are unique to this source data.
   */
  importDefinitions(): Promise<any>;
  /** Convert the source data to BIS and insert into the imodel.  Use the Synchronizer to determine whether an item is new, changed, or unchanged. */
  updateExistingData(): Promise<any>;
  getApplicationId(): string;
  getApplicationVersion(): string;
  getBridgeName(): string;
  setSynchronizer(synchronizer: Synchronizer): void;
  getSynchronizer(): Synchronizer;
}

/** Abstract implementation of the IModelBridge.
 * @alpha
 */
export abstract class IModelBridgeBase implements IModelBridge {
  private _synchronizer: Synchronizer | undefined;
  private _jobSubject?: Subject;

  public abstract initialize(params: BridgeJobDefArgs): any;

  public setSynchronizer(sync: Synchronizer): void {
    assert(this._synchronizer === undefined);
    this._synchronizer = sync;
  }

  public get synchronizer(): Synchronizer {
    assert(this._synchronizer !== undefined);
    return this._synchronizer;
  }

  public getSynchronizer(): Synchronizer {
    return this.synchronizer;
  }

  public setJobSubject(subject: Subject) {
    assert(this._jobSubject === undefined);
    this._jobSubject = subject;
  }
  public get jobSubject(): Subject {
    assert(this._jobSubject !== undefined);
    return this._jobSubject;
  }

  public async onOpenIModel(): Promise<BentleyStatus> {
    return BentleyStatus.SUCCESS;
  }

  public abstract async openSourceData(sourcePath: string): Promise<BentleyStatus>;
  public abstract async initializeJob(): Promise<void>;
  public abstract async updateExistingData(): Promise<any>;
  public abstract async importDefinitions(): Promise<any>;
  public abstract async importDynamicSchema(requestContext?: AuthorizedClientRequestContext | ClientRequestContext): Promise<any>;
  public abstract async importDomainSchema(requestContext?: AuthorizedClientRequestContext | ClientRequestContext): Promise<any>;
  public abstract getApplicationId(): string;
  public abstract getApplicationVersion(): string;
  public abstract getBridgeName(): string;
}
