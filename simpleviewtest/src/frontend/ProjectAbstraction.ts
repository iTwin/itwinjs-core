/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { IModelClient } from "@bentley/imodeljs-clients/lib";
import { SimpleViewState } from "./SimpleViewState";

/** The base class for an environment-specific Project/user/IModelServer management system. */
export abstract class ProjectAbstraction {

  public abstract getIModelClient(): IModelClient;

  public abstract async loginAndOpenImodel(state: SimpleViewState): Promise<void>;
}
