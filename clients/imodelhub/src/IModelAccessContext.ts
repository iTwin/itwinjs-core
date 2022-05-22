/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModelHubClient
 */
import { IModelClient } from "./IModelClient";

export abstract class IModelAccessContext {
  public abstract get client(): IModelClient | undefined;
  public abstract toIModelTokenContextId(): string;
}
