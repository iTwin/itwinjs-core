/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module OrbitGT
 */

//package orbitgt.pointcloud.format.opc;

type int8 = number;
type int16 = number;
type int32 = number;
type float32 = number;
type float64 = number;

import { Coordinate } from "../../../spatial/geom/Coordinate";
import { AList } from "../../../system/collection/AList";
import { ALong } from "../../../system/runtime/ALong";
import { Message } from "../../../system/runtime/Message";
import { Strings } from "../../../system/runtime/Strings";
import { ContentLoader } from "../../../system/storage/ContentLoader";
import { FileStorage } from "../../../system/storage/FileStorage";
import { PointAttribute } from "../../model/PointAttribute";
import { AttributeReader } from "./AttributeReader";
import { ContainerFile } from "./ContainerFile";
import { ContainerFilePart } from "./ContainerFilePart";
import { DirectoryReader } from "./DirectoryReader";
import { DirectoryRecord } from "./DirectoryRecord";
import { EmbeddedAttributeReader } from "./EmbeddedAttributeReader";
import { FileRecord } from "./FileRecord";
import { GeometryReader } from "./GeometryReader";

/**
 * Class FileReader reads OPC files.
 *
 * @version 1.0 January 2014
 */
/** @internal */
export class FileReader {
  /** The name of this module */
  private static readonly MODULE: string = "FileReader";

  /** The file storage */
  private _fileStorage: FileStorage;
  /** The name of the file */
  private _fileName: string;
  /** The container */
  private _container: ContainerFile;

  /** The file record */
  private _fileRecord: FileRecord;
  /** The directory readers (1 per level) */
  private _directoryReaders: Array<DirectoryReader>;
  /** The geometry readers (1 per level) */
  private _geometryReaders: Array<GeometryReader>;
  /** The attribute readers */
  private _attributeReaders: Array<AttributeReader>;

  /**
   * Create a new reader.
   * @param fileName the name of the file.
   * @param container the container file.
   * @param fileRecord the file record.
   */
  private constructor(fileStorage: FileStorage, fileName: string, container: ContainerFile, fileRecord: FileRecord) {
    /* Store the parameters */
    this._fileStorage = fileStorage;
    this._fileName = fileName;
    this._container = container;
    this._fileRecord = fileRecord;
    /* Clear */
    this._directoryReaders = null;
    this._geometryReaders = null;
    this._attributeReaders = null;
  }

  /**
   * Open a file.
   * @param fileName the name of the file.
   * @param lazyLoading avoid early loading to keep a low memory profile?
   * @return the reader.
   */
  public static async openFile(fileStorage: FileStorage, fileName: string, lazyLoading: boolean): Promise<FileReader> {
    /* Open the container file */
    let container: ContainerFile = await ContainerFile.read(fileStorage, fileName, "OPC3");
    /* Read the file record */
    let filePart: ContainerFilePart = container.getPart("file");
    let fileRecord: FileRecord = await FileRecord.readNew(
      fileStorage,
      filePart.getFileAccess().getFileName(),
      filePart.getOffset(),
      filePart.getSize()
    );
    /* Create a reader */
    let fileReader: FileReader = new FileReader(fileStorage, fileName, container, fileRecord);
    /* Open the reader */
    fileReader = await fileReader.open(lazyLoading);
    /* Return the reader */
    return fileReader;
  }

