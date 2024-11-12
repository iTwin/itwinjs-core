/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import "@bentley/icons-generic-webfont/dist/bentley-icons-generic-webfont.css";
import { GuidString, ProcessDetector } from "@itwin/core-bentley";
import { ElectronApp, ElectronAppOpts } from "@itwin/core-electron/lib/cjs/ElectronFrontend";
import { BrowserAuthorizationClient } from "@itwin/browser-authorization";
import { FrontendIModelsAccess } from "@itwin/imodels-access-frontend";
import { IModelsClient } from "@itwin/imodels-client-management";
import { FrontendDevTools } from "@itwin/frontend-devtools";
import { HyperModeling } from "@itwin/hypermodeling-frontend";
import {
  BentleyCloudRpcManager, BentleyCloudRpcParams, IModelReadRpcInterface, IModelTileRpcInterface,
} from "@itwin/core-common";
import { EditTools } from "@itwin/editor-frontend";
import {
  AccuDrawHintBuilder, AccuDrawShortcuts, AccuSnap, IModelApp, IpcApp, LocalhostIpcApp, LocalHostIpcAppOpts, RenderSystem, SelectionTool, SnapMode,
  TileAdmin, Tool, ToolAdmin,
} from "@itwin/core-frontend";
import { MobileApp, MobileAppOpts } from "@itwin/core-mobile/lib/cjs/MobileFrontend";
import { RealityDataAccessClient, RealityDataClientOptions } from "@itwin/reality-data-client";
import { DtaConfiguration } from "../common/DtaConfiguration";
import { dtaChannel, DtaIpcInterface } from "../common/DtaIpcInterface";
import { DtaRpcInterface } from "../common/DtaRpcInterface";
import { ToggleAspectRatioSkewDecoratorTool } from "./AspectRatioSkewDecorator";
import { ApplyModelDisplayScaleTool } from "./DisplayScale";
import { ApplyModelTransformTool, ClearModelTransformsTool, DisableModelTransformsTool } from "./DisplayTransform";
import { ApplyModelClipTool } from "./ModelClipTools";
import { GenerateElementGraphicsTool, GenerateTileContentTool } from "./TileContentTool";
import { ViewClipByElementGeometryTool } from "./ViewClipByElementGeometryTool";
import { DrawingAidTestTool } from "./DrawingAidTestTool";
import { EditingScopeTool, MoveElementTool, PlaceLineStringTool } from "./EditingTools";
import { DynamicClassifierTool, DynamicClipMaskTool } from "./DynamicClassifierTool";
import { FenceClassifySelectedTool } from "./Fence";
import { RecordFpsTool } from "./FpsMonitor";
import { FrameStatsTool } from "./FrameStatsTool";
import { ChangeGridSettingsTool } from "./Grid";
import { IncidentMarkerDemoTool } from "./IncidentMarkerDemo";
import { MarkupSelectTestTool } from "./MarkupSelectTestTool";
import { Notifications } from "./Notifications";
import { OutputShadersTool } from "./OutputShadersTool";
import { PathDecorationTestTool } from "./PathDecorationTest";
import { GltfDecorationTool } from "./GltfDecoration";
import { TextDecorationTool } from "./TextDecoration";
import { ToggleShadowMapTilesTool } from "./ShadowMapDecoration";
import { signIn, signOut } from "./signIn";
import {
  CloneViewportTool, CloseIModelTool, CloseWindowTool, CreateWindowTool, DockWindowTool, FocusWindowTool, MaximizeWindowTool, OpenIModelTool,
  ReopenIModelTool, ResizeWindowTool, RestoreWindowTool, Surface,
} from "./Surface";
import { CreateSectionDrawingTool } from "./CreateSectionDrawingTool";
import { SyncViewportFrustaTool, SyncViewportsTool } from "./SyncViewportsTool";
import { TimePointComparisonTool } from "./TimePointComparison";
import { UiManager } from "./UiManager";
import { MarkupTool, ModelClipTool, ZoomToSelectedElementsTool } from "./Viewer";
import { MacroTool } from "./MacroTools";
import { RecordTileSizesTool } from "./TileSizeRecorder";
import { TerrainDrapeTool } from "./TerrainDrapeTool";
import { SaveImageTool } from "./SaveImageTool";
import { ToggleSecondaryIModelTool } from "./TiledGraphics";
import { BingTerrainMeshProvider } from "./BingTerrainProvider";
import { AttachCustomRealityDataTool, registerRealityDataSourceProvider } from "./RealityDataProvider";
import { MapLayersFormats } from "@itwin/map-layers-formats";
import { OpenRealityModelSettingsTool } from "./RealityModelDisplaySettingsWidget";
import { ElectronRendererAuthorization } from "@itwin/electron-authorization/Renderer";
import { ITwinLocalization } from "@itwin/core-i18n";
import { getConfigurationString } from "./DisplayTestApp";
import { AddSeequentRealityModel } from "./RealityDataModel";

