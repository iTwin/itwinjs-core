/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
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
      console.log("DisplayPerfRpcInterface.jsonFilePath: " + DisplayPerfRpcInterface.jsonFilePath); // tslint:disable-line
      jsonStr = fs.readFileSync(DisplayPerfRpcInterface.jsonFilePath).toString();
    } else if (fs.existsSync(defaultJsonFile)) {
      console.log("defaultJsonFile: " + defaultJsonFile); // tslint:disable-line
      jsonStr = fs.readFileSync(defaultJsonFile).toString();
    }
    return jsonStr;
  }

  public async saveCsv(outputPath: string, outputName: string, rowData: Map<string, number | string>): Promise<void> {
    console.log("---Started saveCsv---------"); // tslint:disable-line
    console.log("_outputPath: " + outputPath); // tslint:disable-line
    console.log("_outputName: " + outputName); // tslint:disable-line
    console.log("_rowData: " + rowData.toString()); // tslint:disable-line

    if (outputPath !== undefined && outputName !== undefined) {
      let outputFile = this.createFullFilePath(outputPath, outputName);
      outputFile = outputFile ? outputFile : "";
      console.log("outputFile: " + outputFile); // tslint:disable-line
      if (fs.existsSync(outputFile)) {
        addColumnsToCsvFile(outputFile, rowData);
      } else {
        createNewCsvFile(outputPath, outputName, rowData);
      }
      addDataToCsvFile(outputFile, rowData);
      console.log("GOT TO THE END"); // tslint:disable-line
    }
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
