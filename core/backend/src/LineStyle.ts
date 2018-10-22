/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Symbology */

import { Id64String, DbResult, IModelStatus } from "@bentley/bentleyjs-core";
import { FilePropertyProps, LineStyleProps, LinePixels, IModelError } from "@bentley/imodeljs-common";
import { IModelDb } from "./IModelDb";
import { LineStyle } from "./Element";

/** A line style definition is a uniquely named pattern that repeats as it is displayed along a curve path. In the absence of a line style, curve display is limited to solid lines with a width in pixels.
 * There are three varieties of line styles:
 * - A style described by a stroke pattern (series of dashes and gaps) that may also include symbol graphics.
 * - A style using pre-defined pixel bit patterns [[LinePixels]] for dashed display (Code1-Code7).
 * - A style that uses a texture.
 *
 * A definition is defined by one or more components. A component is saved as a "file property" and can be referenced by other components. The line style definition references a component
 * by file property id and type and is saved as a dictionary element.
 */
export namespace LineStyleDefinition {

  /** Line style component type identifiers */
  export enum ComponentType {
    /** Component type for [[LineStyleDefinition.PointSymbolProps]] */
    PointSymbol = 1,
    /** Component type for [[LineStyleDefinition.CompoundProps]] */
    Compound = 2,
    /** Component type for [[LineStyleDefinition.StrokePatternProps]] */
    StrokePattern = 3,
    /** Component type for [[LineStyleDefinition.StrokePointProps]] */
    StrokePoint = 4,
    /** Component type for [[LinePixels]], never saved as a file property */
    Internal = 6,
    /** Component type for [[LineStyleDefinition.RasterImageProps]] */
    RasterImage = 7,
  }

  /** Mask of values for StrokeMode */
  export enum StrokeMode {
    /** Stroke represents a blank space */
    Gap = 0x00,
    /** Stroke represents a solid dash */
    Dash = 0x01,
    /** Treat stroke as rigid and continue past a corner to complete the stroke as opposed to breaking at the corner */
    Ray = 0x02,
    /** Stroke length can be stretched when [[LineStyleDefinition.StrokePatternOptions.Iteration]] and [[LineStyleDefinition.StrokePatternOptions.AutoPhase]] options are set, applicable to both Gap and Dash strokes */
    Scale = 0x04,
    /** Invert stroke in first stroke pattern */
    FirstInvert = 0x08,
    /** Invert stroke in last stroke pattern */
    LastInvert = 0x10,
  }

  /** Define constant width or tapered strokes with distance specified in meters */
  export enum StrokeWidth {
    /** Stroke draws as one pixel wide line */
    None = 0,
    /** Half [[LineStyleDefinition.StrokeProps.orgWidth]] and [[LineStyleDefinition.StrokeProps.endWidth]] applied to left side of stroke */
    Left = 1,
    /** Half [[LineStyleDefinition.StrokeProps.orgWidth]] and [[LineStyleDefinition.StrokeProps.endWidth]] applied to right side of stroke */
    Right = 2,
    /** Half [[LineStyleDefinition.StrokeProps.orgWidth]] and [[LineStyleDefinition.StrokeProps.endWidth]] applied to both sides of stroke */
    Full = 3,
  }

  /** Controls appearance of stroke end caps. If StrokeCap is >= Hexagon, the end cap is stroked as an arc and the value of
   * StrokeCap indicates the number of vectors in the arc.
   */
  export enum StrokeCap {
    /** Stroke displays as a closed polygon */
    Closed = 0,
    /** Stroke displays lines at specified width instead of a polygon */
    Open = 1,
    /** Stroke length extended by half the stroke width */
    Extended = 2,
    /** Stroke end cap is a hexagon */
    Hexagon = 3,
    /** Stroke end cap is an octagon */
    Octagon = 4,
    /** Stroke end cap is a decagon */
    Decagon = 5,
    /** Stroke end cap is an arc */
    Arc = 30,
  }

