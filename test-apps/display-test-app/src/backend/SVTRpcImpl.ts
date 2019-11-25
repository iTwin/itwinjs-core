/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import SVTRpcInterface from "../common/SVTRpcInterface";
import { RpcManager, MobileRpcConfiguration } from "@bentley/imodeljs-common";
import * as fs from "fs";
import * as path from "path";

/** The backend implementation of SVTRpcImpl. */
export default class SVTRpcImpl extends SVTRpcInterface {

  public async readExternalSavedViews(bimfileName: string): Promise<string> {
    if (MobileRpcConfiguration.isMobileBackend && process.env.DOCS) {
      const docPath = process.env.DOCS;
      bimfileName = path.join(docPath, bimfileName);
    }
    const esvFileName = this.createEsvFilename(bimfileName);
    if (!fs.existsSync(esvFileName)) {
      return "";
    }
    const jsonStr = fs.readFileSync(esvFileName).toString();
    if (undefined === jsonStr)
      return "";
    return jsonStr;
  }

  public async writeExternalSavedViews(bimfileName: string, namedViews: string): Promise<void> {
    if (MobileRpcConfiguration.isMobileBackend && process.env.DOCS) {
      const docPath = process.env.DOCS;
      bimfileName = path.join(docPath, bimfileName);
    }
    const esvFileName = this.createEsvFilename(bimfileName);
    const filePath = this.getFilePath(bimfileName);
    if (!fs.existsSync(filePath)) this.createFilePath(filePath);
    if (fs.existsSync(esvFileName)) fs.unlinkSync(esvFileName);
    fs.writeFileSync(esvFileName, namedViews);
  }

  private createFilePath(filePath: string) {
    const files = filePath.split(/\/|\\/); // /\.[^/.]+$/ // /\/[^\/]+$/
    let curFile = "";
    for (const file of files) {
      if (file === "") break;
      curFile += file + "\\";
      if (!fs.existsSync(curFile)) fs.mkdirSync(curFile);
    }
  }

  private getFilePath(fileName: string): string {
    const slashIndex = fileName.lastIndexOf("/");
    const backSlashIndex = fileName.lastIndexOf("\\");
    if (slashIndex > backSlashIndex)
      return fileName.substring(0, slashIndex);
    else
      return fileName.substring(0, backSlashIndex);
  }

  private createEsvFilename(fileName: string): string {
    const dotIndex = fileName.lastIndexOf(".");
    if (-1 !== dotIndex)
      return fileName.substring(0, dotIndex) + "_ESV.json";
    return fileName + ".sv";
  }
}

/** Auto-register the impl when this file is included. */
RpcManager.registerImpl(SVTRpcInterface, SVTRpcImpl);
