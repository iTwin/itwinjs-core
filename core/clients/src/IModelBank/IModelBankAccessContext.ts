/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { IModelBankClient } from "./IModelBankClient";
import { IModelClient } from "../IModelClient";
import { IModelAccessContext } from "../IModelAccessContext";
import { DeploymentEnv } from "../Client";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; // (needed temporarily to use self-signed cert to communicate with iModelBank via https)

export class IModelBankAccessContext extends IModelAccessContext {
  private _client: IModelBankClient;
  private _url: string;
  private _env: DeploymentEnv;

  constructor(iModelId: string, url: string, env: DeploymentEnv) {
    super(iModelId, "");
    this._client = new IModelBankClient(url, env);
    this._url = url;
    this._env = env;
  }

  public get client(): IModelClient | undefined { return this._client; }

  private toJson(): any {
    return {
      imodeljsCoreClientsIModelBankAccessContext: {
        iModelId: this.iModelId,
        url: this._url,
        env: this._env,
      },
    };
  }

  private static fromJson(obj: any): IModelBankAccessContext | undefined {
    const props = obj.imodeljsCoreClientsIModelBankAccessContext;
    return new IModelBankAccessContext(props.iModelId, props.url, props.env);
  }

  /** Store the definition of this context as a string that can be used as the contextId property of an IModelToken */
  public toIModelTokenContextId(): string {
    return JSON.stringify(this.toJson());
  }

  /** Create a IModelBankAccessContext from the contextId property of an IModelToken. BriefcaseManager should call this. */
  public static fromIModelTokenContextId(contextStr: string): IModelBankAccessContext | undefined {
    if (!contextStr.startsWith("{\"imodeljsCoreClientsIModelBankAccessContext\":"))
      return undefined;
    return this.fromJson(JSON.parse(contextStr));
  }

}
