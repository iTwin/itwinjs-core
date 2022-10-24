/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as fs from "fs";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { IndexedPolyface } from "../../polyface/Polyface";
import { IModelJson } from "../../serialization/IModelJsonSchema";

/**
 * `ImportedSample` has static methods to create a variety of geometry samples useful in testing.
 * @alpha
 */
 export class ImportedSample {
  // cspell:word rhombicosidodecahedron
  /** Create a 62-sided regular polyhedron mesh with 3-, 4-, and 5-sided faces and vertex color data. */
  public static createPolyhedron62(): IndexedPolyface | undefined {
    const json = fs.readFileSync("./src/test/testInputs/polyface/rhombicosidodecahedron.imjs", "utf8");
    const inputs = IModelJson.Reader.parse(JSON.parse(json)) as GeometryQuery[];
    for (const mesh of inputs) {
      if (undefined !== mesh && mesh instanceof IndexedPolyface)
        return mesh;
    }
    return undefined;
  }
}
