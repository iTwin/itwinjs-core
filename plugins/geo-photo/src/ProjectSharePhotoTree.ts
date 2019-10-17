/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { I18N } from "@bentley/imodeljs-i18n";
import { Logger, GuidString } from "@bentley/bentleyjs-core";
import { ProjectShareClient, ProjectShareFolder, ProjectShareFile, ProjectShareQuery, AuthorizedClientRequestContext } from "@bentley/imodeljs-clients";
import { Cartographic } from "@bentley/imodeljs-common";
import { IModelConnection, AuthorizedFrontendRequestContext } from "@bentley/imodeljs-frontend";
import { loggerCategory, GeoPhotoTags, PhotoTreeHandler, PhotoFolder, PhotoFile, FolderEntry, BasePhotoTreeHandler } from "./PhotoTree";

// ------------------------ Project Share TreeHandler implementation ---------------------

/** Subclass of PhotoFolder created by ProjectShareHandler */
class PSPhotoFolder extends PhotoFolder {

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
class PSPhotoFile extends PhotoFile {
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

/** The TreeHandler subclass that reads from Project Share. */
export class ProjectShareHandler extends BasePhotoTreeHandler implements PhotoTreeHandler {
  private _projectShareClient: ProjectShareClient;
  private _rootFolder: PSPhotoFolder | undefined;
  private static readonly _customPropertyName = "JpegInfoV1";

  constructor(private _context: AuthorizedFrontendRequestContext, private _i18n: I18N, iModel: IModelConnection) {
    super(iModel);
    this._projectShareClient = new ProjectShareClient();
  }

  /** Create the root folder for a Project Share file repository */
  public async createRootFolder(): Promise<PhotoFolder> {
    this._rootFolder = new PSPhotoFolder(this, undefined, this._i18n, undefined);

    // Always get the contents of the root folder. (ends up back at our readFolderContents method)
    await this._rootFolder.getFolderContents(true);
    return this._rootFolder;
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
    // require all the values to be defined, or read the tag value from the file again.
    if (tags.geoLocation === undefined || tags.geoLocation.latitude === undefined || tags.geoLocation.longitude === undefined)
      return undefined;

    const geoLocation = new Cartographic(tags.geoLocation.longitude, tags.geoLocation.latitude, tags.geoLocation.height || 0.0);
    return new GeoPhotoTags(geoLocation, tags.track, tags.time, tags.probablyPano, tags.thumbnail);
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
  public validateTags(_psFile: PSPhotoFile, _tags: GeoPhotoTags): boolean {
    // TODO: This currently just returns true. We experimented with modifiedTime - that doesn't work because it changes when
    // you change the custom properties. We experimented with checksum - that is too slow. So we simply observe that the way
    // pictures are taken, the camera gives them a new name every time, and they never really change. If necessary, we can
    // figure out something in the future.
    return true;
  }

  /**
   * Updates tags (stored as custom properties in Project Share) for the specified file by (re-)reading the image
   * @param requestContext Client request context that includes the authorization information to access Project Share.
   * @param file File in project share
   * @returns The tags that have been read from the image
   */
  public async updateTags(requestContext: AuthorizedClientRequestContext, contextId: GuidString, psFile: PSPhotoFile): Promise<GeoPhotoTags | undefined> {
    try {
      const tags = await psFile.readTagsFromJpeg();
      if (tags === undefined) {
        Logger.logWarning(loggerCategory, "Jpeg does not have any geographic location", () => ({ ...psFile.psFile }));
        return undefined;
      }
      await this.saveTags(requestContext, contextId, psFile, tags);
      return tags;
    } catch (error) {
      // tslint:disable-next-line:no-console
      console.log (`Error ${error} attempting to read tags of ${psFile.name}`);
      return undefined;
    }
  }

  /** Get the Cartographic (lat/long) positions for the specified file. */
  private async getPhotoFileCartographic(file: PhotoFile, _folder: PhotoFolder): Promise<void> {
    const psFile = file as PSPhotoFile;

    let tags = this.readTags(psFile);
    if (tags === undefined || !this.validateTags(psFile, tags))
      tags = await this.updateTags(this._context, this._iModel.iModelToken.contextId!, psFile);

    if (!tags) {
      // tslint:disable-next-line:no-console
      console.log(`File ${file.name} does not have any geographic location`);
      return;
    }

    psFile.geoLocation = tags.geoLocation;
    psFile.track = tags.track;
    psFile.takenTime = tags.time;
    psFile.probablyPano = tags.probablyPano;
  }

  /** Traverses the files to get their Cartographic positions. This is set up as a separate pass to facility
   *  future optimization. Currently, it just does the files one by one.
   */
  public async getCartographicPositions(folder: PhotoFolder, subFolders: boolean): Promise<void> {
    await folder.traversePhotos(this.getPhotoFileCartographic.bind(this), subFolders, false);
  }

  /** Reads the contents (both folders and files) in specified folder */
  public async readFolderContents(folder: PhotoFolder, subFolders: boolean): Promise<FolderEntry[]> {
    const entries: FolderEntry[] = [];
    const projectId = this._iModel.iModelToken.contextId;
    if (!projectId)
      return entries;

    // Note: undefined folderId is interpreted as the root folder.
    let folderId = (folder as PSPhotoFolder).folderId;
    if (undefined === folderId)
      folderId = projectId;
    const projectShareQuery = new ProjectShareQuery().inFolder(folderId!);
    const psFolders: ProjectShareFolder[] = await this._projectShareClient.getFolders(this._context, projectId, projectShareQuery);
    for (const thisPsFolder of psFolders) {
      entries.push(new PSPhotoFolder(this, folder, this._i18n, thisPsFolder));
    }

    const files: ProjectShareFile[] = await this._projectShareClient.getFiles(this._context, projectId, projectShareQuery);
    for (const thisFile of files) {
      // we want only jpeg files.
      if (undefined !== thisFile.name) {
        const lcName: string = thisFile.name.toLowerCase();
        if (lcName.endsWith("jpg") || lcName.endsWith("jpeg")) {
          entries.push(new PSPhotoFile(this, folder, this._i18n, thisFile));
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
