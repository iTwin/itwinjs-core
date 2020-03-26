/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import {
  IModelApp, IModelConnection, NotifyMessageDetails, OutputMessagePriority, OutputMessageType,
  Extension, ScreenViewport, Tool, AuthorizedFrontendRequestContext,
} from "@bentley/imodeljs-frontend";
import { I18NNamespace } from "@bentley/imodeljs-i18n";
import { SettingsStatus } from "@bentley/imodeljs-clients";
import { GeoPhotoMarkerManager } from "./geoPhotoMarker";
import { PhotoTreeHandler, PhotoFolder, PhotoTree, PhotoTraverseFunction } from "./PhotoTree";
import { ProjectShareHandler } from "./ProjectSharePhotoTree";
import { GPDialogUiProvider } from "./ui/GPDialogUiProvider";

/*-----------------------------------------------------------------------
This is the source for an iModel.js Extension that displays on-screen markers
at the latitude and longitude of geoLocated panoramic photographs.

When such a marker is clicked, the corresponding panorama is opened in a
separate tab. Depending on the browser, you may have to grant permission
for such a tab to be opened.

iModel.js Extensions are javascript fragments that can be loaded at runtime
into an appropriately configured browser or Electron process.
-------------------------------------------------------------------------*/

/* ----------------------- The top level container class that holds the tree of photos --------------------- */
/** The container class for the GeoPhoto tree and associated Markers */
export class GeoPhotos {
  public photoTree: PhotoTree | undefined;
  private _markers: GeoPhotoMarkerManager | undefined;
  private _photoCount: number = 0;

  /** Constructs GeoPhotos container. Specify the tree handler to access the storage mechanism.
   * The GeoPhotos container is stored on the associated IModelConnection object.
   */
  constructor(public extension: GeoPhotoExtension, public treeHandler: PhotoTreeHandler, public iModel: IModelConnection, public uiProvider: GPDialogUiProvider | undefined) {
    this.photoTree = undefined;
    this._markers = undefined;
    (iModel as any).geoPhotos = this;
    IModelConnection.onClose.addListener(this.onCloseIModel.bind(this));
  }

  /** Uses the tree handler to read the folders and files in the tree */
  public async readTreeContents(): Promise<PhotoTree> {
    // readRootFolder reads the folder.
    this.photoTree = await this.treeHandler.createPhotoTree();
    await this.treeHandler.getCartographicPositions(this.photoTree, true);
    await this.treeHandler.getSpatialPositions(this.photoTree, true);
    return this.photoTree;
  }

  /** Traverse the tree, calling the func for each PhotoFile. */
  public async traverseTree(func: PhotoTraverseFunction, visibleOnly: boolean) {
    if (this.photoTree)
      await this.photoTree.traversePhotos(func, undefined, true, visibleOnly);
  }

  /** Creates a GeoPhotoMarkerManager to display markers for each photo. */
  public async showMarkers(): Promise<void> {
    if (!this._markers) {
      this._markers = new GeoPhotoMarkerManager(this.extension, this);
    }
    const message: string = this.extension.i18n.translate("geoPhoto:messages.ShowingMarkers");
    const msgDetails: NotifyMessageDetails = new NotifyMessageDetails(OutputMessagePriority.Info, message);
    IModelApp.notifications.outputMessage(msgDetails);
    return this._markers.startDecorating();
  }

  /** Stops drawing and discards the photo markers. */
  public removeMarkers() {
    if (this._markers) {
      this._markers.stopDecorating();
      this._markers = undefined;
    }
  }

  private removeUi() {
    this.extension.removeUi();
  }

  /** callback for iModel closed - removes the markers. */
  private onCloseIModel(iModel: IModelConnection) {
    if (this.iModel === iModel) {
      this.removeMarkers();
      this.removeUi();
      (iModel as any).geoPhotos = undefined;
    }
  }

  /** Returns true if currently displaying markers. */
  public showingMarkers(): boolean {
    return (undefined !== this._markers) && this._markers.nowDecorating();
  }

