/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as express from "express";
import * as bodyParser from "body-parser";
import { PerformanceReportWriter } from "./PerformanceReportWriter";
import { PerformanceDataEntry } from "./PerformanceInterface";

/**
 * An Express server that opens on localhost:3002
 * Forwards post data to PerformanceReportWriter for use in creating/updating excel files
 */
export function run(): Express.Application {
  const app = express();

  app.use(bodyParser.json());

  const server = app.listen(3002); // , () => console.log("PerformanceWriterServer listening on port 3002!")); // tslint:disable-line

  app.post("/", (_req: any, res: any) => {
    return res.status(200).send();
  });

  /**
   * expects post to return optional parameters for the input excel file location and output excel file location
   */
  app.post("/startup", async (req: any, res: any) => {
    await PerformanceReportWriter.startup(req.body.input, req.body.output);
    return res.status(200).send();
  });

  /**
   * expects post to return PerformanceEntryData which is used to write a row of performance results to the excel worksheet
   */
  app.post("/addEntry", async (req: any, res: any) => {
    const json = JSON.parse(req.body.data);
    const data = {
      imodelName: json.imodelName,
      viewName: json.viewName,
      viewFlags: json.viewFlags,
      data: {
        tileLoadingTime: json.data.tileLoadingTime,
        scene: json.data.scene,
        garbageExecute: json.data.garbageExecute,
        initCommands: json.data.initCommands,
        backgroundDraw: json.data.backgroundDraw,
        skybox: json.data.skybox,
        terrain: json.data.terrain,
        setClips: json.data.setClips,
        opaqueDraw: json.data.opaqueDraw,
        translucentDraw: json.data.translucentDraw,
        hiliteDraw: json.data.hiliteDraw,
        compositeDraw: json.data.compositeDraw,
        overlayDraw: json.data.overlayDraw,
        renderFrameTime: json.data.renderFrameTime,
        glFinish: json.data.glFinish,
        totalTime: json.data.totalTime,
      },
    } as PerformanceDataEntry;
    await PerformanceReportWriter.addEntry(data);
    return res.status(200).send();
  });

  /**
   * concludes a performance result series by writing the min time values in a new row of the excel worksheet
   */
  app.post("/finishSeries", async (_req: any, res: any) => {
    await PerformanceReportWriter.finishSeries();
    return res.status(200).send();
  });

  app.post("/saveCanvas", async (_req: any, res: any) => {
    // const json = JSON.parse(_req.body.data);
    // // const reader = new FileReader();
    // // reader.onloadend =

    // // const image = new Image();
    // // image.id = "pic";
    // // image.src = json; // canvas.toDataURL();

    // // if (typeof imgOrURL === "object")
    // //   window.win = open(image.src);
    // // else
    // //   window.win = open(image);
    // window.win = open(json);

    // var link = $('<a href="' + tempUrl + '" id="download" download="' + fileName + '" target="_blank"> </a>');
    // body.append(link);
    // $("#download").get(0).click();

    // setTimeout('win.document.execCommand("SaveAs")', 0);

    // /////////////////////////////////////////
    // // https://stackoverflow.com/questions/10673122/how-to-save-canvas-as-an-image-with-canvas-todataurl

    // var image = canvas.toDataURL("image/png").replace("image/png", "image/octet-stream");  // here is the most important part because if you dont replace you will get a DOM 18 exception.
    // window.location.href = image; // it will save locally
    // /////////////////////////////////////////

    return res.status(200).send();
  });

  // return server instance so that calling context can close the port when it needs to
  return server;
}
