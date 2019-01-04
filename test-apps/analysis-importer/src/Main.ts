/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { Logger } from "@bentley/bentleyjs-core";
import { IModelHost } from "@bentley/imodeljs-backend";
import { AnalysisImporter } from "./AnalysisImporter";
import * as path from "path";
import * as fs from "fs";

IModelHost.startup();
Logger.initializeToConsole();

const outputDir = path.join(__dirname, "output");
const dbName = path.join(outputDir, "AnalysisExample.bim");
fs.mkdir(outputDir, ((_err) => { }));
fs.unlink(dbName, ((_err) => { }));

const importer = new AnalysisImporter(dbName);
importer.import();

IModelHost.shutdown();
