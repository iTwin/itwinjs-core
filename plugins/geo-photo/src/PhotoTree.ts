
/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { I18N } from "@bentley/imodeljs-i18n";
import { Point3d, XYZProps } from "@bentley/geometry-core";
import { IModelApp, IModelConnection, GeoConverter, QuantityType } from "@bentley/imodeljs-frontend";
import { Cartographic, IModelCoordinatesResponseProps, GeoCoordStatus } from "@bentley/imodeljs-common";

/* -------------------- Callback for photo tree traversal ---------------------- */
export type PhotoTraverseFunction = (photoFile: PhotoFile, photoFolder: PhotoFolder) => Promise<void>;

/* -------------------- Interface implemented to access a particular photo storage mechanism --------------- */

/** this interface is provided to allow retrieval of the tree of photos from any storage mechanism. */
export interface PhotoTreeHandler {
  // create the root folder. Do not read contents yet.
  createRootFolder(): Promise<PhotoFolder>;

  // read the folder contents (subFolders and photos).
  readFolderContents(folder: PhotoFolder, subFolders: boolean): Promise<FolderEntry[]>;

  // reads the file contents for each photo file.
  getFileContents(file: PhotoFile, byteCount?: number): Promise<Uint8Array>;

  // gets the cartographic positions for each photo file.
  getCartographicPositions(folder: PhotoFolder, subFolders: boolean): Promise<void>;

  // gets the spatial positions for each photo file from the Cartographic positions.
  getSpatialPositions(folder: PhotoFolder, subFolders: boolean): Promise<void>;

  getIModel(): IModelConnection;
}

// ---------------------- Base Classes for GeoPhoto tree members ---------------------------
// Implementation specific subclasses of these base classes are created by each storage-specific TreeHandler

