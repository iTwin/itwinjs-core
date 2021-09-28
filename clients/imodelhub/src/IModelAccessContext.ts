s;
/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModelHubClient
 */
import { IModelClient } from "./IModelClient";

// SWB What does context mean here?
export abstract class IModelAccessContext {
  public abstract get client(): IModelClient | undefined;
  // SWB What does context mean here?
  public abstract toIModelTokenContextId(): string;
}
