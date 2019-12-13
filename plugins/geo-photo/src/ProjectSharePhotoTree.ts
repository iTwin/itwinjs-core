/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { I18N } from "@bentley/imodeljs-i18n";
import { Logger, GuidString, BeDuration, StopWatch } from "@bentley/bentleyjs-core";
import { ProjectShareClient, ProjectShareFolder, ProjectShareFile, ProjectShareFileQuery, ProjectShareFolderQuery, AuthorizedClientRequestContext } from "@bentley/imodeljs-clients";
import { Cartographic } from "@bentley/imodeljs-common";
import { IModelConnection, AuthorizedFrontendRequestContext } from "@bentley/imodeljs-frontend";
import { loggerCategory, GeoPhotoInfo, GPLoadTracker, PhotoTreeHandler, PhotoFolder, PhotoFile, PhotoTree, FolderEntry, BasePhotoTreeHandler } from "./PhotoTree";

// ------------------------ Project Share TreeHandler implementation ---------------------

/** Subclass of PhotoFolder created by ProjectShareHandler */
export class PSPhotoFolder extends PhotoFolder {

  constructor(treeHandler: PhotoTreeHandler, parent: PhotoFolder | undefined, private _i18n: I18N, private _psFolder: ProjectShareFolder | undefined) {
    super(treeHandler, parent);
  }

  public get name(): string {
    if (this._psFolder)
      return this._psFolder.name!;
    return this._i18n.translate("geoPhoto:messages.RootFolderName");
  }

  public get createTime(): string {
    if (this._psFolder)
      return this._psFolder.createdTimeStamp || "";
    return "";
  }

  public get folderId(): string | undefined {
    return (this._psFolder) ? this._psFolder.wsgId : undefined;
  }
}

class FoundProperty {
  constructor(public index: number, public value: "string") { }
}

/** Subclass of PhotoEntry created by ProjectShareHandler */
export class PSPhotoFile extends PhotoFile {
  public geoLocation: Cartographic | undefined;

  constructor(treeHandler: PhotoTreeHandler, parent: PhotoFolder, i18n: I18N, public psFile: ProjectShareFile) {
    super(treeHandler, parent, i18n);
  }

  public get name(): string {
    return this.psFile.name!;
  }

  public get createTime(): string {
    return this.psFile.createdTimeStamp || "";
  }

  public get fileId(): string {
    return this.psFile.wsgId;
  }

  public async getFileContents(byteCount?: number): Promise<Uint8Array> {
    return this._treeHandler.getFileContents(this, byteCount).catch((error) => {
      // tslint:disable-next-line:no-console
      console.log(`Error retrieving Photo File contents: ${error}`);
      return new Uint8Array();
    });
  }

  public get accessUrl(): string {
    return this.psFile.accessUrl!;
  }

  public async saveFileInfo(): Promise<void> {
    // this should never happen.
    if (!this.geoLocation)
      return;

    const auxFileInfo: GeoPhotoInfo = new GeoPhotoInfo (PhotoTree.PHOTOINFO_VERSION, this.geoLocation, this.gpsTrack ? this.gpsTrack : 0.0, this.takenTime ? this.takenTime : 0, (undefined === this.isPano) ? false : this.isPano,
      this.thumbnail, this.correctionYaw, this.correctionPitch, this.correctionRoll, this.correctionDir);
    return this._treeHandler.saveFileInfo(this, auxFileInfo);
  }
}

/** The TreeHandler subclass that reads from Project Share. */
export class ProjectShareHandler extends BasePhotoTreeHandler implements PhotoTreeHandler {
  private _projectShareClient: ProjectShareClient;
  private _photoTree: PhotoTree | undefined;
  private static readonly _customPropertyName = "JpegInfoV1";
  private _loadTracker: GPLoadTracker | undefined;

  constructor(private _context: AuthorizedFrontendRequestContext, private _i18n: I18N, iModel: IModelConnection, loadTracker: GPLoadTracker | undefined) {
    super(iModel);
    this._loadTracker = loadTracker;
    this._projectShareClient = new ProjectShareClient();
  }

  /** Create the root folder for a Project Share file repository */
  public async createPhotoTree(): Promise<PhotoTree> {
    this._photoTree = new PhotoTree(this, this._i18n);

    // Always get the contents of the root folder. (ends up back at our readFolderContents method)
    await this._photoTree.getFolderContents(true);

    // update the ui.
    if (this._loadTracker) {
      this._loadTracker.foundFile(true);
      this._loadTracker.setLoadPhase(1);
    }

    return this._photoTree;
  }

  private findCustomProperty(file: ProjectShareFile): FoundProperty | undefined {
    if (file.customProperties === undefined)
      return undefined;

    for (let iProperty = 0; iProperty < file.customProperties.length; ++iProperty) {
      const thisProperty = file.customProperties[iProperty];
      if (thisProperty.Name === ProjectShareHandler._customPropertyName) {
        return new FoundProperty(iProperty, thisProperty.Value);
      }
    }
    return undefined;
  }

