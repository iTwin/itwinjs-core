/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { TestRunner, TestSetsProps } from "./TestRunner";
import { ClientRequestContext, ProcessDetector } from "@bentley/bentleyjs-core";
import { ElectronApp } from "@bentley/electron-manager/lib/ElectronFrontend";
import {
  BentleyCloudRpcManager, IModelReadRpcInterface, IModelTileRpcInterface, RpcConfiguration, SnapshotIModelRpcInterface,
} from "@bentley/imodeljs-common";
import { FrontendRequestContext, IModelApp, IModelAppOptions, NativeAppAuthorization } from "@bentley/imodeljs-frontend";
import { BrowserAuthorizationClient, BrowserAuthorizationClientConfiguration } from "@bentley/frontend-authorization-client";
import { I18NOptions } from "@bentley/imodeljs-i18n";
import { HyperModeling } from "@bentley/hypermodeling-frontend";
import DisplayPerfRpcInterface from "../common/DisplayPerfRpcInterface";

export class DisplayPerfTestApp {
  public static async startup(iModelApp?: IModelAppOptions): Promise<void> {
    iModelApp = iModelApp ?? {};
    iModelApp.i18n = { urlTemplate: "locales/en/{{ns}}.json" } as I18NOptions;

    iModelApp.rpcInterfaces = [DisplayPerfRpcInterface, IModelTileRpcInterface, SnapshotIModelRpcInterface, IModelReadRpcInterface];
    if (ProcessDetector.isElectronAppFrontend)
      await ElectronApp.startup({ iModelApp });
    else
      await IModelApp.startup(iModelApp);

    await HyperModeling.initialize();

    IModelApp.animationInterval = undefined;
  }
}

async function createOidcClient(requestContext: ClientRequestContext): Promise<NativeAppAuthorization | BrowserAuthorizationClient> {
  const scope = "openid email profile organization imodelhub context-registry-service:read-only reality-data:read product-settings-service projectwise-share urlps-third-party";

  if (ProcessDetector.isElectronAppFrontend) {
    const clientId = "imodeljs-electron-test";
    const redirectUri = "http://localhost:3000/signin-callback";
    const oidcConfiguration = { clientId, redirectUri, scope: `${scope} offline_access` };
    const desktopClient = new NativeAppAuthorization(oidcConfiguration);
    await desktopClient.initialize(requestContext);
    return desktopClient;
  } else {
    const clientId = "imodeljs-spa-test";
    const redirectUri = "http://localhost:3000/signin-callback";
    const oidcConfiguration: BrowserAuthorizationClientConfiguration = { clientId, redirectUri, scope: `${scope} imodeljs-router`, responseType: "code" };
    const browserClient = new BrowserAuthorizationClient(oidcConfiguration);
    return browserClient;
  }
}

// Wraps the signIn process
// In the case of use in web applications:
// - called the first time to start the signIn process - resolves to false
// - called the second time as the Authorization provider redirects to cause the application to refresh/reload - resolves to false
// - called the third time as the application redirects back to complete the authorization - finally resolves to true
// In the case of use in electron applications:
// - promise wraps around a registered call back and resolves to true when the sign in is complete
// @return Promise that resolves to true only after signIn is complete. Resolves to false until then.
async function signIn(): Promise<boolean> {
  const requestContext = new FrontendRequestContext();
  const oidcClient = await createOidcClient(requestContext);

  IModelApp.authorizationClient = oidcClient;
  if (oidcClient.isAuthorized)
    return true;

  const retPromise = new Promise<boolean>((resolve, _reject) => {
    oidcClient.onUserStateChanged.addListener((token) => {
      resolve(token !== undefined);
    });
  });

  await oidcClient.signIn(requestContext);
  return retPromise;
}

<<<<<<< HEAD
async function getAllMatchingModels(testConfig: DefaultConfigs): Promise<string[]> {
  if (!testConfig.iModelLocation || !testConfig.iModelName?.includes("*"))
    return [testConfig.iModelName!];

  const matchingFilesJson = await DisplayPerfRpcInterface.getClient().getMatchingFiles(testConfig.iModelLocation, testConfig.iModelName ?? "*");
  const matchingFiles = JSON.parse(matchingFilesJson);
  const matchingIModels: string[] = [];
  matchingFiles.forEach((file: string) => {
    if ((file.endsWith(".bim") || file.endsWith(".ibim"))) {
      const fileSplit = file.split("\\");
      const model = fileSplit[fileSplit.length - 1];
      if (model)
        matchingIModels.push(model);
    }
  });
  return matchingIModels;
}

