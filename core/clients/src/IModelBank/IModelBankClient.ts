/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { IModelBankHandler } from "./IModelBankHandler";
import { IModelClient } from "../IModelClient";
import { UrlFileHandler } from "../UrlFileHandler";
import { Config, FileHandler, DeploymentEnv } from "..";

function constructUrlFileHandler(): FileHandler | undefined {
  return Config.isBrowser() ? undefined : new UrlFileHandler();
}

/** Class that allows access to different iModel Hub class handlers.
 * Handlers should be accessed through an instance of this class, rather than constructed directly.
 */
export class IModelBankClient extends IModelClient {
  /**
   * Creates an instance of IModelBankClient.
   * @param url Url to iModel Bank instance.
   */
  public constructor(url: string, deploymentEnv: DeploymentEnv) {
    super(new IModelBankHandler(url), deploymentEnv, constructUrlFileHandler());
  }

}
