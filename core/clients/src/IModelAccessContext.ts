/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module iModels */
import { IModelClient } from "./IModelClient";

export abstract class IModelAccessContext {
  public abstract get client(): IModelClient | undefined;
  public abstract toIModelTokenContextId(): string;
}