async function getAllMatchingSavedViews(testConfig: DefaultConfigs): Promise<string[]> {
  const intViews: string[] = [];
  const extViews: string[] = [];

  await openImodelAndLoadExtViews(testConfig); // Open iModel & load all external saved views into activeViewState

  if (testConfig.savedViewType?.toLocaleLowerCase() !== "external") { // Get both public & private internal/local saved views
    if (activeViewState.iModelConnection) {
      const viewSpecs = await activeViewState.iModelConnection.views.getViewList({ wantPrivate: true });
      viewSpecs.forEach((spec) => intViews.push(spec.name));
    }
  }
  if (testConfig.savedViewType?.toLocaleLowerCase() !== "internal" && testConfig.savedViewType?.toLocaleLowerCase() !== "local") {  // Open external saved views
    activeViewState.externalSavedViews?.forEach((view) => extViews.push(view._name));
  }

  const allViews = intViews.concat(extViews);
  return allViews.filter((view) => matchRule(view, testConfig.viewName ?? "*")).sort(); // Filter & alphabetize all view names
}

async function openImodelAndLoadExtViews(testConfig: DefaultConfigs, extViews?: any[]): Promise<void> {
  activeViewState = new SimpleViewState();

  // Open an iModel from a local file
  let openLocalIModel = (testConfig.iModelLocation !== undefined) || ProcessDetector.isMobileAppFrontend;
  if (openLocalIModel) {
    try {
      activeViewState.iModelConnection = await SnapshotConnection.openFile(testConfig.iModelFile!);
    } catch (err) {
      alert(`openSnapshot failed: ${err.toString()}`);
      openLocalIModel = false;
    }
    if (extViews) {
      activeViewState.externalSavedViews = extViews;
    } else {
      const esvString = await DisplayPerfRpcInterface.getClient().readExternalSavedViews(testConfig.iModelFile!);
      if (undefined !== esvString && "" !== esvString) {
        activeViewState.externalSavedViews = JSON.parse(esvString) as any[];
      }
    }
  }

  // Open an iModel from iModelHub
  if (!openLocalIModel && testConfig.iModelHubProject !== undefined && !ProcessDetector.isMobileAppFrontend) {
    const signedIn: boolean = await signIn();
    if (!signedIn)
      return;

    const requestContext = await AuthorizedFrontendRequestContext.create();
    requestContext.enter();

    const iModelName = testConfig.iModelName!.replace(".ibim", "").replace(".bim", "");
    activeViewState.projectConfig = { projectName: testConfig.iModelHubProject, iModelName } as ConnectProjectConfiguration;
    activeViewState.project = await initializeIModelHub(activeViewState.projectConfig.projectName);
    activeViewState.iModel = await IModelApi.getIModelByName(requestContext, activeViewState.project!.wsgId, activeViewState.projectConfig.iModelName);
    if (activeViewState.iModel === undefined)
      throw new Error(`${activeViewState.projectConfig.iModelName} - IModel not found in project ${activeViewState.project!.name}`);
    activeViewState.iModelConnection = await IModelApi.openIModel(activeViewState.project!.wsgId, activeViewState.iModel.wsgId, undefined, OpenMode.Readonly);

    if (extViews) {
      activeViewState.externalSavedViews = extViews;
    } else if (activeViewState.project) { // Get any external saved views from iModelHub if they exist
      try {
        const projectShareClient: ProjectShareClient = new ProjectShareClient();
        const projectId = activeViewState.project.wsgId;
        const findFile = async (folderId: string): Promise<boolean> => {
          const files: ProjectShareFile[] = await projectShareClient.getFiles(requestContext, projectId, new ProjectShareFileQuery().inFolderWithNameLike(folderId, `${iModelName}_ESV.json`));
          if (files && files.length > 0) {
            const content = await projectShareClient.readFile(requestContext, files[0]);
            const esvString = new TextDecoder("utf-8").decode(content);
            if (undefined !== esvString && "" !== esvString) {
              activeViewState.externalSavedViews = JSON.parse(esvString) as any[];
            }
            return true;
          }
          return false;
        };
        const findAllFiles = async (folderId: string): Promise<boolean> => {
          if (await findFile(folderId))
            return true;
          else {
            const folders = await projectShareClient.getFolders(requestContext, projectId, new ProjectShareFolderQuery().inFolder(folderId));
            let fileFound = false;
            for (let i = 0; i < folders.length && !fileFound; i++) {
              fileFound = await findAllFiles(folders[i].wsgId);
            }
            return fileFound;
          }
        };
        // Set activeViewState.externalSavedViews using the first _ESV.json file found in iModelHub with the iModel's name
        await findAllFiles(activeViewState.project.wsgId);
      } catch (error) {
        // Couldn't access the project share files
      }
    }
  }

}

