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

import { ABuffer } from "../../../system/buffer/ABuffer";
import { Uint8Buffer } from "../../../system/buffer/Uint8Buffer";
import { AList } from "../../../system/collection/AList";
import { ALong } from "../../../system/runtime/ALong";
import { ContentLoader } from "../../../system/storage/ContentLoader";
import { CloudPoint } from "../../model/CloudPoint";
import { PointDataRaw } from "../../model/PointDataRaw";
import { ReadRequest } from "../../model/ReadRequest";
import { TileIndex } from "../../model/TileIndex";
import { AttributeMask } from "./AttributeMask";
import { AttributeReader } from "./AttributeReader";
import { FileReader } from "./FileReader";
import { GeometryReader } from "./GeometryReader";
import { TileReadBuffer } from "./TileReadBuffer";

/**
 * Class PointReader reads points from tiles.
 *
 * @version 1.0 January 2014
 */
/** @internal */
export class PointReader {
  /**
   * No instances.
   */
  private constructor() {}

  /**
   * Read the data of a tile.
   * @param reader the file reader.
   * @param readRequest the read request parameters.
   * @param attributeMask the attribute mask for reading.
   * @param level the index of the level to read from.
   * @param tileRecord the tile record.
   * @param tileBuffer the buffer to help reading.
   */
  private static readTileData(
    reader: FileReader,
    readRequest: ReadRequest,
    attributeMask: AttributeMask,
    level: int32,
    tileRecord: TileIndex,
    pointOffset: int32,
    pointCount: int32,
    tileBuffer: TileReadBuffer,
    fileContents: ContentLoader
  ): void {
    /* Should we read the geometry? */
    let geometryReader: GeometryReader = null;
    if (readRequest.readGeometry()) {
      /* Read all geometry data */
      geometryReader = reader.getGeometryReader(level);
      geometryReader.readTileData2(
        tileRecord,
        pointOffset,
        pointCount,
        tileBuffer,
        readRequest,
        fileContents
      );
    }
    /* Read all attribute data */
    let attributeReaders: AList<AttributeReader> = attributeMask.readers;
    for (let i: number = 0; i < attributeReaders.size(); i++) {
      let attributeReader: AttributeReader = attributeReaders.get(i);
      attributeReader.readTileData2(
        level,
        tileRecord,
        ALong.fromInt(pointOffset),
        pointCount,
        tileBuffer,
        i,
        readRequest,
        fileContents
      );
    }
  }

  /**
   * Parse the data of a tile.
   * @return the parsed tile data.
   */
  private static parseTileData(
    reader: FileReader,
    readRequest: ReadRequest,
    attributeMask: AttributeMask,
    level: int32,
    tileRecord: TileIndex,
    pointOffset: int32,
    pointCount: int32,
    tileBuffer: TileReadBuffer,
    fileContents: ContentLoader
  ): AList<CloudPoint> {
    /* We should have the file content */
    if (fileContents.isAvailable() == false) return null;
    /* Should we read the geometry? */
    let geometryReader: GeometryReader = null;
    if (readRequest.readGeometry()) {
      /* Read all geometry data */
      geometryReader = reader.getGeometryReader(level);
    }
    /* Read all attribute data */
    let attributeReaders: AList<AttributeReader> = attributeMask.readers;
    /* Thinning? */
    let thinning: int32 = readRequest.getThinning();
    if (thinning < 2) thinning = 0;
    /* Process all points */
    let cloudPointList: AList<CloudPoint> = new AList<CloudPoint>();
    for (let i: number = 0; i < pointCount; i++) {
      /* Create a point */
      let cloudPoint: CloudPoint = CloudPoint.createWithAttributes(
        attributeMask.attributes
      );
      /* Thinning? */
      if (thinning != 0 && i % thinning != 0) {
        /* Skip */
        continue;
      }
      /* Get the point index */
      let pointIndex: ALong = tileRecord.pointIndex.addInt(pointOffset + i);
      /* Set the index */
      cloudPoint.setIndex(pointIndex);
      /* Set the geometry */
      if (readRequest.readGeometry())
        geometryReader.getPointData(tileRecord, tileBuffer, i, cloudPoint);
      /* Set the attributes */
      for (let j: number = 0; j < attributeReaders.size(); j++) {
        let attributeReader: AttributeReader = attributeReaders.get(j);
        attributeReader.getPointData(
          level,
          tileRecord,
          tileBuffer,
          j,
          i,
          cloudPoint
        );
      }
      /* Process the point */
      cloudPointList.add(cloudPoint);
    }
    /* Return the list */
    return cloudPointList;
  }

