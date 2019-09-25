/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { IModelApp, IModelConnection, Plugin, ScreenViewport, Tool, AuthorizedFrontendRequestContext } from "@bentley/imodeljs-frontend";
import { I18NNamespace } from "@bentley/imodeljs-i18n";
import { ProjectShareClient, ProjectShareFolder, ProjectShareFile, ProjectShareQuery } from "@bentley/imodeljs-clients";
import { Cartographic } from "@bentley/imodeljs-common";
import { XYZProps } from "@bentley/geometry-core";
import { GeoPhotoMarkerManager } from "./geoPhotoMarker";
import { ExifExtractor, ImageTags, ImageTagValue } from "./ExifExtractor";

/*-----------------------------------------------------------------------
This is the source for an iModel.js Plugin that displays on-screen markers
at the latitude and longitude of geoLocated panoramic photographs.

When such a marker is clicked, the corresponding panorama is opened in a
separate tab. Depending on the browser, you may have to grant permission
for such a tab to be opened.

iModel.js Plugins are javascript fragments that can be loaded at runtime
into an appropriately configured browser or Electron process.
-------------------------------------------------------------------------*/

/* -------------------- Callback for photo tree traversal ---------------------- */
export type PhotoTraverseFunction = (photoFile: PhotoFile, photoFolder: PhotoFolder) => Promise<void>;

/* -------------------- Interface implemented to access a particular photo storage mechanism --------------- */

/** this interface is provided to allow retrieval of the tree of photos from any storage mechanism. */
interface TreeHandler {
  // create the root folder. Do not read contents yet.
  createRootFolder(container: GeoPhotos): Promise<PhotoFolder>;

  // read the folder contents (subFolders and photos).
  readFolderContents(folder: PhotoFolder, subFolders: boolean): Promise<FolderEntry[]>;

  // reads the file contents for each photo file.
  getFileContents(file: PhotoFile): Promise<Uint8Array>;

  // gets the cartographic positions for each photo file.
  getCartographicPositions(folder: PhotoFolder, subFolders: boolean): Promise<void>;

  // gets the spatial positions for each photo file from the Cartographic positions.
  getSpatialPositions(folder: PhotoFolder, subFolders: boolean): Promise<void>;
}

/* ----------------------- The top level container class that holds the tree of photos --------------------- */
/** The container class for the GeoPhoto tree and associated Markers */
export class GeoPhotos {
  public rootFolder: PhotoFolder | undefined;
  private _markers: GeoPhotoMarkerManager | undefined;

  /** Constructs GeoPhotos container. Specify the tree handler to access the storage mechanism.
   * The GeoPhotos container is stored on the associated IModelConnection object.
   */
  constructor(public plugin: GeoPhotoPlugin, public treeHandler: TreeHandler, public iModel: IModelConnection) {
    this.rootFolder = undefined;
    this._markers = undefined;
    (iModel as any).geoPhotos = this;
    IModelConnection.onClose.addListener(this.onCloseIModel.bind(this));
  }

  /** Uses the tree handler to read the folders and files in the tree */
  public async readTreeContents(): Promise<void> {
    // readRootFolder reads the folder.
    this.rootFolder = await this.treeHandler.createRootFolder(this);
    await this.treeHandler.getCartographicPositions(this.rootFolder, true);
    await this.treeHandler.getSpatialPositions(this.rootFolder, true);
  }

  /** Traverse the tree, calling the func for each PhotoFile. */
  public async traverseTree(func: PhotoTraverseFunction, visibleOnly: boolean) {
    if (this.rootFolder)
      await this.rootFolder.traversePhotos(func, true, visibleOnly);
  }

  /** Creates a GeoPhotoMarkerManager to display markers for each photo. */
  public showMarkers() {
    if (!this._markers) {
      this._markers = new GeoPhotoMarkerManager(this.plugin, this);
    }
    this._markers.startDecorating().catch((_err) => { });
  }

  /** Stops drawing and discards the photo markers. */
  public removeMarkers() {
    if (this._markers) {
      this._markers.stopDecorating();
      this._markers = undefined;
    }
  }

  /** callback for iModel closed - removes the markers. */
  private onCloseIModel(iModel: IModelConnection) {
    if (this.iModel === iModel) {
      this.removeMarkers();
      (iModel as any).geoPhotos = undefined;
    }
  }