async function loadIModel(testConfig: DefaultConfigs, extViews?: any[]): Promise<boolean> {
  await openImodelAndLoadExtViews(testConfig, extViews); // Open iModel & load all external saved views into activeViewState

  // open the specified view
  if (undefined !== testConfig.viewStatePropsString)
    await loadViewString(activeViewState, testConfig.viewStatePropsString, testConfig.selectedElements, testConfig.overrideElements);
  else if (undefined !== testConfig.extViewName)
    await loadExternalView(activeViewState, testConfig.extViewName);
  else if (undefined !== testConfig.viewName)
    await loadView(activeViewState, testConfig.viewName);
  else
    return false;

  // Make sure the view was set up.  If not (probably because the name wasn't found anywhere) just skip this test.
  if (undefined === activeViewState.viewState)
    return false;

  // now connect the view to the canvas
  await openView(activeViewState, testConfig.view!);
  // assert(theViewport !== undefined, "ERROR: theViewport is undefined");

  // Set the hilite/emphasis settings
  if (undefined !== testConfig.hilite)
    theViewport!.hilite = Hilite.cloneSettings(testConfig.hilite);
  if (undefined !== testConfig.emphasis)
    theViewport!.emphasisSettings = Hilite.cloneSettings(testConfig.emphasis);

  // Set the display style
  const iModCon = activeViewState.iModelConnection;
  if (iModCon && testConfig.displayStyle) {
    const displayStyleProps = await iModCon.elements.queryProps({ from: DisplayStyleState.classFullName, where: `CodeValue = '${testConfig.displayStyle}'` });
    if (displayStyleProps.length >= 1)
      theViewport!.view.setDisplayStyle(new DisplayStyle3dState(displayStyleProps[0] as DisplayStyleProps, iModCon));
  }

  // Set the viewFlags (including the render mode)
  if (undefined !== activeViewState.viewState) {
    if (testConfig.viewFlags) {
      // Use the testConfig.viewFlags data for each property in ViewFlags if it exists; otherwise, keep using the viewState's ViewFlags info
      for (const [key] of Object.entries(activeViewState.viewState.displayStyle.viewFlags)) {
        if ((testConfig.viewFlags as Options)[key] !== undefined)
          (activeViewState.viewState.displayStyle.viewFlags as Options)[key] = (testConfig.viewFlags as Options)[key];
        else
          (testConfig.viewFlags as Options)[key] = (activeViewState.viewState.displayStyle.viewFlags as Options)[key];
      }
    }
    if (undefined !== testConfig.backgroundMap) {
      // Use the testConfig.backgroundMap data for each property in Background if it exists; otherwise, keep using the viewState's ViewFlags info
      const bmSettings = activeViewState.viewState.displayStyle.settings.backgroundMap;
      activeViewState.viewState.displayStyle.changeBackgroundMapProps(bmSettings.clone(testConfig.backgroundMap));
    }
  }

  // Set the overrides for elements (if there are any)
  if (undefined !== iModCon && undefined !== activeViewState.overrideElements) {
    // Hook up the feature override provider and set up the overrides in it from the ViewState.
    // Note that we do not have to unhook it or clear out the feature overrides if there are none since the viewport is created from scratch each time.
    const provider = FOProvider.getOrCreate(theViewport!);
    if (undefined !== provider && undefined !== activeViewState.overrideElements) {
      provider.overrideElementsByArray(activeViewState.overrideElements);
    }
  }

  // Load all tiles
  await waitForTilesToLoad(testConfig.iModelLocation);

  // Set the selected elements (if there are any)
  if (undefined !== iModCon && undefined !== activeViewState.selectedElements) {
    iModCon.selectionSet.add(activeViewState.selectedElements);
    theViewport!.markSelectionSetDirty();
    theViewport!.renderFrame();
  }

  return true;
}

