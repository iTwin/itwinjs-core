/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
import * as path from "path";

export class KnownTestLocations {

  public static get assetsDir(): string {
    const imodeljsSelf: any = self;
    if (imodeljsSelf !== undefined && "imodeljs" in imodeljsSelf) {
      return imodeljsSelf.imodeljs.appAssets;
    }

    // Assume that we are running in nodejs
    return path.join(__dirname, "assetsDir");
  }

  public static get outputDir(): string {
    const imodeljsSelf: any = self;
    if (imodeljsSelf !== undefined && "imodeljs" in imodeljsSelf) {
      return imodeljsSelf.imodeljs.tempDir;
    }

    // Assume that we are running in nodejs
    return path.join(__dirname, "output");
  }

}