  /** A stroke representing either a dash or gap in a stroke pattern */
  export interface StrokeProps {
    /** Length of stroke in meters */
    length: number;
    /** Width at start of stroke. Behavior controlled by [[LineStyleDefinition.StrokeWidth]], choose value other than [[LineStyleDefinition.StrokeWidth.None]] */
    orgWidth?: number;
    /** Width at end of stroke, same as start width if not present. Behavior controlled by [[LineStyleDefinition.StrokeWidth]], choose value other than [[LineStyleDefinition.StrokeWidth.None]] */
    endWidth?: number;
    /** Type and behavior of stroke */
    strokeMode?: StrokeMode;
    /** How to apply orgWidth and endWidth to stroke */
    widthMode?: StrokeWidth;
    /** Appearance of stroke end cap */
    capMode?: StrokeCap;
  }

  export type Strokes = StrokeProps[];

  /** Options to control how stroke pattern is applied to underlying curve */
  export enum StrokePatternOptions {
    /** Use default stroke behavior */
    None = 0x00,
    /** [[LineStyleDefinition.StrokePatternProps.phase]] represents fractional distance into first stroke of pattern */
    AutoPhase = 0x01,
    /** Use [[LineStyleDefinition.StrokePatternProps.maxIter]] to limit the number of iterations of the stroke pattern */
    Iteration = 0x08,
    /** Single segment mode restarts the stroke pattern at corners instead of continuing around corners */
    Segment = 0x10,
    /** Center the line style and stretch the ends */
    CenterStretch = 0x20,
  }

  /** Stroke pattern component definition [[LineStyleDefinition.ComponentType.StrokePattern]].
   * A stroke pattern component consists of a series of dashes and gaps having specified lengths and widths in meters. Simple dash-dot type line styles that do not
   * include point symbols can be created by referencing a stroke pattern component by its file property id.
   */
  export interface StrokePatternProps {
    /** Name for this stroke pattern */
    descr: string;
    /** Skip into the pattern before starting to draw. Value treated as fraction of the first stroke when [[LineStyleDefinition.StrokePatternOptions.AutoPhase]] set. Value used as distance when [[LineStyleDefinition.StrokePatternOptions.CenterStretch]] is not set. */
    phase?: number;
    /** Options mask for this stroke pattern */
    options?: StrokePatternOptions;
    /** The entire stroke pattern will be repeated no more than maxIter on curve or segment when [[LineStyleDefinition.StrokePatternOptions.Iteration]] is set and stroke pattern includes stretchable strokes. */
    maxIter?: number;
    /** Array of strokes, maximum number that will be used is 32 */
    strokes: Strokes;
  }

  /** Flags to identify point symbol behavior */
  export enum PointSymbolFlags {
    /** Default symbol behavior */
    None = 0x0,
    /** Symbol includes 3d geometry */
    Is3d = 0x01,
    /** Symbol does not allow scaling */
    NoScale = 0x02,
  }

  /** Point symbol component definition [[LineStyleDefinition.ComponentType.PointSymbol]].
   * A point symbol component identifies a GeometryPart for reference by a [[LineStyleDefinition.SymbolProps]].
   */
  export interface PointSymbolProps {
    /** GeometryPart Id to use as a pattern symbol */
    geomPartId: Id64String;
    /** GeometryPart.bbox.low.x */
    baseX?: number;
    /** GeometryPart.bbox.low.y */
    baseY?: number;
    /** GeometryPart.bbox.low.z */
    baseZ?: number;
    /** GeometryPart.bbox.high.x */
    sizeX?: number;
    /** GeometryPart.bbox.high.y */
    sizeY?: number;
    /** GeometryPart.bbox.high.z */
    sizeZ?: number;
    /** Symbol behavior flags */
    symFlags?: PointSymbolFlags;
    /** Symbol scale, defaults to 1 */
    scale?: number;
  }

  /** Symbol options for location, orientation, and behavior */
  export enum SymbolOptions {
    /** No point symbol */
    None = 0x00,
    /** Symbol at origin of stroke */
    Origin = 0x01,
    /** Symbol at end of stroke */
    End = 0x02,
    /** symbol at center of stroke */
    Center = 0x03,
    /** Symbol at curve start point */
    CurveOrigin = 0x0004,
    /** Symbol at curve end point */
    CurveEnd = 0x0008,
    /** Symbol at each vertex */
    CurveVertex = 0x0010,
    /** Adjust symbol rotation left->right */
    AdjustRotation = 0x0020,
    /** Angle of symbol not relative to stroke direction */
    AbsoluteRotation = 0x0040,
    /** No scale on variable strokes */
    NoScale = 0x0100,
    /** No clip on partial strokes */
    NoClip = 0x0200,
    /** No partial strokes */
    NoPartial = 0x0400,
    /** Project partial origin */
    ProjectOrigin = 0x0800,
    /** Use color from symbol instead of inheriting curve color */
    UseColor = 0x4000,
    /** Use weight from symbol instead of inheriting curve weight */
    UseWeight = 0x8000,
  }