async function closeIModel() {
  debugPrint(`start closeIModel${activeViewState.iModelConnection}`);
  if (activeViewState.iModelConnection) {
    await activeViewState.iModelConnection.close();
  }
  debugPrint("end closeIModel");
}

// Restart the IModelApp if either the TileAdmin.Props or the Render.Options has changed
async function restartIModelApp(testConfig: DefaultConfigs): Promise<void> {
  const newRenderOpts: RenderSystem.Options = testConfig.renderOptions ? testConfig.renderOptions : {};
  const newTileProps: TileAdmin.Props = testConfig.tileProps ? testConfig.tileProps : {};
  if (IModelApp.initialized) {
    let restart = false; // Determine if anything in renderOpts or tileProps changed that requires the IModelApp to be reinitialized
    if (Object.keys(curTileProps).length !== Object.keys(newTileProps).length || Object.keys(curRenderOpts).length !== Object.keys(newRenderOpts).length)
      restart = true;
    for (const [key, value] of Object.entries(curTileProps)) {
      if (value !== (newTileProps as Options)[key]) {
        restart = true;
        break;
      }
    }
    for (const [key, value] of Object.entries(curRenderOpts)) {
      if (key === "disabledExtensions") {
        if ((value ? value.length : 0) !== ((newRenderOpts && newRenderOpts.disabledExtensions) ? newRenderOpts.disabledExtensions.length : 0)) {
          restart = true;
          break;
        }
        for (let i = 0; i < (value ? value.length : 0); i++) {
          if (value && newRenderOpts.disabledExtensions && value[i] !== newRenderOpts.disabledExtensions[i]) {
            restart = true;
            break;
          }
        }
      } else if (value !== (newRenderOpts as Options)[key]) {
        restart = true;
        break;
      }
    }
    if (restart) {
      if (theViewport) {
        theViewport.dispose();
        theViewport = undefined;
      }
      await IModelApp.shutdown();
    }
  }
  curRenderOpts = newRenderOpts;
  curTileProps = newTileProps;
  if (!IModelApp.initialized) {
    await DisplayPerfTestApp.startup({
      renderSys: testConfig.renderOptions,
      tileAdmin: curTileProps,
    });
  }
}

