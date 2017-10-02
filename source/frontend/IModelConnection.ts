/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { OpenMode } from "@bentley/bentleyjs-core/lib/BeSQLite";
import { AccessToken } from "@bentley/imodeljs-clients";
import { IModel } from "../IModel";
import { IModelVersion } from "../IModelVersion";
import { BriefcaseManager, KeepBriefcase } from "../backend/BriefcaseManager"; // WIP: cannot include backend classes in the frontend

/** A connection to an iModel database hosted on the backend. */
export class IModelConnection extends IModel {

  private constructor() {
    super();
  }

  /** Open an iModel from the iModelHub */
  public static async open(accessToken: AccessToken, iModelId: string, openMode: OpenMode = OpenMode.ReadWrite, version: IModelVersion = IModelVersion.latest()): Promise<IModelConnection> {
    const iModel = new IModelConnection();
    iModel._briefcaseKey = await BriefcaseManager.open(accessToken, iModelId, openMode, version);
    return iModel;
  }

  /** Close this iModel */
  public async close(accessToken: AccessToken, keepBriefcase: KeepBriefcase = KeepBriefcase.Yes): Promise<void> {
    if (!this.briefcaseKey)
      return;
    await BriefcaseManager.close(accessToken, this.briefcaseKey, keepBriefcase);
  }

}