  /** Identifies a symbol and its location and orientation relative to a stroke pattern */
  export interface SymbolProps {
    /** The file property id of the symbol component, assumed to be [[LineStyleDefinition.ComponentType.PointSymbol]] if symType is undefined. */
    symId: number;
    /** The component type, leave undefined if symId is a [[LineStyleDefinition.ComponentType.PointSymbol]] */
    symType?: ComponentType;
    /** The 0 based stroke index for base stroke pattern [[LineStyleDefinition.ComponentType.StrokePattern]] component */
    strokeNum?: number;
    /** Symbol x offset distance in meters */
    xOffset?: number;
    /** Symbol y offset distance in meters */
    yOffset?: number;
    /** Symbol rotation in radians */
    angle?: number;
    /** Must set location for symbol as default value is [[LineStyleDefinition.SymbolOptions.None]] */
    mod1?: SymbolOptions;
  }

  export type Symbols = SymbolProps[];

  /** Stroke point component definition [[LineStyleDefinition.ComponentType.StrokePoint]].
   * A stroke point component identifies the locations of point symbol components relative to a base stroke pattern component.
   */
  export interface StrokePointProps {
    /** Name for this stroke point component */
    descr: string;
    /** The file property id of the stroke component, assumed to be [[LineStyleDefinition.ComponentType.StrokePattern]] if lcType is undefined */
    lcId: number;
    /** The component type, leave undefined if lcId is a [[LineStyleDefinition.ComponentType.StrokePattern]] */
    lcType?: ComponentType;
    /** Array of symbols */
    symbols: Symbols;
  }

  /** Raster component definition [[LineStyleDefinition.ComponentType.RasterImage]].
   * A raster component identifies a texture for a line style.
   */
  export interface RasterImageProps {
    /** Name for this raster image component */
    descr: string;
    /** Raster width */
    x: number;
    /** Raster height */
    y: number;
    /** True width flag */
    trueWidth?: number;
    /** Raster flags */
    flags?: number;
    /** The file property id of raster image */
    imageId?: number;
  }

  /** Identifies a component by file property id and type */
  export interface ComponentProps {
    /** The file property id of [[LineStyleDefinition.ComponentType.StrokePattern]] or [[LineStyleDefinition.ComponentType.StrokePoint]] component */
    id: number;
    /** The type of component for specified file property id */
    type: ComponentType;
    /** Offset distance for this component, default is 0 */
    offset?: number;
  }

  export type Components = ComponentProps[];

  /** Compound component definition [[LineStyleDefinition.ComponentType.Compound]].
   * A compound component is used to link stroke pattern and stroke point components to create a style that displays dashes, gaps, and symbols.
   */
  export interface CompoundProps {
    comps: Components;
  }

  /** Flags to describe a style or control style behavior */
  export enum StyleFlags {
    /** Use defaults */
    None = 0x00,
    /** Only snap to center line and not individual strokes and symbols of line style */
    NoSnap = 0x04,
    /** Style represents a continuous line with width (determined by looking at components if not set) */
    Continuous = 0x08,
    /** Style represents physical geometry and should be scaled as such */
    Physical = 0x80,
  }

  /** The line style definition element data */
  export interface StyleProps {
    /** The file property id for either a [[LineStyleDefinition.ComponentType.StrokePattern]] or [[LineStyleDefinition.ComponentType.Compound]] component */
    compId: number;
    /** The type of component for specified file property id */
    compType: ComponentType;
    /** Style behavior flags. Defaults to [[LineStyleDefinition.StyleFlags.NoSnap]] if left undefined */
    flags?: StyleFlags;
    /** Style scale, defaults to 1 */
    unitDef?: number;
  }

