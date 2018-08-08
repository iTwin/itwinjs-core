/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { ECDb } from "../../ECDb";
import { Guid } from "@bentley/bentleyjs-core";
import { IModelJsFs } from "../../IModelJsFs";
import * as path from "path";

export class ECDbTestHelper {

  public static createECDb(outDir: string, fileName: string, schemaXml?: string): ECDb {
  if (!IModelJsFs.existsSync(outDir))
    IModelJsFs.mkdirSync(outDir);

  const outpath = path.join(outDir, fileName);
  if (IModelJsFs.existsSync(outpath))
    IModelJsFs.unlinkSync(outpath);

  const ecdb = new ECDb();
  ecdb.createDb(outpath);

  if (!schemaXml)
    return ecdb;

  const schemaPath = path.join(outDir, Guid.createValue() + ".ecschema.xml");
  if (IModelJsFs.existsSync(schemaPath))
    IModelJsFs.unlinkSync(schemaPath);

  IModelJsFs.writeFileSync(schemaPath, schemaXml);

  ecdb.importSchema(schemaPath);
  return ecdb;
  }
}
