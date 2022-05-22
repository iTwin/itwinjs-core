/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as path from "path";
import { Guid } from "@itwin/core-bentley";
import { ECDb } from "../../ECDb";
import { IModelJsFs } from "../../IModelJsFs";

export class ECDbTestHelper {

  public static createECDb(outDir: string, fileName: string, schemaXml?: string): ECDb {
    if (!IModelJsFs.existsSync(outDir))
      IModelJsFs.mkdirSync(outDir);

    const outPath = path.join(outDir, fileName);
    if (IModelJsFs.existsSync(outPath))
      IModelJsFs.unlinkSync(outPath);

    const ecdb = new ECDb();
    ecdb.createDb(outPath);

    if (!schemaXml)
      return ecdb;

    const schemaPath = path.join(outDir, `${Guid.createValue()}.ecschema.xml`);
    if (IModelJsFs.existsSync(schemaPath))
      IModelJsFs.unlinkSync(schemaPath);

    IModelJsFs.writeFileSync(schemaPath, schemaXml);

    ecdb.importSchema(schemaPath);
    return ecdb;
  }
}