  /** Helper methods for creating and querying line styles */
  export class Utils {

    /** Create a file property for a new stroke pattern component. */
    public static createStrokePatternComponent(iModel: IModelDb, props: StrokePatternProps): StyleProps | undefined {
      const fileProps: FilePropertyProps = { name: "LineCodeV1", namespace: "dgn_LStyle" };
      fileProps.id = iModel.queryNextAvailableFileProperty(fileProps);
      return (DbResult.BE_SQLITE_OK === iModel.saveFileProperty(fileProps, JSON.stringify(props)) ? { compId: fileProps.id, compType: ComponentType.StrokePattern } : undefined);
    }

    /** Create a file property for a new point symbol component.
     * If base and size parameters are not supplied, queries GeometryPart by id to set them.
     */
    public static createPointSymbolComponent(iModel: IModelDb, props: PointSymbolProps): StyleProps | undefined {
      // if part extents weren't supplied, set them up now.
      if (!props.baseX && !props.baseY && !props.baseZ && !props.sizeX && !props.sizeY && !props.sizeZ) {
        const geomPart = iModel.elements.getElement(props.geomPartId);
        if (!geomPart)
          return undefined;

        props.baseX = geomPart.bbox.low.x;
        props.baseY = geomPart.bbox.low.y;
        props.baseZ = geomPart.bbox.low.z;

        props.sizeX = geomPart.bbox.high.x;
        props.sizeY = geomPart.bbox.high.y;
        props.sizeZ = geomPart.bbox.high.z;
      }

      const fileProps: FilePropertyProps = { name: "PointSymV1", namespace: "dgn_LStyle" };
      fileProps.id = iModel.queryNextAvailableFileProperty(fileProps);
      return (DbResult.BE_SQLITE_OK === iModel.saveFileProperty(fileProps, JSON.stringify(props)) ? { compId: fileProps.id, compType: ComponentType.PointSymbol } : undefined);
    }

    /** Create a file property for a new stroke point component. */
    public static createStrokePointComponent(iModel: IModelDb, props: StrokePointProps): StyleProps | undefined {
      const fileProps: FilePropertyProps = { name: "LinePointV1", namespace: "dgn_LStyle" };
      fileProps.id = iModel.queryNextAvailableFileProperty(fileProps);
      return (DbResult.BE_SQLITE_OK === iModel.saveFileProperty(fileProps, JSON.stringify(props)) ? { compId: fileProps.id, compType: ComponentType.StrokePoint } : undefined);
    }

    /** Create a file property for a new compound component. */
    public static createCompoundComponent(iModel: IModelDb, props: CompoundProps): StyleProps | undefined {
      const fileProps: FilePropertyProps = { name: "CompoundV1", namespace: "dgn_LStyle" };
      fileProps.id = iModel.queryNextAvailableFileProperty(fileProps);
      return (DbResult.BE_SQLITE_OK === iModel.saveFileProperty(fileProps, JSON.stringify(props)) ? { compId: fileProps.id, compType: ComponentType.Compound } : undefined);
    }

    /** Create a file property for a new raster image component. */
    public static createRasterComponent(iModel: IModelDb, props: RasterImageProps, image: Uint8Array): StyleProps | undefined {
      const rasterFileProps: FilePropertyProps = { name: "RasterImageV1", namespace: "dgn_LStyle" };
      rasterFileProps.id = iModel.queryNextAvailableFileProperty(rasterFileProps);
      if (DbResult.BE_SQLITE_OK !== iModel.saveFileProperty(rasterFileProps, undefined, image))
        return undefined;
      props.imageId = rasterFileProps.id;
      const fileProps: FilePropertyProps = { name: "RasterComponentV1", namespace: "dgn_LStyle" };
      fileProps.id = iModel.queryNextAvailableFileProperty(fileProps);
      return (DbResult.BE_SQLITE_OK === iModel.saveFileProperty(fileProps, JSON.stringify(props)) ? { compId: fileProps.id, compType: ComponentType.RasterImage } : undefined);
    }

