/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
import * as path from "path";

export class KnownLocations {

  public static get assetsDir(): string {
    const imodeljsSelf: any = self;
    if (imodeljsSelf !== undefined && "imodeljs" in imodeljsSelf) {
      return path.join(imodeljsSelf.imodeljs.packageAssetsDir, "imodeljs-backend");
    }

    // Assume that we are running in nodejs
    return path.join(__dirname, "assets");
  }
}
