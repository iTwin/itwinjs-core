/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { IModelClient } from "./IModelClient";

export abstract class IModelAccessContext {
  public iModelId: string;
  public projectId: string;
  constructor(id: string, pid: string) { this.iModelId = id; this.projectId = pid; }
  public abstract get client(): IModelClient | undefined;
}
