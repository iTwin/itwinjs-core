/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { GeometryQuery } from "../curve/GeometryQuery";
import { prettyPrint } from "./testFunctions";
import { Geometry } from "../Geometry";
import * as fs from "fs";
import { IModelJson } from "../serialization/IModelJsonSchema";
// Methods (called from other files in the test suite) for doing I/O of tests files.
export class GeometryCoreTestIO {
  public static outputRootDirectory = "./src/test/output";
  public static saveGeometry(geometry: GeometryQuery[], directoryName: string | undefined, fileName: string) {
    let path = GeometryCoreTestIO.outputRootDirectory;
    if (directoryName !== undefined) {
      path += "/" + directoryName;
      if (!fs.existsSync(path))
        fs.mkdirSync(path);
    }
    const filename = path + "/" + fileName + ".imjs";
    const imjs = IModelJson.Writer.toIModelJson(geometry);
    fs.writeFileSync(filename, prettyPrint(imjs));
  }
  public static captureGeometry(collection: GeometryQuery[], newGeometry: GeometryQuery, dx: number = 0, dy: number = 0, dz: number = 0) {
    if (newGeometry) {
      if (Geometry.hypotenuseSquaredXYZ(dx, dy, dz) !== 0)
        newGeometry.tryTranslateInPlace(dx, dy, dz);
      collection.push(newGeometry);
    }
  }
}
