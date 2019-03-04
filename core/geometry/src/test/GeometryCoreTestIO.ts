/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { GeometryQuery } from "../curve/GeometryQuery";
import { prettyPrint } from "./testFunctions";
import { Geometry } from "../Geometry";
import * as fs from "fs";
import { IModelJson } from "../serialization/IModelJsonSchema";
import { Arc3d } from "../curve/Arc3d";
import { Point3d } from "../geometry3d/Point3dVector3d";
/* tslint:disable:no-console */

// Methods (called from other files in the test suite) for doing I/O of tests files.
export class GeometryCoreTestIO {
  public static outputRootDirectory = "./src/test/output";
  public static saveGeometry(geometry: any, directoryName: string | undefined, fileName: string) {
    let path = GeometryCoreTestIO.outputRootDirectory;
    if (directoryName !== undefined) {
      path += "/" + directoryName;
      if (!fs.existsSync(path))
        fs.mkdirSync(path);
    }
    const fullPath = path + "/" + fileName + ".imjs";
    // console.log("saveGeometry::    " + fullPath);

    const imjs = IModelJson.Writer.toIModelJson(geometry);
    fs.writeFileSync(fullPath, prettyPrint(imjs));
  }
  public static captureGeometry(collection: GeometryQuery[], newGeometry: GeometryQuery | GeometryQuery[], dx: number = 0, dy: number = 0, dz: number = 0) {
    if (newGeometry instanceof GeometryQuery) {
      if (Geometry.hypotenuseSquaredXYZ(dx, dy, dz) !== 0)
        newGeometry.tryTranslateInPlace(dx, dy, dz);
      collection.push(newGeometry);
      return;
    }
    if (Array.isArray(newGeometry)) {
      for (const g of newGeometry)
        this.captureGeometry(collection, g, dx, dy, dz);
    }
  }
  /**
   * Create a circle (or many circles) given center and radius.  Save the arcs in collection, shifted by [dx,dy,dz]
   * @param collection growing array of geometry
   * @param center single or multiple center point data
   * @param radius radius of circles
   * @param dx x shift
   * @param dy y shift
   * @param dz z shift
   */
  public static createAndCaptureXYCircle(collection: GeometryQuery[], center: Point3d | Point3d[], radius: number, dx: number = 0, dy: number = 0, dz: number = 0) {
    if (Array.isArray(center)) {
      for (const c of center)
        this.createAndCaptureXYCircle(collection, c, radius, dx, dy, dz);
      return;
    }
    if (!Geometry.isSameCoordinate(0, radius)) {
      const newGeometry = Arc3d.createXY(center, radius);
      newGeometry.tryTranslateInPlace(dx, dy, dz);
      collection.push(newGeometry);
    }
  }
}
