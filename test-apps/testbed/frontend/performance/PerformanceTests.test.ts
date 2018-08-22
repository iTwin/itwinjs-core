/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { ViewState, SceneContext, TileRequests } from "@bentley/imodeljs-frontend";
import { ViewDefinitionProps } from "@bentley/imodeljs-common";
import { AccessToken, Project, IModelRepository } from "@bentley/imodeljs-clients";
import { PerformanceWriterClient } from "./PerformanceWriterClient";
import { IModelConnection, IModelApp, Viewport } from "@bentley/imodeljs-frontend";
import { Target, UpdatePlan, PerformanceMetrics/*, System*/ } from "@bentley/imodeljs-frontend/lib/rendering";
import { IModelApi } from "./IModelApi";
import { ProjectApi } from "./ProjectApi";
// import { CONSTANTS } from "../../common/Testbed";
// import * as path from "path";
import { StopWatch } from "@bentley/bentleyjs-core";

// const iModelLocation = path.join(CONSTANTS.IMODELJS_CORE_DIRNAME, "test-apps/testbed/frontend/performance/imodels/");
// const glContext: WebGLRenderingContext | null = null;

const wantConsoleOutput: boolean = true;
function debugPrint(msg: string): void {
  if (wantConsoleOutput)
    console.log(msg); // tslint:disable-line
}

function resolveAfterXMilSeconds(ms: number) { // must call await before this function!!!
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, ms);
  });
}

function createWindow() {
  const canv = document.createElement("canvas");
  canv.id = "imodelview";
  document.body.appendChild(canv);
  // debugPrint("canv.context: " + canv.getContext("webgl"));
  // debugPrint("getelement.context: " + (document.getElementById("imodelview") as HTMLCanvasElement)!.getContext("webgl"));
  // glContext = canv.getContext("webgl");
}

async function waitForTilesToLoad() {
  theViewport!.continuousRendering = false;

  // Start timer for tile loading time
  const timer = new StopWatch(undefined, true);
  let haveNewTiles = true;
  const plan = new UpdatePlan();
  while (haveNewTiles) {
    theViewport!.sync.setRedrawPending;
    theViewport!.sync.invalidateScene();
    theViewport!.renderFrame(plan);

    const requests = new TileRequests();
    const sceneContext = new SceneContext(theViewport!, requests);
    activeViewState.viewState!.createScene(sceneContext);
    requests.requestMissing();

    // The scene is ready when (1) all required TileTree roots have been created and (2) all required tiles have finished loading
    haveNewTiles = !(activeViewState.viewState!.areAllTileTreesLoaded) || requests.hasMissingTiles;
    debugPrint(haveNewTiles ? "Awaiting tile loads..." : "...All tiles loaded.");

    await resolveAfterXMilSeconds(100);
  }
  theViewport!.continuousRendering = false;
  theViewport!.renderFrame(plan);
  timer.stop();
  curTileLoadingTime = timer.current.milliseconds;
}

class PerformanceEntryData {
  public tileLoadingTime = 999999;
  public scene = 999999;
  public garbageExecute = 999999; // This is mostly the begin paint now.
  public initCommands = 999999;
  public backgroundDraw = 999999; // This is from the begining of the draw command until after renderBackground has completed
  public skybox = 999999;
  public terrain = 999999;
  public setClips = 999999;
  public opaqueDraw = 999999;
  public translucentDraw = 999999;
  public hiliteDraw = 999999;
  public compositeDraw = 999999;
  public overlayDraw = 999999; // The world and view overlay draw passes
  public renderFrameTime = 999999;
  public glFinish = 999999; // This includes end paint and glFinish
  public totalTime = 999999;
}

class PerformanceEntry {
  public imodelName = "unknown";
  public viewName = "unknown";
  public viewFlags = "unknown";
  public data = new PerformanceEntryData();

  public constructor(tileLoadingTime: number, frameTimes: number[], imodelName?: string, viewName?: string, viewFlags?: string) {
    let sumOfTimes = 0;
    for (let i = 0; i < 12; i++)
      sumOfTimes += frameTimes[i];

    const data = this.data;
    data.tileLoadingTime = tileLoadingTime;
    data.scene = frameTimes[0];
    data.garbageExecute = frameTimes[1]; // This is mostly the begin paint now.
    data.initCommands = frameTimes[2];
    data.backgroundDraw = frameTimes[3]; // This is from the begining of the draw command until after renderBackground has completed
    data.skybox = frameTimes[4];
    data.terrain = frameTimes[5];
    data.setClips = frameTimes[6];
    data.opaqueDraw = frameTimes[7];
    data.translucentDraw = frameTimes[8];
    data.hiliteDraw = frameTimes[9];
    data.compositeDraw = frameTimes[10];
    data.overlayDraw = frameTimes[11]; // The world and view overlay draw passes and the end paint
    data.renderFrameTime = sumOfTimes;
    data.glFinish = frameTimes[12];
    data.totalTime = sumOfTimes + frameTimes[12];

    if (imodelName) this.imodelName = imodelName;
    if (viewName) this.viewName = viewName;
    if (viewFlags) this.viewFlags = viewFlags;
  }
}

