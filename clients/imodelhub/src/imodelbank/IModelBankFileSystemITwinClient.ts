/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModelBankClient
 */
import { AccessToken, IModelHubStatus, Logger } from "@itwin/core-bentley";
import { Project as ITwin } from "@itwin/projects-client";
import { request, RequestOptions, Response } from "@bentley/itwin-client";
import { WsgInstance } from "../wsg/ECJsonTypeMap";
import { WsgError, WSStatus } from "../wsg/WsgClient";
import { ITwinManagerClient } from "../IModelCloudEnvironment";
import { IModelHubClientError } from "../imodelhub/Errors";
import { IModelHubClientLoggerCategory } from "../IModelHubClientLoggerCategories";

const loggerCategory: string = IModelHubClientLoggerCategory.IModelBank;

// Format of the imodelContext.json file found in the root directory of an iModel file system context master directory.
// TODO: Remove this when we
/** @internal */
export interface IModelFileSystemITwinProps {
  name: string;
  id: string;
  description: string;
}

/** @internal */
export class IModelBankFileSystemITwinClient implements ITwinManagerClient {
  constructor(public baseUri: string) {
  }

  private async queryITwinProps(accessToken: AccessToken, iTwinName: string): Promise<IModelFileSystemITwinProps[]> {
    const url: string = `${this.baseUri}/sv1.0/Repositories/Global--main/GlobalScope/Context`;
    Logger.logInfo(loggerCategory, `Sending GET request to ${url}`);

    const queryOptions = {      // use the same ODATA-style queries that Connect and iModelHub use
      $select: "*",
      $filter: `name+eq+'${iTwinName}'`,
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

    return props.map((value) => value.properties as IModelFileSystemITwinProps);
  }

  public async getITwinByName(accessToken: AccessToken, name: string): Promise<ITwin> {
    const props = await this.queryITwinProps(accessToken, name);

    // Get first iTwin
    return props[0] as ITwin;
  }

  public async createITwin(accessToken: AccessToken, name: string): Promise<void> {
    const url: string = `${this.baseUri}/sv1.0/Repositories/Global--main/GlobalScope/Context`;

    Logger.logInfo(loggerCategory, `Sending POST request to ${url}`);

    const body = { instance: { className: "ITwin", schemaName: "GlobalScope", properties: { name, id: "", description: "" } } };

    const options: RequestOptions = {
      method: "POST",
      headers: { authorization: accessToken },
      body,
    };

    await request(url, options);
  }

  public async deleteITwin(accessToken: AccessToken, iTwinId: string): Promise<void> {
    const url: string = `${this.baseUri}/sv1.0/Repositories/Global--main/GlobalScope/Context/${iTwinId}`;
    Logger.logInfo(loggerCategory, `Sending DELETE request to ${url}`);

    const options: RequestOptions = {
      method: "DELETE",
      headers: { authorization: accessToken },
    };

    await request(url, options);
  }
}