  private countFunc(folder: PhotoFolder, _parent: PhotoFolder | undefined): void {
    this._photoCount += folder.photoCount;
  }

  public getPhotoCount(): number {
    if (!this.photoTree)
      return 0;
    this._photoCount = 0;
    this.photoTree.traverseFolders(this.countFunc.bind(this), true, true);
    return this._photoCount;
  }
}

/** An Immediate Tool that can be used to execute the operations in GeoPhotoExtension. */
class GeoPhotoTool extends Tool {
  public static toolId = "GeoPhotoTool";
  public static extension: GeoPhotoExtension | undefined;
  public static get maxArgs() { return 1; }
  public static get minArgs() { return 0; }
  public parseAndRun(...args: string[]): boolean {
    return this.run(args);
  }

  public run(args: any[]): boolean {
    // the extension does the actual work.
    if (IModelApp.viewManager.selectedView) {
      const arg: string = ((undefined !== args) && (args.length > 0)) ? args[0] : "toggle";
      GeoPhotoTool.extension!.geoPhotoOperation(arg);
    }
    return true;
  }
}

/** the show/hide/toggle operations */
const enum Operation {
  Hide = 0,
  Show = 1,
  Toggle = 2,
}

// settings for the extension.
// We don't currently provide a way to change minDistance, maxDistance, or eyeHeight.
export class GeoPhotoSettings {
  // In the pannellum viewer, the maximum distance for nearby markers. Beyond that distance, they are not drawn.
  public maxDistance: number = 100.0;
  // In the pannellum viewer, the maximum perpendicular distance between the path of the camera and displayed markers. Markers outside of that distance are not drawn.
  public maxCrossDistance: number = 7.0;
  // In the pannellum viewer, the assumed height above the ground of the panoramic camera.
  public eyeHeight: number = 3.0;
  // Show markers in the pannellum viewer.
  public showMarkers: boolean = true;
  // Use the path of the camera (i.e., the vector from the current photo's position to the next photo's position) rather than the gps track from the camera.
  public directionFromPath: boolean = true;
  // use reverse of the camera orientation
  public reversed: boolean = false;
}

class GeoPhotoFullSettings extends GeoPhotoSettings {
  public visiblePaths: string[] = [];

  public getPathList(photoTree: PhotoTree) {
    photoTree.traverseFolders(this.gatherPaths.bind(this), true, true);
  }

  // traverse
  public gatherPaths(folder: PhotoFolder, _parent: PhotoFolder | undefined) {
    this.visiblePaths.push(folder.fullPath);
  }
}

/** The extension class that is instantiated when the extension is loaded, and executes the operations */
export class GeoPhotoExtension extends Extension {
  private _i18NNamespace?: I18NNamespace;
  public uiProvider?: GPDialogUiProvider;
  public settings: GeoPhotoSettings = new GeoPhotoSettings();

