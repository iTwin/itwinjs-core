/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { DgnDb, DgnDbToken } from "../dgnplatform/DgnDb";
import { OpenMode } from "@bentley/bentleyjs-core/lib/BeSQLite";

declare const __dirname: string;

export class DgnDbTestUtils {
  public static getTestAssetsPath(): string {
    return __dirname + "/assets/";
  }

  public static async openDgnDb(filename: string, expectSuccess: boolean, readWrite?: boolean): Promise<DgnDbToken> {
    const mode = readWrite ? OpenMode.ReadWrite : OpenMode.Readonly;
    const {error, result: dbtoken} = await DgnDb.callOpenDb(DgnDbTestUtils.getTestAssetsPath() + filename, mode);
    if (expectSuccess) {
      assert(!error);
      assert(dbtoken);
    }
    if (!dbtoken)
      return new DgnDbToken("?");
    return dbtoken;
  }
}
