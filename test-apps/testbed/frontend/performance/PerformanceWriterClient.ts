/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { request, Response } from "@bentley/imodeljs-clients";
import { PerformanceDataEntry } from "./PerformanceInterface";
import { ActivityLoggingContext, Guid } from "@bentley/bentleyjs-core";

/**
 * client for posting asynchronous calls to the listening PerformanceWriterServer
 * allows the frontend to write data to an excel file by forwarding those actions to the backend server that is listening
 */
export class PerformanceWriterClient {
  /**
   * start a new performance result series
   * @param input the file location of the excel file to read from
   * @param output the file location of the excel file to write to
   */
  public static async startup(input?: string, output?: string): Promise<Response> {
    const alctx = new ActivityLoggingContext(Guid.createValue());
    return await request(alctx, "http://localhost:3002/startup", { method: "POST", body: { input, output } });
  }

  /**
   * write a row of data for the active performance result series in the active excel worksheet
   * @param data must conform to PerformanceDataEntry interface
   */
  public static async addEntry(data: PerformanceDataEntry): Promise<Response> {
    const alctx = new ActivityLoggingContext(Guid.createValue());
    return await request(alctx, "http://localhost:3002/addEntry", { method: "POST", body: { data: JSON.stringify(data) } });
  }

  /**
   * write the min times of the performance result series in the active excel worksheet
   */
  public static async finishSeries(): Promise<Response> {
    const alctx = new ActivityLoggingContext(Guid.createValue());
    return await request(alctx, "http://localhost:3002/finishSeries", { method: "POST" });
  }

  /**
   * save the current canvas image
   */
  public static async saveCanvas(_data: any) {
    // return await request("http://localhost:3002/saveCanvas", { method: "POST", body: { data: JSON.stringify(data) } });
  }
}
