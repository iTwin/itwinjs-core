/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import SampleGatewayDefinition from "../common/SampleGatewayDefinition";
import { Gateway } from "@bentley/imodeljs-common";
import { KnownLocations } from "@bentley/imodeljs-backend";
import * as fs from "fs";
import * as path from "path";

/** The backend implementation of SampleGatewayDefinition. */
export default class SampleGateway extends SampleGatewayDefinition {

  public async getSampleImodels(): Promise<string[]> {
    const dir = path.join(KnownLocations.assetsDir, "sample_documents");
    const files = fs.readdirSync(dir);
    return files.map((name: string) => (path.resolve(dir, name)));
  }
  
}

/** Auto-register the gateway when this file is included. */
Gateway.registerImplementation(SampleGatewayDefinition, SampleGateway);