  /**
   * Open the reader.
   * @param lazyLoading avoid early loading to keep a low memory profile?
   * @return the reader.
   */
  private async open(lazyLoading: boolean): Promise<FileReader> {
    /* Log */
    Message.print(
      FileReader.MODULE,
      "Opening OPC with " +
        this._fileRecord.getLevelCount() +
        " levels (crs " +
        this._fileRecord.getCRS() +
        ", lazy? " +
        lazyLoading +
        ")"
    );
    Message.print(FileReader.MODULE, "Container has " + this._container.getPartCount() + " parts");
    //        for(ContainerFilePart part: this._container.getParts()) Message.print(MODULE,"Part '"+part.getName()+"'");
    /* Define the content we are going to need (dozens of parts) */
    Message.print(
      FileReader.MODULE,
      "Loading " +
        this._fileRecord.getLevelCount() +
        " levels and " +
        this._fileRecord.getAttributeCount() +
        " attributes"
    );
    let fileContents: ContentLoader = new ContentLoader(this._fileStorage, this._fileName);
    /* Only read the block list for the top levels? (to save memory) */
    let prefetchLevelIndex: int32 = this._fileRecord.getLevelCount() - 6;
    if (prefetchLevelIndex < 0) prefetchLevelIndex = 0;
    if (lazyLoading == false) prefetchLevelIndex = 0;
    Message.print(FileReader.MODULE, "Prefetching from level " + prefetchLevelIndex);
    /* Read the directory */
    this._directoryReaders = new Array<DirectoryReader>(this._fileRecord.getLevelCount());
    for (let i: number = 0; i < this._directoryReaders.length; i++) {
      let directoryReader: DirectoryReader = new DirectoryReader(this, i);
      let readBlockList: boolean = i >= prefetchLevelIndex;
      directoryReader.loadData(readBlockList, fileContents);
      this._directoryReaders[i] = directoryReader;
    }
    /* Read the geometry */
    this._geometryReaders = new Array<GeometryReader>(this._fileRecord.getLevelCount());
    for (let i: number = 0; i < this._geometryReaders.length; i++) {
      let geometryReader: GeometryReader = new GeometryReader(this, i);
      geometryReader.loadData(fileContents);
      this._geometryReaders[i] = geometryReader;
    }
    /* Read the attributes */
    this._attributeReaders = new Array<AttributeReader>(this._fileRecord.getAttributeCount());
    for (let i: number = 0; i < this._fileRecord.getAttributeCount(); i++) {
      let attributeReader: EmbeddedAttributeReader = new EmbeddedAttributeReader(
        this._container,
        i,
        this._fileRecord.getLevelCount()
      );
      attributeReader.loadData(fileContents);
      this._attributeReaders[i] = attributeReader;
    }
    /* Load all data needed for the structures */
    fileContents = await fileContents.load();
    /* Read the directory */
    for (let i: number = 0; i < this._directoryReaders.length; i++) {
      let readBlockList: boolean = i >= prefetchLevelIndex;
      this._directoryReaders[i].loadData(readBlockList, fileContents);
    }
    /* Read the geometry */
    for (let i: number = 0; i < this._geometryReaders.length; i++) {
      this._geometryReaders[i].loadData(fileContents);
    }
    /* Read the attributes */
    for (let i: number = 0; i < this._fileRecord.getAttributeCount(); i++) {
      let attributeReader: EmbeddedAttributeReader = <EmbeddedAttributeReader>(<unknown>this._attributeReaders[i]);
      attributeReader.loadData(fileContents);
    }
    /* Log file info */
    Message.print(FileReader.MODULE, "OPC bounds are " + this._geometryReaders[0].getGeometryRecord().getBounds());
    let tileGridSize0: Coordinate = this._geometryReaders[0].getGeometryRecord().getTileGrid().size;
    Message.print(
      FileReader.MODULE,
      "OPC level0 tile size is (" + tileGridSize0.x + "," + tileGridSize0.y + "," + tileGridSize0.z + ")"
    );
    let totalPointCount: ALong = ALong.ZERO;
    let totalTileCount: int32 = 0;
    let totalBlockCount: int32 = 0;
    for (let i: number = 0; i < this._fileRecord.getLevelCount(); i++) {
      let directoryRecord: DirectoryRecord = this._directoryReaders[i].getDirectoryRecord();
      Message.print(
        FileReader.MODULE,
        "Level " +
          i +
          " has " +
          directoryRecord.getPointCount() +
          " points, " +
          directoryRecord.getTileCount() +
          " tiles, " +
          directoryRecord.getBlockCount() +
          " blocks"
      );
      totalPointCount = totalPointCount.add(directoryRecord.getPointCount());
      totalTileCount += directoryRecord.getTileCount();
      totalBlockCount += directoryRecord.getBlockCount();
    }
    Message.print(
      FileReader.MODULE,
      "Pointcloud has " + totalPointCount + " points, " + totalTileCount + " tiles, " + totalBlockCount + " blocks"
    );
    /* Get the attributes */
    Message.print(FileReader.MODULE, "Pointcloud has " + this._attributeReaders.length + " static attributes:");
    for (let i: number = 0; i < this._attributeReaders.length; i++) {
      Message.print(FileReader.MODULE, "Attribute " + i + ": " + this._attributeReaders[i].getAttribute());
      Message.print(FileReader.MODULE, " min: " + this._attributeReaders[i].getMinimumValue());
      Message.print(FileReader.MODULE, " max: " + this._attributeReaders[i].getMaximumValue());
    }
    /* Return the reader */
    return this;
  }

  /**
   * Close the file.
   */
  public close(): void {
    for (let attributeReader of this._attributeReaders) attributeReader.close();
    if (this._container != null) this._container.close(true);
    this._container = null;
  }

  /**
   * Get the storage of the file.
   * @return the storage of the file.
   */
  public getFileStorage(): FileStorage {
    return this._fileStorage;
  }

  /**
   * Get the name of the file.
   * @return the name of the file.
   */
  public getFileName(): string {
    return this._fileName;
  }

  /**
   * Get the container file.
   * @return the container file.
   */
  public getContainer(): ContainerFile {
    return this._container;
  }

  /**
   * Get the file record.
   * @return the file record.
   */
  public getFileRecord(): FileRecord {
    return this._fileRecord;
  }

  /**
   * Get the number of resolution levels.
   * @return the number of resolution levels.
   */
  public getLevelCount(): int32 {
    return this._fileRecord.getLevelCount();
  }

  /**
   * Get a directory reader.
   * @param level the index of the level.
   * @return the directory reader.
   */
  public getDirectoryReader(level: int32): DirectoryReader {
    return this._directoryReaders[level];
  }

  /**
   * Get a geometry reader.
   * @param level the index of the level.
   * @return the geometry reader.
   */
  public getGeometryReader(level: int32): GeometryReader {
    return this._geometryReaders[level];
  }

  /**
   * Get the static attribute readers.
   * @return the static attribute readers.
   */
  public getStaticAttributeReaders(): Array<AttributeReader> {
    return this._attributeReaders;
  }

  /**
   * Get the attribute readers.
   * @return the attribute readers.
   */
  public getAttributeReaders(): Array<AttributeReader> {
    return this._attributeReaders;
  }

  /**
   * Get the attributes.
   * @return the attributes.
   */
  public getAttributes(): Array<PointAttribute> {
    let list: Array<PointAttribute> = new Array<PointAttribute>(this._attributeReaders.length);
    for (let i: number = 0; i < this._attributeReaders.length; i++) list[i] = this._attributeReaders[i].getAttribute();
    return list;
  }

  /**
   * Find an attribute reader.
   * @param attributeName the name of the attribute.
   * @return the attribute reader (null if not found).
   */
  public findAttributeReader(attributeName: string): AttributeReader {
    /* Check the static attributes */
    for (let attributeReader of this._attributeReaders) {
      if (Strings.equalsIgnoreCase(attributeReader.getAttribute().getName(), attributeName)) return attributeReader;
    }
    /* Not found */
    return null;
  }
}
