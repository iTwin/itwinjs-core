/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModelBankClient
 */
import { AccessToken, IModelHubStatus, Logger } from "@bentley/bentleyjs-core";
import { ITwin } from "@bentley/context-registry-client";
import { request, RequestOptions, Response } from "@bentley/itwin-client";
import { WsgInstance } from "../wsg/ECJsonTypeMap";
import { WsgError, WSStatus } from "../wsg/WsgClient";
import { ContextManagerClient } from "../IModelCloudEnvironment";
import { IModelHubClientError } from "../imodelhub/Errors";
import { IModelHubClientLoggerCategory } from "../IModelHubClientLoggerCategories";

const loggerCategory: string = IModelHubClientLoggerCategory.IModelBank;

// Format of the imodelContext.json file found in the root directory of an iModel file system context master directory.
// TODO: Remove this when we
/** @internal */
export interface IModelFileSystemContextProps {
  name: string;
  id: string;
  description: string;
}

/** @internal */
export class IModelBankFileSystemContextClient implements ContextManagerClient {
  constructor(public baseUri: string) {
  }

  private async queryContextProps(accessToken: AccessToken, projectName: string): Promise<IModelFileSystemContextProps[]> {
    const url: string = `${this.baseUri}/sv1.0/Repositories/Global--main/GlobalScope/Context`;
    Logger.logInfo(loggerCategory, `Sending GET request to ${url}`);

    const queryOptions = {      // use the same ODATA-style queries that Connect and iModelHub use
      $select: "*",
      $filter: `name+eq+'${projectName}'`,
    };

    const options: RequestOptions = {
      method: "GET",
      headers: { authorization: accessToken },
      qs: queryOptions,
      accept: "application/json",
    };

    const res: Response = await request(url, options);
    if (!res.body || !res.body.instances) {
      throw new Error(`Query to URL ${url} executed successfully, but did NOT return anything.`);
    }

    const props = res.body.instances as WsgInstance[];
    if (props.length === 0)
      throw new WsgError(WSStatus.InstanceNotFound);

    if (props.length !== 1)
      throw new IModelHubClientError(IModelHubStatus.InvalidArgumentError);

    Logger.logTrace(loggerCategory, `Successful GET request to ${url}`);

    return props.map((value) => value.properties as IModelFileSystemContextProps);
  }

  public async getITwinByName(accessToken: AccessToken, name: string): Promise<ITwin> {
    const props = await this.queryContextProps(accessToken, name);

    // Get first context
    return props[0] as ITwin;
  }

  public async createContext(accessToken: AccessToken, name: string): Promise<void> {
    const url: string = `${this.baseUri}/sv1.0/Repositories/Global--main/GlobalScope/Context`;

    Logger.logInfo(loggerCategory, `Sending POST request to ${url}`);

    const body = { instance: { className: "Context", schemaName: "GlobalScope", properties: { name, id: "", description: "" } } };

    const options: RequestOptions = {
      method: "POST",
      headers: { authorization: accessToken },
      body,
    };

    await request(url, options);
  }

  public async deleteContext(accessToken: AccessToken, contextId: string): Promise<void> {
    const url: string = `${this.baseUri}/sv1.0/Repositories/Global--main/GlobalScope/Context/${contextId}`;
    Logger.logInfo(loggerCategory, `Sending DELETE request to ${url}`);

    const options: RequestOptions = {
      method: "DELETE",
      headers: { authorization: accessToken },
    };

    await request(url, options);
  }
}