class DisplayTestAppAccuSnap extends AccuSnap {
  private readonly _activeSnaps: SnapMode[] = [SnapMode.NearestKeypoint];

  public override get keypointDivisor() { return 2; }
  public override getActiveSnapModes(): SnapMode[] { return this._activeSnaps; }
  public setActiveSnapModes(snaps: SnapMode[]): void {
    this._activeSnaps.length = snaps.length;
    for (let i = 0; i < snaps.length; i++)
      this._activeSnaps[i] = snaps[i];
  }
}

class DisplayTestAppToolAdmin extends ToolAdmin {
  /** Process shortcut key events */
  public override async processShortcutKey(keyEvent: KeyboardEvent, wentDown: boolean): Promise<boolean> {
    if (wentDown && AccuDrawHintBuilder.isEnabled)
      return AccuDrawShortcuts.processShortcutKey(keyEvent);
    return false;
  }
}

class SVTSelectionTool extends SelectionTool {
  public static override toolId = "SVTSelect";
  protected override initSelectTool() {
    super.initSelectTool();

    // ###TODO Want to do this only if version comparison enabled, but meh.
    IModelApp.locateManager.options.allowExternalIModels = true;
  }
}

class SignInTool extends Tool {
  public static override toolId = "SignIn";
  public override async run(): Promise<boolean> {
    await signIn();
    return true;
  }
}

class SignOutTool extends Tool {
  public static override toolId = "SignOut";
  public override async run(): Promise<boolean> {
    await signOut();
    return true;
  }
}

class PushChangesTool extends Tool {
  public static override toolId = "PushChanges";
  public static override get maxArgs() { return 1; }
  public static override get minArgs() { return 1; }

  public override async run(description?: string): Promise<boolean> {
    if (!description || "string" !== typeof description)
      return false;

    const imodel = IModelApp.viewManager.selectedView?.iModel;
    if (!imodel || !imodel.isBriefcaseConnection())
      return false;

    await imodel.pushChanges(description);
    return true;
  }

  public override async parseAndRun(...args: string[]): Promise<boolean> {
    return this.run(args[0]);
  }
}

class PullChangesTool extends Tool {
  public static override toolId = "PullChanges";

  public override async run(): Promise<boolean> {
    const imodel = IModelApp.viewManager.selectedView?.iModel;
    if (!imodel || !imodel.isBriefcaseConnection())
      return false;

    await imodel.pullChanges();
    return true;
  }
}

export const dtaIpc = IpcApp.makeIpcProxy<DtaIpcInterface>(dtaChannel);

class RefreshTilesTool extends Tool {
  public static override toolId = "RefreshTiles";
  public static override get maxArgs() { return undefined; }

  public override async run(changedModelIds?: string[]): Promise<boolean> {
    if (undefined !== changedModelIds && 0 === changedModelIds.length)
      changedModelIds = undefined;

    IModelApp.viewManager.refreshForModifiedModels(changedModelIds);
    return true;
  }

  public override async parseAndRun(...args: string[]): Promise<boolean> {
    return this.run(args);
  }
}

class PurgeTileTreesTool extends Tool {
  public static override toolId = "PurgeTileTrees";
  public static override get minArgs() { return 0; }
  public static override get maxArgs() { return undefined; }