    /** Query for an existing line style with the supplied name. */
    public static queryStyle(imodel: IModelDb, scopeModelId: Id64String, name: string): Id64String | undefined {
      return imodel.elements.queryElementIdByCode(LineStyle.createCode(imodel, scopeModelId, name));
    }

    /** Insert a new line style with the supplied name.
     * @throws [[IModelError]] if unable to insert the line style definition element.
     */
    public static createStyle(imodel: IModelDb, scopeModelId: Id64String, name: string, props: StyleProps): Id64String {
      if (undefined === props.flags)
        props.flags = StyleFlags.NoSnap; // If flags weren't supplied, default to not snapping to stroke geometry.

      const lsProps: LineStyleProps = {
        classFullName: "BisCore:LineStyle",
        iModel: imodel,
        model: scopeModelId,
        code: LineStyle.createCode(imodel, scopeModelId, name),
        data: JSON.stringify(props),
      };

      return imodel.elements.insertElement(lsProps);
    }

    /** Query for a continuous line style that can be used to create curves with physical width instead of weight in pixels and create one if it does not already exist.
     * There are 2 ways to define a continuous line style:
     * - Width is not specified in the style itself and instead will be supplied as an override for each curve that is drawn.
     *  - Defined using [[LineStyleDefinition.ComponentType.Internal]] with component id 0 [[LinePixels::Solid] which has special behavior of being affected by width overrides.
     * - Width is specified in the style.
     *  - Defined using a single stroke component that is a long dash.
     *
     * @throws [[IModelError]] if unable to insert the line style definition element.
     */
    public static getOrCreateContinuousStyle(imodel: IModelDb, scopeModelId: Id64String, width?: number): Id64String {
      if (width === undefined) {
        const name0 = "Continuous";
        const lsId0 = this.queryStyle(imodel, scopeModelId, name0);
        return (undefined === lsId0 ? this.createStyle(imodel, scopeModelId, name0, { compId: 0, compType: ComponentType.Internal, flags: StyleFlags.Continuous | StyleFlags.NoSnap }) : lsId0);
      }

      const name = "Continuous-" + width;
      const lsId = this.queryStyle(imodel, scopeModelId, name);
      if (undefined !== lsId)
        return lsId;

      const strokePatternData = this.createStrokePatternComponent(imodel, { descr: name, strokes: [{ length: 1e37, orgWidth: width, strokeMode: StrokeMode.Dash, widthMode: StrokeWidth.Full }] });
      if (undefined === strokePatternData)
        throw new IModelError(IModelStatus.BadArg, "Unable to insert stroke component");

      return this.createStyle(imodel, scopeModelId, name, { compId: strokePatternData!.compId, compType: strokePatternData!.compType, flags: StyleFlags.Continuous | StyleFlags.NoSnap });
    }

    /** Query for a line style using the supplied [[LinePixels]] value (Code1-Code7) and create one if it does not already exist.
     * Most applications should instead use [[createStrokePatternComponent]] to define a style with physical dash and gap lengths.
     * Unlike other components, [[LineStyleDefinition.ComponentType.Internal]] uses the line code as the compId instead of a file property id.
     * @throws [[IModelError]] if supplied an invalid [[LinePixels]] value or if unable to insert the line style definition element.
     */
    public static getOrCreateLinePixelsStyle(imodel: IModelDb, scopeModelId: Id64String, linePixels: LinePixels): Id64String {
      let lineCode;
      switch (linePixels) {
        case LinePixels.Code1:
          lineCode = 1;
          break;
        case LinePixels.Code2:
          lineCode = 2;
          break;
        case LinePixels.Code3:
          lineCode = 3;
          break;
        case LinePixels.Code4:
          lineCode = 4;
          break;
        case LinePixels.Code5:
          lineCode = 5;
          break;
        case LinePixels.Code6:
          lineCode = 6;
          break;
        case LinePixels.Code7:
          lineCode = 7;
          break;
        default:
          throw new IModelError(IModelStatus.BadArg, "Invalid LinePixels");
      }
      const name = "LinePixelsCodeNumber-" + lineCode;
      const lsId = this.queryStyle(imodel, scopeModelId, name);
      return (undefined === lsId ? this.createStyle(imodel, scopeModelId, name, { compId: lineCode, compType: ComponentType.Internal }) : lsId);
    }

  }
}
