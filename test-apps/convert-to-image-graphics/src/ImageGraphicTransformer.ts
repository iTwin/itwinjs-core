/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import {
  Id64String,
  using,
} from "@bentley/bentleyjs-core";
import {
  Point2d,
  Point3d,
} from "@bentley/geometry-core";
import {
  ElementProps,
  GeometricElement2dProps,
  ImageGraphic,
  ImageGraphicCorners,
  ImageSourceFormat,
  IModel,
  Placement2d,
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
  border?: true;
}

class Importer extends IModelImporter {
  private readonly _textureId: Id64String;
  private readonly _wantBorder: boolean;

  public constructor(db: IModelDb, image: TextureImage) {
    super(db);
    this._textureId = Texture.insert(this.targetDb, IModel.dictionaryId, "ImageGraphicTexture", image.format, image.data, image.width, image.height, "", TextureFlags.None);
    this._wantBorder = true === image.border;
  }

  public onInsertElement(elemProps: ElementProps): Id64String {
    const props2d = elemProps as GeometricElement2dProps;
    this.convertToImageGraphic2d(props2d);

    return super.onInsertElement(elemProps);
  }

  private convertToImageGraphic2d(props: GeometricElement2dProps): void {
    if (undefined === props.placement || undefined === props.geom || undefined === props.placement.bbox)
      return;

    const newGeom = [];
    let imageGraphic;
    for (const entry of props.geom) {
      if (undefined !== entry.geomPart || undefined !== entry.point || undefined !== entry.subRange)
        continue;

      if (undefined !== entry.header || undefined !== entry.appearance || undefined !== entry.styleMod
        || undefined !== entry.fill || undefined !== entry.pattern || undefined !== entry.image || undefined !== entry.material) {
        newGeom.push(entry);
        continue;
      }

      if (undefined !== imageGraphic)
        continue;

      const low2d = Point2d.fromJSON(props.placement.bbox.low);
      const high2d = Point2d.fromJSON(props.placement.bbox.high);
      const corners = new ImageGraphicCorners(new Point3d(low2d.x, low2d.y, 0), new Point3d(high2d.x, low2d.y, 0), new Point3d(high2d.x, high2d.y, 0), new Point3d(low2d.x, high2d.y, 0));
      imageGraphic = new ImageGraphic(corners, this._textureId, this._wantBorder);

      newGeom.push({ image: imageGraphic.toJSON() });
    }

    props.geom = newGeom;
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
