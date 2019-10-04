/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { I18N } from "@bentley/imodeljs-i18n";
import { Logger, BentleyError, BentleyStatus, GuidString } from "@bentley/bentleyjs-core";
import { ProjectShareClient, ProjectShareFolder, ProjectShareFile, ProjectShareQuery, AuthorizedClientRequestContext } from "@bentley/imodeljs-clients";
import { Cartographic } from "@bentley/imodeljs-common";
import { IModelConnection, AuthorizedFrontendRequestContext } from "@bentley/imodeljs-frontend";
import { PhotoTreeHandler, PhotoFolder, PhotoFile, FolderEntry } from "./PhotoTree";
import { JpegTagReader, ImageTags, ImageTagValue } from "./JpegTagReader";

const loggerCategory = "Plugins.GeoPhoto";

// ------------------------ Project Share TreeHandler implementation ---------------------

/** Subclass of PhotoFolder created by ProjectShareHandler */
class PSPhotoFolder extends PhotoFolder {

  constructor(treeHandler: PhotoTreeHandler, private _i18N: I18N, private _psFolder: ProjectShareFolder | undefined) {
    super(treeHandler);
  }

  public get name(): string {
    if (this._psFolder)
      return this._psFolder.name!;
    return this._i18N.translate("geoPhoto:messages.RootFolderName");
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

  constructor(treeHandler: PhotoTreeHandler, private _i18N: I18N, public psFile: ProjectShareFile) {
    super(treeHandler);
  }

  public get name(): string {
    return this.psFile.name!;
  }

  public get fileId(): string {
    return this.psFile.wsgId;
  }

  public async getFileContents(byteCount?: number): Promise<Uint8Array> {
    return this.treeHandler.getFileContents(this, byteCount).catch((error) => {
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
    return this._i18N.translate(this.isPanorama ? "geoPhoto:messages.PanoramaFile" : "geoPhoto:messages.PhotoFile", { fileName: this.name });
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

/**
 * Subset of Jpeg Tags that are of interest to the geo-photo plugin, stored in ProjectShare
 */
export class GeoPhotoTags {
  constructor(public geoLocation: Cartographic, public probablyPano: boolean, public createdTime: string | undefined) {
  }
}

/** The TreeHandler subclass that reads from Project Share. */
export class ProjectShareHandler implements PhotoTreeHandler {
  private _projectShareClient: ProjectShareClient;
  private _rootFolder: PSPhotoFolder | undefined;
  private static readonly _customPropertyName = "JpegFileInfo";

  constructor(private _context: AuthorizedFrontendRequestContext, private _i18N: I18N, private _iModelConnection: IModelConnection) {
    this._projectShareClient = new ProjectShareClient();
  }

  /** Create the root folder for a Project Share file repository */
  public async createRootFolder(): Promise<PhotoFolder> {
    this._rootFolder = new PSPhotoFolder(this, this._i18N, undefined);

    // Always get the contents of the root folder. (ends up back at our readFolderContents method)
    await this._rootFolder.getFolderContents(true);
    return this._rootFolder;
  }

  /** Utility function to get decimal degrees from the degree / minute / second array stored in a JPEG file */
  private static getDegreeMinSec(tagSet: ImageTags, baseName: string, positiveVal: string): number | undefined {
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
  private static getProbablyPano(tagSet: ImageTags): boolean {
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

  /** Read tags from a JPEG image */
  private async readTagsFromJpeg(psFile: PSPhotoFile): Promise<GeoPhotoTags> {
    const byteCount = 12000; // 12KB should be sufficient to read the GPS headers and Thumbnails
    const byteArray: Uint8Array = await psFile.getFileContents(byteCount);

    const tagSet: ImageTags = JpegTagReader.readTags(byteArray.buffer);

    const longitude = ProjectShareHandler.getDegreeMinSec(tagSet, "GPSLongitude", "E");
    const latitude = ProjectShareHandler.getDegreeMinSec(tagSet, "GPSLatitude", "N");
    const elevation: ImageTagValue = tagSet.get("GPSAltitude");
    const probablyPano: boolean = ProjectShareHandler.getProbablyPano(tagSet);
    if (longitude === undefined || latitude === undefined)
      throw new BentleyError(BentleyStatus.ERROR, "There is no geographic tag in the jpeg file", Logger.logError, loggerCategory, () => ({ ...psFile.psFile }));

    const cartographic = new Cartographic(longitude, latitude, (undefined === elevation) ? undefined : elevation as number);

    const tags = new GeoPhotoTags(cartographic, probablyPano, psFile.psFile.createdTimeStamp);
    return tags;
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
   * Saves tags as custom properties in Project Share for the specified file
   * @param requestContext Client request context that includes the authorization information to access Project Share.
   * @param contextId Connect context Id (e.g., projectId or assetId)
   * @param file
   * @param tags
   * @returns Updated ProjectShareFile
   */
  public async saveTags(requestContext: AuthorizedClientRequestContext, contextId: GuidString, psFile: PSPhotoFile, tags: GeoPhotoTags): Promise<void> {
    const tagsStr = JSON.stringify(tags);

    const prop = this.findCustomProperty(psFile.psFile);
    const customProperties = psFile.psFile.customProperties;
    if (prop)
      customProperties[prop.index].Value = tagsStr; // Update existing
    else
      customProperties.push({ Name: ProjectShareHandler._customPropertyName, Value: tagsStr }); // Create new

    await this._projectShareClient.updateCustomProperties(requestContext, contextId, psFile.psFile, customProperties);
  }

  /**
   * Reads tags (stored as custom properties in Project Share) for the specified file
   * @param requestContext Client request context that includes the authorization information to access Project Share.
   * @param file File in project share
   */
  public readTags(psFile: PSPhotoFile): GeoPhotoTags | undefined {
    const prop = this.findCustomProperty(psFile.psFile);
    if (prop === undefined)
      return undefined;

    const tags: any = JSON.parse(prop.value);
    if (tags.geoLocation === undefined || tags.geoLocation.latitude === undefined || tags.geoLocation.longitude === undefined)
      return undefined;

    const geoLocation = new Cartographic(tags.geoLocation.longitude, tags.geoLocation.latitude, tags.geoLocation.height || 0.0);
    return new GeoPhotoTags(geoLocation, tags.probablyPano, tags.createdTime);
  }

  /**
   * Delete tags (stored as custom properties in Project Share) for the specified file
   * @param requestContext Client request context that includes the authorization information to access Project Share.
   * @param contextId Connect context Id (e.g., projectId or assetId)
   * @param file
   */
  public async deleteTags(requestContext: AuthorizedClientRequestContext, contextId: GuidString, file: ProjectShareFile): Promise<void> {
    const prop = this.findCustomProperty(file);
    if (!prop)
      return;

    const deleteProperties = new Array<string>(ProjectShareHandler._customPropertyName);
    await this._projectShareClient.updateCustomProperties(requestContext, contextId, file, undefined, deleteProperties);
  }

  /** Validates the tags retrieved from the ProjectShare image */
  public validateTags(psFile: PSPhotoFile, tags: GeoPhotoTags): boolean {
    // TODO: This currently checks whether the created time matches.This isn't ideal, we are planning on changing it
    return (psFile.psFile.createdTimeStamp === tags.createdTime);
  }

  /**
   * Updates tags (stored as custom properties in Project Share) for the specified file by (re-)reading the image
   * @param requestContext Client request context that includes the authorization information to access Project Share.
   * @param file File in project share
   * @returns The tags that have been read from the image
   */
  public async updateTags(requestContext: AuthorizedClientRequestContext, contextId: GuidString, psFile: PSPhotoFile): Promise<GeoPhotoTags | undefined> {
    const tags = await this.readTagsFromJpeg(psFile);
    if (tags === undefined) {
      Logger.logWarning(loggerCategory, "Jpeg does not have any geographic location", () => ({ ...psFile.psFile }));
      return undefined;
    }
    await this.saveTags(requestContext, contextId, psFile, tags);
    return tags;
  }

  /** Get the Cartographic (lat/long) positions for the specified file. */
  private async getPhotoFileCartographic(file: PhotoFile, _folder: PhotoFolder): Promise<void> {
    const psFile = file as PSPhotoFile;

    let tags = this.readTags(psFile);
    if (tags === undefined || !this.validateTags(psFile, tags))
      tags = await this.updateTags(this._context, this._iModelConnection.iModelToken.contextId!, psFile);

    if (!tags) {
      // tslint:disable-next-line:no-console
      console.log(`File ${file.name} does not have any geographic location`);
      return;
    }

    psFile.geoLocation = tags.geoLocation;
    psFile.probablyPano = tags.probablyPano;
  }

  /** Gets the Spatial (x,y,z) coordinates for the photoFile. */
  private async getPhotoFileSpatial(file: PhotoFile, _folder: PhotoFolder): Promise<void> {
    const psFile: PSPhotoFile = file as PSPhotoFile;
    const geoLocation: Cartographic | undefined = psFile.geoLocation;
    if (geoLocation) {
      const cartographic = Cartographic.fromDegrees(geoLocation.longitude, geoLocation.latitude, geoLocation.height);
      psFile.spatial = await this._iModelConnection.cartographicToSpatial(cartographic);
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
      entries.push(new PSPhotoFolder(this, this._i18N, thisFolder));
    }

    const files: ProjectShareFile[] = await this._projectShareClient.getFiles(this._context, projectId, projectShareQuery);
    for (const thisFile of files) {
      // we want only jpeg files.
      if (undefined !== thisFile.name) {
        const lcName: string = thisFile.name.toLowerCase();
        if (lcName.endsWith("jpg") || lcName.endsWith("jpeg")) {
          entries.push(new PSPhotoFile(this, this._i18N, thisFile));
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
  public async getFileContents(file: PhotoFile, byteCount?: number): Promise<Uint8Array> {
    const arrayBuffer = this._projectShareClient.readFile(this._context, (file as PSPhotoFile).psFile, byteCount);
    return arrayBuffer;
  }
}