  /** Returns true if currently displaying markers. */
  public showingMarkers(): boolean {
    return (undefined !== this._markers) && this._markers.nowDecorating();
  }
}

// ---------------------- Base Classes for GeoPhoto tree members ---------------------------
// Implementation specific subclasses of these base classes are created by each storage-specific TreeHandler

/** Abstract base class for PhotoFolder and PhotoEntry */
abstract class FolderEntry {
  private _visible: boolean;
  constructor(public container: GeoPhotos) {
    this._visible = true;
  }
  abstract get name(): string;

  get visible(): boolean {
    return this._visible;
  }

  set visible(value: boolean) {
    this._visible = value;
  }
}

/** Abstract base class for folders in the GeoPhotos tree. */
abstract class PhotoFolder extends FolderEntry {
  private _entries: FolderEntry[] | undefined;

  constructor(container: GeoPhotos) {
    super(container);
    this._entries = undefined;
  }

  /** uses treeHandler to read the contents of this Folder. */
  public async getFolderContents(subFolders: boolean): Promise<FolderEntry[]> {
    if (!this._entries)
      this._entries = await this.container.treeHandler.readFolderContents(this, subFolders);

    return this._entries;
  }

  /** traverse each photo in this folder, calling func. Recurses into subFolders if desired. */
  public async traversePhotos(func: PhotoTraverseFunction, subFolders: boolean, visibleOnly: boolean) {
    if (!this._entries)
      return;

    for (const thisEntry of this._entries) {
      if (thisEntry instanceof PhotoFile) {
        if (!visibleOnly || thisEntry.visible) {
          await func(thisEntry, this);
        }
      }
    }

    if (!subFolders)
      return;

    for (const thisEntry of this._entries) {
      if (thisEntry instanceof PhotoFolder) {
        if (!visibleOnly || thisEntry.visible) {
          await thisEntry.traversePhotos(func, true, visibleOnly);
        }
      }
    }
  }
}

/** Abstract base class for Files in the GeoPhotos tree. */
export abstract class PhotoFile extends FolderEntry {
  public geoLocation: Cartographic | undefined;
  public spatial: XYZProps | undefined;
  public probablyPano: boolean | undefined;

  constructor(container: GeoPhotos, geoLocation?: Cartographic, spatial?: XYZProps, probablyPano?: boolean) {
    super(container);
    this.geoLocation = geoLocation;
    this.spatial = spatial;
    this.probablyPano = probablyPano;
  }

  /** Gets the contents of the file. */
  public abstract getFileContents(): Promise<Uint8Array>;

  /** Gets an Url that corresponds to the photo file. */
  public abstract get accessUrl(): string;

  public abstract get isPanorama(): boolean;

  public abstract get toolTip(): string;
}

// ------------------------ Project Share TreeHandler implementation ---------------------

/** Subclass of PhotoFolder created by ProjectShareHandler */
class PSPhotoFolder extends PhotoFolder {

  constructor(container: GeoPhotos, private _psFolder: ProjectShareFolder | undefined) {
    super(container);
  }

  public get name(): string {
    if (this._psFolder)
      return this._psFolder.name!;
    return this.container.plugin.i18n.translate("geoPhoto:messages.RootFolderName");
  }

  public get folderId(): string | undefined {
    return (this._psFolder) ? this._psFolder.wsgId : undefined;
  }
}

class FoundProperty {
  constructor(public index: number, public value: "string") { }
}

/** Subclass of PhotoEntry created by ProjectShareHandler */
class PSPhotoFile extends PhotoFile {
  public geoLocation: Cartographic | undefined;

  constructor(container: GeoPhotos, public psFile: ProjectShareFile) {
    super(container);
  }

  public get name(): string {
    return this.psFile.name!;
  }

  public get fileId(): string {
    return this.psFile.wsgId;
  }

  public async getFileContents(): Promise<Uint8Array> {
    return this.container.treeHandler.getFileContents(this).catch((error) => {
      // tslint:disable-next-line:no-console
      console.log(`Error retrieving Photo File contents: ${error}`);
      return new Uint8Array();
    });
  }

  public get accessUrl(): string {
    return this.psFile.accessUrl!;
  }

  public get isPanorama(): boolean {
    return this.probablyPano ? this.probablyPano : false;
  }

