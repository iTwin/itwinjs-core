/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { IModel } from "../IModel";
import { BeSQLite } from "@bentley/bentleyjs-common/lib/BeSQLite";

declare const __dirname: string;

export class IModelTestUtils {
  public static async openIModel(filename: string, expectSuccess: boolean): Promise<IModel> {
    const imodel = new IModel();
    const res: BeSQLite.DbResult = await imodel.openDgnDb(__dirname + "/assets/" + filename); // throws an exception if open fails
    assert(expectSuccess === (BeSQLite.DbResult.BE_SQLITE_OK === res));
    return imodel;
  }
}
