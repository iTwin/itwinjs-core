/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { SimpleViewState } from "./SimpleViewState";

/** The base class for an environment-specific Project/user/IModelServer management system. */
export abstract class ProjectAbstraction {
  public abstract async loginAndOpenImodel(state: SimpleViewState): Promise<void>;
}