  public get toolTip(): string {
    return this.container.plugin.i18n.translate(this.isPanorama ? "geoPhoto:messages.PanoramaFile" : "geoPhoto:messages.PhotoFile", {fileName: this.name});
  }

  public findCustomProperty(propertyName: string): FoundProperty | undefined {
    for (let iProperty = 0; iProperty < this.psFile.customProperties.length; ++iProperty) {
      const thisProperty = this.psFile.customProperties[iProperty];
      if (thisProperty.Name === propertyName) {
        return new FoundProperty(iProperty, thisProperty.Value);
      }
    }
    return undefined;
  }
}

/** A JSON string containing this class is stored in the customProperties of each PhotoFile in Project Share */
class JpegFileInfo {
  constructor(public geoLocation: Cartographic, public probablyPano: boolean, public createdTime: string | undefined) {
  }
}

/** The TreeHandler subclass that reads from Project Share. */
class ProjectShareHandler implements TreeHandler {
  private _projectShareClient: ProjectShareClient;
  private _rootFolder: PSPhotoFolder | undefined;
  constructor(private _context: AuthorizedFrontendRequestContext, private _iModelConnection: IModelConnection) {
    this._projectShareClient = new ProjectShareClient();
  }

  /** Create the root folder for a Project Share file repository */
  public async createRootFolder(container: GeoPhotos): Promise<PhotoFolder> {
    this._rootFolder = new PSPhotoFolder(container, undefined);

    // Always get the contents of the root folder. (ends up back at our readFolderContents method)
    await this._rootFolder.getFolderContents(true);
    return this._rootFolder;
  }

  /** Utility function to get decimal degrees from the degree / minute / second array stored in a JPEG file */
  private getDegreeMinSec(tagSet: ImageTags, baseName: string, positiveVal: string): number | undefined {
    const dmsArray = tagSet.get(baseName);
    if (!Array.isArray(dmsArray) || dmsArray.length < 3)
      return undefined;
    const ref: ImageTagValue = tagSet.get(baseName + "Ref");
    if (undefined === ref)
      return undefined;
    if (typeof ref !== "string")
      return undefined;
    const sign: number = (ref === positiveVal) ? 1.0 : -1.0;
    return sign * (dmsArray[0] + dmsArray[1] / 60.0 + dmsArray[2] / (3600.0));
  }

  /** There is no obvious way to tell whether a JPEG file contains a panorama or not. This function uses the heuristic that
   *  panorama files have an aspect ratio of 2:1.
   */
  private getProbablyPano(tagSet: ImageTags): boolean {
    const pixelX = tagSet.get("PixelXDimension");
    const pixelY = tagSet.get("PixelYDimension");
    // err on the side of calling it a pano.
    if ((undefined === pixelX) || (undefined === pixelY)) {
      return true;
    }
    if ((typeof pixelX !== "number") || (typeof pixelY !== "number"))
      return true;

    return pixelX === 2 * pixelY;
  }

  /** Reads the EXIF tags from a PSPhotoFile and extract the information that is useful to us.
   * The extracted information is stored to custom properties of the PhotoFile in Project Share
   * so that next time through, we can get the information easily while reading the folder entries.
   */
  private async readJpegInfoFromFile(psFile: PSPhotoFile): Promise<JpegFileInfo> {
    const fileArray: Uint8Array = await psFile.getFileContents();
    const tagSet: ImageTags = ExifExtractor.extractFromJpeg(fileArray.buffer);
    const longitude = this.getDegreeMinSec(tagSet, "GPSLongitude", "E");
    const latitude = this.getDegreeMinSec(tagSet, "GPSLatitude", "N");
    const elevation: ImageTagValue = tagSet.get("GPSAltitude");
    const probablyPano: boolean = this.getProbablyPano(tagSet);
    if ((undefined !== longitude) && (undefined !== latitude)) {
      // write it to the custom attributes of the file.
      const cartographic = new Cartographic(longitude, latitude, (undefined === elevation) ? undefined : elevation as number);
      const customProperties: any = psFile.psFile.customProperties;
      const jpegFileInfo = new JpegFileInfo(cartographic, probablyPano, psFile.psFile.createdTimeStamp);
      const jpegFileInfoString = JSON.stringify(jpegFileInfo);
      const foundProperty = psFile.findCustomProperty("JpegFileInfo");
      if (foundProperty)
        psFile.psFile.customProperties[foundProperty.index].Value = jpegFileInfoString;
      else
        customProperties.push({ Name: "JpegFileInfo", Value: jpegFileInfoString });
      this._projectShareClient.updateCustomProperties(this._context, this._iModelConnection.iModelToken.contextId!, psFile.psFile, customProperties).catch((error) => {
        // tslint:disable-next-line:no-console
        console.log(`Unable to update custom properties for file ${psFile.name}: ${error}`);
      });
      return jpegFileInfo;
    } else {
      throw new Error("There is no geographic tag in the jpeg file");
    }
  }

