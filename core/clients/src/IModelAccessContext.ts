/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module iModels */
import { IModelClient } from "./IModelClient";

export abstract class IModelAccessContext {
  public abstract get client(): IModelClient | undefined;
  public abstract toIModelTokenContextId(): string;
}
