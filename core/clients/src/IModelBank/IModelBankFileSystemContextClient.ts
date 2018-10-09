/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { IModelHubClientError } from "../imodelhub";
import { ContextManagerClient } from "../IModelCloudEnvironment";
import { ActivityLoggingContext, IModelHubStatus, Logger, WSStatus } from "@bentley/bentleyjs-core";
import { AccessToken } from "../Token";
import { Project } from "../ConnectClients";
import { RequestOptions, request, Response } from "../Request";
import { WsgError } from "../WsgClient";

// Format of the imodelContext.json file found in the root directory of an iModel file system context master directory.
// TODO: Remove this when we
export interface IModelFileSystemContextProps {
  name: string;
  id: string;
  description: string;
}

const loggingCategory = "imodeljs-clients.iModelBank";

export class IModelBankFileSystemContextClient implements ContextManagerClient {
  constructor(public baseUri: string) {
  }

  public async queryContextByName(alctx: ActivityLoggingContext, accessToken: AccessToken, projectName: string): Promise<Project> {

    alctx.enter();
    const url: string = this.baseUri + "/sv1.0/Repositories/IModelBankFileSystem--main/IModelBankFileSystem/Context";
    alctx.enter();
    Logger.logInfo(loggingCategory, `Sending GET request to ${url}`);

    const queryOptions = {      // use the same ODATA-style queries that Connect and iModelHub use
      $select: "*",
      $filter: `name+eq+'${projectName}'`,
    };

    const options: RequestOptions = {
      method: "GET",
      headers: { authorization: accessToken.toTokenString() },
      qs: queryOptions,
      accept: "application/json",
    };

    const res: Response = await request(alctx, url, options);
    alctx.enter();
    if (!res.body) {
      return Promise.reject(new Error(`Query to URL ${url} executed successfully, but did NOT return anything.`));
    }

    const props = res.body as IModelFileSystemContextProps[];
    if (props.length === 0)
      return Promise.reject(new WsgError(WSStatus.InstanceNotFound));

    if (props.length !== 1)
      return Promise.reject(new IModelHubClientError(IModelHubStatus.InvalidArgumentError));

    const project = new Project();
    project.wsgId = project.ecId = props[0].id;
    project.name = props[0].name;
    Logger.logTrace(loggingCategory, `Successful GET request to ${url}`);
    return Promise.resolve(project);
  }

  public async createContext(alctx: ActivityLoggingContext, accessToken: AccessToken, name: string): Promise<void> {
    alctx.enter();
    const url: string = this.baseUri + "/sv1.0/Repositories/IModelBankFileSystem--main/IModelBankFileSystem/Context";

    Logger.logInfo(loggingCategory, `Sending POST request to ${url}`);

    const body: IModelFileSystemContextProps = { name, id: "", description: "" };

    const options: RequestOptions = {
      method: "POST",
      headers: { authorization: accessToken.toTokenString() },
      body,
    };

    return request(alctx, url, options).then(() => Promise.resolve());
  }

  public async deleteContext(alctx: ActivityLoggingContext, accessToken: AccessToken, contextId: string): Promise<void> {
    alctx.enter();
    const url: string = this.baseUri + "/sv1.0/Repositories/IModelBankFileSystem--main/IModelBankFileSystem/Context/" + contextId;
    alctx.enter();
    Logger.logInfo(loggingCategory, `Sending DELETE request to ${url}`);

    const options: RequestOptions = {
      method: "DELETE",
      headers: { authorization: accessToken.toTokenString() },
    };

    return request(alctx, url, options).then(() => Promise.resolve());
  }
}
