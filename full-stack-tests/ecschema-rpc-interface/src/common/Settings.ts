/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { LogLevel } from "@itwin/core-bentley";
import { IModelReadRpcInterface } from "@itwin/core-common";
import { TestUserCredentials } from "@itwin/oidc-signin-tool";
import { ECSchemaRpcInterface } from "@itwin/ecschema-rpcinterface-common";

export interface Backend {
  version: string;
  location: string;
  name: string;
  path: string;
}

export interface IModelData {
  useName: boolean; // Defines whether or not to use the name of the iModel
  id?: string; // The iModel Id - This is not required
  name?: string; // The name is not required to actually get the iModel, only the id.
  useITwinName: boolean;
  iTwinId?: string;
  iTwinName?: string;
  changesetId?: string;
}

export function getRpcInterfaces() {
  const rpcInterfaces = [];
  rpcInterfaces.push(IModelReadRpcInterface);
  rpcInterfaces.push(ECSchemaRpcInterface);

  return rpcInterfaces;
}

export class Settings {
  private _backend: Backend = {} as Backend;
  public env: number = 0;
  public oidcClientId!: string;
  public oidcScopes!: string;
  public oidcRedirect!: string;
  public imsUrl!: string;
  public discovery!: string;
  public gprid?: string;
  public logLevel?: number;
  public users: TestUserCredentials[] = [];

  // eslint-disable-next-line @typescript-eslint/naming-convention
  public get Backend(): Backend { return this._backend; }
  public get user(): TestUserCredentials { return this.users[0]; }

  public iModel: IModelData = {} as IModelData;

  constructor(env: NodeJS.ProcessEnv) {
    const isFrontend = (typeof (process) === "undefined");
    if (!isFrontend && undefined === env.TF_BUILD) {
      const path = require("path"); // eslint-disable-line @typescript-eslint/no-var-requires
      const dotenv = require("dotenv"); // eslint-disable-line @typescript-eslint/no-var-requires
      const dotenvExpand = require("dotenv-expand"); // eslint-disable-line @typescript-eslint/no-var-requires
      // First check in process.cwd() for the config
      let result = dotenv.config();
      if (result.error) {
        const potential = path.resolve(process.cwd(), "..", "..", "..", "imodeljs-config", ".env");
        result = dotenv.config({ path: potential });
        if (result.error)
          throw result.error;
      }

      dotenvExpand(result);
    }

    if (isFrontend)
      globalThis.process = { browser: true, env } as any;

    // Loads the config out of the environment.
    this.load();
  }

  /** Loads the necessary variables from `process.env`.
   */
  private load() {

    // Parse environment
    if (undefined !== process.env.ENVIRONMENT)
      this.env = parseInt(process.env.ENVIRONMENT, 10);

    // Parse OIDC
    if (undefined === process.env.OIDC_CLIENT_ID)
      throw new Error("Missing the 'OIDC_CLIENT_ID' setting.");
    this.oidcClientId = process.env.OIDC_CLIENT_ID!;

    if (undefined === process.env.OIDC_SCOPES)
      throw new Error("Missing the 'OIDC_SCOPES' setting");
    this.oidcScopes = process.env.OIDC_SCOPES;

    this.oidcRedirect = (undefined === process.env.OIDC_REDIRECT) ? "http://localhost:5000" : process.env.OIDC_REDIRECT;

    // Parse GPRId
    if (undefined !== process.env.GPRID)
      this.gprid = process.env.GPRID;

    //  Parse the iModel variables
    if (!process.env.IMODEL_PROJECTID && !process.env.IMODEL_PROJECTNAME)
      throw new Error("Missing the 'IMODEL_PROJECTID' or 'IMODEL_PROJECTNAME' setting.");

    if (!process.env.IMODEL_IMODELID && !process.env.IMODEL_IMODELNAME)
      throw new Error("Missing the 'IMODEL_IMODELID' or 'IMODEL_IMODELNAME' setting.");

    this.iModel = {
      useName: !process.env.IMODEL_IMODELID,
      id: process.env.IMODEL_IMODELID,
      name: process.env.IMODEL_IMODELNAME,
      useITwinName: !process.env.IMODEL_PROJECTID,
      iTwinId: process.env.IMODEL_PROJECTID,
      iTwinName: process.env.IMODEL_PROJECTNAME,
      changesetId: process.env.IMODEL_CHANGESETID,
    };

    // Parse logging level
    if (undefined !== process.env.LOG_LEVEL) {
      const level = parseInt(process.env.LOG_LEVEL, 10);
      if (!isNaN(level) && undefined !== LogLevel[level])
        this.logLevel = level;
    }

    // Get backend data
    if (undefined === process.env.BACKEND_LOCATION)
      throw new Error("Missing the 'BACKEND_LOCATION' setting.");
    this._backend.location = process.env.BACKEND_LOCATION;

    if (undefined === process.env.BACKEND_VERSION)
      throw new Error("Missing the 'BACKEND_VERSION' setting.");
    this._backend.version = process.env.BACKEND_VERSION;

    if (undefined === process.env.BACKEND_NAME)
      throw new Error("Missing the 'BACKEND_NAME' setting.");
    this._backend.name = process.env.BACKEND_NAME;

    // Get users
    this.users.push({
      email: process.env.USER_WITH_ACCESS_USERNAME || "",
      password: process.env.USER_WITH_ACCESS_PASSWORD || "",
    });
    // this.users.push([process.env.USER_WITHOUT_ACCESS_USERNAME || "", process.env.USER_WITHOUT_ACCESS_PASSWORD || ""]);
  }

  public toString(): string {
    return `Configurations:
      oidc client id: ${this.oidcClientId},
      oidc scopes: ${this.oidcScopes},
      applicationId: ${this.gprid},
      log level: ${this.logLevel}`;
  }
}