  // displays the GeoPhoto markers for the specified iModel.
  public async showGeoPhotoMarkers(iModel: IModelConnection): Promise<void> {
    if (!iModel.isGeoLocated) {
      const errMsg: string = this.i18n.translate("geoPhoto:messages.notGeolocated");
      const errDetails: NotifyMessageDetails = new NotifyMessageDetails(OutputMessagePriority.Warning, errMsg, undefined, OutputMessageType.Sticky);
      IModelApp.notifications.outputMessage(errDetails);
      return;
    }

    if (this.uiProvider)
      this.uiProvider.showGeoPhotoDialog();

    let geoPhotos: GeoPhotos = (iModel as any).geoPhotos;
    if (undefined === geoPhotos) {
      const requestContext = await AuthorizedFrontendRequestContext.create();
      const settingsPromise = IModelApp.settings.getUserSetting(requestContext, "GeoPhotoExtension", "Settings", false, iModel.contextId, iModel.iModelId);

      /* ------------- Not needed now that we have the dialog box to show progress
      let message: string = this.i18n.translate("geoPhoto:messages.GatheringPhotos");
      let msgDetails: NotifyMessageDetails = new NotifyMessageDetails(OutputMessagePriority.Info, message);
      IModelApp.notifications.outputMessage(msgDetails);
      ------------------------------------------------------------------------------- */

      const treeHandler = new ProjectShareHandler(requestContext, this.i18n, iModel, this.uiProvider);
      geoPhotos = new GeoPhotos(this, treeHandler!, iModel, this.uiProvider);
      await geoPhotos.readTreeContents();

      const settingsResult = await settingsPromise;
      if (SettingsStatus.Success === settingsResult.status) {
        // process the returned settings.
        const settings: any = settingsResult.setting;
        if ((settings.visiblePaths) && Array.isArray(settings.visiblePaths)) {
          geoPhotos.photoTree!.traverseFolders(this.checkFolderVisibility.bind(this, settings.visiblePaths), true, false);
        }
        // get the other values out of the saved settings.
        if (undefined !== settings.showMarkers) {
          this.settings.showMarkers = settings.showMarkers;
        }
        if (undefined !== settings.maxDistance) {
          this.settings.maxDistance = settings.maxDistance;
        }
        if (undefined !== settings.maxCrossDistance) {
          this.settings.maxCrossDistance = settings.maxCrossDistance;
        }
        if (undefined !== settings.eyeHeight) {
          this.settings.eyeHeight = settings.eyeHeight;
        }
      }
      /* ------------- Not needed now that we have the dialog box to show progress
      const photoCount: number = geoPhotos.getPhotoCount();
      message = this.i18n.translate("geoPhoto:messages.GeneratingMarkers", { photoCount });
      msgDetails = new NotifyMessageDetails(OutputMessagePriority.Info, message);
      IModelApp.notifications.outputMessage(msgDetails);
      ------------------------------------------------------------------------------- */
    }

    const hasPhotos: boolean = (0 !== geoPhotos.getPhotoCount());
    if (!hasPhotos) {
      if (this.uiProvider) {
        this.uiProvider.syncTitle(this.i18n.translate("geoPhoto:LoadDialog.GeoPhotoTitle"));
        this.uiProvider.setLoadPhase(3);
      }
    } else {
      await geoPhotos.showMarkers();
      if (this.uiProvider) {
        this.uiProvider.setLoadPhase(2);
        this.uiProvider.syncTreeData(geoPhotos.photoTree!);
        this.uiProvider.syncTitle(this.i18n.translate("geoPhoto:LoadDialog.FoldersTitle"));
        this.uiProvider.syncSettings(this.settings);
        this.uiProvider.showGeoPhotoDialog(); // in case it was closed by user earlier.
      }
    }
  }

  private checkFolderVisibility(visiblePaths: string[], folder: PhotoFolder, _parent: PhotoFolder | undefined) {
    const path: string = folder.fullPath;
    for (const thisPath of visiblePaths) {
      if (thisPath === path)
        return;
    }
    // not found in visiblePaths, turn it off.
    folder.visible = false;
  }

  /** displays the GeoPhoto markers for the specified iModel. */
  public hideGeoPhotoMarkers(iModel: IModelConnection): void {
    const geoPhotos: GeoPhotos = (iModel as any).geoPhotos;
    if (undefined !== geoPhotos)
      geoPhotos.removeMarkers();
  }

  public clearCloseNeighborData(iModel: IModelConnection): void {
    const geoPhotos: GeoPhotos = (iModel as any).geoPhotos;
    if ((undefined !== geoPhotos) && (undefined !== geoPhotos.photoTree))
      geoPhotos.photoTree.clearCloseNeighborData();
  }

  // interprets the argument
  private getOperation(arg: string): Operation {
    arg = arg.toLocaleLowerCase();
    if ((arg === "1") || (arg === "on") || (arg === "show"))
      return Operation.Show;
    else if ((arg === "0") || (arg === "off") || (arg === "hide"))
      return Operation.Hide;
    else
      return Operation.Toggle;
  }

