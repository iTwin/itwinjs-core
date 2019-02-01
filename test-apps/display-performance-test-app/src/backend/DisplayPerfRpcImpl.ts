/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import DisplayPerfRpcInterface from "../common/DisplayPerfRpcInterface";
import { IModelHost } from "@bentley/imodeljs-backend";
import { RpcManager } from "@bentley/imodeljs-common";
import { addColumnsToCsvFile, addDataToCsvFile, createFilePath, createNewCsvFile } from "./CsvWriter";
import * as fs from "fs";
import { app } from "electron";

/** The backend implementation of DisplayPerfRpcImpl. */
export default class DisplayPerfRpcImpl extends DisplayPerfRpcInterface {

  public async getDefaultConfigs(): Promise<string> {
    let jsonStr = "";
    const defaultJsonFile = "./src/backend/DefaultConfig.json";
    if (fs.existsSync(DisplayPerfRpcInterface.jsonFilePath)) {
      jsonStr = fs.readFileSync(DisplayPerfRpcInterface.jsonFilePath).toString();
    } else if (fs.existsSync(defaultJsonFile)) {
      jsonStr = fs.readFileSync(defaultJsonFile).toString();
    }
    let argOutputPath: string | undefined;
    process.argv.forEach((arg, index) => {
      if (index >= 2 && arg !== "chrome" && arg !== "edge" && arg !== "firefox" && arg.split(".").pop() !== "json") {
        while (arg.endsWith("\\") || arg.endsWith("\/"))
          arg = arg.slice(0, -1);
        argOutputPath = "\"argOutputPath\": \"" + arg + "\",";
      }
    });

    if (argOutputPath) {
      const firstBraceIndex = jsonStr.indexOf("{") + 1;
      jsonStr = jsonStr.slice(0, firstBraceIndex) + argOutputPath + jsonStr.slice(firstBraceIndex);
    }
    return jsonStr;
  }

  public async saveCsv(outputPath: string, outputName: string, rowData: Map<string, number | string>): Promise<void> {
    if (outputPath !== undefined && outputName !== undefined) {
      let outputFile = this.createFullFilePath(outputPath, outputName);
      outputFile = outputFile ? outputFile : "";
      if (fs.existsSync(outputFile)) {
        addColumnsToCsvFile(outputFile, rowData);
      } else {
        createNewCsvFile(outputPath, outputName, rowData);
      }
      addDataToCsvFile(outputFile, rowData);
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

  public async savePng(fileName: string, png: string) {
    const filePath = this.getFilePath(fileName);
    if (!fs.existsSync(filePath)) createFilePath(filePath);
    if (fs.existsSync(fileName)) fs.unlinkSync(fileName);
    const buf = Buffer.from(png, "base64");
    fs.writeFileSync(fileName, buf);
  }

  public async finishTest() {
    IModelHost.shutdown();

    // Electron only
    if (app !== undefined) app.exit();

    // Browser only
    if (DisplayPerfRpcInterface.webServer) DisplayPerfRpcInterface.webServer.close();
    if (DisplayPerfRpcInterface.backendServer) DisplayPerfRpcInterface.backendServer.close();
    if (DisplayPerfRpcInterface.chrome) await DisplayPerfRpcInterface.chrome.kill();
  }

  private createFullFilePath(filePath: string | undefined, fileName: string | undefined): string | undefined {
    if (fileName === undefined)
      return undefined;
    if (filePath === undefined)
      return fileName;
    else {
      let output = filePath;
      const lastChar = output[output.length - 1];
      if (lastChar !== "/" && lastChar !== "\\")
        output += "\\";
      return output + fileName;
    }
  }

}

/** Auto-register the impl when this file is included. */
RpcManager.registerImpl(DisplayPerfRpcInterface, DisplayPerfRpcImpl);