  /**
   * Saves information regarding Photo as custom properties in Project Share for the specified file
   * @param requestContext Client request context that includes the authorization information to access Project Share.
   * @param contextId Connect context Id (e.g., projectId or assetId)
   * @param file
   * @param auxInfo
   */
  private async saveCustomInfo(requestContext: AuthorizedClientRequestContext, contextId: GuidString, psFile: PSPhotoFile, auxInfo: GeoPhotoInfo): Promise<void> {
    const auxInfoStr = JSON.stringify(auxInfo);
    const customProperties = [{ Name: ProjectShareHandler._customPropertyName, Value: auxInfoStr }]; // Create or update
    psFile.psFile = await this._projectShareClient.updateCustomProperties(requestContext, contextId, psFile.psFile, customProperties);
  }

  /**
   * Saves information regarding Photo as custom properties in Project Share for the specified file
   * @returns Updated ProjectShareFile
   */
  public async saveFileInfo (file: PSPhotoFile, auxInfo: GeoPhotoInfo): Promise<void> {
    return this.saveCustomInfo (this._context, this._iModel.iModelToken.contextId!, file, auxInfo);
  }

  /**
   * Reads information (stored as custom properties in Project Share) for the specified file
   * @param requestContext Client request context that includes the authorization information to access Project Share.
   * @param file File in project share
   */
  public readCustomInfo(psFile: PSPhotoFile): GeoPhotoInfo | undefined {
    const prop = this.findCustomProperty(psFile.psFile);
    if (prop === undefined)
      return undefined;

    const auxInfo: any = JSON.parse(prop.value);
    // some values are required, or we will read the tag value from the file again.
    if (auxInfo.geoLoc === undefined || auxInfo.geoLoc.latitude === undefined || auxInfo.geoLoc.longitude === undefined)
      return undefined;

    // if there is no version in the custom data, set it to 0 so it will be rejected.
    if (auxInfo.vrsn === undefined)
      auxInfo.vrsn = "0";

    const geoLocation = new Cartographic(auxInfo.geoLoc.longitude, auxInfo.geoLoc.latitude, auxInfo.geoLoc.height || 0.0);
    return new GeoPhotoInfo(auxInfo.vrsn, geoLocation, auxInfo.track, auxInfo.time, auxInfo.isPano, auxInfo.thmbnl, auxInfo.cxnYaw, auxInfo.cxnPitch, auxInfo.cxnRoll, auxInfo.cxnDir);
  }

  /**
   * Delete customInfo (stored as custom properties in Project Share) for the specified file
   * @param requestContext Client request context that includes the authorization information to access Project Share.
   * @param contextId Connect context Id (e.g., projectId or assetId)
   * @param file
   */
  public async deleteCustomInfo(requestContext: AuthorizedClientRequestContext, contextId: GuidString, psFile: PSPhotoFile): Promise<void> {
    const prop = this.findCustomProperty(psFile.psFile);
    if (!prop)
      return;

    const deleteProperties = [];
    deleteProperties.push(ProjectShareHandler._customPropertyName);
    psFile.psFile = await this._projectShareClient.updateCustomProperties(requestContext, contextId, psFile.psFile, undefined, deleteProperties);
  }

  /** Validates the tags retrieved from the ProjectShare image */
  public validateCustomInfo(_psFile: PSPhotoFile, auxInfo: GeoPhotoInfo): boolean {
    // TODO: This currently just returns true. We experimented with modifiedTime - that doesn't work because it changes when
    // you change the custom properties. We experimented with checksum - that is too slow. So we simply observe that the way
    // pictures are taken, the camera gives them a new name every time, and they never really change. If necessary, we can
    // figure out something in the future.
    return (auxInfo.vrsn !== undefined) && (typeof auxInfo.vrsn === "string") && (auxInfo.vrsn === PhotoTree.PHOTOINFO_VERSION);
  }

  /**
   * Updates custom info (stored as custom properties in Project Share) for the specified file by (re-)reading the image
   * @param requestContext Client request context that includes the authorization information to access Project Share.
   * @param file File in project share
   * @returns The GeoPhotoInfo that has been read from the image
   */
  public async updateCustomInfo(requestContext: AuthorizedClientRequestContext, contextId: GuidString, psFile: PSPhotoFile): Promise<GeoPhotoInfo | undefined> {
    try {
      const auxInfo = await psFile.readTagsFromJpeg();
      if (auxInfo === undefined) {
        Logger.logWarning(loggerCategory, "Jpeg does not have any geographic location", () => ({ ...psFile.psFile }));
        return undefined;
      }
      await this.saveCustomInfo(requestContext, contextId, psFile, auxInfo);
      return auxInfo;
    } catch (error) {
      // tslint:disable-next-line:no-console
      console.log(`Error ${error} attempting to read tags of ${psFile.name}`);
      return undefined;
    }
  }