async function printResults(tileLoadingTime: number, frameTimes: number[]) {
  await PerformanceWriterClient.addEntry(new PerformanceEntry(tileLoadingTime, frameTimes, configuration.iModelName, configuration.viewName));
}

// export function savePng() {
//   // write((document.getElementById("imodelview") as HTMLCanvasElement)!.toBlob().toString(), "demo.png", "image/png");


//   (document.getElementById("imodelview") as HTMLCanvasElement)!.toBlob((blob) => {
//     // IModelApp.renderSystem.canvas!.toBlob((blob) => {
//     const url = URL.createObjectURL(blob);
//     // localStorage.setItem("elephant.png", url);

//     const a = document.createElement("a");
//     a.href = url, a.download = "demoModel.png";
//     document.body.appendChild(a);
//     a.click();
//     setTimeout(() => {
//       document.body.removeChild(a);
//       window.URL.revokeObjectURL(url);
//     }, 0);
//   });

//   // const a = document.createElement("a");
//   // const url = URL.createObjectURL((document.getElementById("imodelview") as HTMLCanvasElement)!.toBlob());
//   // a.href = url, a.download = "demoModel.png";
//   // document.body.appendChild(a);
//   // a.click();
//   // setTimeout(() => {
//   //   document.body.removeChild(a);
//   //   window.URL.revokeObjectURL(url);
//   // }, 0);





//   // (document.getElementById("imodelview") as HTMLCanvasElement)!.toBlob();


//   const tempUrl = (document.getElementById("imodelview") as HTMLCanvasElement)!.toDataURL("image/png");
//   // const tempUrl = IModelApp.renderSystem.canvas.toDataURL("image/png");
//   const defaultFileLocation = path.join(__dirname, "../../../frontend/performance/performancePic.png");
//   // PerformanceWriterClient.saveCanvas(tempUrl); // (document.getElementById("imodelview") as HTMLCanvasElement)!.toDataURL());
//   const newlink = document.createElement("a");
//   // newlink.innerHTML = "Google";
//   // newlink.setAttribute("title", "Google");

//   newlink.setAttribute("href", tempUrl);
//   newlink.setAttribute("id", "download");
//   newlink.setAttribute("download", defaultFileLocation);
//   newlink.setAttribute("target", "_blank");
//   document.body.appendChild(newlink);

//   // const link = $('<a href="' + tempUrl + '" id="download" download="' + fileName + '" target="_blank"> </a>');
//   document.body.appendChild(newlink);
//   (document.getElementById("download") as HTMLCanvasElement).click();
//   // $("#download").get(0).click();

// }

class SimpleViewState {
  public accessToken?: AccessToken;
  public project?: Project;
  public iModel?: IModelRepository;
  public iModelConnection?: IModelConnection;
  public viewDefinition?: ViewDefinitionProps;
  public viewState?: ViewState;
  public viewPort?: Viewport;
  constructor() { }
}

let configuration: SVTConfiguration;
let theViewport: Viewport | undefined;
let activeViewState: SimpleViewState = new SimpleViewState();
let curTileLoadingTime = 0;

async function _changeView(view: ViewState) {
  theViewport!.changeView(view);
  activeViewState.viewState = view;
}

// opens the view and connects it to the HTML canvas element.
async function openView(state: SimpleViewState) {
  // find the canvas.
  const htmlCanvas: HTMLCanvasElement = document.getElementById("imodelview") as HTMLCanvasElement;
  htmlCanvas!.width = 1239;
  htmlCanvas!.height = 685;
  document.body.appendChild(htmlCanvas!);

  if (htmlCanvas) {
    theViewport = new Viewport(htmlCanvas, state.viewState!);
    theViewport.continuousRendering = false;
    theViewport.sync.setRedrawPending;
    (theViewport!.target as Target).performanceMetrics = new PerformanceMetrics(true, false);
    await _changeView(state.viewState!);
  }
}