  public override async run(modelIds?: string[]): Promise<boolean> {
    const vp = IModelApp.viewManager.selectedView;
    if (undefined === vp)
      return true;

    if (undefined !== modelIds && 0 === modelIds.length)
      modelIds = undefined;

    await vp.iModel.tiles.purgeTileTrees(modelIds);
    IModelApp.viewManager.refreshForModifiedModels(modelIds);

    return true;
  }

  public override async parseAndRun(...args: string[]): Promise<boolean> {
    return this.run(args);
  }
}

class ShutDownTool extends Tool {
  public static override toolId = "ShutDown";

  public override async run(_args: any[]): Promise<boolean> {
    DisplayTestApp.surface.closeAllViewers();
    const app = ElectronApp.isValid ? ElectronApp : IModelApp;
    await app.shutdown();

    debugger; // eslint-disable-line no-debugger
    return true;
  }
}

class ExitTool extends Tool {
  public static override toolId = "Exit";

  public override async run(_args: any[]): Promise<boolean> {
    DisplayTestApp.surface.closeAllViewers();
    await DtaRpcInterface.getClient().terminate();
    return true;
  }
}

function createHubAccess(configuration: DtaConfiguration) {
  if (configuration.urlPrefix) {
    return new FrontendIModelsAccess(new IModelsClient({ api: { baseUrl: `https://${configuration.urlPrefix}api.bentley.com/imodels` } }));
  } else {
    return new FrontendIModelsAccess();
  }
}

export class DisplayTestApp {
  private static _surface?: Surface;
  public static get surface() { return this._surface!; }
  public static set surface(surface: Surface) { this._surface = surface; }
  private static _iTwinId?: GuidString;
  public static get iTwinId(): GuidString | undefined { return this._iTwinId; }