  /**
   * Read some points of a tile.
   * @param reader the file reader.
   * @param readRequest the read request parameters.
   * @param attributeMask the attribute mask for reading.
   * @param level the index of the level to read from.
   * @param tileRecord the tile record.
   * @param tileBuffer the buffer to help reading.
   * @param processor the point processor.
   * @param fileContens the file contents.
   * @return the tile points.
   */
  public static readTilePoints(
    reader: FileReader,
    readRequest: ReadRequest,
    attributeMask: AttributeMask,
    level: int32,
    tileRecord: TileIndex,
    pointOffset: int32,
    pointCount: int32,
    tileBuffer: TileReadBuffer,
    fileContens: ContentLoader
  ): AList<CloudPoint> {
    /* Read the tile data */
    PointReader.readTileData(
      reader,
      readRequest,
      attributeMask,
      level,
      tileRecord,
      pointOffset,
      pointCount,
      tileBuffer,
      fileContens
    );
    /* Parse the tile data */
    return PointReader.parseTileData(
      reader,
      readRequest,
      attributeMask,
      level,
      tileRecord,
      pointOffset,
      pointCount,
      tileBuffer,
      fileContens
    );
  }

  /**
   * Parse the data of a tile.
   * @return the parsed tile data.
   */
  private static parseTileDataRaw(
    reader: FileReader,
    readRequest: ReadRequest,
    attributeMask: AttributeMask,
    tileRecord: TileIndex,
    tileBuffer: TileReadBuffer,
    pointData: PointDataRaw,
    fileContents: ContentLoader
  ): void {
    /* We should have the file content */
    if (fileContents.isAvailable() == false) return;
    /* Read the geometry */
    let geometryReader: GeometryReader = reader.getGeometryReader(
      tileRecord.level
    );
    geometryReader.getPointDataRaw(tileRecord, tileBuffer, pointData);
    /* Read the color? */
    if (tileBuffer.getAttributeCount() > 0) {
      /* Little-endian encoding makes 24-bit RGB values to be written as BGR byte sequence */
      pointData.colors = new Uint8Buffer(
        tileBuffer.getAttributeBuffer(0),
        0,
        3 * tileRecord.pointCount
      );
    }
  }

  /**
   * Read some points of a tile.
   * @param reader the file reader.
   * @param readRequest the read request parameters.
   * @param attributeMask the attribute mask for reading.
   * @param level the index of the level to read from.
   * @param tileRecord the tile record.
   * @param tileBuffer the buffer to help reading.
   * @param processor the point processor.
   * @param fileContens the file contents.
   * @return the tile points.
   */
  public static readTilePointsRaw(
    reader: FileReader,
    readRequest: ReadRequest,
    attributeMask: AttributeMask,
    tileRecord: TileIndex,
    tileBuffer: TileReadBuffer,
    pointData: PointDataRaw,
    fileContents: ContentLoader
  ): void {
    /* Read the tile data */
    PointReader.readTileData(
      reader,
      readRequest,
      attributeMask,
      tileRecord.level,
      tileRecord,
      0,
      tileRecord.pointCount,
      tileBuffer,
      fileContents
    );
    /* Parse the tile data */
    PointReader.parseTileDataRaw(
      reader,
      readRequest,
      attributeMask,
      tileRecord,
      tileBuffer,
      pointData,
      fileContents
    );
  }
}
