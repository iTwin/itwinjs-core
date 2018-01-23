/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { ECDb } from "../backend/ECDb";
import { Guid } from "@bentley/bentleyjs-core/lib/Id";
import * as fs from "fs-extra";

export class ECDbTestHelper {

  public static createECDb(outDir: string, fileName: string, schemaXml?: string): ECDb {
  if (!fs.existsSync(outDir))
    fs.mkdirSync(outDir);

  const path = outDir + fileName;
  if (fs.existsSync(path))
    fs.removeSync(path);

  const ecdb = new ECDb();
  ecdb.createDb(path);

  if (!schemaXml)
    return ecdb;

  const schemaPath = outDir + Guid.createValue() + ".ecschema.xml";
  if (fs.existsSync(schemaPath))
    fs.removeSync(schemaPath);

  fs.writeFileSync(schemaPath, schemaXml);

  ecdb.importSchema(schemaPath);
  return ecdb;
  }
}
