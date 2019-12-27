/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import {
  using,
} from "@bentley/bentleyjs-core";
import {
  ImageSourceFormat,
  IModel,
} from "@bentley/imodeljs-common";
import {
  GeometricElement,
  IModelDb,
  IModelTransformer,
  IModelImporter,
} from "@bentley/imodeljs-backend";

export class ImageGraphicTransformer /* extends IModelTransformer */ {
  public static transform(src: IModelDb, dst: IModelDb, _textureBytes: string, _textureFormat: ImageSourceFormat): void {
    using (new IModelTransformer(src, dst), (transformer) => {
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
