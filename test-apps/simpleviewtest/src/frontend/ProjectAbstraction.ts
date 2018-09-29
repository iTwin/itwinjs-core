/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { SimpleViewState } from "./SimpleViewState";

/** The base class for an environment-specific Project/user/IModelServer management system. */
export abstract class ProjectAbstraction {
  public abstract async loginAndOpenImodel(state: SimpleViewState): Promise<void>;
}
