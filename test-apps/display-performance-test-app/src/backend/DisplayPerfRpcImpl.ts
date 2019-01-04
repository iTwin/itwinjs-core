/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import DisplayPerfRpcInterface from "../common/DisplayPerfRpcInterface";
import { RpcManager } from "@bentley/imodeljs-common";
import { addColumnsToCsvFile, addDataToCsvFile, createNewCsvFile } from "./CsvWriter";
import * as fs from "fs";

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

  public async savePng(fileName: string, png: string) {
    if (fs.existsSync(fileName)) fs.unlinkSync(fileName);
    const buf = Buffer.from(png, "base64");
    fs.writeFileSync(fileName, buf);
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
