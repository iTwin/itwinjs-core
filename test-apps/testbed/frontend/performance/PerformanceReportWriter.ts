/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as Excel from "exceljs";
import * as path from "path";
import * as fs from "fs";
import { PerformanceDataEntry } from "./PerformanceInterface";

// default file location is ./testbed/frontend/performance/performanceResults.xlsx
const defaultFileLocation = path.join(__dirname, "../../../frontend/performance/performanceResults.xlsx");

/**
 * class encapsulates methods to write performance results to an excel file
 */
export class PerformanceReportWriter {
  public static output: string = defaultFileLocation; // file location of excel file to write to
  public static input: string = defaultFileLocation; // file location of excel file to read from
  public static dataArray: number[][] = []; // data rows of the performance series

  /**
   * starts a performance result series
   * resets the series's data array and updates the input/output locations of the active workbook
   * @param inputPath the path to an excel file to read get excel workbook from, (if doesn't exist, then the column headers are writen) (defaults to defaultFileLocation)
   * @param outputPath the path to an excel file to write the updated workbook to (defaults to input)
   */
  public static async startup(inputPath?: string, outputPath?: string): Promise<void> {
    if (undefined !== inputPath)
      PerformanceReportWriter.input = inputPath;
    if (undefined !== inputPath || undefined !== outputPath)
      PerformanceReportWriter.output = undefined !== outputPath ? outputPath : inputPath!;

    // if file doesn't exist, do setup a new file by writing column headers
    const doSetupNewFile = !fs.existsSync(PerformanceReportWriter.input);

    PerformanceReportWriter.dataArray = [];

    if (doSetupNewFile) {
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

    return Promise.resolve();
  }

  /**
   * apply a routine to an excel worksheet
   * @param fnc routine to execute against the worksheet read from the input. once this routine is finished, the workbook is then written to output
   */
  public static async applyToWorksheet(fnc: (worksheet: Excel.Worksheet) => void): Promise<void> {
    const workbook = new Excel.Workbook();
    return workbook.xlsx.readFile(PerformanceReportWriter.input)
      .then(() => {
        fnc(workbook.getWorksheet(1));
        return workbook.xlsx.writeFile(PerformanceReportWriter.output);
      });
  }

  /**
   * writes row data for a performance result series in excel worksheet
   * @param entry row of data for the performance result series
   */
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

  /**
   * wraps up a performance result series by writing the min values for each column of data to a new row annotated as 'Min Time'
   */
  public static async finishSeries(): Promise<void> {
    return PerformanceReportWriter.applyToWorksheet((ws: Excel.Worksheet) => {
      if (undefined !== ws.lastRow) {
        const resultsRow = ws.lastRow.number + 1;

        ws.getRow(resultsRow).getCell(4).value = "Min Time";

        for (let i = 0; i < PerformanceReportWriter.dataArray.length; i++) // tslint:disable-line
          console.log("-" + PerformanceReportWriter.dataArray[i]); // tslint:disable-line

        const minTotal = Math.min(...PerformanceReportWriter.dataArray.map((row: number[]) => row[13]));
        let minRow = 0;
        for (let i = 0; i < PerformanceReportWriter.dataArray.length; i++) {
          console.log(PerformanceReportWriter.dataArray[i]); // tslint:disable-line

          if (PerformanceReportWriter.dataArray[i][13] === minTotal) {
            minRow = i;
          }
        }
        for (let i = 5; i <= 18; i++)
          ws.getRow(resultsRow).getCell(i).value = PerformanceReportWriter.dataArray[minRow][i - 5];
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