/** Abstract base class for PhotoFolder and PhotoEntry */
export abstract class FolderEntry {
  private _visible: boolean;
  constructor(public treeHandler: PhotoTreeHandler) {
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
export abstract class PhotoFolder extends FolderEntry {
  private _entries: FolderEntry[] | undefined;

  constructor(treeHandler: PhotoTreeHandler) {
    super(treeHandler);
    this._entries = undefined;
  }

  /** uses treeHandler to read the contents of this Folder. */
  public async getFolderContents(subFolders: boolean): Promise<FolderEntry[]> {
    if (!this._entries)
      this._entries = await this.treeHandler.readFolderContents(this, subFolders);

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

  constructor(treeHandler: PhotoTreeHandler, protected _i18n: I18N, geoLocation?: Cartographic, spatial?: XYZProps, probablyPano?: boolean) {
    super(treeHandler);
    this.geoLocation = geoLocation;
    this.spatial = spatial;
    this.probablyPano = probablyPano;
  }

  /** Gets the contents of the file. */
  public abstract getFileContents(byteCount?: number): Promise<Uint8Array>;

  /** Gets an Url that corresponds to the photo file. */
  public abstract get accessUrl(): string;

  public get isPanorama(): boolean {
    return this.probablyPano ? this.probablyPano : false;
  }

  public async getToolTip(): Promise<string | HTMLElement | undefined> {
    const toolTip = document.createElement("div");
    let toolTipHtml = this._i18n.translate(this.isPanorama ? "geoPhoto:messages.PanoramaFile" : "geoPhoto:messages.PhotoFile", { fileName: this.name });
    const coordFormatterSpec = await IModelApp.quantityFormatter.getFormatterSpecByQuantityType(QuantityType.Coordinate);
    const latLongFormatterSpec = await IModelApp.quantityFormatter.getFormatterSpecByQuantityType(QuantityType.LatLong);
    if (undefined !== latLongFormatterSpec && undefined !== coordFormatterSpec && undefined !== this.geoLocation) {
      try {
        const globalOrigin = this.treeHandler.getIModel().globalOrigin;
        const zAdjusted = this.geoLocation.height - globalOrigin.z;

        const cartographic = Cartographic.fromDegrees(this.geoLocation.longitude, this.geoLocation.latitude, this.geoLocation.height);
        const formattedLat = IModelApp.quantityFormatter.formatQuantity(Math.abs(cartographic.latitude), latLongFormatterSpec);
        const formattedLong = IModelApp.quantityFormatter.formatQuantity(Math.abs(cartographic.longitude), latLongFormatterSpec);
        const formattedHeight = IModelApp.quantityFormatter.formatQuantity(zAdjusted, coordFormatterSpec);
        const latDir = cartographic.latitude < 0 ? "S" : "N";
        const longDir = cartographic.longitude < 0 ? "W" : "E";
        toolTipHtml += this._i18n.translate("geoPhoto:messages.ToolTip", { formattedLat, latDir, formattedLong, longDir, formattedHeight });
      } catch { }
    }
    toolTip.innerHTML = toolTipHtml;
    return toolTip;
  }
}

export class BasePhotoTreeHandler {
  constructor(protected _iModel: IModelConnection) {
  }

  public getIModel(): IModelConnection {
    return this._iModel;
  }

  /** Traverses the files to get their Spatial positions. This is set up as a separate pass to facility
   *  future optimization. Currently, it just does the files one by one. Batching up the lat/long
   *  values to calculate their spatial coordinates would improve efficiency.
   */
  public async getSpatialPositions(folder: PhotoFolder, subFolders: boolean): Promise<void> {
    const spatialPositionCollector = new SpatialPositionCollector(folder, subFolders, this._iModel);
    await spatialPositionCollector.getPositions();
  }
}

// this collects the spatial position of every photo.
class SpatialPositionCollector {
  private _haveGCS: boolean | undefined;
  private _gcsConverter: GeoConverter | undefined;
  private _geoPoints: XYZProps[] | undefined;
  private _photoFiles: PhotoFile[] | undefined;

  constructor(private _folder: PhotoFolder, private _subFolders: boolean, private _iModel: IModelConnection) {
  }

  private async getGcsConverterAvailable(iModel: IModelConnection) {
    // Determine if we have a usable GCS.
    const converter = iModel.geoServices.getConverter("WGS84");
    if (undefined === converter)
      return false;
    const requestProps: XYZProps[] = [{ x: 0, y: 0, z: 0 }];
    let haveConverter;
    try {
      const responseProps = await converter.getIModelCoordinatesFromGeoCoordinates(requestProps);
      haveConverter = responseProps.iModelCoords.length === 1 && responseProps.iModelCoords[0].s !== GeoCoordStatus.NoGCSDefined;
    } catch (_) {
      haveConverter = false;
    }
    if (haveConverter)
      this._gcsConverter = converter;
    return haveConverter;
  }

  private async gatherRequests(file: PhotoFile, _folder: PhotoFolder) {
    const geoLocation: Cartographic | undefined = file.geoLocation;
    if (geoLocation) {
      this._geoPoints!.push(new Point3d(geoLocation.longitude, geoLocation.latitude, 0.0 /*geoLocation.height*/));
      this._photoFiles!.push(file);
    }
  }

  private async getEcefResults (file: PhotoFile, _folder: PhotoFolder) {
    const geoLocation: Cartographic | undefined = file.geoLocation;
    if (geoLocation) {
      const cartographic = Cartographic.fromDegrees(geoLocation.longitude, geoLocation.latitude, geoLocation.height);
      file.spatial = this._iModel.cartographicToSpatialFromEcef(cartographic);
    }
  }

  public async getPositions(): Promise<void> {
    if (undefined === this._haveGCS) {
      this._haveGCS = await this.getGcsConverterAvailable(this._iModel);
    }

    if (this._haveGCS) {
      // traverse all folders gathering up the required conversions.
      this._gcsConverter = this._iModel.geoServices.getConverter("WGS84");
      this._geoPoints = [];
      this._photoFiles = [];
      await this._folder.traversePhotos(this.gatherRequests.bind(this), this._subFolders, false);

      // make a single request to the server (it is broken up by the GeoServices layer)
      const response: IModelCoordinatesResponseProps = await this._gcsConverter!.getIModelCoordinatesFromGeoCoordinates(this._geoPoints);

      // put the answers in the photo file objects.
      for (let iPoint = 0; iPoint < response.iModelCoords.length; ++iPoint) {
        const status = response.iModelCoords[iPoint].s;
        if ((status === GeoCoordStatus.Success) || (status === GeoCoordStatus.OutOfUsefulRange)) {
          this._photoFiles![iPoint].spatial = response.iModelCoords[iPoint].p;
        }
      }
    } else {
      // no gcs, just use ecef for each position.
      await this._folder.traversePhotos(this.getEcefResults.bind(this), this._subFolders, false);
    }
  }
}
