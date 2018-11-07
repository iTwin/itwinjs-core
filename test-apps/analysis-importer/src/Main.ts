/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { Logger } from "@bentley/bentleyjs-core";
import { IModelHost } from "@bentley/imodeljs-backend";
import { AnalysisImporter } from "./AnalysisImporter";
import * as path from "path";

IModelHost.startup();
Logger.initializeToConsole();

const outputDir = path.join(__dirname, "output");
const dbName = path.join(outputDir, "AnalysisExample.bim");
const importer = new AnalysisImporter(dbName);
importer.import();

IModelHost.shutdown();