async function createReadPixelsImages(testConfig: DefaultConfigs, pix: Pixel.Selector, pixStr: string) {
  const canvas = theViewport !== undefined ? theViewport.readImageToCanvas() : undefined;
  if (canvas !== undefined) {
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const cssWidth = testConfig.view!.width;
      const cssHeight = testConfig.view!.height;
      const cssRect = new ViewRect(0, 0, cssWidth, cssHeight);

      const imgWidth = cssPixelsToDevicePixels(cssWidth);
      const imgHeight = cssPixelsToDevicePixels(cssHeight);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const elemIdImgData = (pix & Pixel.Selector.Feature) ? ctx.createImageData(imgWidth, imgHeight) : undefined;
      const depthImgData = (pix & Pixel.Selector.GeometryAndDistance) ? ctx.createImageData(imgWidth, imgHeight) : undefined;
      const typeImgData = (pix & Pixel.Selector.GeometryAndDistance) ? ctx.createImageData(imgWidth, imgHeight) : undefined;

      theViewport!.readPixels(cssRect, pix, (pixels: any) => {
        if (undefined === pixels)
          return;
        for (let y = 0; y < imgHeight; ++y) {
          for (let x = 0; x < imgWidth; ++x) {
            const index = (x * 4) + (y * 4 * imgWidth);
            const pixel = pixels.getPixel(x, y);
            // // RGB for element ID
            if (elemIdImgData !== undefined) {
              const elemId = Id64.getLowerUint32(pixel.elementId ? pixel.elementId : "");
              elemIdImgData.data[index + 0] = elemId % 256;
              elemIdImgData.data[index + 1] = (Math.floor(elemId / 256)) % 256;
              elemIdImgData.data[index + 2] = (Math.floor(elemId / (256 ^ 2))) % 256;
              elemIdImgData.data[index + 3] = 255; // Set alpha to 100% opaque
            }
            // RGB for Depth
            if (depthImgData !== undefined) {
              const distColor = pixels.getPixel(x, y).distanceFraction * 255;
              depthImgData.data[index + 0] = depthImgData.data[index + 1] = depthImgData.data[index + 2] = distColor;
              depthImgData.data[index + 3] = 255; // Set alpha to 100% opaque
            }
            // RGB for type
            if (typeImgData !== undefined) {
              const type = pixels.getPixel(x, y).type;
              switch (type) {
                case Pixel.GeometryType.None: // White
                  typeImgData.data[index + 0] = 255;
                  typeImgData.data[index + 1] = 255;
                  typeImgData.data[index + 2] = 255;
                  break;
                case Pixel.GeometryType.Surface: // Red
                  typeImgData.data[index + 0] = 255;
                  typeImgData.data[index + 1] = 0;
                  typeImgData.data[index + 2] = 0;
                  break;
                case Pixel.GeometryType.Linear: // Green
                  typeImgData.data[index + 0] = 0;
                  typeImgData.data[index + 1] = 255;
                  typeImgData.data[index + 2] = 0;
                  break;
                case Pixel.GeometryType.Edge: // Blue
                  typeImgData.data[index + 0] = 0;
                  typeImgData.data[index + 1] = 0;
                  typeImgData.data[index + 2] = 255;
                  break;
                case Pixel.GeometryType.Silhouette: // Purple
                  typeImgData.data[index + 0] = 255;
                  typeImgData.data[index + 1] = 0;
                  typeImgData.data[index + 2] = 255;
                  break;
                case Pixel.GeometryType.Unknown: // Black
                default:
                  typeImgData.data[index + 0] = 0;
                  typeImgData.data[index + 1] = 0;
                  typeImgData.data[index + 2] = 0;
                  break;
              }
              typeImgData.data[index + 3] = 255; // Set alpha to 100% opaque
            }
          }
        }
        return;
      });
      if (elemIdImgData !== undefined) {
        ctx.putImageData(elemIdImgData, 0, 0);
        await savePng(getImageString(testConfig, `elemId_${pixStr}_`), canvas);
      }
      if (depthImgData !== undefined) {
        ctx.putImageData(depthImgData, 0, 0);
        await savePng(getImageString(testConfig, `depth_${pixStr}_`), canvas);
      }
      if (typeImgData !== undefined) {
        ctx.putImageData(typeImgData, 0, 0);
        await savePng(getImageString(testConfig, `type_${pixStr}_`), canvas);
      }
    }
  }
}

async function renderAsync(vp: ScreenViewport, numFrames: number, timings: Array<Map<string, number>>, resultsCallback: (result: any) => void): Promise<void> {
  IModelApp.viewManager.addViewport(vp);

  const debugControl = IModelApp.renderSystem.debugControl!;
  const target = vp.target as Target;
  const metrics = target.performanceMetrics!;
  target.performanceMetrics = undefined;
  debugControl.resultsCallback = undefined; // Turn off glTimer metrics until after the first N frames

  const numFramesToIgnore = 120;
  let ignoreFrameCount = 0;
  let frameCount = 0;
  vp.continuousRendering = true;
  return new Promise((resolve: () => void, _reject) => {
    const timer = new StopWatch();
    const removeListener = vp.onRender.addListener((_) => {
      // Ignore the first N frames - they seem to have more variable frame rate.
      ++ignoreFrameCount;
      if (ignoreFrameCount <= numFramesToIgnore) {
        if (ignoreFrameCount === numFramesToIgnore) {
          // Time to start recording.
          target.performanceMetrics = metrics;
          debugControl.resultsCallback = resultsCallback; // Turn on glTimer metrics after the first N frames
          timer.start();
        }

        return;
      }

      timer.stop();
      timings[frameCount] = metrics.frameTimings;
      timings[frameCount].set("Total Time", timer.current.milliseconds);

      if (++frameCount === numFrames) {
        target.performanceMetrics = undefined;
      }
      if (gpuFramesCollected >= numFrames || (frameCount >= numFrames && !(IModelApp.renderSystem as System).isGLTimerSupported)) {
        removeListener();
        IModelApp.viewManager.dropViewport(vp, false);
        vp.continuousRendering = false;
        debugControl.resultsCallback = undefined; // Turn off glTimer metrics
        resolve();
      } else {
        vp.requestRedraw();
        timer.start();
      }
    });
  });
}

