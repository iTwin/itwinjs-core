/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { ViewState } from "@bentley/imodeljs-frontend"; // @ts-ignore
import { ViewDefinitionProps, ViewQueryParams } from "@bentley/imodeljs-common"; // tslint:disable-line
import { AccessToken, Project, IModelRepository } from "@bentley/imodeljs-clients"; // @ts-ignore
import { PerformanceWriterClient } from "./PerformanceWriterClient";
import { IModelConnection, IModelApp, Viewport } from "@bentley/imodeljs-frontend"; // @ts-ignore
import { Target, UpdatePlan, PerformanceMetrics } from "@bentley/imodeljs-frontend/lib/rendering";
import { IModelApi } from "./IModelApi"; // @ts-ignore
import { ProjectApi } from "./ProjectApi"; // @ts-ignore
import { CONSTANTS } from "../../common/Testbed";
import * as path from "path";

const iModelLocation = path.join(CONSTANTS.IMODELJS_CORE_DIRNAME, "test-apps/testbed/frontend/performance/imodels/");

function createWindow() {
  const canv = document.createElement("canvas");
  canv.id = "imodelview";
  document.body.appendChild(canv);
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

  public constructor(frameTimes: number[], imodelName?: string, viewName?: string, viewFlags?: string) {
    let sumOfTimes = 0;
    for (let i = 0; i < 10; i++)
      sumOfTimes += frameTimes[i];

    const data = this.data;
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

async function printResults(frameTimes: number[]) {
  await PerformanceWriterClient.addEntry(new PerformanceEntry(frameTimes, configuration.iModelName, configuration.viewName));
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

async function _changeView(view: ViewState) {
  await theViewport!.changeView(view);
  activeViewState.viewState = view;
  // await buildModelMenu(activeViewState);
  // buildCategoryMenu(activeViewState);
  // updateRenderModeOptionsMap();
}
// opens the view and connects it to the HTML canvas element.
async function openView(state: SimpleViewState) {
  // find the canvas.
  const htmlCanvas: HTMLCanvasElement = document.getElementById("imodelview") as HTMLCanvasElement; // await document.createElement("htmlCanvas") as HTMLCanvasElement; // document.getElementById("imodelview") as HTMLCanvasElement;
  htmlCanvas!.width = htmlCanvas!.height = 400;
  await document.body.appendChild(htmlCanvas!);

  if (htmlCanvas) {
    console.log("openView - htmlCanvas exists"); // tslint:disable-line
    console.log("theViewport: " + theViewport); // tslint:disable-line
    console.log("htmlCanvas: " + htmlCanvas); // tslint:disable-line
    // console.log("theViewport.view: " + theViewport!.view); // tslint:disable-line
    theViewport = await new Viewport(htmlCanvas, state.viewState!);
    theViewport.continuousRendering = false;
    theViewport.sync.setRedrawPending;
    (theViewport!.target as Target).performanceMetrics = new PerformanceMetrics(true, false);
    console.log("theViewport: " + theViewport); // tslint:disable-line
    console.log("state.viewState: " + state.viewState); // tslint:disable-line
    await _changeView(state.viewState!);
    console.log("theViewport: " + theViewport); // tslint:disable-line
    console.log("theViewport.view: " + theViewport!.view); // tslint:disable-line
    console.log("iModel: " + theViewport.iModel === undefined); // tslint:disable-line
    console.log("_changeView Finished"); // tslint:disable-line
    console.log("viewManager: " + IModelApp.viewManager); // tslint:disable-line
    console.log("iModel: " + theViewport.iModel); // tslint:disable-line
    IModelApp.viewManager.addViewport(theViewport);
    console.log("Finished IModelApp.viewManager.addViewport"); // tslint:disable-line
  }
}
// selects the configured view.
async function buildViewList(state: SimpleViewState, configurations?: { viewName?: string }) {
  const config = undefined !== configurations ? configurations : {};
  // const viewList = document.getElementById("viewList") as HTMLSelectElement;
  const viewQueryParams: ViewQueryParams = { wantPrivate: false };
  const viewSpecs: IModelConnection.ViewSpec[] = await state.iModelConnection!.views.getViewList(viewQueryParams);
  console.log("config.viewName: " + config.viewName); // tslint:disable-line
  for (const viewSpec of viewSpecs) {
    console.log("----------\nviewSpec: " + viewSpec); // tslint:disable-line
    console.log("viewSpec.name: " + viewSpec.name); // tslint:disable-line
    if (viewSpec.name === config.viewName) {
      console.log("viewSpec.name: " + viewSpec.name); // tslint:disable-line
      // viewList!.value = viewSpec.name;
      const viewState = await state.iModelConnection!.views.load(viewSpec.id);
      // viewMap.set(viewSpec.name, viewState);
      state.viewState = viewState;
    }
  }
}
// opens the configured iModel from disk
async function openStandaloneIModel(state: SimpleViewState, filename: string) {
  try {
    configuration.standalone = true;
    console.log("Filename: " + filename); // tslint:disable-line
    state.iModelConnection = await IModelConnection.openStandalone(filename);
    console.log("openStandalone succeeded"); // tslint:disable-line
    console.log("88888888888888configuration.iModelName: " + configuration.iModelName); // tslint:disable-line
    // configuration.iModelName = state.iModelConnection.name;
    console.log("99999999999999configuration.iModelName: " + configuration.iModelName); // tslint:disable-line
  } catch (err) {
    console.log("openStandaloneIModel failed: " + err); // tslint:disable-line
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

describe("PerformanceTests - 1", () => {
  // let imodel: IModelConnection;
  // let spatialView: SpatialViewState;

  // before(async () => {
  //   PerformanceWriterClient.startup();
  // });
  // after(async () => {
  //   console.log("/////////////////////////////////  -- b4 shutdown"); // tslint:disable-line
  //   PerformanceWriterClient.finishSeries();
  //   IModelApp.shutdown();
  //   // WebGLTestContext.shutdown();
  //   // TestApp.shutdown();
  //   console.log("/////////////////////////////////  -- after shutdown"); // tslint:disable-line

  // });

  it("Test 1 - Wraith Model - W0", async () => {
    await PerformanceWriterClient.startup();

    // this is the default configuration
    configuration = {
      userName: "bistroDEV_pmadm1@mailinator.com",
      password: "pmadm1",
      iModelName: path.join(iModelLocation, "Wraith.ibim"), // path.join("../../", __dirname, "Wraith.ibim"), // "D:\\models\\ibim_bim0200dev\\Wraith.ibim", // "D:\\models\\ibim_bim0200dev\\Wraith.ibim", // "atp_10K.bim", // "D:/models/ibim_bim0200dev/Wraith.ibim", // "atp_10K.bim",
      viewName: "W0", // "Physical-Tag",
    } as SVTConfiguration;
    // override anything that's in the configuration
    // retrieveConfigurationOverrides(configuration);
    // applyConfigurationOverrides(configuration);

    console.log("Configuration", JSON.stringify(configuration)); // tslint:disable-line

    // Start the backend
    // const config = new IModelHostConfiguration();
    // config.hubDeploymentEnv = "QA";
    // await IModelHost.startup(config);
    console.log("Starting create Window"); // tslint:disable-line

    await createWindow();

    // start the app.
    await IModelApp.startup();
    console.log("IModelApp Started up"); // tslint:disable-line

    // initialize the Project and IModel Api
    console.log("Initialize ProjectApi and ImodelApi"); // tslint:disable-line
    await ProjectApi.init();
    await IModelApi.init();
    console.log("Finished Initializing ProjectApi and ImodelApi"); // tslint:disable-line

    activeViewState = new SimpleViewState();

    // showStatus("Opening", configuration.iModelName);
    console.log("Opening standaloneImodel"); // tslint:disable-line
    await openStandaloneIModel(activeViewState, configuration.iModelName);

    // open the specified view
    // showStatus("opening View", configuration.viewName);
    console.log("Build the view list"); // tslint:disable-line
    await buildViewList(activeViewState, configuration);

    // now connect the view to the canvas
    console.log("Open the view"); // tslint:disable-line
    await openView(activeViewState);
    console.log("This is from frontend/main"); // tslint:disable-line

    const plan = new UpdatePlan();
    theViewport!.sync.setRedrawPending;
    await theViewport!.renderFrame(plan);
    const target = (theViewport!.target as Target);
    const frameTimes = target.frameTimings;
    for (let i = 0; i < 11 && frameTimes.length; ++i)
      console.log("frameTimes[" + i + "]: " + frameTimes[i]); // tslint:disable-line

    await printResults(frameTimes);
    theViewport!.sync.setRedrawPending;
    await theViewport!.renderFrame(plan);
    for (let i = 0; i < 11 && frameTimes.length; ++i)
      console.log("frameTimes[" + i + "]: " + frameTimes[i]); // tslint:disable-line
    await printResults((theViewport!.target as Target).frameTimings);
    theViewport!.sync.setRedrawPending;
    await theViewport!.renderFrame(plan);
    await printResults((theViewport!.target as Target).frameTimings);
    theViewport!.sync.setRedrawPending;
    await theViewport!.renderFrame(plan);
    await printResults((theViewport!.target as Target).frameTimings);
    theViewport!.sync.setRedrawPending;
    await theViewport!.renderFrame(plan);
    await printResults((theViewport!.target as Target).frameTimings);
    theViewport!.sync.setRedrawPending;
    await theViewport!.renderFrame(plan);
    await printResults((theViewport!.target as Target).frameTimings);
    theViewport!.sync.setRedrawPending;
    await theViewport!.renderFrame(plan);
    await printResults((theViewport!.target as Target).frameTimings);
    theViewport!.sync.setRedrawPending;
    await theViewport!.renderFrame(plan);
    await printResults((theViewport!.target as Target).frameTimings);
    theViewport!.sync.setRedrawPending;
    await theViewport!.renderFrame(plan);
    await printResults((theViewport!.target as Target).frameTimings);
    theViewport!.sync.setRedrawPending;
    await theViewport!.renderFrame(plan);
    await printResults((theViewport!.target as Target).frameTimings);
    theViewport!.sync.setRedrawPending;
    await theViewport!.renderFrame(plan);
    await printResults((theViewport!.target as Target).frameTimings);

    console.log("/////////////////////////////////  -- b4 shutdown"); // tslint:disable-line
    if (activeViewState.iModelConnection) await activeViewState.iModelConnection.closeStandalone();
    await IModelApp.shutdown();
    await PerformanceWriterClient.finishSeries();
    // WebGLTestContext.shutdown();
    // TestApp.shutdown();
    console.log("/////////////////////////////////  -- after shutdown"); // tslint:disable-line

  });

  it("Test 1 - Wraith Model - W1", async () => {
    await PerformanceWriterClient.startup();

    // this is the default configuration
    configuration = {
      userName: "bistroDEV_pmadm1@mailinator.com",
      password: "pmadm1",
      iModelName: path.join(iModelLocation, "Wraith.ibim"), // "D:\\models\\ibim_bim0200dev\\Wraith.ibim", // "D:\\models\\ibim_bim0200dev\\Wraith.ibim", // "atp_10K.bim", // "D:/models/ibim_bim0200dev/Wraith.ibim", // "atp_10K.bim",
      viewName: "W1", // "Physical-Tag",
    } as SVTConfiguration;
    // override anything that's in the configuration
    // retrieveConfigurationOverrides(configuration);
    // applyConfigurationOverrides(configuration);

    console.log("Configuration", JSON.stringify(configuration)); // tslint:disable-line

    // Start the backend
    // const config = new IModelHostConfiguration();
    // config.hubDeploymentEnv = "QA";
    // await IModelHost.startup(config);
    console.log("Starting create Window"); // tslint:disable-line

    await createWindow();

    // start the app.
    await IModelApp.startup();
    console.log("IModelApp Started up"); // tslint:disable-line

    // initialize the Project and IModel Api
    console.log("Initialize ProjectApi and ImodelApi"); // tslint:disable-line
    await ProjectApi.init();
    await IModelApi.init();
    console.log("Finished Initializing ProjectApi and ImodelApi"); // tslint:disable-line

    activeViewState = new SimpleViewState();

    // showStatus("Opening", configuration.iModelName);
    console.log("Opening standaloneImodel"); // tslint:disable-line
    await openStandaloneIModel(activeViewState, configuration.iModelName);

    // open the specified view
    // showStatus("opening View", configuration.viewName);
    console.log("Build the view list"); // tslint:disable-line
    await buildViewList(activeViewState, configuration);

    // now connect the view to the canvas
    console.log("Open the view"); // tslint:disable-line
    await openView(activeViewState);
    console.log("This is from frontend/main"); // tslint:disable-line

    const plan = new UpdatePlan();
    await theViewport!.renderFrame(plan);
    const target = (theViewport!.target as Target);
    const frameTimes = target.frameTimings;
    for (let i = 0; i < 11 && frameTimes.length; ++i)
      console.log("frameTimes[" + i + "]: " + frameTimes[i]); // tslint:disable-line

    await printResults(frameTimes);
    await theViewport!.renderFrame(plan);
    for (let i = 0; i < 11 && frameTimes.length; ++i)
      console.log("frameTimes[" + i + "]: " + frameTimes[i]); // tslint:disable-line
    await printResults((theViewport!.target as Target).frameTimings);
    await theViewport!.renderFrame(plan);
    await printResults((theViewport!.target as Target).frameTimings);
    await theViewport!.renderFrame(plan);
    await printResults((theViewport!.target as Target).frameTimings);
    await theViewport!.renderFrame(plan);
    await printResults((theViewport!.target as Target).frameTimings);
    await theViewport!.renderFrame(plan);
    await printResults((theViewport!.target as Target).frameTimings);
    await theViewport!.renderFrame(plan);
    await printResults((theViewport!.target as Target).frameTimings);
    await theViewport!.renderFrame(plan);
    await printResults((theViewport!.target as Target).frameTimings);
    await theViewport!.renderFrame(plan);
    await printResults((theViewport!.target as Target).frameTimings);
    await theViewport!.renderFrame(plan);
    await printResults((theViewport!.target as Target).frameTimings);
    await theViewport!.renderFrame(plan);
    await printResults((theViewport!.target as Target).frameTimings);

    console.log("/////////////////////////////////  -- b4 shutdown"); // tslint:disable-line
    if (activeViewState.iModelConnection) await activeViewState.iModelConnection.closeStandalone();
    await IModelApp.shutdown();
    await PerformanceWriterClient.finishSeries();
    // WebGLTestContext.shutdown();
    // TestApp.shutdown();
    console.log("/////////////////////////////////  -- after shutdown"); // tslint:disable-line

  });

});

// /*---------------------------------------------------------------------------------------------
// |  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
//  *--------------------------------------------------------------------------------------------*/
// import { WebGLTestContext } from "../WebGLTestContext";
// import { PerformanceWriterClient } from "./PerformanceWriterClient";

// describe("PerformanceTests", () => {
//   before(() => {
//     WebGLTestContext.startup();
//   });
//   after(() => WebGLTestContext.shutdown());

//   it("/////////////////////////////////////////////////////////////////", () => {
//     if (WebGLTestContext.isInitialized) {
//       // testCreateGeometry();
//     }
//     // const fileName = "C:\\Files\\test.xlsx";
//     // const sheetName = "Sheet1";
//     // const app = Sys.OleObject("Excel.Application")
//     // app.Visible = "True";

//     // const excel = new ActiveXObject("Excel.Application");
//     // excel.Visible = true;
//     // excel.Workbooks.Open("test.xlsx");
//   });
// });

// import { assert, expect } from "chai";
// import { ColorMap } from "@bentley/imodeljs-frontend/lib/rendering";
// import { ColorDef, ColorIndex } from "@bentley/imodeljs-common";

// describe("ColorMap", () => {
//   it("create a new ColorMap", async () => {
//     // console.log(response); //tslint:disable-line
//     async function run() {
//       try {
//         await PerformanceWriterClient.startup();
//         await PerformanceWriterClient.addEntry({
//           imodelName: "test",
//           viewName: "test",
//           viewFlags: "test",
//           data: {
//             tileLoadingTime: 1,
//             scene: 2,
//             garbageExecute: 3,
//             initCommands: 4,
//             backgroundDraw: 5,
//             setClips: 6,
//             opaqueDraw: 7,
//             translucentDraw: 8,
//             hiliteDraw: 9,
//             compositeDraw: 10,
//             overlayDraw: 11,
//             renderFrameTime: 12,
//             glFinish: 13,
//             totalTime: 14,
//           },
//         });
//         await PerformanceWriterClient.addEntry({
//           imodelName: "test",
//           viewName: "test",
//           viewFlags: "test",
//           data: {
//             tileLoadingTime: 11,
//             scene: 12,
//             garbageExecute: 13,
//             initCommands: 14,
//             backgroundDraw: 15,
//             setClips: 16,
//             opaqueDraw: 17,
//             translucentDraw: 18,
//             hiliteDraw: 19,
//             compositeDraw: 110,
//             overlayDraw: 111,
//             renderFrameTime: 112,
//             glFinish: 113,
//             totalTime: 1411,
//           },
//         });
//         await PerformanceWriterClient.addEntry({
//           imodelName: "test",
//           viewName: "test",
//           viewFlags: "test",
//           data: {
//             tileLoadingTime: 21,
//             scene: 22,
//             garbageExecute: 23,
//             initCommands: 24,
//             backgroundDraw: 25,
//             setClips: 26,
//             opaqueDraw: 27,
//             translucentDraw: 28,
//             hiliteDraw: 29,
//             compositeDraw: 20,
//             overlayDraw: 121,
//             renderFrameTime: 122,
//             glFinish: 213,
//             totalTime: 124,
//           },
//         });
//       } catch (ex) {
//         console.log(ex); // tslint:disable-line
//       }

//       await PerformanceWriterClient.finishSeries();
//     }

//     await run();

//     /** Test creating a ColorMap */
//     const a: ColorMap = new ColorMap();
//     expect(a.length).to.equal(0);
//     expect(a.hasTransparency).to.be.false;
//   });

//   it("test insert function", () => {
//     /** Test static getMaxIndex function */
//     const a: ColorMap = new ColorMap();
//     assert.isTrue(a.insert(0xFF0000) === 0);
//     assert.isTrue(a.length === 1);
//     assert.isFalse(a.hasTransparency);
//     assert.isTrue(a.insert(0x0000FF) === 1);
//     assert.isTrue(a.length === 2);
//     assert.isFalse(a.hasTransparency);
//     assert.isTrue(a.insert(0x0000FF) === 1);
//     assert.isTrue(a.length === 2);
//     assert.isFalse(a.hasTransparency);
//     assert.isTrue(a.insert(0xFF0000) === 0);
//     assert.isTrue(a.length === 2);
//     assert.isFalse(a.hasTransparency);
//     assert.isTrue(a.insert(0xFFFFFF) === 2);
//     assert.isTrue(a.length === 3);
//     assert.isFalse(a.hasTransparency);
//     assert.isTrue(a.insert(0x0000FF) === 1);
//     assert.isTrue(a.length === 3);
//     assert.isFalse(a.hasTransparency);
//     assert.isTrue(a.insert(0xFF0000) === 0);
//     assert.isTrue(a.length === 3);
//     assert.isFalse(a.hasTransparency);
//     assert.isTrue(a.insert(0xFFFFFF) === 2);
//     assert.isTrue(a.length === 3);
//     assert.isFalse(a.hasTransparency);
//   });

//   it("test simple return functions", () => {
//     /** Test hasTransparency function */
//     let a: ColorMap = new ColorMap();
//     assert.isFalse(a.hasTransparency);
//     a.insert(0x01000000);
//     assert.isTrue(a.hasTransparency);
//     a.insert(0xFF000000);
//     assert.isTrue(a.hasTransparency);
//     a.insert(0x7FFFFFFF);
//     assert.isTrue(a.hasTransparency);
//     a = new ColorMap();
//     a.insert(0xFF000000);
//     assert.isTrue(a.hasTransparency);
//     a = new ColorMap();
//     a.insert(0x7FFFFFFF);
//     assert.isTrue(a.hasTransparency);
//     a = new ColorMap();
//     a.insert(0x00000000);
//     assert.isFalse(a.hasTransparency);
//     a = new ColorMap();
//     a.insert(0x00FFFFFF);
//     assert.isFalse(a.hasTransparency);
//     let inserted = false;
//     try { // try to insert a translucent color into a table which does not have transparency.
//       a.insert(0x0F000000);
//       inserted = true;
//     } catch (err) {
//       expect(err).is.not.undefined;
//     }
//     expect(inserted).to.be.false;

//     /** Test isUniform function */
//     a = new ColorMap();
//     assert.isFalse(a.isUniform);
//     a.insert(0xFF0000);
//     assert.isTrue(a.isUniform);
//     a.insert(0x00FF00);
//     assert.isFalse(a.isUniform);
//     a.insert(0x0000FF);
//     assert.isFalse(a.isUniform);

//     /** Test isFull function */
//     a = new ColorMap();
//     assert.isFalse(a.isFull);
//     for (let i = 0; a.length !== 0xffff; i++) {
//       assert.isFalse(a.isFull);
//       a.insert(i);
//     }
//     assert.isTrue(a.length === 0xffff);
//     assert.isTrue(a.isFull);

//     /** Test getNumIndices function */
//     a = new ColorMap();
//     assert.isTrue(a.length === 0);
//     for (let i = 0; a.length !== 0xffff; i++) {
//       assert.isTrue(a.length === i);
//       a.insert(i);
//     }
//     assert.isTrue(a.length === 0xffff);

//     /** Test size function */
//     a = new ColorMap();
//     assert.isTrue(a.length === 0);
//     for (let i = 0; a.length !== 0xffff; i++) {
//       assert.isTrue(a.length === i);
//       a.insert(i);
//     }
//     assert.isTrue(a.length === 0xffff);

//     /** Test empty function */
//     a = new ColorMap();
//     assert.isTrue(a.isEmpty);
//     a.insert(0x00FFFF);
//     assert.isFalse(a.isEmpty);
//     a.insert(0xFFFF00);
//     assert.isFalse(a.isEmpty);
//     a.insert(0xFFFFFF);
//     assert.isFalse(a.isEmpty);
//   });

//   it("test toColorIndex function", () => {
//     /** Test toColorIndex function */
//     let a: ColorMap = new ColorMap();
//     const uint16: Uint16Array = new Uint16Array(2);
//     let colorIndex = new ColorIndex();

//     a.insert(0xFFFFFF);
//     a.toColorIndex(colorIndex, uint16);
//     expect(colorIndex.uniform!.tbgr).to.equal(0xFFFFFF);
//     assert.isTrue(colorIndex.numColors === 1);

//     a = new ColorMap();
//     colorIndex = new ColorIndex();
//     expect(colorIndex.uniform!.tbgr).to.equal(ColorDef.white.tbgr);
//     assert.isTrue(colorIndex.numColors === 1);
//     a.insert(0x0000FFFF);
//     a.toColorIndex(colorIndex, uint16);
//     expect(colorIndex.isUniform).to.equal(true);
//     assert.isTrue(colorIndex.uniform!.tbgr === 0x0000FFFF);
//     assert.isTrue(colorIndex.numColors === 1);

//     a = new ColorMap();
//     a.insert(0x0000FFFF);
//     a.insert(0x000000FF);
//     colorIndex = new ColorIndex();
//     colorIndex.initUniform(0x00FF00FF);
//     assert.isTrue(colorIndex.numColors === 1);
//     a.toColorIndex(colorIndex, uint16);
//     assert.isFalse(colorIndex.isUniform);
//     assert.isTrue(colorIndex.nonUniform && colorIndex.nonUniform.colors.length === 2);
//     let values = colorIndex.nonUniform ? colorIndex.nonUniform.colors.values() : undefined;
//     assert.isTrue(values && values.next().value === 0x0000FFFF);
//     assert.isTrue(values && values.next().value === 0x000000FF);
//     assert.isTrue(values && values.next().done);
//     assert.isTrue(colorIndex.numColors === 2);

//     a = new ColorMap();
//     a.insert(0x00000000);
//     a.insert(0x0000FFFF);
//     a.insert(0x000000FF);
//     colorIndex = new ColorIndex();
//     assert.isTrue(colorIndex.numColors === 1);
//     a.toColorIndex(colorIndex, uint16);
//     assert.isFalse(colorIndex.isUniform);
//     assert.isTrue(colorIndex.nonUniform && colorIndex.nonUniform.colors.length === 3);
//     values = colorIndex.nonUniform ? colorIndex.nonUniform.colors.values() : undefined;
//     assert.isTrue(values && values.next().value === 0x00000000);
//     assert.isTrue(values && values.next().value === 0x0000FFFF);
//     assert.isTrue(values && values.next().value === 0x000000FF);
//     assert.isTrue(values && values.next().done);
//     assert.isTrue(colorIndex.numColors === 3);
//   });
// });