  // returns true if we are currently displaying geoPhoto markers.
  private showingMarkers(view: ScreenViewport) {
    const geoPhotos: GeoPhotos = (view.iModel as any).geoPhotos;
    return (geoPhotos && geoPhotos.showingMarkers());
  }

  // turns geoPhotos off or on depending on argument
  public geoPhotoOperation(opArg: string) {
    const view = IModelApp.viewManager.selectedView;
    if (!view || !view.iModel)
      return;

    const operation = this.getOperation(opArg);
    if ((Operation.Show === operation) || ((Operation.Toggle === operation) && !this.showingMarkers(view))) {
      if (undefined === this.uiProvider)
        this.uiProvider = new GPDialogUiProvider(this);
      this.showGeoPhotoMarkers(view.iModel).catch((_err) => { });
    } else if ((Operation.Hide === operation) || ((Operation.Toggle === operation) && this.showingMarkers(view))) {
      this.hideGeoPhotoMarkers(view.iModel);
    }
  }

  // called from GPDialogUiProvider when the visibility of part of the marker set is changed.
  public async visibilityChange(): Promise<void> {
    const view = IModelApp.viewManager.selectedView;
    if (!view || !view.iModel)
      return;
    // change the markers on the screen.
    if (this.showingMarkers(view)) {
      this.hideGeoPhotoMarkers(view.iModel);
      this.showGeoPhotoMarkers(view.iModel).catch((_err) => { });
      this.clearCloseNeighborData(view.iModel);
    }
    this.saveSettings().catch((_err) => { });
  }

  public async saveSettings(): Promise<void> {
    const view = IModelApp.viewManager.selectedView;
    if (!view || !view.iModel)
      return;

    // store settings to SettingsManager
    const geoPhotos: GeoPhotos = (view.iModel as any).geoPhotos;
    if (geoPhotos && geoPhotos.photoTree) {
      const newSettings: GeoPhotoFullSettings = new GeoPhotoFullSettings();
      const fullSettings = Object.assign(newSettings, this.settings);
      fullSettings.getPathList(geoPhotos.photoTree);
      const requestContext = await AuthorizedFrontendRequestContext.create();
      IModelApp.settings.saveUserSetting(requestContext, fullSettings, "GeoPhotoExtension", "Settings", false, view.iModel.contextId, view.iModel.iModelId).catch((_err) => { });
    }
  }

  /** Invoked the first time this extension is loaded. */
  public onLoad(_args: string[]): void {
    // store the extension in the tool prototype.
    GeoPhotoTool.extension = this;

    this._i18NNamespace = this.i18n.registerNamespace("geoPhoto");
    this._i18NNamespace!.readFinished.then(() => {
      IModelApp.tools.register(GeoPhotoTool, this._i18NNamespace, this.i18n);
      GeoPhotoTool.extension = this;
    }).catch(() => { });
  }

  /** Invoked each time this extension is loaded. */
  public onExecute(args: string[]): void {
    // if no args passed in, don't do anything.
    if (args.length < 1)
      return;

    this._i18NNamespace!.readFinished.then(() => {
      this.geoPhotoOperation(args.length > 1 ? args[1] : "toggle");
    }).catch((_err: Error) => { });
  }

  // returning false blocks output of message for subsequent "load Extension" attempts. onExecute is called.
  public reportReload() {
    return false;
  }

  // called when an iModel is closed to remove the dialog
  public removeUi() {
    if (this.uiProvider) {
      this.uiProvider.removeUi();
      // discard the UiProvider, another will be created when
      this.uiProvider = undefined;
    }
  }
}

// This variable is set by webPack when building a extension.
declare var PLUGIN_NAME: string;

// Register the extension with the extensionAdmin.
IModelApp.extensionAdmin.register(new GeoPhotoExtension(PLUGIN_NAME));