async function runTest(testConfig: DefaultConfigs, extViews?: any[]) {
  // Restart the IModelApp if needed
  await restartIModelApp(testConfig);

  // Reset the title bar to include the current model and view name
  document.title = "Display Performance Test App:  ".concat(testConfig.iModelName ?? "", "  [", testConfig.viewName ?? "", "]");

  // Open and finish loading model
  const loaded = await loadIModel(testConfig, extViews);
  if (!loaded) {
    await closeIModel();
    return; // could not properly open the given model or saved view so skip test
  }

  if (testConfig.testType === "image" || testConfig.testType === "both") {
    updateTestNames(testConfig, undefined, true); // Update the list of image test names
    await savePng(getImageString(testConfig));
    if (testConfig.testType === "image") {
      // Close the imodel & exit if nothing else needs to happen
      await closeIModel();
      return;
    }
  }

  const csvFormat = testConfig.csvFormat!;
  const debugControl = IModelApp.renderSystem.debugControl!;
  gpuFramesCollected = 0; // Set the number of gpu timings collected back to 0

  // Throw away the first n renderFrame times, until it's more consistent
  for (let i = 0; i < (testConfig.numRendersToSkip ? testConfig.numRendersToSkip : 50); ++i) {
    theViewport!.requestRedraw();
    theViewport!.renderFrame();
  }
  testConfig.numRendersToTime = testConfig.numRendersToTime ? testConfig.numRendersToTime : 100;

  // Turn on performance metrics to start collecting data when we render things
  const finalCPUFrameTimings: Array<Map<string, number>> = [];
  const finalGPUFrameTimings = new Map<string, number[]>();
  const timingsForActualFPS: Array<Map<string, number>> = []; // only used to get ; most gpu only metrics come from gpuResultsCallback
  const gpuResultsCallback = (result: GLTimerResult): void => {
    if (gpuFramesCollected < testConfig.numRendersToTime!) {
      const label = result.label;
      const timings = finalGPUFrameTimings.get(label);
      finalGPUFrameTimings.set(label, timings ? timings.concat(result.nanoseconds / 1e6) : [result.nanoseconds / 1e6]); // Save as milliseconds
      if (result.children) {
        for (const kid of result.children)
          gpuResultsCallback(kid);
      }
      if ("Total" === label) // Do this to ensure that we gather the gpu information for exactly 'testConfig.numRendersToTime' frames
        gpuFramesCollected++;
    }
  };

  // Add a pause so that user can start the GPU Performance Capture program
  // await resolveAfterXMilSeconds(7000);

  updateTestNames(testConfig); // Update the list of timing test names
  if (testConfig.testType === "readPixels") {
    const width = testConfig.view!.width;
    const height = testConfig.view!.height;
    const viewRect = new ViewRect(0, 0, width, height);
    const testReadPix = async (pixSelect: Pixel.Selector, pixSelectStr: string) => {
      // Get CPU timings
      (theViewport!.target as Target).performanceMetrics = new PerformanceMetrics(true, false, undefined);
      debugControl.resultsCallback = undefined; // Turn off glTimer metrics
      for (let i = 0; i < testConfig.numRendersToTime!; ++i) {
        theViewport!.readPixels(viewRect, pixSelect, (_pixels: any) => { });
        finalCPUFrameTimings[i] = (theViewport!.target as Target).performanceMetrics!.frameTimings;
        finalCPUFrameTimings[i].delete("Scene Time");
      }
      // Get GPU timings
      gpuFramesCollected = 0; // Set the number of gpu timings collected back to 0
      (theViewport!.target as Target).performanceMetrics = new PerformanceMetrics(true, false, gpuResultsCallback);
      await renderAsync(theViewport!, testConfig.numRendersToTime!, timingsForActualFPS, gpuResultsCallback);
      debugControl.resultsCallback = undefined; // Turn off glTimer metrics
      updateTestNames(testConfig, pixSelectStr, true); // Update the list of image test names
      updateTestNames(testConfig, pixSelectStr, false); // Update the list of timing test names
      const rowData = getRowData(finalCPUFrameTimings, finalGPUFrameTimings, timingsForActualFPS, testConfig, pixSelectStr);
      await saveCsv(testConfig.outputPath!, testConfig.outputName!, rowData, csvFormat);

      // Create images from the elementID, depth (i.e. distance), and type (i.e. order)
      await createReadPixelsImages(testConfig, pixSelect, pixSelectStr);
    };
    // Test each combo of pixel selectors, then close the iModel
    await testReadPix(Pixel.Selector.Feature, "+feature");
    await testReadPix(Pixel.Selector.GeometryAndDistance, "+geom+dist");
    await testReadPix(Pixel.Selector.All, "+feature+geom+dist");
    await closeIModel();
  } else {
    (theViewport!.target as Target).performanceMetrics = new PerformanceMetrics(true, false, gpuResultsCallback);
    await renderAsync(theViewport!, testConfig.numRendersToTime, timingsForActualFPS, gpuResultsCallback);
    // Close model & save csv file
    await closeIModel();
    const rowData = getRowData(timingsForActualFPS, finalGPUFrameTimings, timingsForActualFPS, testConfig);
    await saveCsv(testConfig.outputPath!, testConfig.outputName!, rowData, csvFormat);

    if (wantConsoleOutput) { // Debug purposes only
      debugPrint("------------ ");
      debugPrint(`Tile Loading Time: ${curTileLoadingTime}`);
      for (const t of finalCPUFrameTimings) {
        let timingsString = "[";
        t.forEach((val) => {
          timingsString += `${val}, `;
        });
        debugPrint(`${timingsString}]`);
        // Save all of the individual runs in the csv file, not just the average
        // const rowData = getRowData([t], testConfig);
        // await saveCsv(testConfig.outputPath!, testConfig.outputName!, rowData);
      }
    }
  }
}

