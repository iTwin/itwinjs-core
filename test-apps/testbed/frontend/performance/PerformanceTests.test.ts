/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { ViewState, SceneContext, TileRequests } from "@bentley/imodeljs-frontend"; // @ts-ignore
import { ViewDefinitionProps } from "@bentley/imodeljs-common"; // tslint:disable-line
import { AccessToken, Project, IModelRepository } from "@bentley/imodeljs-clients"; // @ts-ignore
import { PerformanceWriterClient } from "./PerformanceWriterClient";
import { IModelConnection, IModelApp, Viewport } from "@bentley/imodeljs-frontend"; // @ts-ignore
import { Target, UpdatePlan, PerformanceMetrics } from "@bentley/imodeljs-frontend/lib/rendering";
import { IModelApi } from "./IModelApi"; // @ts-ignore
import { ProjectApi } from "./ProjectApi"; // @ts-ignore
import { CONSTANTS } from "../../common/Testbed";
import * as path from "path";
// import { BeTimePoint, BeDuration } from "@bentley/bentleyjs-core/lib/Time";
import { StopWatch, BeTimePoint } from "@bentley/bentleyjs-core";

const iModelLocation = path.join(CONSTANTS.IMODELJS_CORE_DIRNAME, "test-apps/testbed/frontend/performance/imodels/");

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
}

async function waitForTilesToLoad() {
  theViewport!.continuousRendering = false; // false; // true;
  // Start timer for tile loading time
  const timer = new StopWatch(undefined, true);
  let haveNewTiles = true;
  const plan = new UpdatePlan();
  while (haveNewTiles) {
    debugPrint("----------------------------------------START OF WHILE LOOP");
    debugPrint("----waiting for tiles to load, about to renderFrame");
    theViewport!.sync.setRedrawPending;
    theViewport!.sync.invalidateScene();
    theViewport!.renderFrame(plan);
    debugPrint("----waiting for tiles to load, finished renderFrame");

    const requests = new TileRequests();
    const sceneContext = new SceneContext(theViewport!, requests);
    activeViewState.viewState!.createScene(sceneContext);
    requests.requestMissing();

    // The scene is ready when (1) all required TileTree roots have been created and (2) all required tiles have finished loading
    haveNewTiles = !(activeViewState.viewState!.areAllTileTreesLoaded) || requests.hasMissingTiles;
    debugPrint("---------Are all tiles loaded???? " + !haveNewTiles);

    debugPrint("@@@@@@@@@@@@@@@@@@@@@@@@@@ BEFORE sleep (v.3) " + BeTimePoint.now().milliseconds);
    await resolveAfterXMilSeconds(2000);
    debugPrint("@@@@@@@@@@@@@@@@@@@@@@@@@@ AFTER  sleep (v.3) " + BeTimePoint.now().milliseconds);
  }
  theViewport!.continuousRendering = false;
  theViewport!.renderFrame(plan);
  timer.stop();
  curTileLoadingTime = timer.current.milliseconds;
  debugPrint("----end of wait for tiles to load");
}

class PerformanceEntryData {
  public tileLoadingTime = 999999;
  public scene = 999999;
  public garbageExecute = 999999; // This is mostly the begin paint now.
  public initCommands = 999999;
  public backgroundDraw = 999999; // This is from the begining of the draw command until after renderBackground has completed
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
    for (let i = 0; i < 10; i++)
      sumOfTimes += frameTimes[i];

    const data = this.data;
    data.tileLoadingTime = tileLoadingTime;
    data.scene = frameTimes[0];
    data.garbageExecute = frameTimes[1]; // This is mostly the begin paint now.
    data.initCommands = frameTimes[2];
    data.backgroundDraw = frameTimes[3]; // This is from the begining of the draw command until after renderBackground has completed
    data.setClips = frameTimes[4];
    data.opaqueDraw = frameTimes[5];
    data.translucentDraw = frameTimes[6];
    data.hiliteDraw = frameTimes[7];
    data.compositeDraw = frameTimes[8];
    data.overlayDraw = frameTimes[9]; // The world and view overlay draw passes and the end paint
    data.renderFrameTime = sumOfTimes;
    data.glFinish = frameTimes[10];
    data.totalTime = sumOfTimes + frameTimes[10];

