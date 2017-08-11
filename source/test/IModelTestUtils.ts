/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { IModel } from "../IModel";
import { OpenMode } from "@bentley/bentleyjs-core/lib/BeSQLite";

declare const __dirname: string;

export class IModelTestUtils {
  public static async openIModel(filename: string, expectSuccess: boolean, readWrite?: boolean): Promise<IModel> {
    const imodel = new IModel();
    const mode = readWrite ? OpenMode.ReadWrite : OpenMode.Readonly;
    const {error} = await imodel.openDgnDb(__dirname + "/assets/" + filename, mode);
    assert(!expectSuccess || !error);
    return imodel;
  }
}
