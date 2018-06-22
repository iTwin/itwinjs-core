/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as Excel from "exceljs";
import { PerformanceDataEntry } from "./PerformanceInterface";

export class PerformanceReportWriter {
  public static output: string = "c:/performanceResults.xlsx";
  public static input: string = "c:/performanceResults.xlsx";
  public static dataArray: number[][] = [];

  public static async startup(inputPath?: string, outputPath?: string): Promise<void> {
    if (undefined !== inputPath)
      PerformanceReportWriter.input = inputPath;
    if (undefined !== inputPath || undefined !== outputPath)
      PerformanceReportWriter.input = undefined !== outputPath ? outputPath : inputPath!;

    PerformanceReportWriter.dataArray = [];

    const wb = new Excel.Workbook();
    const ws = wb.addWorksheet("Performance Results");

    ws.columns = [
      { header: "" },
      { header: "IModel" },
      { header: "View" },
      { header: "Flags" },
      { header: "TileLoadingTime" },
      { header: "Scene" },
      { header: "GarbageExecute" },
      { header: "InitCommands" },
      { header: "BackgroundDraw" },
      { header: "SetClips" },
      { header: "OpaqueDraw" },
      { header: "TranslucentDraw" },
      { header: "HiliteDraw" },
      { header: "CompositeDraw" },
      { header: "OverlayDraw" },
      { header: "RenderFrameTime" },
      { header: "glFinish" },
      { header: "TotalTime" },
    ];

    return wb.xlsx.writeFile(PerformanceReportWriter.output);
  }

  public static async applyToWorksheet(fnc: (worksheet: Excel.Worksheet) => void): Promise<void> {
    const workbook = new Excel.Workbook();
    return workbook.xlsx.readFile(PerformanceReportWriter.input)
      .then(() => {
        fnc(workbook.getWorksheet(1));
        return workbook.xlsx.writeFile(PerformanceReportWriter.output);
      });
  }

  public static async addEntry(entry: PerformanceDataEntry): Promise<void> {
    return PerformanceReportWriter.applyToWorksheet((ws: Excel.Worksheet) => {
      const pd = entry.data;
      const data = [
        pd.tileLoadingTime,
        pd.scene,
        pd.garbageExecute,
        pd.initCommands,
        pd.backgroundDraw,
        pd.setClips,
        pd.opaqueDraw,
        pd.translucentDraw,
        pd.hiliteDraw,
        pd.compositeDraw,
        pd.overlayDraw,
        pd.renderFrameTime,
        pd.glFinish,
        pd.totalTime,
      ];
      PerformanceReportWriter.dataArray.push(data);
      ws.addRow(["", entry.imodelName, entry.viewName, entry.viewFlags, ...data]);
    });
  }

  public static async finishSeries(): Promise<void> {
    return PerformanceReportWriter.applyToWorksheet((ws: Excel.Worksheet) => {
      if (undefined !== ws.lastRow) {
        const resultsRow = ws.lastRow.number + 1;

        ws.getRow(resultsRow).getCell(4).value = "Min Time";

        for (let i = 5; i <= 18; i++)
          ws.getRow(resultsRow).getCell(i).value = Math.min(...PerformanceReportWriter.dataArray.map((row: number[]) => row[i - 5]));
      }
    });
  }
}

/* EXAMPLE USAGE */
// async function run() {
//   try {
//     await PerformanceReportWriter.startup();
//     await PerformanceReportWriter.addEntry({
//       imodelName: "test",
//       viewName: "test",
//       viewFlags: "test",
//       data: {
//         tileLoadingTime: 1,
//         scene: 2,
//         garbageExecute: 3,
//         initCommands: 4,
//         backgroundDraw: 5,
//         setClips: 6,
//         opaqueDraw: 7,
//         translucentDraw: 8,
//         hiliteDraw: 9,
//         compositeDraw: 10,
//         overlayDraw: 11,
//         renderFrameTime: 12,
//         glFinish: 13,
//         totalTime: 14,
//       }
//     });
//     await PerformanceReportWriter.addEntry({
//       imodelName: "test",
//       viewName: "test",
//       viewFlags: "test",
//       data: {
//         tileLoadingTime: 11,
//         scene: 12,
//         garbageExecute: 13,
//         initCommands: 14,
//         backgroundDraw: 15,
//         setClips: 16,
//         opaqueDraw: 17,
//         translucentDraw: 18,
//         hiliteDraw: 19,
//         compositeDraw: 110,
//         overlayDraw: 111,
//         renderFrameTime: 112,
//         glFinish: 113,
//         totalTime: 1411,
//       }
//     });
//     await PerformanceReportWriter.addEntry({
//       imodelName: "test",
//       viewName: "test",
//       viewFlags: "test",
//       data: {
//         tileLoadingTime: 21,
//         scene: 22,
//         garbageExecute: 23,
//         initCommands: 24,
//         backgroundDraw: 25,
//         setClips: 26,
//         opaqueDraw: 27,
//         translucentDraw: 28,
//         hiliteDraw: 29,
//         compositeDraw: 20,
//         overlayDraw: 121,
//         renderFrameTime: 122,
//         glFinish: 213,
//         totalTime: 124,
//       }
//     });
//   } catch (ex) {
//     console.log(ex);
//   }

//   await PerformanceReportWriter.finishSeries();
// }

// run();
