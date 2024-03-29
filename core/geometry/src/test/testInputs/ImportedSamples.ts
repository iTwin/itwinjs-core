/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as fs from "fs";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { IndexedPolyface } from "../../polyface/Polyface";
import { IModelJson } from "../../serialization/IModelJsonSchema";

// cspell:word rhombicosidodecahedron

/**
 * `ImportedSample` has static methods to create a variety of geometry samples useful in testing.
 * @alpha
 */
export class ImportedSample {
  /**
   * Create a 62-sided regular polyhedron with facets of size 3,4,5.
   * * The following auxiliary data is also present:
   * * * per-facet normals
   * * * per-facet color
   * * * per-sector uv parameters (originally generated by Parasolid)
   */
  public static createPolyhedron62(): IndexedPolyface | undefined {
    return ImportedSample.createIndexedPolyface("./src/test/testInputs/polyface/rhombicosidodecahedron.imjs");
  }

  /** Create IndexedPolyface from imjs file. Returns the first mesh found. */
  public static createIndexedPolyface(imjsPath: string): IndexedPolyface | undefined {
    const json = fs.readFileSync(imjsPath, "utf8");
    const inputs = IModelJson.Reader.parse(JSON.parse(json)) as GeometryQuery[];
    for (const mesh of inputs) {
      if (undefined !== mesh && mesh instanceof IndexedPolyface)
        return mesh;
    }
    return undefined;
  }
}
