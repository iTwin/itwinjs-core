/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { assert, Id64 } from "@bentley/bentleyjs-core";
import { GraphicParams, GeometryParams, ColorDef, GeometryClass, LinePixels, FillDisplay } from "@bentley/imodeljs-common";
import { IModelConnection } from "../IModelConnection";
import { System } from "./System";

export const enum DisplayParamsType {
  Mesh,
  Linear,
  Text,
}
export class DisplayParams {
  public type: DisplayParamsType = DisplayParamsType.Mesh;
  public categoryId: Id64 = new Id64();
  public subCategoryId: Id64 = new Id64();
  public materialId: Id64 = new Id64();
  // public material: Material; // meshes only // Material doesn't exist yet!!!
  // public gradient: GradientSymb; // GradientSymb doesn't exist yet!!!
  // public textureMapping: TextureMapping; // only if m_material is null (e.g. gradients, glyph bitmaps) // TextureMapping doesn't exist yet!!!
  public lineColor: ColorDef = ColorDef.white; // all types of geometry (edge color for meshes)
  public fillColor: ColorDef = ColorDef.white; // meshes only
  public width: number = 0; // linear and mesh (edges)
  public linePixels: LinePixels = LinePixels.Solid; // linear and mesh (edges)
  // public fillFlags: FillFlags; // meshes only // FillFalgs doesn't exist yet!!!
  public geomClass: GeometryClass = GeometryClass.Primary;
  public ignoreLighting: boolean = false; // always true for text and linear geometry; true for meshes only if normals not desired
  public hasRegionOutline: boolean = false;

  public constructor() { }
  public static create(type: DisplayParamsType, categoryId: Id64, subCategoryId: Id64, /*gradient: GradientSymb,*/ materialId: Id64, lineColor: ColorDef, fillColor: ColorDef, width: number, linePixels: LinePixels, /*fillFlags: FillFlags,*/ geomClass: GeometryClass/*, iModel: IModelConnection, renderSys: System*/): DisplayParams {
    const output = new DisplayParams();
    output.type = type;
    output.categoryId = categoryId;
    output.subCategoryId = subCategoryId;
    output.materialId = materialId;
    output.geomClass = geomClass;
    output.lineColor = lineColor;
    output.fillColor = fillColor;
    output.width = width;
    output.linePixels = linePixels;
    // output.gradient = gradient;
    // output.fillFlags = fillFlags;
    // if (materialId.isValid()) { output.material = renderSys.getMaterial(materialId, iModel); }
    return output;
  }
  public static createText(lineColor: ColorDef, catId: Id64, subCatId: Id64, geomClass: GeometryClass): DisplayParams {
    const output = new DisplayParams();
    output.initText(lineColor, catId, subCatId, geomClass);
    return output;
  }
  public static createLinear(lineColor: ColorDef, width: number, px: LinePixels, cat: Id64, sub: Id64, gc: GeometryClass): DisplayParams {
    const output = new DisplayParams();
    output.initLinear(lineColor, width, px, cat, sub, gc);
    return output;
  }
  public static createMesh(lineColor: ColorDef, fillColor: ColorDef, width: number, px: LinePixels, /*mat: Material, grad, GradientSymb, tx: TextureMapping, ff: FillFlags,*/ cat: Id64, sub: Id64, gc: GeometryClass): DisplayParams {
    const output = new DisplayParams();
    output.initMesh(lineColor, fillColor, width, px, /*mat, grad, tx, ff,*/ cat, sub, gc);
    return output;
  }

