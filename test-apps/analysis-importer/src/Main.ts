/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as fs from "fs";
import * as path from "path";
import { Logger } from "@bentley/bentleyjs-core";
import { IModelHost } from "@bentley/imodeljs-backend";
import { AnalysisImporter } from "./AnalysisImporter";

(async () => { // eslint-disable-line @typescript-eslint/no-floating-promises
  await IModelHost.startup();
  Logger.initializeToConsole();

  const outputDir = path.join(__dirname, "output");
  const dbName = path.join(outputDir, "AnalysisExample.bim");
  fs.mkdir(outputDir, ((_err) => { }));
  fs.unlink(dbName, ((_err) => { }));

  const importer = new AnalysisImporter(dbName);
  importer.import();

  await IModelHost.shutdown();
})();
