/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module HubAccess
 */

import { AccessToken, GuidString, IModelStatus } from "@bentley/bentleyjs-core";
import { addCsrfHeader, ChangeSet, ChangeSetQuery, IModelClient, IModelHubClient, VersionQuery } from "@bentley/imodelhub-client";
import { IModelError, IModelVersion } from "@bentley/imodeljs-common";
import { IModelApp } from "./IModelApp";

/** @internal */
export type ChangeSetId = string;

/** @internal */
export interface IModelIdArg {
  iModelId: GuidString;
  accessToken: AccessToken;
}

/** @internal */
export interface FrontendHubAccess {
  getLatestChangesetId: (arg: IModelIdArg) => Promise<ChangeSetId>;
  getChangesetIdFromVersion: (arg: IModelIdArg & { version: IModelVersion }) => Promise<ChangeSetId>;
  getChangesetIdFromNamedVersion: (arg: IModelIdArg & { versionName: string }) => Promise<ChangeSetId>;
}

/** @internal */
export class IModelHubFrontend {
  private static _imodelClient: IModelClient;

  public static get iModelClient(): IModelClient { return this._imodelClient; }

  public static setIModelClient(client?: IModelClient) {
    this._imodelClient = client ?? new IModelHubClient();
    if (IModelApp.securityOptions.csrfProtection?.enabled) {
      this._imodelClient.use(
        addCsrfHeader(
          IModelApp.securityOptions.csrfProtection.headerName,
          IModelApp.securityOptions.csrfProtection.cookieName,
        ));
    }
  }

  public static async getLatestChangesetId(arg: IModelIdArg): Promise<ChangeSetId> {
    const changeSets: ChangeSet[] = await this.iModelClient.changeSets.get(arg.accessToken, arg.iModelId, new ChangeSetQuery().top(1).latest());
    return (changeSets.length === 0) ? "" : changeSets[changeSets.length - 1].wsgId;
  }

  public static async getChangesetIdFromNamedVersion(arg: IModelIdArg & { versionName: string }): Promise<ChangeSetId> {
    const versions = await this.iModelClient.versions.get(arg.accessToken, arg.iModelId, new VersionQuery().select("ChangeSetId").byName(arg.versionName));
    if (!versions[0] || !versions[0].changeSetId)
      throw new IModelError(IModelStatus.NotFound, `Named version ${arg.versionName} not found`);
    return versions[0].changeSetId;
  }

  public static async getChangesetIdFromVersion(arg: IModelIdArg & { version: IModelVersion }): Promise<ChangeSetId> {
    const version = arg.version;
    if (version.isFirst)
      return "";

    const asOf = version.getAsOfChangeSet();
    if (asOf)
      return asOf;

    const versionName = version.getName();
    if (versionName)
      return this.getChangesetIdFromNamedVersion({ ...arg, versionName });

    return this.getLatestChangesetId(arg);
  }

}
