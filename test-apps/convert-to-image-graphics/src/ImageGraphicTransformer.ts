/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import {
  Id64String,
  using,
} from "@bentley/bentleyjs-core";
import {
  LowAndHighXY,
  LowAndHighXYZ,
  Point2d,
  Point3d,
} from "@bentley/geometry-core";
import {
  ElementProps,
  GeometricElement2dProps,
  GeometricElement3dProps,
  GeometricElementProps,
  GeometryStreamProps,
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
    const geomProps = elemProps as GeometricElementProps;
    const geom = geomProps.geom;
    if (geom) {
      const props2d = elemProps as GeometricElement2dProps;
      if (props2d.placement && props2d.placement.bbox) {
        geomProps.geom = this.convertToImageGraphic2d(geom, props2d.placement.bbox);
      } else {
        const props3d = elemProps as GeometricElement3dProps;
        if (props3d.placement && props3d.placement.bbox)
          geomProps.geom = this.convertToImageGraphic3d(geom, props3d.placement.bbox);
      }
    }

    return super.onInsertElement(elemProps);
  }

  private convertToImageGraphic2d(geom: GeometryStreamProps, bbox: LowAndHighXY): GeometryStreamProps {
    const low2d = Point2d.fromJSON(bbox.low);
    const high2d = Point2d.fromJSON(bbox.high);
    const corners = new ImageGraphicCorners(new Point3d(low2d.x, low2d.y, 0), new Point3d(high2d.x, low2d.y, 0), new Point3d(high2d.x, high2d.y, 0), new Point3d(low2d.x, high2d.y, 0));
    return this.convertToImageGraphic(geom, corners);
  }

  private convertToImageGraphic3d(geom: GeometryStreamProps, bbox: LowAndHighXYZ): GeometryStreamProps {
    const low = Point3d.fromJSON(bbox.low);
    const high = Point3d.fromJSON(bbox.high);
    const lx = low.x, ly = low.y, lz = low.z;
    const hx = high.x, hy = high.y, hz = high.z;
    const corners = new ImageGraphicCorners(low, new Point3d(hx, ly, lz), high, new Point3d(lx, hy, hz));
    return this.convertToImageGraphic(geom, corners);
  }

  private convertToImageGraphic(oldGeom: GeometryStreamProps, corners: ImageGraphicCorners): GeometryStreamProps {
    const newGeom = [];
    let imageGraphic;
    for (const entry of oldGeom) {
      if (undefined !== entry.geomPart || undefined !== entry.point || undefined !== entry.subRange)
        continue;

      if (undefined !== entry.header || undefined !== entry.appearance || undefined !== entry.styleMod
        || undefined !== entry.fill || undefined !== entry.pattern || undefined !== entry.image || undefined !== entry.material) {
        newGeom.push(entry);
        continue;
      }

      if (undefined !== imageGraphic)
        continue;

      imageGraphic = new ImageGraphic(corners, this._textureId, this._wantBorder);
      newGeom.push({ image: imageGraphic.toJSON() });
    }

    return newGeom;
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
