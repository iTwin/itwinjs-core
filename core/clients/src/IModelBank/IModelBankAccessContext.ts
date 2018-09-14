/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module iModelBank */
import { DeploymentEnv } from "../Client";
import { assert } from "@bentley/bentleyjs-core";

/** Format of the imodel.json file found in an iModel directory of an iModel file system. */
export interface IModelFileSystemIModelProps {
  name: string;
  description: string;
  id: string;
  seedFile?: string;
}

/** Format of the imodelfs.json file found in the root directory of an iModel file system. */
export interface IModelFileSystemProps {
  name: string;
  id: string;
  description: string;
  iModels: IModelFileSystemIModelProps[];
}

/** The externalize format of an IModelAccessContext */
export interface IModelAccessContextProps {
  imodeljsCoreClientsIModelBankAccessContext: {
    iModelId: string;
    url: string;
    env: DeploymentEnv;
  };
}

/** The externalized format of an IModelAccessContext that has been assigned a name. */
export interface NamedIModelAccessContextProps extends IModelAccessContextProps {
  name: string;
}

/** The externalized format of a group of named IModelBankAccessContexts */
export interface IModelBankAccessContextGroupProps {
  iModelBankProjectAccessContextGroup: {
    id: string;
    name: string;
    contexts: NamedIModelAccessContextProps[];
  };
}

/* A group of access contexts for related IModelBanks
export class IModelBankAccessContextGroup {
  public readonly name: string;
  public readonly contexts: IModelBankAccessContext[];
  public readonly names: {};

  constructor(projectName: string, contexts: IModelBankAccessContext[]) {
    this.name = projectName;
    this.contexts = contexts;
  }

  public toIModelTokenContextId(): string {
    const tok: IModelBankAccessContextGroupJson = { iModelBankProjectAccessContext: { name: this.name, contexts: [] } };
    for (const context of this.contexts)
      tok.iModelBankProjectAccessContext.contexts.push(context.toJson());
    return JSON.stringify(tok);
  }

  public static fromIModelTokenContextId(contextStr: string): IModelBankAccessContextGroupJson | undefined {
    if (contextStr.startsWith("{\"imodeljsCoreClientsIModelBankAccessContext\":"))
      return JSON.parse(contextStr) as IModelBankAccessContextGroupJson;
    return undefined;
  }

}
*/

/* All information needed to contact and use an iModelBank server that provides access to a given iModel.
export class IModelBankAccessContext extends IModelAccessContext {
  private _client: IModelBankClient;
  private _iModelId: string;
  private _url: string;
  private _env: DeploymentEnv;

  constructor(iModelId: string, url: string, env: DeploymentEnv, handler: FileHandler | undefined) {
    super();
    this._iModelId = iModelId;
    this._client = new IModelBankClient(url, env, handler);
    this._url = url;
    this._env = env;
  }

  public get client(): IModelClient | undefined { return this._client; }

  public toJson(): IModelAccessContextProps {
    return {
      imodeljsCoreClientsIModelBankAccessContext: {
        iModelId: this._iModelId,
        url: this._url,
        env: this._env,
      },
    };
  }

  public static fromJson(obj: IModelAccessContextProps, handler: FileHandler): IModelBankAccessContext | undefined {
    const props = obj.imodeljsCoreClientsIModelBankAccessContext;
    return new IModelBankAccessContext(props.iModelId, props.url, props.env, handler);
  }

  public toIModelTokenContextId(): string {
    return JSON.stringify(this.toJson());
  }

  public static fromIModelTokenContextId(contextStr: string, iModelId: string, handler: FileHandler): IModelBankAccessContext | undefined {
    if (contextStr.startsWith("{\"imodeljsCoreClientsIModelBankAccessContext\":"))
      return this.fromJson(JSON.parse(contextStr), handler);

    if (contextStr.startsWith("{\"iModelBankProjectAccessContextGroup\":")) {
      const groupJson = JSON.parse(contextStr) as IModelBankAccessContextGroupProps;
      for (const context of groupJson.iModelBankProjectAccessContextGroup.contexts) {
        if (context.imodeljsCoreClientsIModelBankAccessContext.iModelId === iModelId)
          return IModelBankAccessContext.fromJson(context, handler);
      }
    }
    return undefined;
  }
*/

export function makeNamedIModelAccessContextPropsFromFileSystem(iModel: IModelFileSystemIModelProps): NamedIModelAccessContextProps {
  return {
    name: iModel.name,
    imodeljsCoreClientsIModelBankAccessContext: {
      iModelId: iModel.id,
      url: "",
      env: "PROD",
    },
  };
}

export function makeIModelBankAccessContextGroupPropsFromFileSystem(fs: IModelFileSystemProps): IModelBankAccessContextGroupProps {
  assert("name" in fs);
  assert("id" in fs);
  assert("iModels" in fs);

  const group: IModelBankAccessContextGroupProps = {
    iModelBankProjectAccessContextGroup: {
      id: fs.id,
      name: fs.name,
      contexts: [],
    },
  };

  for (const iModel of fs.iModels) {
    assert("name" in iModel);
    assert("id" in iModel);
    group.iModelBankProjectAccessContextGroup.contexts.push(makeNamedIModelAccessContextPropsFromFileSystem(iModel));
  }

  return group;
}