// selects the configured view.
async function loadView(state: SimpleViewState, viewName: string) {
  const viewIds = await state.iModelConnection!.elements.queryIds({ from: ViewState.classFullName, where: `CodeValue = '${viewName}'` });
  if (1 === viewIds.size)
    state.viewState = await state.iModelConnection!.views.load(viewIds.values().next().value);

  if (undefined === state.viewState) {
    // Could not find it in the file, so look through the external saved views for this file.
    // This will allow us to use the 'viewName' property in the config file for either type of saved view
    // unless there is one named the same in both lists (which is not being prevented anymore when creating them).
    await loadExternalView(state, viewName);
    return;
  }

  if (undefined === state.viewState)
    debugPrint("Error: failed to load view by name");
}

// selects the configured view from the external saved views list.
async function loadExternalView(state: SimpleViewState, extViewName: string) {
  if (undefined !== state.externalSavedViews) {
    for (const namedExternalSavedView of state.externalSavedViews) {
      if (extViewName === namedExternalSavedView._name) {
        let oe;
        if (undefined !== namedExternalSavedView._overrideElements)
          oe = JSON.parse(namedExternalSavedView._overrideElements) as any[];
        let se;
        if (undefined !== namedExternalSavedView._selectedElements)
          se = JSON.parse(namedExternalSavedView._selectedElements) as Id64Arg;
        await loadViewString(state, namedExternalSavedView._viewStatePropsString, se, oe);
        return;
      }
    }
  }

  if (undefined === state.viewState)
    debugPrint("Error: failed to load view by name");
}