// selects the configured view.
async function loadView(state: SimpleViewState, configurations?: { viewName?: string }) {
  const config = undefined !== configurations ? configurations : {};
  const viewIds = await state.iModelConnection!.elements.queryIds({ from: ViewState.sqlName, where: "CodeValue = '" + config.viewName + "'" });
  if (1 === viewIds.size)
    state.viewState = await state.iModelConnection!.views.load(viewIds.values().next().value);

  if (undefined === state.viewState)
    debugPrint("Error: failed to load view by name");
}

// opens the configured iModel from disk
async function openStandaloneIModel(state: SimpleViewState, filename: string) {
  try {
    configuration.standalone = true;
    state.iModelConnection = await IModelConnection.openStandalone(filename);
  } catch (err) {
    debugPrint("openStandaloneIModel failed: " + err.toString());
    throw err;
  }
}
interface SVTConfiguration {
  filename: string;
  userName: string;
  password: string;
  projectName: string;
  iModelName: string;
  standalone: boolean;
  viewName?: string;
}

async function mainBody() {
  await PerformanceWriterClient.startup();

  // this is the default configuration
  configuration = {
    userName: "bistroDEV_pmadm1@mailinator.com",
    password: "pmadm1",
    iModelName: "D:\\models\\ibim_bim0200dev\\Wraith.ibim", // path.join(iModelLocation, "Wraith_MultiMulti.ibim"),
    viewName: "V0",
  } as SVTConfiguration;

  // Start the backend
  createWindow();

  // start the app.
  IModelApp.startup();

  // initialize the Project and IModel Api
  await ProjectApi.init();
  await IModelApi.init();

  activeViewState = new SimpleViewState();

  await openStandaloneIModel(activeViewState, configuration.iModelName);

  // open the specified view
  await loadView(activeViewState, configuration);

  // now connect the view to the canvas
  await openView(activeViewState);

  // Load all tiles
  await waitForTilesToLoad();
  debugPrint("1111111111111111111111 - waitForTilesToLoad has FINISHED");

  // debugPrint("1111111111111111111111 - b4 save png " + theViewport!.continuousRendering);
  // await savePng();
  // debugPrint("1111111111111111111111 - after save png " + theViewport!.continuousRendering);

  const plan = new UpdatePlan();
  // theViewport!.renderFrame(plan);

  theViewport!.sync.setRedrawPending();
  theViewport!.renderFrame(plan);
  const target = (theViewport!.target as Target);
  const frameTimes = target.frameTimings;
  for (let i = 0; i < 11 && frameTimes.length; ++i)
    debugPrint("frameTimes[" + i + "]: " + frameTimes[i]);

  debugPrint("///////////////////////////////// start extra renderFrames");
  // await resolveAfterXMilSeconds(7000);

  const finalFrameTimings: number[][] = [];
  const timer = new StopWatch(undefined, true);
  const numToRender = 50;
  for (let i = 0; i < numToRender; ++i) {
    // await savePng();
    (theViewport!.target as Target).performanceMetrics!.frameTimes = [];
    theViewport!.sync.setRedrawPending();
    // debugPrint("///////////--- start collecting timing data");
    theViewport!.renderFrame(plan);
    finalFrameTimings[i] = (theViewport!.target as Target).frameTimings; // .slice();
  }
  timer.stop();
  debugPrint("------------ Elapsed Time: " + timer.elapsed.milliseconds + " = " + timer.elapsed.milliseconds / numToRender + "ms per frame");
  for (const t of finalFrameTimings) {
    await printResults(curTileLoadingTime, t);
  }

  const nt = finalFrameTimings.length;
  let na = 1;
  for (let i = nt - 2; i >= 0 && i >= nt - 50; --i) {
    for (let j = 0; j < finalFrameTimings[i].length; ++j) {
      finalFrameTimings[nt - 1][j] += finalFrameTimings[i][j];
    }
    na++;
  }
  debugPrint("Average of last " + na + "timings:");
  for (let i = 0; i < finalFrameTimings[nt - 1].length; ++i) {
    finalFrameTimings[nt - 1][i] /= na;
    debugPrint(i + "  " + finalFrameTimings[nt - 1][i]);
  }
  await printResults(curTileLoadingTime, finalFrameTimings[nt - 1]);

  if (activeViewState.iModelConnection) await activeViewState.iModelConnection.closeStandalone();
  IModelApp.shutdown();
  await PerformanceWriterClient.finishSeries();

  debugPrint("//" + (theViewport!.target as Target).frameTimings);
}

describe("PerformanceTests - 1", () => {
  it("Test 2 - Wraith_MultiMulti Model - V0", (done) => {
    mainBody().then((_result) => {
      done();
    }).catch((error) => {
      debugPrint("Exception in mainBody: " + error.toString());
    });
  });
});
