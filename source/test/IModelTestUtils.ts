/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { IModel } from "../IModel";
import { OpenMode } from "@bentley/bentleyjs-core/lib/BeSQLite";
import * as fs from "fs-extra";

declare const __dirname: string;

export class IModelTestUtils {
  private static getStat(name: string) {
    let stat: fs.Stats | undefined;
    try {
      stat = fs.statSync(name);
    } catch (err) { stat = undefined; }
    return stat;
  }

  public static async openIModel(filename: string, mode: OpenMode = OpenMode.ReadWrite): Promise<IModel> {
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

    const iModel: IModel = await IModel.openDgnDb(dbName, mode); // could throw Error
    assert.exists(iModel);
    return iModel!;
  }
}
