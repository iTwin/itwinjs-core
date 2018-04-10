/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Id64Props, DbResult, Id64 } from "@bentley/bentleyjs-core";
import { FilePropertyProps, LineStyleProps } from "@bentley/imodeljs-common";
import { IModelDb } from "./IModelDb";
import { LineStyle } from "./backend";

export namespace LineStyleDefinition {

  /** screen based hardware line codes */
  export enum LinePixels {
    Code1 = 1,
    Code2 = 2,
    Code3 = 3,
    Code4 = 4,
    Code5 = 5,
    Code6 = 6,
    Code7 = 7,
  }

  /** line style component idenifier */
  export enum ComponentType {
    Unknown = 0,
    PointSymbol = 1,
    Compound = 2,
    LineCode = 3,
    LinePoint = 4,
    Internal = 6, /** type for hardware LinePixels, does not require insert into file properties */
    RasterImage = 7,
  }

  /** line code component definition */
  export type StrokeProps =
    { length: number } |
    { orgWidth?: number } |
    { endWidth?: number } |
    { strokeMode?: number } | /** 0 for gap, 1 for dash */
    { widthMode?: number } |
    { capMode?: number };

  export type Strokes = StrokeProps[];

  export interface LineCodeProps {
    descr: string;
    phase?: number;
    options?: number;
    maxIter?: number;
    strokes: Strokes;
  }

  /** point symbol component defintion. If base and size parameters are not supplied, gets GeometryPart by id to set them */
  export type PointSymbolProps =
    { geomPartId: Id64Props } |
    { baseX?: number } | /** set to GeometryPart.bbox.low.x if not supplied */
    { baseY?: number } | /** set to GeometryPart.bbox.low.y if not supplied */
    { baseZ?: number } | /** set to GeometryPart.bbox.low.z if not supplied */
    { sizeX?: number } | /** set to GeometryPart.bbox.high.x if not supplied */
    { sizeY?: number } | /** set to GeometryPart.bbox.high.x if not supplied */
    { sizeZ?: number } | /** set to GeometryPart.bbox.high.x if not supplied */
    { symFlags?: number } |
    { scale?: number };

  /** line point component defintion */
  export type SymbolProps =
    { symId: number } | /** id of ComponentType.PointSymbol component */
    { strokeNum?: number } | /** 0 based stroke index of ComponentType.LineCode */
    { xOffset?: number } |
    { yOffset?: number } |
    { angle?: number } |
    { mod1?: number }; /** 0 for origin of stroke, 1 for end of stroke, 2 for middle of stroke */

  export type Symbols = SymbolProps[];

  export interface LinePointProps {
    descr: string;
    lcId: number; /** id of ComponentType.LineCode component */
    symbols: Symbols;
  }

  /** compound component definition */
  export type ComponentProps =
    { id: number } | /** id of LineCodeV1 or PointSymV1 component */
    { type: ComponentType } | /** type of component for specified id */
    { offset?: number };

  export type Components = ComponentProps[];

  export interface CompoundProps {
    comps: Components;
  }

  /** line style definition element data defintion */
  export interface DataProps {
    compId: number;
    compType: ComponentType;
    flags?: number;
    unitDef?: number;
  }

  export class Utils {

    public static createLineCode(iModel: IModelDb, props: LineCodeProps): DataProps | undefined {
      const fileProps: FilePropertyProps = { name: "LineCodeV1", namespace: "dgn_LStyle" };
      fileProps.id = iModel.queryNextAvailableFileProperty(fileProps);
      return (DbResult.BE_SQLITE_OK === iModel.saveFileProperty(fileProps, JSON.stringify(props)) ? { compId: fileProps.id, compType: ComponentType.LineCode } : undefined);
    }

    public static createPointSymbol(iModel: IModelDb, props: PointSymbolProps): DataProps | undefined {
      const anyProps = (props as any); // if part extents weren't supplied, set them up now.
      if (!anyProps.baseX && !anyProps.baseY && !anyProps.baseZ && !anyProps.sizeX && !anyProps.sizeY && !anyProps.sizeZ) {
        const geomPart = iModel.elements.getElement(anyProps.geomPartId);
        if (!geomPart)
          return undefined;

        anyProps.baseX = geomPart.bbox.low.x;
        anyProps.baseY = geomPart.bbox.low.y;
        anyProps.baseZ = geomPart.bbox.low.z;

        anyProps.sizeX = geomPart.bbox.high.x;
        anyProps.sizeY = geomPart.bbox.high.y;
        anyProps.sizeZ = geomPart.bbox.high.z;
      }

      const fileProps: FilePropertyProps = { name: "PointSymV1", namespace: "dgn_LStyle" };
      fileProps.id = iModel.queryNextAvailableFileProperty(fileProps);
      return (DbResult.BE_SQLITE_OK === iModel.saveFileProperty(fileProps, JSON.stringify(props)) ? { compId: fileProps.id, compType: ComponentType.PointSymbol } : undefined);
    }

    public static createLinePoint(iModel: IModelDb, props: LinePointProps): DataProps | undefined {
      const fileProps: FilePropertyProps = { name: "LinePointV1", namespace: "dgn_LStyle" };
      fileProps.id = iModel.queryNextAvailableFileProperty(fileProps);
      return (DbResult.BE_SQLITE_OK === iModel.saveFileProperty(fileProps, JSON.stringify(props)) ? { compId: fileProps.id, compType: ComponentType.LinePoint } : undefined);
    }

    public static createCompound(iModel: IModelDb, props: CompoundProps): DataProps | undefined {
      const fileProps: FilePropertyProps = { name: "CompoundV1", namespace: "dgn_LStyle" };
      fileProps.id = iModel.queryNextAvailableFileProperty(fileProps);
      return (DbResult.BE_SQLITE_OK === iModel.saveFileProperty(fileProps, JSON.stringify(props)) ? { compId: fileProps.id, compType: ComponentType.Compound } : undefined);
    }

    /** Query for an existing line style with the supplied name. */
    public static queryStyle(imodel: IModelDb, scopeModelId: Id64, name: string): Id64 | undefined {
      return imodel.elements.queryElementIdByCode(LineStyle.createCode(imodel, scopeModelId, name));
    }

    /** Insert new line style with the supplied name. */
    public static createStyle(imodel: IModelDb, scopeModelId: Id64, name: string, props: DataProps): Id64 {
      const lsProps: LineStyleProps = {
        classFullName: "BisCore:LineStyle",
        iModel: imodel,
        model: scopeModelId,
        code: LineStyle.createCode(imodel, scopeModelId, name),
        data: JSON.stringify(props),
      };

      return imodel.elements.insertElement(lsProps);
    }

    /** Query or insert for a line style that uses a screen based hardware line code. Most applications should instead use insertLineCode to define physical dash and gap lengths. */
    public static getOrCreateLinePixelsStyle(imodel: IModelDb, scopeModelId: Id64, lineCode: LinePixels): Id64 {
      const name = "HardwareLinePixels-" + lineCode;
      const lsId = this.queryStyle(imodel, scopeModelId, name);
      return (undefined === lsId ? this.createStyle(imodel, scopeModelId, name, { compId: lineCode, compType: ComponentType.Internal }) : lsId);
    }

  }
}