  /** check whether the creating time matches. This isn't ideal, we are planning on changing it. */
  private fileTimeMatches(psFile: PSPhotoFile, createdTime: string | undefined) {
    return (psFile.psFile.createdTimeStamp === createdTime);
  }

  /** Get the Cartographic (lat/long) positions for the specified file. */
  private async getPhotoFileCartographic(file: PhotoFile, _folder: PhotoFolder): Promise<void> {
    try {
      const psFile = file as PSPhotoFile;
      // first we try see if the position is in the Project share metadata.
      const foundProperty = psFile.findCustomProperty("JpegFileInfo");
      if (undefined !== foundProperty) {
        const jpegInfoString = foundProperty.value;
        const jpegInfo: any = JSON.parse(jpegInfoString);
        if ((undefined !== jpegInfo.geoLocation) && (undefined !== jpegInfo.geoLocation.latitude) && (undefined !== jpegInfo.geoLocation.longitude) && this.fileTimeMatches(psFile, jpegInfo.createdTime)) {
          psFile.geoLocation = new Cartographic(jpegInfo.geoLocation.longitude, jpegInfo.geoLocation.latitude, (undefined !== jpegInfo.geoLocation.height) ? jpegInfo.geoLocation.height : 0.0);
          psFile.probablyPano = jpegInfo.probablyPano;
          return Promise.resolve();
        }
      }
      const fileInfo: JpegFileInfo = await this.readJpegInfoFromFile(psFile);
      psFile.geoLocation = fileInfo.geoLocation;
      psFile.probablyPano = fileInfo.probablyPano;
    } catch (error) {
      // tslint:disable-next-line:no-console
      console.log(`File ${file.name} does not have any geographic location`);
      return undefined;
    }
  }

  /** Gets the Spatial (x,y,z) coordinates for the photoFile. */
  private async getPhotoFileSpatial(file: PhotoFile, _folder: PhotoFolder): Promise<void> {
    const psFile: PSPhotoFile = file as PSPhotoFile;
    const geoLocation: Cartographic | undefined = psFile.geoLocation;
    if (geoLocation) {
      const cartographic = Cartographic.fromDegrees(geoLocation.longitude, geoLocation.latitude, geoLocation.height);
      psFile.spatial = await psFile.container.iModel.cartographicToSpatial(cartographic);
    }
  }

  /** Traverses the files to get their Cartographic positions. This is set up as a separate pass to facility
   *  future optimization. Currently, it just does the files one by one.
   */
  public async getCartographicPositions(folder: PhotoFolder, subFolders: boolean): Promise<void> {
    await folder.traversePhotos(this.getPhotoFileCartographic.bind(this), subFolders, false);
  }

  /** Traverses the files to get their Spatial positions. This is set up as a separate pass to facility
   *  future optimization. Currently, it just does the files one by one. Batching up the lat/long
   *  values to calculate their spatial coordinates would improve efficiency.
   */
  public async getSpatialPositions(folder: PhotoFolder, subFolders: boolean): Promise<void> {
    await folder.traversePhotos(this.getPhotoFileSpatial.bind(this), subFolders, false);
  }

