/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Framework
 */

import { BentleyStatus } from "@bentley/bentleyjs-core";
import { AuthorizedClientRequestContext } from "@bentley/itwin-client";
import { Synchronizer } from "./Synchronizer";

/** Defines the base set of features that an IModelBridge needs to implement
 * @alpha
 */
export interface IModelBridge {
  initialize(params: any): any;
  onOpenBim(sync: Synchronizer): Promise<BentleyStatus>;
  openSource(sourcePath: string, dmsAccessToken: string | undefined, documentGuid: string | undefined): Promise<BentleyStatus>;
  updateExistingData(sourcePath: string): Promise<any>;
  importDefinitions(): Promise<any>;
  importDynamicSchema(requestContext: AuthorizedClientRequestContext): Promise<any>;
  importDomainSchema(requestContext: AuthorizedClientRequestContext): Promise<any>;
  getApplicationId(): string;
  getApplicationVersion(): string;
}

/** Abstract implementation of the IModelBridge.
 * @alpha
 */
export abstract class IModelBridgeBase implements IModelBridge {
  protected _synchronizer: Synchronizer | undefined;
  public abstract initialize(params: any): any;
  public async onOpenBim(sync: Synchronizer): Promise<BentleyStatus> {
    this._synchronizer = sync;
    return BentleyStatus.SUCCESS;
  }
  public abstract async openSource(sourcePath: string, dmsAccessToken: string | undefined, documentGuid: string | undefined): Promise<BentleyStatus>;
  public abstract async updateExistingData(sourcePath: string): Promise<any>;
  public abstract async importDefinitions(): Promise<any>;
  public abstract async importDynamicSchema(requestContext: AuthorizedClientRequestContext): Promise<any>;
  public abstract async importDomainSchema(requestContext: AuthorizedClientRequestContext): Promise<any>;
  public abstract getApplicationId(): string;
  public abstract getApplicationVersion(): string;
}
