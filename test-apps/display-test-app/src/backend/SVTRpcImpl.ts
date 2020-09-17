/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as fs from "fs";
import * as path from "path";
import { MobileRpcConfiguration, RpcManager } from "@bentley/imodeljs-common";
import SVTRpcInterface from "../common/SVTRpcInterface";

/** The backend implementation of SVTRpcImpl. */
export default class SVTRpcImpl extends SVTRpcInterface {

  public async readExternalSavedViews(bimFileName: string): Promise<string> {
    if (MobileRpcConfiguration.isMobileBackend && process.env.DOCS) {
      const docPath = process.env.DOCS;
      bimFileName = path.join(docPath, bimFileName);
    }

    const esvFileName = this.createEsvFilename(bimFileName);
    if (!fs.existsSync(esvFileName))
      return "";

    const jsonStr = fs.readFileSync(esvFileName).toString();
    return jsonStr ?? "";
  }

  public async writeExternalSavedViews(bimFileName: string, namedViews: string): Promise<void> {
    if (MobileRpcConfiguration.isMobileBackend && process.env.DOCS) {
      const docPath = process.env.DOCS;
      bimFileName = path.join(docPath, bimFileName);
    }

    const esvFileName = this.createEsvFilename(bimFileName);
    return this.writeExternalFile(esvFileName, namedViews);
  }

  public async writeExternalFile(fileName: string, content: string): Promise<void> {
    const filePath = this.getFilePath(fileName);
    if (!fs.existsSync(filePath))
      this.createFilePath(filePath);

    if (fs.existsSync(fileName))
      fs.unlinkSync(fileName);

    fs.writeFileSync(fileName, content);
  }

  private createFilePath(filePath: string) {
    const files = filePath.split(/\/|\\/); // /\.[^/.]+$/ // /\/[^\/]+$/
    let curFile = "";
    for (const file of files) {
      if (file === "")
        break;

      curFile += `${file}\\`;
      if (!fs.existsSync(curFile))
        fs.mkdirSync(curFile);
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
      return `${fileName.substring(0, dotIndex)}_ESV.json`;
    return `${fileName}.sv`;
  }
}

/** Auto-register the impl when this file is included. */
RpcManager.registerImpl(SVTRpcInterface, SVTRpcImpl);
