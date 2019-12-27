/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import {
  Id64String,
  using,
} from "@bentley/bentleyjs-core";
import {
  ImageSourceFormat,
  IModel,
  TextureFlags,
} from "@bentley/imodeljs-common";
import {
  IModelDb,
  IModelTransformer,
  IModelImporter,
  Texture,
} from "@bentley/imodeljs-backend";

export interface TextureImage {
  data: string;
  format: ImageSourceFormat;
  width: number;
  height: number;
}

class Importer extends IModelImporter {
  private readonly _textureId: Id64String;

  public constructor(db: IModelDb, image: TextureImage) {
    super(db);
    this._textureId = Texture.insert(this.targetDb, IModel.dictionaryId, "ImageGraphicTexture", image.format, image.data, image.width, image.height, "", TextureFlags.None);
  }
}

export class ImageGraphicTransformer extends IModelTransformer {
  public constructor(src: IModelDb, dst: IModelDb, image: TextureImage) {
    const importer = new Importer(dst, image);
    super(src, importer);
  }

  public static transform(src: IModelDb, dst: IModelDb, image: TextureImage): void {
    using (new ImageGraphicTransformer(src, dst, image), (transformer) => {
      // Want to use transformer.processAll(), but it chokes on exportRelationships.
      transformer.initFromExternalSourceAspects();
      transformer.exporter.exportCodeSpecs();
      transformer.exporter.exportFonts();
      transformer.exporter.exportChildElements(IModel.rootSubjectId);
      transformer.exporter.exportSubModels(IModel.repositoryModelId);
      // transformer.exporter.exportRelationships(ElementRefersToElements.classFullName);
      transformer.processDeferredElements();
      transformer.detectElementDeletes();
    });
  }
}