    if (imodelName) this.imodelName = imodelName;
    if (viewName) this.viewName = viewName;
    if (viewFlags) this.viewFlags = viewFlags;
  }
}

async function printResults(tileLoadingTime: number, frameTimes: number[]) {
  await PerformanceWriterClient.addEntry(new PerformanceEntry(tileLoadingTime, frameTimes, configuration.iModelName, configuration.viewName));
}

function savePng() {
  const tempUrl = (document.getElementById("imodelview") as HTMLCanvasElement)!.toDataURL("image/png");
  const defaultFileLocation = path.join(__dirname, "../../../frontend/performance/performancePic.png");
  // debugPrint("&&&&&&&&&&&&&URL: " + tempUrl);
  // PerformanceWriterClient.saveCanvas(tempUrl); // (document.getElementById("imodelview") as HTMLCanvasElement)!.toDataURL());
  const newlink = document.createElement("a");
  // newlink.innerHTML = "Google";
  // newlink.setAttribute("title", "Google");

  newlink.setAttribute("href", tempUrl);
  newlink.setAttribute("id", "download");
  newlink.setAttribute("download", defaultFileLocation);
  newlink.setAttribute("target", "_blank");
  document.body.appendChild(newlink);

  // const link = $('<a href="' + tempUrl + '" id="download" download="' + fileName + '" target="_blank"> </a>');
  document.body.appendChild(newlink);
  (document.getElementById("download") as HTMLCanvasElement).click();
  // $("#download").get(0).click();

}

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
  const htmlCanvas: HTMLCanvasElement = document.getElementById("imodelview") as HTMLCanvasElement; // await document.createElement("htmlCanvas") as HTMLCanvasElement; // document.getElementById("imodelview") as HTMLCanvasElement;
  htmlCanvas!.width = htmlCanvas!.height = 500;
  document.body.appendChild(htmlCanvas!);

  if (htmlCanvas) {
    debugPrint("openView - htmlCanvas exists");
    debugPrint("theViewport: " + theViewport);
    debugPrint("htmlCanvas: " + htmlCanvas);
    // debugPrint("theViewport.view: " + theViewport!.view);
    theViewport = new Viewport(htmlCanvas, state.viewState!);
    theViewport.continuousRendering = false;
    theViewport.sync.setRedrawPending;
    (theViewport!.target as Target).performanceMetrics = new PerformanceMetrics(true, false);
    debugPrint("theViewport: " + theViewport);
    debugPrint("state.viewState: " + state.viewState);
    await _changeView(state.viewState!);
    debugPrint("theViewport: " + theViewport);
    debugPrint("theViewport.view: " + theViewport!.view);
    debugPrint("iModel: " + (theViewport.iModel === undefined));
    debugPrint("_changeView Finished");
    debugPrint("viewManager: " + IModelApp.viewManager);
    debugPrint("iModel: " + theViewport.iModel);
    IModelApp.viewManager.addViewport(theViewport);
    debugPrint("Finished IModelApp.viewManager.addViewport");
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
    debugPrint("Filename: " + filename);
    state.iModelConnection = await IModelConnection.openStandalone(filename);
    debugPrint("openStandalone succeeded");
    debugPrint("88888888888888configuration.iModelName: " + configuration.iModelName);
    // configuration.iModelName = state.iModelConnection.name;
    debugPrint("99999999999999configuration.iModelName: " + configuration.iModelName);
  } catch (err) {
    debugPrint("openStandaloneIModel failed: " + err);
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
  debugPrint("---Just started mainBody!!!!");
  await PerformanceWriterClient.startup();
  debugPrint("---Just started mainBody2!!!!");

  // this is the default configuration
  configuration = {
    userName: "bistroDEV_pmadm1@mailinator.com",
    password: "pmadm1",
    iModelName: path.join(iModelLocation, "Wraith_MultiMulti.ibim"), // "D:\\models\\ibim_bim0200dev\\Wraith.ibim", // "D:\\models\\ibim_bim0200dev\\Wraith.ibim", // "atp_10K.bim", // "D:/models/ibim_bim0200dev/Wraith.ibim", // "atp_10K.bim",
    viewName: "V0", // "Physical-Tag",
  } as SVTConfiguration;
  // override anything that's in the configuration
  // retrieveConfigurationOverrides(configuration);
  // applyConfigurationOverrides(configuration);

  debugPrint("Configuration: " + JSON.stringify(configuration));

  // Start the backend
  // const config = new IModelHostConfiguration();
  // config.hubDeploymentEnv = "QA";
  // await IModelHost.startup(config);
  debugPrint("Starting create Window");

  createWindow();

  // start the app.
  IModelApp.startup();
  debugPrint("IModelApp Started up");

  // initialize the Project and IModel Api
  debugPrint("Initialize ProjectApi and ImodelApi");
  await ProjectApi.init();
  await IModelApi.init();
  debugPrint("Finished Initializing ProjectApi and ImodelApi");

  activeViewState = new SimpleViewState();

  // showStatus("Opening", configuration.iModelName);
  debugPrint("Opening standaloneImodel");
  await openStandaloneIModel(activeViewState, configuration.iModelName);

  // open the specified view
  // showStatus("opening View", configuration.viewName);
  debugPrint("Build the view list");
  await loadView(activeViewState, configuration);

  // now connect the view to the canvas
  debugPrint("Open the view");
  await openView(activeViewState);
  debugPrint("This is from frontend/main");

  // Load all tiles ???
  // await waitForTilesToLoad().then(savePng);
  debugPrint("1111111111111111111111 - waitForTilesToLoad has STARTED");
  await waitForTilesToLoad();
  debugPrint("1111111111111111111111 - waitForTilesToLoad has FINISHED");
  savePng();

  // savePng();

  const plan = new UpdatePlan();
  theViewport!.renderFrame(plan);

  theViewport!.sync.setRedrawPending;
  theViewport!.renderFrame(plan);
  const target = (theViewport!.target as Target);
  const frameTimes = target.frameTimings;
  for (let i = 0; i < 11 && frameTimes.length; ++i)
    debugPrint("frameTimes[" + i + "]: " + frameTimes[i]);

  debugPrint("///////////////////////////////// start extra renderFrames");

  for (let i = 0; i < 20; ++i) {
    debugPrint("///////////////////////////////// extra renderFrames " + i);
    (theViewport!.target as Target).performanceMetrics!.frameTimes = [];
    theViewport!.sync.setRedrawPending;
    theViewport!.sync.invalidateScene();
    theViewport!.renderFrame(plan);
    await printResults(curTileLoadingTime, (theViewport!.target as Target).frameTimings);
  }

  // savePng();

  debugPrint("/////////////////////////////////  -- b4 shutdown");
  if (activeViewState.iModelConnection) await activeViewState.iModelConnection.closeStandalone();
  IModelApp.shutdown();
  await PerformanceWriterClient.finishSeries();
  // WebGLTestContext.shutdown();
  // TestApp.shutdown();
  debugPrint("//" + (theViewport!.target as Target).frameTimings);
  debugPrint("/////////////////////////////////  -- after shutdown");

}

describe("PerformanceTests - 1", () => {
  it("Test 2 - Wraith_MultiMulti Model - V0", (done) => {
    debugPrint("/////////////////////////////////  -- b4 async");
    mainBody().then((_result) => {
      debugPrint("/////////////////////////////////  -- inside .then() function");
      done();
    }).catch((error) => {
      debugPrint("Exception in mainBody: " + error.toString());
    });
    debugPrint("/////////////////////////////////  -- after async");
  });
});