  /** Reads the contents (both folders and files) in specified folder */
  public async readFolderContents(folder: PhotoFolder, subFolders: boolean): Promise<FolderEntry[]> {
    const entries: FolderEntry[] = [];
    const projectId = this._iModelConnection.iModelToken.contextId;
    if (!projectId)
      return entries;

    // Note: undefined folderId is interpreted as the root folder.
    let folderId = (folder as PSPhotoFolder).folderId;
    if (undefined === folderId)
      folderId = projectId;
    const projectShareQuery = new ProjectShareQuery().inFolder(folderId!);
    const folders: ProjectShareFolder[] = await this._projectShareClient.getFolders(this._context, projectId, projectShareQuery);
    for (const thisFolder of folders) {
      entries.push(new PSPhotoFolder(folder.container, thisFolder));
    }

    const files: ProjectShareFile[] = await this._projectShareClient.getFiles(this._context, projectId, projectShareQuery);
    for (const thisFile of files) {
      // we want only jpeg files.
      if (undefined !== thisFile.name) {
        const lcName: string = thisFile.name.toLowerCase();
        if (lcName.endsWith("jpg") || lcName.endsWith("jpeg")) {
          entries.push(new PSPhotoFile(folder.container, thisFile));
        }
      }
    }

    if (subFolders) {
      for (const thisEntry of entries) {
        if (thisEntry instanceof PSPhotoFolder) {
          await thisEntry.getFolderContents(subFolders);
        }
      }
    }
    return entries;
  }

  /** Reads the file contents from Project Share */
  public async getFileContents(file: PhotoFile): Promise<Uint8Array> {
    return this._projectShareClient.downloadFile(this._context, (file as PSPhotoFile).psFile);
  }
}

/** An Immediate Tool that can be used to execute the operations in GeoPhotoPlugin. */
class GeoTagTool extends Tool {
  public static toolId = "GeoTagTool";
  public static plugin: GeoPhotoPlugin | undefined;
  public static get maxArgs() { return 1; }
  public static get minArgs() { return 0; }
  public parseAndRun(...args: string[]): boolean {
    return this.run(args);
  }

  public run(args: any[]): boolean {
    // the plugin does the actual work.
    if (IModelApp.viewManager.selectedView) {
      if ((undefined === args) || args.length < 1)
        args = ["toggle"];
      GeoTagTool.plugin!.onExecute(args);
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

/** The plugin class that is instantiated when the plugin is loaded, and executes the operations */
class GeoPhotoPlugin extends Plugin {
  private _i18NNamespace?: I18NNamespace;

  // displays the GeoPhoto markers for the specified iModel.
  public async showGeoPhotoMarkers(iModel: IModelConnection): Promise<void> {
    let geoPhotos: GeoPhotos = (iModel as any).geoPhotos;
    if (undefined === geoPhotos) {
      const requestContext = await AuthorizedFrontendRequestContext.create();
      const treeHandler = new ProjectShareHandler(requestContext, iModel);
      geoPhotos = new GeoPhotos(this, treeHandler!, iModel);
      await geoPhotos.readTreeContents();
    }
    geoPhotos.showMarkers();
  }

  /** displays the GeoPhoto markers for the specified iModel. */
  public hideGeoPhotoMarkers(iModel: IModelConnection): void {
    const geoPhotos: GeoPhotos = (iModel as any).geoPhotos;
    if (undefined !== geoPhotos)
      geoPhotos.removeMarkers();
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

  private showingMarkers(view: ScreenViewport) {
    const geoPhotos: GeoPhotos = (view.iModel as any).geoPhotos;
    return (geoPhotos && geoPhotos.showingMarkers());
  }

  /** Invoked the first time this plugin is loaded. */
  public onLoad(_args: string[]): void {
    // store the plugin in the tool prototype.
    GeoTagTool.plugin = this;

    this._i18NNamespace = this.i18n.registerNamespace("geoPhoto");
    this._i18NNamespace!.readFinished.then(() => {
      IModelApp.tools.register(GeoTagTool, this._i18NNamespace, this.i18n);
      GeoTagTool.plugin = this;
    }).catch(() => { });
  }

  /** Invoked each time this plugin is loaded. */
  public onExecute(args: string[]): void {
    // if no args passed in, don't do anything.
    if (args.length < 1)
      return;

    const view = IModelApp.viewManager.selectedView;
    if (!view)
      return;

    const operation = this.getOperation(args[0]);

    if ((Operation.Show === operation) || ((Operation.Toggle === operation) && !this.showingMarkers(view)))
      this.showGeoPhotoMarkers(view.iModel).catch((_err) => { });
    else if ((Operation.Hide === operation) || ((Operation.Toggle === operation) && this.showingMarkers(view)))
      this.hideGeoPhotoMarkers(view.iModel);
  }
}

// This variable is set by webPack when building a plugin.
declare var PLUGIN_NAME: string;

// Register the plugin with the pluginAdmin.
IModelApp.pluginAdmin.register(new GeoPhotoPlugin(PLUGIN_NAME));