  public static forMesh(gf: GraphicParams, geom: GeometryParams, filled: boolean /*, iModel: IModelConnection, sys: System*/): DisplayParams {
    let catId = new Id64();
    let subCatId = new Id64();
    let geomClass = GeometryClass.Primary;
    // let fillFlags: FillFlags = filled ? FillFlags.ByView : FillFlags.None;
    // if (gf.isBlankingRegion) { fillFlags |= FillFlags.Blanking; }

    // TFS#786614: BRep with multiple face attachments - params may no longer be resolved.
    // Doesn't matter - we will create GeometryParams for each of the face attachments - only need the
    // class, category, and sub-category here.
    if (geom && geom.isResolved()) {
      catId = geom.categoryId;
      subCatId = geom.subCategoryId;
      geomClass = geom.getGeometryClass();
      // if (geom.getPatternParams()) { fillFlags |= FillFlags.Behind; }
      if (filled) {
        if (FillDisplay.Always === geom.getFillDisplay()) {
          // fillFlags |= FillFlags.Always;
          // fillFlags &= ~FillFlags.ByView;
        }
        // if (geom.isFillColorFromViewBackground()) { fillFlags |= FillFlags.Background; }
      }
    }
      // const grad = gf.gradient;
      // const tex: TextureMapping;
      // if (grad) { tex = new TextureMapping(sys.getTexture(grad, iModel)); }
    return DisplayParams.createMesh(gf.lineColor, gf.fillColor, gf.rasterWidth, gf.linePixels, /*gf.material, grad, tex, fillFlags,*/ catId, subCatId, geomClass);
  }
  public static forText(gf: GraphicParams, geom: GeometryParams) {
    let catId = new Id64();
    let subCatId = new Id64();
    let geomClass = GeometryClass.Primary;
    if (geom) {
      catId = geom.categoryId;
      subCatId = geom.subCategoryId;
      geomClass = geom.getGeometryClass();
    }
    return DisplayParams.createText(gf.lineColor, catId, subCatId, geomClass);
  }
  public static forLinear(gf: GraphicParams, geom: GeometryParams) {
    let catId = new Id64();
    let subCatId = new Id64();
    let geomClass: GeometryClass = GeometryClass.Primary;
    if (geom) {
      catId = geom.categoryId;
      subCatId = geom.subCategoryId;
      geomClass = geom.getGeometryClass();
    }
    return DisplayParams.createLinear(gf.lineColor, gf.rasterWidth, gf.linePixels, catId, subCatId, geomClass);
  }
  public static forType(type: DisplayParamsType, gf: GraphicParams, geom: GeometryParams, filled: boolean/*, iModel: IModelConnection, sys: System*/): DisplayParams {
    if (type === DisplayParamsType.Mesh) {
      return this.forMesh(gf, geom, filled/*, iModel, sys*/);
    } else if (type === DisplayParamsType.Text) {
      return this.forText(gf, geom);
    } else if (type === DisplayParamsType.Linear) {
      return this.forLinear(gf, geom);
    } else {
      assert(false); return this.forText(gf, geom);
    }
  }

  public initMesh(lineColor: ColorDef, fillColor: ColorDef, width: number, pixels: LinePixels, /*mat: Material, grad: GradientSymb, tex: TextureMapping, fillFlags: FillFlags,*/
    catId: Id64, subCatId: Id64, geomClass: GeometryClass) {
    this.initGeomParams(catId, subCatId, geomClass);
    this.type = DisplayParamsType.Mesh;
    this.lineColor = lineColor;
    this.fillColor = fillColor;
    // this.fillFlags = fillFlags;
    // this.material = mat;
    // this.gradient = grad;
    this.width = width;
    this.linePixels = pixels;
    this.hasRegionOutline = this.computeHasRegionOutline();
    // if (!mat && !tex) { this.textureMapping = tex; }
    // assert(this.gradient.isNull() || this.textureMapping.isValid());
    // assert(this.gradient.isNull() || this.gradient.getRefCount() > 1); // assume caller allocated on heap...
  }
  public initText(lineColor: ColorDef, catId: Id64, subCatId: Id64, geomClass: GeometryClass) {
    this.initGeomParams(catId, subCatId, geomClass);
    this.type = DisplayParamsType.Text;
    this.lineColor = this.fillColor = lineColor;
    this.ignoreLighting = true;
    // this.fillFlags = FillFlags.Always;
  }
  public initLinear(lineColor: ColorDef, width: number, pixels: LinePixels, catId: Id64, subCatId: Id64, geomClass: GeometryClass): void {
    this.initGeomParams(catId, subCatId, geomClass);
    this.type = DisplayParamsType.Linear;
    this.lineColor = this.fillColor = lineColor;
    this.width = width;
    this.linePixels = pixels;
  }
  public initGeomParams(catId: Id64, subCatId: Id64, geomClass: GeometryClass) {
    this.categoryId = catId;
    this.subCategoryId = subCatId;
    this.geomClass = geomClass;
  }

