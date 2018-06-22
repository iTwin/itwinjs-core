/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { request, Response } from "@bentley/imodeljs-clients";
import { PerformanceDataEntry } from "./PerformanceInterface";

export class PerformanceWriterClient {
  public static async startup(input?: string, output?: string): Promise<Response> {
    return await request("http://localhost:3002/startup", { method: "POST", body: { input, output } });
  }

  public static async addEntry(data: PerformanceDataEntry): Promise<Response> {
    return await request("http://localhost:3002/addEntry", { method: "POST", body: { data: JSON.stringify(data) } });
  }

  public static async finishSeries(): Promise<Response> {
    return await request("http://localhost:3002/finishSeries", { method: "POST" });
  }
}
