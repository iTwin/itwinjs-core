/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { IModelHubStatus, Logger, WSStatus } from "@bentley/bentleyjs-core";
import { AuthorizedClientRequestContext } from "../AuthorizedClientRequestContext";
import { Project } from "../ConnectClients";
import { ContextManagerClient } from "../IModelCloudEnvironment";
import { IModelHubClientError } from "../imodelhub/Errors";
import { LoggerCategory } from "../LoggerCategory";
import { request, RequestOptions, Response } from "../Request";
import { WsgError } from "../WsgClient";

const loggerCategory: string = LoggerCategory.IModelBank;

// Format of the imodelContext.json file found in the root directory of an iModel file system context master directory.
// TODO: Remove this when we
export interface IModelFileSystemContextProps {
  name: string;
  id: string;
  description: string;
}

export class IModelBankFileSystemContextClient implements ContextManagerClient {
  constructor(public baseUri: string) {
  }

  public async queryContextByName(requestContext: AuthorizedClientRequestContext, projectName: string): Promise<Project> {

    requestContext.enter();
    const url: string = this.baseUri + "/sv1.0/Repositories/IModelBankFileSystem--main/IModelBankFileSystem/Context";
    requestContext.enter();
    Logger.logInfo(loggerCategory, `Sending GET request to ${url}`);

    const queryOptions = {      // use the same ODATA-style queries that Connect and iModelHub use
      $select: "*",
      $filter: `name+eq+'${projectName}'`,
    };

    const options: RequestOptions = {
      method: "GET",
      headers: { authorization: requestContext.accessToken.toTokenString() },
      qs: queryOptions,
      accept: "application/json",
    };

    const res: Response = await request(requestContext, url, options);
    requestContext.enter();
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
    Logger.logTrace(loggerCategory, `Successful GET request to ${url}`);
    return Promise.resolve(project);
  }

  public async createContext(requestContext: AuthorizedClientRequestContext, name: string): Promise<void> {
    requestContext.enter();
    const url: string = this.baseUri + "/sv1.0/Repositories/IModelBankFileSystem--main/IModelBankFileSystem/Context";

    Logger.logInfo(loggerCategory, `Sending POST request to ${url}`);

    const body: IModelFileSystemContextProps = { name, id: "", description: "" };

    const options: RequestOptions = {
      method: "POST",
      headers: { authorization: requestContext.accessToken.toTokenString() },
      body,
    };

    return request(requestContext, url, options).then(async () => Promise.resolve());
  }

  public async deleteContext(requestContext: AuthorizedClientRequestContext, contextId: string): Promise<void> {
    requestContext.enter();
    const url: string = this.baseUri + "/sv1.0/Repositories/IModelBankFileSystem--main/IModelBankFileSystem/Context/" + contextId;
    requestContext.enter();
    Logger.logInfo(loggerCategory, `Sending DELETE request to ${url}`);

    const options: RequestOptions = {
      method: "DELETE",
      headers: { authorization: requestContext.accessToken.toTokenString() },
    };

    return request(requestContext, url, options).then(async () => Promise.resolve());
  }
}