  private nextFolder(_folder: PhotoFolder, _parent: PhotoFolder | undefined) {
    if (this._loadTracker)
      this._loadTracker.nextFolder();
  }

  /** Get the Cartographic (lat/long) positions for the specified file. */
  private async getPhotoFileCartographic(file: PhotoFile, _folder: PhotoFolder): Promise<void> {
    const psFile = file as PSPhotoFile;

    // tell UI that we are evaluating the next file.
    if (this._loadTracker) {
      this._loadTracker.nextFile(false);
    }

    let auxInfo = this.readCustomInfo(psFile);
    await BeDuration.wait(5);
    if (auxInfo === undefined || !this.validateCustomInfo(psFile, auxInfo))
      auxInfo = await this.updateCustomInfo(this._context, this._iModel.iModelToken.contextId!, psFile);

    if (!auxInfo) {
      // tslint:disable-next-line:no-console
      console.log(`File ${file.name} does not have any geographic location`);
      return;
    }

    psFile.geoLocation = auxInfo.geoLoc;
    psFile.gpsTrack = auxInfo.track;
    psFile.takenTime = auxInfo.time;
    psFile.isPano = auxInfo.isPano;
    psFile.thumbnail = auxInfo.thmbnl;
    psFile.correctionYaw = auxInfo.cxnYaw;
    psFile.correctionPitch = auxInfo.cxnPitch;
    psFile.correctionRoll = auxInfo.cxnRoll;
    psFile.correctionDir = auxInfo.cxnDir;

    // inform UI that we have found either a panorama or a standard photo.
    if (this._loadTracker) {
      if (psFile.isPano) {
        this._loadTracker.foundPanorama(false);
      } else {
        this._loadTracker.foundPhoto(false);
      }
    }
  }

  /** Traverses the files to get their Cartographic positions. This is set up as a separate pass to facility
   *  future optimization. Currently, it just does the files one by one.
   */
  public async getCartographicPositions(folder: PhotoFolder, subFolders: boolean): Promise<void> {
    await folder.traversePhotos(this.getPhotoFileCartographic.bind(this), this.nextFolder.bind(this), subFolders, false);
    // tell the tracker that we're done finding files so it can make the final report.
    if (this._loadTracker) {
      this._loadTracker.nextFile(true);
      this._loadTracker.foundPanorama(true);
      this._loadTracker.foundPhoto(true);
    }
    // the current folder needs to be counted.
    this.nextFolder(folder, folder.parent);
  }

  /** Reads the contents (both folders and files) in specified folder */
  public async readFolderContents(folder: PhotoFolder, subFolders: boolean): Promise<FolderEntry[]> {
    const entries: FolderEntry[] = [];
    const projectId = this._iModel.iModelToken.contextId;
    if (!projectId)
      return entries;

    if (this._loadTracker)
      this._loadTracker.startFolder(folder.name);

    // Note: undefined folderId is interpreted as the root folder.
    let folderId = (folder as PSPhotoFolder).folderId;
    if (undefined === folderId)
      folderId = projectId;
    const psFolders: ProjectShareFolder[] = await this._projectShareClient.getFolders(this._context, projectId, new ProjectShareFolderQuery().inFolder(folderId!));
    for (const thisPsFolder of psFolders) {
      entries.push(new PSPhotoFolder(this, folder, this._i18n, thisPsFolder));
    }

    // This stopwatch is to interrupt this tight loop every .1 second to allow the UI to update, if there's a loadTracker.
    let stopWatch: StopWatch | undefined;
    let nextET: number = 0;
    if (this._loadTracker) {
      stopWatch = new StopWatch (undefined, true);
    }
    const files: ProjectShareFile[] = await this._projectShareClient.getFiles(this._context, projectId, new ProjectShareFileQuery().inFolder(folderId!));
    for (const thisFile of files) {
      // we want only jpeg files.
      if (undefined !== thisFile.name) {
        const lcName: string = thisFile.name.toLowerCase();
        if (lcName.endsWith("jpg") || lcName.endsWith("jpeg")) {
          entries.push(new PSPhotoFile(this, folder, this._i18n, thisFile));
          if (this._loadTracker) {
            if (stopWatch!.elapsed.milliseconds > nextET) {
              await BeDuration.wait(0);
              nextET += 200;
            }
            this._loadTracker.foundFile(false);
          }
        }
      }
    }

    if (this._loadTracker)
      this._loadTracker.doneFolder();

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
  public async getFileContents(file: PhotoFile, byteCount?: number): Promise<Uint8Array> {
    const arrayBuffer = this._projectShareClient.readFile(this._context, (file as PSPhotoFile).psFile, byteCount);
    return arrayBuffer;
  }
}
