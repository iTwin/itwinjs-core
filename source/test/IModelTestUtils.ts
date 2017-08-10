/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { IModel } from "../IModel";
import { DbResult, OpenMode } from "@bentley/bentleyjs-core/lib/BeSQLite";

declare const __dirname: string;

export class IModelTestUtils {
  public static async openIModel(filename: string, expectSuccess: boolean, readWrite?: boolean): Promise<IModel> {
    const imodel = new IModel();
    const mode = readWrite ? OpenMode.ReadWrite : OpenMode.Readonly;
    const res: DbResult = await imodel.openDgnDb(__dirname + "/assets/" + filename, mode); // throws an exception if open fails
    assert(expectSuccess === (DbResult.BE_SQLITE_OK === res));
    return imodel;
  }
}
