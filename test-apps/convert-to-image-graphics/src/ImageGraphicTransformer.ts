/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import {
  using,
} from "@bentley/bentleyjs-core";
import {
  ImageSourceFormat,
} from "@bentley/imodeljs-common";
import {
  IModelDb,
  IModelTransformer,
  IModelImporter,
} from "@bentley/imodeljs-backend";

export class ImageGraphicTransformer /* extends IModelTransformer */ {
  public static transform(src: IModelDb, dst: IModelDb, _textureBytes: string, _textureFormat: ImageSourceFormat): void {
    using (new IModelTransformer(src, dst), (transformer) => {
      transformer.processAll();
    });
  }
}