// selects the configured view from a viewStateProperties string.
async function loadViewString(state: SimpleViewState, viewStatePropsString: string, selectedElements: Id64Arg | undefined, overrideElements: any[] | undefined) {
  const vsp = JSON.parse(viewStatePropsString);
  const className = vsp.viewDefinitionProps.classFullName;
  const ctor = await state.iModelConnection!.findClassFor<typeof EntityState>(className, undefined) as typeof ViewState | undefined;
  if (undefined === ctor) {
    debugPrint("Could not create ViewState from viewString");
    state.viewState = undefined;
  } else {
    state.viewState = ctor.createFromProps(vsp, state.iModelConnection!);
    if (undefined !== state.viewState) {
      await state.viewState.load(); // make sure any attachments are loaded
      state.overrideElements = overrideElements;
      state.selectedElements = selectedElements;
    }
  }
}

async function testSet(configs: DefaultConfigs, setData: any, logFileName: string) {
  if (configs.iModelLocation) removeFilesFromDir(configs.iModelLocation, ".Tiles");
  if (configs.iModelLocation) removeFilesFromDir(configs.iModelLocation, ".TileCache");

  // Create DefaultModelConfigs
  const modConfigs = new DefaultConfigs(setData, configs);

  // Perform all tests for this model. If modelName contains an asterisk *,
  // treat it as a wildcard and run tests for each bim or ibim model that matches the given wildcard
  for (const testData of setData.tests) {

    // Create DefaultTestConfigs
    const testConfig = new DefaultConfigs(testData, modConfigs, true);
    const origViewName = testConfig.viewName;
    const allModelNames = await getAllMatchingModels(testConfig);
    for (const modelName of allModelNames) {
      testConfig.iModelName = modelName;
      testConfig.viewName = origViewName; // Reset viewName here in case running multiple models (which will overwrite the viewName)

      // Ensure imodel file exists
      // if (!fs.existsSync(testConfig.iModelFile!))
      //   break;

      // If a viewName contains an asterisk *,
      // treat it as a wildcard and run tests for each saved view that matches the given wildcard
      let allSavedViews = [testConfig.viewName];
      let extViews: any[] | undefined;
      if (testConfig.viewName?.includes("*")) {
        allSavedViews = await getAllMatchingSavedViews(testConfig);
        extViews = activeViewState.externalSavedViews;
      }
      for (const viewName of allSavedViews) {
        testConfig.viewName = viewName;

        // write output log file of timestamp, current model, and view
        const today = new Date();
        const month = (`0${(today.getMonth() + 1)}`).slice(-2);
        const day = (`0${today.getDate()}`).slice(-2);
        const year = today.getFullYear();
        const hours = (`0${today.getHours()}`).slice(-2);
        const minutes = (`0${today.getMinutes()}`).slice(-2);
        const seconds = (`0${today.getSeconds()}`).slice(-2);
        const outStr = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}  ${testConfig.iModelName}  [${testConfig.viewName}]`;
        await consoleLog(outStr);
        await writeExternalFile(testConfig.outputPath!, logFileName, true, `${outStr}\n`);

        await runTest(testConfig, extViews);

        await writeExternalFile(testConfig.outputPath!, logFileName, true, formattedSelectedTileIds);
      }
    }
  }
  if (configs.iModelLocation) removeFilesFromDir(configs.iModelLocation, ".Tiles");
  if (configs.iModelLocation) removeFilesFromDir(configs.iModelLocation, ".TileCache");
}

=======
>>>>>>> imodel02
async function main() {
  try {
    const configStr = await DisplayPerfRpcInterface.getClient().getDefaultConfigs();
    const props = JSON.parse(configStr) as TestSetsProps;

    if (props.signIn)
      await signIn();

    const runner = new TestRunner(props);
    await runner.run();
  } catch (err) {
    alert(err.toString());
  }

  return IModelApp.shutdown();
}

window.onload = async () => {
  // Choose RpcConfiguration based on whether we are in electron or browser
  RpcConfiguration.developmentMode = true;
  RpcConfiguration.disableRoutingValidation = true;

  if (!ProcessDetector.isElectronAppFrontend && !ProcessDetector.isMobileAppFrontend) {
    const uriPrefix = "http://localhost:3001";
    BentleyCloudRpcManager.initializeClient({ info: { title: "DisplayPerformanceTestApp", version: "v1.0" }, uriPrefix }, [DisplayPerfRpcInterface, IModelTileRpcInterface, SnapshotIModelRpcInterface, IModelReadRpcInterface]);
  }

  await DisplayPerfTestApp.startup();
  await main();
};
