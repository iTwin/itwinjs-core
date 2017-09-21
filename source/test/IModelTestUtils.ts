/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { IModel } from "../IModel";
import * as fs from "fs-extra";

declare const __dirname: string;

export class IModelTestUtils {
  public static user = {
    email: "bistroDEV_pmadm1@mailinator.com",
    password: "pmadm1",
  };

  private static getStat(name: string) {
    let stat: fs.Stats | undefined;
    try {
      stat = fs.statSync(name);
    } catch (err) { stat = undefined; }
    return stat;
  }

  public static async openIModel(filename: string): Promise<IModel> {
    const destPath = __dirname + "/output";
    if (!fs.existsSync(destPath))
      fs.mkdirSync(destPath);

    const srcName = __dirname + "/assets/" + filename;
    const dbName = destPath + "/" + filename;
    const srcstat = IModelTestUtils.getStat(srcName);
    const destStat = IModelTestUtils.getStat(dbName);
    if (!srcstat || !destStat || srcstat.mtime.getTime() !== destStat.mtime.getTime()) {
      fs.copySync(srcName, dbName, { preserveTimestamps: true });
    }

    const iModel: IModel = await IModel.openStandalone(dbName); // could throw Error
    assert.exists(iModel);
    return iModel!;
  }

  public static closeIModel(iModel: IModel) {
    iModel.closeStandalone();
  }
}
