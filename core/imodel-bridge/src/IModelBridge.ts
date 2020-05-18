/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Framework
 */

import { IModelDb } from "@bentley/imodeljs-backend";
import { BentleyStatus } from "@bentley/bentleyjs-core";

/** Defines the base set of features that an IModelBridge needs to implement
 * @alpha
 */
export interface IModelBridge {
  initialize(params: any): any;
  onOpenBim(db: IModelDb): Promise<BentleyStatus>;
  openSource(sourcePath: string, dmsAccessToken: string | undefined): Promise<BentleyStatus>;
  updateExistingData(sourcePath: string): Promise<any>;
  importDefinitions(): Promise<any>;
  importDynamicSchema(): Promise<any>;
  importDomainSchema(): Promise<any>;
  getDgnDb(): IModelDb;
  getApplicationId(): string;
  getApplicationVersion(): string;
}

/** Abstract implementation of the IModelBridge.
 * @alpha
 */
export abstract class IModelBridgeBase implements IModelBridge {
  protected _iModelDb: IModelDb | undefined;
  public abstract initialize(params: any): any;
  public async onOpenBim(db: IModelDb): Promise<BentleyStatus> {
    this._iModelDb = db;
    return BentleyStatus.SUCCESS;
  }
  public abstract async openSource(sourcePath: string, dmsAccessToken: string | undefined): Promise<BentleyStatus>;
  public abstract async updateExistingData(sourcePath: string): Promise<any>;
  public abstract async importDefinitions(): Promise<any>;
  public abstract async importDynamicSchema(): Promise<any>;
  public abstract async importDomainSchema(): Promise<BentleyStatus>;
  public getDgnDb(): IModelDb { return this._iModelDb!; }
  public abstract getApplicationId(): string;
  public abstract getApplicationVersion(): string;
}
