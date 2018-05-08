/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import SampleGatewayDefinition from "../common/SampleGatewayDefinition";
import { Gateway } from "@bentley/imodeljs-common";
import { IModelHost } from "@bentley/imodeljs-backend";
import * as fs from "fs";
import * as path from "path";

/** The backend implementation of SampleGatewayDefinition. */
export default class SampleGateway extends SampleGatewayDefinition {

  private getAssetsDir(): string {
    if (IModelHost.appAssetsDir)
      return IModelHost.appAssetsDir;
    return "assets";
  }

  public async getSampleImodels(): Promise<string[]> {
    const dir = path.join(this.getAssetsDir(), "sample_documents");
    const files = fs.readdirSync(dir);
    return files.map((name: string) => (path.resolve(dir, name)));
  }

}

/** Auto-register the gateway when this file is included. */
Gateway.registerImplementation(SampleGatewayDefinition, SampleGateway);
