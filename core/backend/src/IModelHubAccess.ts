/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module HubAccess
 */

import { BriefcaseStatus, GuidString } from "@bentley/bentleyjs-core";
import { BriefcaseQuery, ChangeSet, ChangeSetQuery } from "@bentley/imodelhub-client";
import { BriefcaseProps, IModelError } from "@bentley/imodeljs-common";
import { AuthorizedClientRequestContext } from "@bentley/itwin-client";
import { BriefcaseManager } from "./BriefcaseManager";
import { ChangesetFileProps, ChangesetProps, ChangesetRange } from "./HubAccess";
import { IModelHost } from "./IModelHost";

/** @internal */
export class IModelHubAccess {

  /** Releases a briefcaseId from iModelHub. After this call it is illegal to generate changesets for the released briefcaseId.
   * @note generally, this method should not be called directly. Instead use [[deleteBriefcaseFiles]].
   * @see deleteBriefcaseFiles
   */
  public static async releaseBriefcase(requestContext: AuthorizedClientRequestContext, briefcase: BriefcaseProps): Promise<void> {
    const { briefcaseId, iModelId } = briefcase;
    try {
      await IModelHost.iModelClient.briefcases.get(requestContext, iModelId, new BriefcaseQuery().byId(briefcaseId));
      requestContext.enter();
    } catch (error) {
      requestContext.enter();
      throw error;
    }

    await IModelHost.iModelClient.briefcases.delete(requestContext, iModelId, briefcaseId);
    requestContext.enter();
  }

  public static async acquireNewBriefcaseId(requestContext: AuthorizedClientRequestContext, iModelId: GuidString): Promise<number> {
    requestContext.enter();

    const briefcase = await IModelHost.iModelClient.briefcases.create(requestContext, iModelId);
    requestContext.enter();

    if (!briefcase)
      throw new IModelError(BriefcaseStatus.CannotAcquire, "Could not acquire briefcase");

    return briefcase.briefcaseId!;
  }

  public static async getChangeSetIndexFromId(requestContext: AuthorizedClientRequestContext, iModelId: GuidString, changeSetId: string): Promise<number> {
    if (changeSetId === "")
      return 0; // the first version

    const changeSet = (await IModelHost.iModelClient.changeSets.get(requestContext, iModelId, new ChangeSetQuery().byId(changeSetId)))[0];
    requestContext.enter();
    return +changeSet.index!;
  }

  public static async queryChangesetProps(requestContext: AuthorizedClientRequestContext, iModelId: GuidString, changesetId: string): Promise<ChangesetProps> {
    const query = new ChangeSetQuery();
    query.byId(changesetId);

    const changeSets = await IModelHost.iModelClient.changeSets.get(requestContext, iModelId, query);
    if (changeSets.length === 0)
      throw new Error(`Unable to find change set ${changesetId} for iModel ${iModelId}`);

    const cs = changeSets[0];
    return { id: cs.id!, changesType: cs.changesType!, parentId: cs.parentId ?? "", description: cs.description ?? "", pushDate: cs.pushDate, userCreated: cs.userCreated };
  }

  /** Downloads change sets in the specified range. */
  public static async downloadChangeSets(requestContext: AuthorizedClientRequestContext, iModelId: GuidString, range: ChangesetRange): Promise<ChangesetFileProps[]> {
    const after = range.after ?? (await this.queryChangesetProps(requestContext, iModelId, range.first)).parentId;
    if (range.end === "" || after === range.end)
      return [];

    const query = new ChangeSetQuery();
    query.betweenChangeSets(after, range.end);

    const changeSetsPath: string = BriefcaseManager.getChangeSetsPath(iModelId);

    let changeSets: ChangeSet[];
    try {
      changeSets = await IModelHost.iModelClient.changeSets.download(requestContext, iModelId, query, changeSetsPath);
      requestContext.enter();
    } catch (error) {
      requestContext.enter();
      throw error;
    }

    const val: ChangesetFileProps[] = [];
    for (const cs of changeSets)
      val.push({ id: cs.wsgId, parentId: cs.parentId ? cs.parentId : "", pathname: path.join(changeSetsPath, cs.fileName!), description: cs.description ?? "", changesType: cs.changesType ?? ChangesType.Regular, userCreated: cs.userCreated });

    return val;
  }

}