  public clone(): DisplayParams {
    const output = new DisplayParams();
    output.categoryId = this.categoryId;
    output.fillColor = this.fillColor;
    output.geomClass = this.geomClass;
    output.hasRegionOutline = this.hasRegionOutline;
    output.ignoreLighting = this.ignoreLighting;
    output.lineColor = this.lineColor;
    output.linePixels = this.linePixels;
    output.materialId = this.materialId;
    output.subCategoryId = this.subCategoryId;
    output.type = this.type;
    output.width = this.width;
    return output;
  }

  public computeHasRegionOutline(): boolean {
    if (false /*this.gradient.isValid()*/) {
    //   return this.gradient.getIsOutlined();
    } else {
      return !this.neverRegionOutline() && this.fillColor !== this.lineColor;
    }
  }
  public neverRegionOutline(): boolean { return this.hasBlankingFill() /*|| (this.gradient.isValid() && !this.gradient.getIsOutlined())*/; }
  public hasBlankingFill(): boolean { return false; /*FillFlags.Blanking === (this.fillFlags & FillFlags.Blanking);*/ }
  public hasFillTransparency(): boolean { return 0 !== this.fillColor.getAlpha(); }
  public hasLineTransparency(): boolean { return 0 !== this.lineColor.getAlpha(); }
  public isTextured(): boolean { return false; } // return this.textureMapping.isValid(); }
}

export class DisplayParamsCache {
  public set: DisplayParams[] = [];
  public constructor(public iModel: IModelConnection, public system: System) { }

  public getForMesh(gf: GraphicParams, geom: GeometryParams, filled: boolean): DisplayParams { return this.get(DisplayParamsType.Mesh, gf, geom, filled); }
  public getForLinear(gf: GraphicParams, geom: GeometryParams): DisplayParams { return this.get(DisplayParamsType.Linear, gf, geom, false); }
  public getForText(gf: GraphicParams, geom: GeometryParams): DisplayParams { return this.get(DisplayParamsType.Text, gf, geom, false); }
  public get(type: DisplayParamsType, gf: GraphicParams, geom: GeometryParams, filled: boolean): DisplayParams {
    const ndp = DisplayParams.forType(type, gf, geom, filled/*, this.iModel, this.system*/);
    return this.getFromDisplayParams(ndp);
  }
  public getFromDisplayParams(toFind: DisplayParams): DisplayParams {
    const matches = this.set.filter((x) => x === toFind || (x.type === toFind.type && x.ignoreLighting === toFind.ignoreLighting && x.width === toFind.width
      /*&& x.material === toFind.material*/ && x.linePixels === toFind.linePixels /*&& x.fillFlags === toFind.fillFlags*/ && x.categoryId === toFind.categoryId
      && x.hasRegionOutline === toFind.hasRegionOutline /*&& x.getTextureMapping().getTexture() === toFind.getTextureMapping().getTexture()*/
      && x.fillColor === toFind.fillColor && x.lineColor === toFind.lineColor && x.subCategoryId === toFind.subCategoryId && x.geomClass === toFind.geomClass));
    if (matches.length === 0) {
      const match = toFind.clone();
      this.set.push(match);
      return match;
    }
    return matches[0];
  }
}
