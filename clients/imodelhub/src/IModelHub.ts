/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { AccessToken, BentleyError, BentleyStatus, GuidString } from "@itwin/core-bentley";
import { FrontendHubAccess, IModelIdArg } from "@itwin/core-frontend"; // All of the imports from both frontend and common must be only of interfaces.
import { BriefcaseId, ChangesetIndexAndId, IModelVersion } from "@itwin/core-common";
import { BriefcaseQuery } from "./imodelhub/Briefcases";
import { ChangeSet, ChangeSetQuery } from "./imodelhub/ChangeSets";
import { IModelHubClient } from "./imodelhub/Client";
import { Version, VersionQuery } from "./imodelhub/Versions";
import { IModelQuery } from "./imodelhub/iModels";

// TODO: Replace with types from imodeljs-backend once its dep is removed on this client
/** @internal */
export interface IModelNameArg {
  readonly iModelName: string;
  readonly iTwinId: GuidString;
  readonly accessToken: AccessToken;
}

// TODO: Replace with types from imodeljs-backend once its dep is removed on this client
/** @internal */
export interface BriefcaseIdArg extends IModelIdArg {
  readonly briefcaseId: BriefcaseId;
}

/** Implements both FrontendHubAccess and BackendHubAccess
 * @internal
*/
export class IModelHubFrontend implements FrontendHubAccess {
  public readonly hubClient: IModelHubClient = new IModelHubClient();

  private async _getChangesetFromId(arg: IModelIdArg & { changeSetId: string }): Promise<ChangesetIndexAndId> {
    const changeSets: ChangeSet[] = await this.hubClient.changeSets.get(arg.accessToken, arg.iModelId, new ChangeSetQuery().byId(arg.changeSetId));
    if (!changeSets[0] || !changeSets[0].index || !changeSets[0].id)
      throw new BentleyError(BentleyStatus.ERROR, `Changeset ${arg.changeSetId} not found`);
    return { index: +changeSets[0].index, id: changeSets[0].id };
  }

  public async getLatestChangeset(arg: IModelIdArg): Promise<ChangesetIndexAndId> {
    const changeSets: ChangeSet[] = await this.hubClient.changeSets.get(arg.accessToken, arg.iModelId, new ChangeSetQuery().top(1).latest());
    if (!changeSets[0] || !changeSets[0].index || !changeSets[0].id)
      return { index: 0, id: "" };
    return { index: +changeSets[0].index, id: changeSets[0].id };
  }

  public async getChangesetFromVersion(arg: IModelIdArg & { version: IModelVersion }): Promise<ChangesetIndexAndId> {
    const version = arg.version;
    if (version.isFirst)
      return { index: 0, id: "" };

    const asOfChangeSetId = version.getAsOfChangeSet();
    if (asOfChangeSetId)
      return this._getChangesetFromId({ ...arg, changeSetId: asOfChangeSetId });

    const versionName = version.getName();
    if (versionName)
      return this.getChangesetFromNamedVersion({ ...arg, versionName });

    return this.getLatestChangeset(arg);
  }

  public async getChangesetFromNamedVersion(arg: IModelIdArg & { versionName?: string }): Promise<ChangesetIndexAndId> {
    const versionQuery = arg.versionName ? new VersionQuery().select("ChangeSetId").byName(arg.versionName) : new VersionQuery().top(1);
    const versions: Version[] = await this.hubClient.versions.get(arg.accessToken, arg.iModelId, versionQuery);
    if (!versions[0] || !versions[0].changeSetIndex || !versions[0].changeSetId)
      throw new BentleyError(BentleyStatus.ERROR, `Named version ${arg.versionName ?? ""} not found`);
    return { index: versions[0].changeSetIndex, id: versions[0].changeSetId };
  }

  /** Get the iModelId of an iModel by name. Undefined if no iModel with that name exists.  */
  public async queryIModelByName(arg: IModelNameArg): Promise<GuidString | undefined> {
    const iModels = await this.hubClient.iModels.get(arg.accessToken, arg.iTwinId, new IModelQuery().byName(arg.iModelName));
    return iModels.length === 0 ? undefined : iModels[0].id!;
  }

  public async getMyBriefcaseIds(arg: IModelIdArg): Promise<number[]> {
    const myHubBriefcases = await this.hubClient.briefcases.get(arg.accessToken, arg.iModelId, new BriefcaseQuery().ownedByMe().selectDownloadUrl());
    const myBriefcaseIds: number[] = [];
    for (const hubBc of myHubBriefcases)
      myBriefcaseIds.push(hubBc.briefcaseId!); // save the list of briefcaseIds we already own.
    return myBriefcaseIds;
  }

  public async releaseBriefcase(arg: BriefcaseIdArg): Promise<void> {
    await this.hubClient.briefcases.delete(arg.accessToken, arg.iModelId, arg.briefcaseId);
  }
}
