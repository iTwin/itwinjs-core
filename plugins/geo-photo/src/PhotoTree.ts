
/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { XYZProps } from "@bentley/geometry-core";
import { Cartographic } from "@bentley/imodeljs-common";

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

  constructor(treeHandler: PhotoTreeHandler, geoLocation?: Cartographic, spatial?: XYZProps, probablyPano?: boolean) {
    super(treeHandler);
    this.geoLocation = geoLocation;
    this.spatial = spatial;
    this.probablyPano = probablyPano;
  }

  /** Gets the contents of the file. */
  public abstract getFileContents(byteCount?: number): Promise<Uint8Array>;

  /** Gets an Url that corresponds to the photo file. */
  public abstract get accessUrl(): string;

  public abstract get isPanorama(): boolean;

  public abstract get toolTip(): string;
}
