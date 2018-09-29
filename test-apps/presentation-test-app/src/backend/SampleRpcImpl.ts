/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import SampleRpcInterface from "../common/SampleRpcInterface";
import { RpcManager } from "@bentley/imodeljs-common";
import { IModelHost } from "@bentley/imodeljs-backend";
import * as fs from "fs";
import * as path from "path";

/** The backend implementation of SampleRpcInterface. */
export default class SampleRpcImpl extends SampleRpcInterface {

  private getAssetsDir(): string {
    if (IModelHost.appAssetsDir)
      return IModelHost.appAssetsDir;
    return "assets";
  }

  public async getSampleImodels(): Promise<string[]> {
    const dir = path.join(this.getAssetsDir(), "sample_documents");
    const files = fs.readdirSync(dir);
    return files
      .filter((name) => name.endsWith(".ibim") || name.endsWith(".bim"))
      .map((name) => path.resolve(dir, name));
  }

}

/** Auto-register the impl when this file is included. */
RpcManager.registerImpl(SampleRpcInterface, SampleRpcImpl);
