/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { OpenMode } from "@bentley/bentleyjs-core/lib/BeSQLite";
import { AccessToken } from "@bentley/imodeljs-clients";
import { IModel } from "../IModel";
import { IModelVersion } from "../IModelVersion";
import { BriefcaseManager, KeepBriefcase } from "./BriefcaseManager";

/** Represents a physical copy (briefcase) of an iModel that can be accessed as a file. */
export class IModelDb extends IModel {

  private constructor() {
    super();
  }

  /** Open the iModel from a local file
   * @param fileName The file name of the iModel
   * @param openMode Open mode for database
   * @throws [[IModelError]]
   */
  public static async openStandalone(fileName: string, openMode: OpenMode = OpenMode.ReadWrite): Promise<IModelDb> {
    const iModel = new IModelDb();
    iModel._briefcaseKey = await BriefcaseManager.openStandalone(fileName, openMode);
    return iModel;
  }

  /** Close this iModel, if it is currently open */
  public closeStandalone() {
    if (!this.briefcaseKey)
      return;
    BriefcaseManager.closeStandalone(this.briefcaseKey);
  }

  /** Open an iModel from the iModelHub */
  public static async open(accessToken: AccessToken, iModelId: string, openMode: OpenMode = OpenMode.ReadWrite, version: IModelVersion = IModelVersion.latest()): Promise<IModelDb> {
    const iModel = new IModelDb();
    iModel._briefcaseKey = await BriefcaseManager.open(accessToken, iModelId, openMode, version);
    return iModel;
  }

  /** Close this iModel, if it is currently open. */
  public async close(accessToken: AccessToken, keepBriefcase: KeepBriefcase = KeepBriefcase.Yes): Promise<void> {
    if (!this.briefcaseKey)
      return;
    await BriefcaseManager.close(accessToken, this.briefcaseKey, keepBriefcase);
  }

}
