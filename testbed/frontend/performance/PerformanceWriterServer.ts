/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as express from "express";
import * as bodyParser from "body-parser";
import { PerformanceReportWriter } from "./PerformanceReportWriter";
import { PerformanceDataEntry } from "./PerformanceInterface";

const app = express();

app.use(bodyParser.json());

app.post("/", (_req: any, res: any) => {
  return res.status(200).send();
});

app.post("/startup", async (req: any, res: any) => {
  await PerformanceReportWriter.startup(req.body.input, req.body.output, req.body.isNew);
  return res.status(200).send();
});

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

app.post("/finishSeries", async (_req: any, res: any) => {
  await PerformanceReportWriter.finishSeries();
  return res.status(200).send();
});

app.listen(3002, () => console.log("Example app listening on port 3002!")); // tslint:disable-line
