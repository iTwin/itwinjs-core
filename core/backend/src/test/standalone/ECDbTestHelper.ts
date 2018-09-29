/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
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