  public static async startup(configuration: DtaConfiguration, renderSys: RenderSystem.Options, tileAdmin: TileAdmin.Props): Promise<void> {
    let socketUrl = new URL(configuration.customOrchestratorUri || "http://localhost:3001");
    socketUrl = LocalhostIpcApp.buildUrlForSocket(socketUrl);
    const realityDataClientOptions: RealityDataClientOptions = {
      /** API Version. v1 by default */
      // version?: ApiVersion;
      /** API Url. Used to select environment. Defaults to "https://api.bentley.com/reality-management/reality-data" */
      baseUrl: `https://${process.env.IMJS_URL_PREFIX ?? ""}api.bentley.com`,
    };
    const opts: ElectronAppOpts | LocalHostIpcAppOpts = {
      iModelApp: {
        accuSnap: new DisplayTestAppAccuSnap(),
        notifications: new Notifications(),
        tileAdmin,
        toolAdmin: new DisplayTestAppToolAdmin(),
        uiAdmin: new UiManager(),
        realityDataAccess: new RealityDataAccessClient(realityDataClientOptions),
        renderSys,
        rpcInterfaces: [
          DtaRpcInterface,
          IModelReadRpcInterface,
          IModelTileRpcInterface,
        ],
        /* eslint-disable @typescript-eslint/naming-convention */
        mapLayerOptions: {
          MapboxImagery: configuration.mapBoxKey
            ? { key: "access_token", value: configuration.mapBoxKey }
            : undefined,
          BingMaps: configuration.bingMapsKey
            ? { key: "key", value: configuration.bingMapsKey }
            : undefined,
        },
        /* eslint-enable @typescript-eslint/naming-convention */
        hubAccess: createHubAccess(configuration),
        localization: new ITwinLocalization({ detectorOptions: { order: ["htmlTag"] } }),
      },
      localhostIpcApp: {
        socketUrl,
      },
    };

    this._iTwinId = configuration.iTwinId;

    if (ProcessDetector.isElectronAppFrontend) {
      // The electron package produces an exception every time getAccessToken is called, which is quite frequently.
      // It makes debugging with "pause on caught exceptions" infuriating.
      // ###TODO fix that in the client and remove this
      if (!configuration.noElectronAuth)
        opts.iModelApp!.authorizationClient = new ElectronRendererAuthorization({
          clientId: getConfigurationString("oidcClientId") ?? "native-testId",
        });

      await ElectronApp.startup(opts);
    } else if (ProcessDetector.isMobileAppFrontend) {
      await MobileApp.startup(opts as MobileAppOpts);
    } else {
      const redirectUri = getConfigurationString("oidcRedirectUri") ?? "http://localhost:3000/signin-callback";
      const urlObj = new URL(redirectUri);
      if (urlObj.pathname === window.location.pathname) {
        const client = new BrowserAuthorizationClient({
          clientId: getConfigurationString("oidcClientId") ?? "imodeljs-spa-test",
          scope: getConfigurationString("oidcScope") ?? "projects:read realitydata:read imodels:read imodels:modify imodelaccess:read",
          redirectUri,
        });
        await client.handleSigninCallback();
      }

      const rpcParams: BentleyCloudRpcParams = { info: { title: "ui-test-app", version: "v1.0" }, uriPrefix: configuration.customOrchestratorUri || "http://localhost:3001" };
      if (opts.iModelApp?.rpcInterfaces) // eslint-disable-line @typescript-eslint/no-deprecated
        BentleyCloudRpcManager.initializeClient(rpcParams, opts.iModelApp.rpcInterfaces); // eslint-disable-line @typescript-eslint/no-deprecated
      await LocalhostIpcApp.startup(opts);
    }

    IModelApp.applicationLogoCard =
      () => IModelApp.makeLogoCard({ iconSrc: "DTA.png", iconWidth: 100, heading: "Display Test App", notice: "For internal testing" });

    const svtToolNamespace = "SVTTools";
    await IModelApp.localization.registerNamespace(svtToolNamespace);
    [
      ApplyModelClipTool,
      ApplyModelDisplayScaleTool,
      ApplyModelTransformTool,
      AttachCustomRealityDataTool,
      ChangeGridSettingsTool,
      ClearModelTransformsTool,
      CloneViewportTool,
      CloseIModelTool,
      CloseWindowTool,
      CreateSectionDrawingTool,
      CreateWindowTool,
      DisableModelTransformsTool,
      DockWindowTool,
      DrawingAidTestTool,
      EditingScopeTool,
      ExitTool,
      FenceClassifySelectedTool,
      FocusWindowTool,
      FrameStatsTool,
      GenerateElementGraphicsTool,
      GenerateTileContentTool,
      GltfDecorationTool,
      IncidentMarkerDemoTool,
      PathDecorationTestTool,
      MacroTool,
      MarkupSelectTestTool,
      MarkupTool,
      MaximizeWindowTool,
      ModelClipTool,
      MoveElementTool,
      OpenIModelTool,
      OpenRealityModelSettingsTool,
      OutputShadersTool,
      PlaceLineStringTool,
      DynamicClassifierTool,
      DynamicClipMaskTool,
      PullChangesTool,
      PushChangesTool,
      PurgeTileTreesTool,
      AddSeequentRealityModel,
      RecordFpsTool,
      RecordTileSizesTool,
      RefreshTilesTool,
      ReopenIModelTool,
      ResizeWindowTool,
      RestoreWindowTool,
      SaveImageTool,
      ShutDownTool,
      SignInTool,
      SignOutTool,
      SVTSelectionTool,
      SyncViewportFrustaTool,
      SyncViewportsTool,
      TerrainDrapeTool,
      TextDecorationTool,
      ToggleAspectRatioSkewDecoratorTool,
      ToggleSecondaryIModelTool,
      TimePointComparisonTool,
      ToggleShadowMapTilesTool,
      ViewClipByElementGeometryTool,
      ZoomToSelectedElementsTool,
    ].forEach((tool) => tool.register(svtToolNamespace));

    IModelApp.toolAdmin.defaultToolId = SVTSelectionTool.toolId;

    BingTerrainMeshProvider.register();

    const realityApiKey = process.env.IMJS_REALITY_DATA_KEY;
    if (realityApiKey)
      registerRealityDataSourceProvider(realityApiKey);

    await FrontendDevTools.initialize();
    await HyperModeling.initialize();
    await EditTools.initialize();
    await MapLayersFormats.initialize();

    EditTools.registerProjectLocationTools();
  }

  public static setActiveSnapModes(snaps: SnapMode[]): void {
    (IModelApp.accuSnap as DisplayTestAppAccuSnap).setActiveSnapModes(snaps);
  }

  public static setActiveSnapMode(snap: SnapMode): void { this.setActiveSnapModes([snap]); }
}
