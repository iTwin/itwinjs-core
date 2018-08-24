import * as fs from "fs";
import { PerformanceDataEntry } from "./PerformanceInterface";

export function readCsvFile(file: string) {
  const rawFile = new XMLHttpRequest();
  rawFile.open("GET", file, false);
  rawFile.onreadystatechange = () => {
    if (rawFile.readyState === 4) {
      if (rawFile.status === 200 || rawFile.status === 0) {
        // const allText = rawFile.responseText;
        // var allRows = data.split(/\r?\n|\r/);
        // debugPrint("READ FILE:\n" + allText);
        // alert(allText);
      }
    }
  };
  rawFile.send(undefined);
}

export function createNewCsvFile(filePath: string, fileName: string) {
  let fd;
  const file = filePath + fileName;
  if (!fs.existsSync(filePath)) fs.mkdirSync(filePath);
  if (!fs.existsSync(file)) {
    try {
      fd = fs.openSync(file, "a");
      fs.writeFileSync(fd, "iModel,View,Flags,Tile Loading,Scene,Garbage Execution,InitCommands,Background Draw,Skybox,Terrain,SetClips,Opaque Draw,Translucent Draw,Hilite Draw,Composite Draw,Overlay Draw,RenderFrame(),Finish GPU Queue,Total Time\r\n", "utf8");
    } catch (err) {
      /* Handle the error */
    } finally {
      if (fd !== undefined)
        fs.closeSync(fd);
    }
  }
}

export function addDataToCsvFile(file: string, data: PerformanceDataEntry) {
  let fd;
  try {
    fd = fs.openSync(file, "a");
    let stringData = "";
    stringData += "\"" + data.imodelName + "\",";
    stringData += data.viewName + ",";
    stringData += data.viewFlags + ",";
    stringData += data.data.tileLoadingTime + ",";
    stringData += data.data.scene + ",";
    stringData += data.data.garbageExecute + ",";
    stringData += data.data.initCommands + ",";
    stringData += data.data.backgroundDraw + ",";
    stringData += data.data.skybox + ",";
    stringData += data.data.terrain + ",";
    stringData += data.data.setClips + ",";
    stringData += data.data.opaqueDraw + ",";
    stringData += data.data.translucentDraw + ",";
    stringData += data.data.hiliteDraw + ",";
    stringData += data.data.compositeDraw + ",";
    stringData += data.data.overlayDraw + ",";
    stringData += data.data.renderFrameTime + ",";
    stringData += data.data.glFinish + ",";
    stringData += data.data.totalTime + ",";
    stringData += "\r\n";
    fs.appendFileSync(fd, stringData, "utf8");
  } catch (err) {
    /* Handle the error */
  } finally {
    if (fd !== undefined)
      fs.closeSync(fd);
  }

}
