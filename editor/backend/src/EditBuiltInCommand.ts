/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Editing
 */

import { BentleyStatus, CompressedId64Set, DbResult, Id64String, IModelStatus } from "@itwin/core-bentley";
import {
  Matrix3d, Matrix3dProps, Point3d, PointString3d, Range3d, Range3dProps, Transform, TransformProps, XYZProps, YawPitchRollAngles,
} from "@itwin/core-geometry";
import { GeometricElement, IModelDb } from "@itwin/core-backend";
import {
  BRepEntity, ColorDefProps, DynamicGraphicsRequest3dProps, EcefLocation, EcefLocationProps, ElementGeometry, ElementGeometryDataEntry,
  ElementGeometryFunction, ElementGeometryInfo, ElementGeometryRequest, ElementGeometryUpdate, FilePropertyProps, GeometricElementProps,
  GeometryPartProps, GeometryStreamBuilder, IModelError, Placement3dProps,
} from "@itwin/core-common";
import {
  BasicManipulationCommandIpc, editorBuiltInCmdIds, ElementGeometryCacheFilter, ElementGeometryResultOptions, ElementGeometryResultProps,
  FlatBufferGeometricElementData, FlatBufferGeometryFilter, FlatBufferGeometryPartData, LocateSubEntityProps, OffsetFacesProps, SolidModelingCommandIpc,
  SubEntityAppearanceProps, SubEntityGeometryProps, SubEntityLocationProps, SubEntityProps,
} from "@itwin/editor-common";
import { EditCommand } from "./EditCommand";

/** @alpha */
export class BasicManipulationCommand extends EditCommand implements BasicManipulationCommandIpc {
  public static override commandId = editorBuiltInCmdIds.cmdBasicManipulation;

  public constructor(iModel: IModelDb, protected _str: string) { super(iModel); }

  public async deleteElements(ids: CompressedId64Set): Promise<IModelStatus> {
    for (const id of CompressedId64Set.iterable(ids))
      this.iModel.elements.deleteElement(id);

    return IModelStatus.Success;
  }

  public async transformPlacement(ids: CompressedId64Set, transProps: TransformProps): Promise<IModelStatus> {
    const transform = Transform.fromJSON(transProps);

    for (const id of CompressedId64Set.iterable(ids)) {
      const element = this.iModel.elements.getElement<GeometricElement>(id);

      if (!element.placement.isValid)
        continue; // Ignore assembly parents w/o geometry, etc...

      element.placement.multiplyTransform(transform);
      this.iModel.elements.updateElement(element);
    }

    return IModelStatus.Success;
  }

  public async rotatePlacement(ids: CompressedId64Set, matrixProps: Matrix3dProps, aboutCenter: boolean): Promise<IModelStatus> {
    const matrix = Matrix3d.fromJSON(matrixProps);

    for (const id of CompressedId64Set.iterable(ids)) {
      const element = this.iModel.elements.getElement<GeometricElement>(id);

      if (!element.placement.isValid)
        continue; // Ignore assembly parents w/o geometry, etc...

      const fixedPoint = aboutCenter ? element.placement.calculateRange().center : Point3d.createFrom(element.placement.origin);
      const transform = Transform.createFixedPointAndMatrix(fixedPoint, matrix);

      element.placement.multiplyTransform(transform);
      this.iModel.elements.updateElement(element);
    }

    return IModelStatus.Success;
  }

  public async insertGeometricElement(props: GeometricElementProps, data?: FlatBufferGeometricElementData): Promise<Id64String> {
    const newElem = this.iModel.elements.createElement(props);
    const newId = this.iModel.elements.insertElement(newElem);
    if (undefined === data)
      return newId;

    const updateProps: ElementGeometryUpdate = {
      elementId: newId,
      entryArray: data.entryArray,
      isWorld: data.isWorld,
      viewIndependent: data.viewIndependent,
    };

    const status = this.iModel.elementGeometryUpdate(updateProps);
    if (DbResult.BE_SQLITE_OK !== status) {
      this.iModel.elements.deleteElement(newId); // clean up element...
      throw new IModelError(status, "Error updating element geometry");
    }

    return newId;
  }

  public async insertGeometryPart(props: GeometryPartProps, data?: FlatBufferGeometryPartData): Promise<Id64String> {
    if (undefined === props.geom && undefined !== data) {
      const builder = new GeometryStreamBuilder();
      builder.appendGeometry(PointString3d.create(Point3d.createZero()));
      props.geom = builder.geometryStream; // can't insert a DgnGeometryPart without geometry...
    }

    const newElem = this.iModel.elements.createElement(props);
    const newId = this.iModel.elements.insertElement(newElem);
    if (undefined === data)
      return newId;

    const updateProps: ElementGeometryUpdate = {
      elementId: newId,
      entryArray: data.entryArray,
      is2dPart: data.is2dPart,
    };

    const status = this.iModel.elementGeometryUpdate(updateProps);
    if (DbResult.BE_SQLITE_OK !== status) {
      this.iModel.elements.deleteElement(newId); // clean up element...
      throw new IModelError(status, "Error updating part geometry");
    }

    return newId;
  }

  public async updateGeometricElement(propsOrId: GeometricElementProps | Id64String, data?: FlatBufferGeometricElementData): Promise<void> {
    let props: GeometricElementProps;
    if (typeof propsOrId === "string") {
      if (undefined === data)
        throw new IModelError(DbResult.BE_SQLITE_ERROR, "Flatbuffer data required for update by id");
      props = this.iModel.elements.getElement<GeometricElement>(propsOrId);
    } else {
      props = propsOrId;
    }

    if (undefined === props.id)
      throw new IModelError(DbResult.BE_SQLITE_ERROR, "Element id required for update");

    this.iModel.elements.updateElement(props);
    if (undefined === data)
      return;

    const updateProps: ElementGeometryUpdate = {
      elementId: props.id,
      entryArray: data.entryArray,
      isWorld: data.isWorld,
      viewIndependent: data.viewIndependent,
    };

    const status = this.iModel.elementGeometryUpdate(updateProps);
    if (DbResult.BE_SQLITE_OK !== status) {
      throw new IModelError(status, "Error updating element geometry");
    }
  }

  public async requestElementGeometry(elementId: Id64String, filter?: FlatBufferGeometryFilter): Promise<ElementGeometryInfo | undefined> {
    let accepted: ElementGeometryInfo | undefined;

    const onGeometry: ElementGeometryFunction = (info: ElementGeometryInfo): void => {
      accepted = info;

      if (undefined !== filter) {
        let numDisplayable = 0;

        for (const entry of info.entryArray) {
          if (!ElementGeometry.isDisplayableEntry(entry))
            continue;

          numDisplayable++;
          if (filter.maxDisplayable && numDisplayable > filter.maxDisplayable) {
            accepted = undefined;
            break;
          }

          if (filter.reject && filter.reject.some((opcode) => entry.opcode === opcode)) {
            accepted = undefined;
            break;
          }

          if (filter.accept && !filter.accept.some((opcode) => entry.opcode === opcode)) {
            accepted = undefined;
            break;
          }

          if (undefined === filter.geometry)
            continue;

          let entityType;
          if (filter.geometry.curves && !(filter.geometry.surfaces || filter.geometry.solids))
            entityType = ElementGeometry.isCurve(entry) ? BRepEntity.Type.Wire : undefined; // skip surface/solid opcodes...
          else
            entityType = ElementGeometry.getBRepEntityType(entry);

          switch (entityType) {
            case BRepEntity.Type.Wire:
              if (!filter.geometry.curves)
                accepted = undefined;
              break;
            case BRepEntity.Type.Sheet:
              if (!filter.geometry.surfaces)
                accepted = undefined;
              break;
            case BRepEntity.Type.Solid:
              if (!filter.geometry.solids)
                accepted = undefined;
              break;
            default:
              accepted = undefined;
              break;
          }

          if (undefined === accepted)
            break;
        }
      }
    };

    const requestProps: ElementGeometryRequest = {
      onGeometry,
      elementId,
    };

    if (DbResult.BE_SQLITE_OK !== this.iModel.elementGeometryRequest(requestProps))
      return undefined;

    return accepted;
  }

  public async updateProjectExtents(extents: Range3dProps): Promise<void> {
    const newExtents = new Range3d();
    newExtents.setFromJSON(extents);

    if (newExtents.isNull)
      throw new IModelError(DbResult.BE_SQLITE_ERROR, "Invalid project extents");

    this.iModel.updateProjectExtents(newExtents);

    // Set source from calculated to user so connectors preserve the change.
    const unitsProps: FilePropertyProps = { name: "Units", namespace: "dgn_Db" };
    const unitsStr = this.iModel.queryFilePropertyString(unitsProps);

    if (undefined !== unitsStr) {
      const unitsVal = JSON.parse(unitsStr);
      const calculated = 1;

      if (calculated !== unitsVal.extentsSource) {
        unitsVal.extentsSource = calculated;
        this.iModel.saveFileProperty(unitsProps, JSON.stringify(unitsVal));
      }
    }
  }

  public async updateEcefLocation(ecefLocation: EcefLocationProps): Promise<void> {
    // Clear GCS that caller already determined was invalid...
    this.iModel.deleteFileProperty({ name: "DgnGCS", namespace: "dgn_Db" });

    const newEcefLocation = new EcefLocation(ecefLocation);
    this.iModel.updateEcefLocation(newEcefLocation);
  }
}

interface ElementGeometryCacheRequestProps {
  id?: Id64String;
}

interface ElementGeometryCacheResponseProps {
  status: BentleyStatus;
  numGeom?: number;
  numPart?: number;
  numSolid?: number;
  numSurface?: number;
  numCurve?: number;
  numOther?: number;
}

interface SubEntityGeometryResponseProps {
  /** The face, edge, or vertex geometry */
  geometry: ElementGeometryDataEntry;
  /** The face or edge range box for the sub-entity geometry stored as 6 values for low/high */
  range?: Float64Array;
  /** Category id for geometry. */
  category?: Id64String;
  /** SubCategory id for geometry. */
  subCategory?: Id64String;
  /** Material id for geometry. */
  material?: Id64String;
  /** color of geometry. */
  color?: ColorDefProps;
  /** transparency of geometry. */
  transparency?: number;
  /** weight of geometry. */
  weight?: number;
}

type SubEntityGeometryFunction = (info: SubEntityGeometryResponseProps) => void;
type ClosestFaceFunction = (info: SubEntityLocationProps) => void;
type LocateSubEntityFunction = (info: SubEntityLocationProps[]) => void;

interface SubEntityGeometryRequestProps {
  /** Sub-entity to return geometry for */
  subEntity: SubEntityProps;
  /** Callback for result */
  onResult: SubEntityGeometryFunction;
}

interface ClosestFaceRequestProps {
  /** Space point */
  point: XYZProps;
  /** Optional direction for choosing face from edge or vertex hit... */
  direction?: XYZProps;
  /** Callback for result */
  onResult: ClosestFaceFunction;
}

interface LocateSubEntityRequestProps  {
  /** Space point for boresite origin */
  point: XYZProps;
  /** Vector for bosite direction */
  direction: XYZProps;
  /** The maximum number of faces, edges, and vertices to return */
  options: LocateSubEntityProps;
  /** Callback for result */
  onResult: LocateSubEntityFunction;
}

interface ElementGeometryCacheOperationRequestProps {
  /** Target element id, tool element ids supplied by operations between elements... */
  id: Id64String;
  /** Callback for result when element's geometry stream is requested in flatbuffer or graphic formats */
  onGeometry?: ElementGeometryFunction;
  onSubEntityGeometry?: SubEntityGeometryRequestProps;
  onLocateSubEntity?: LocateSubEntityRequestProps;
  onClosestFace?: ClosestFaceRequestProps;
  onOffsetFaces?: OffsetFacesProps;
}

/** @alpha */
export class SolidModelingCommand extends BasicManipulationCommand implements SolidModelingCommandIpc {
  public static override commandId = editorBuiltInCmdIds.cmdSolidModeling;

  private async updateElementGeometryCache(props: ElementGeometryCacheRequestProps): Promise<ElementGeometryCacheResponseProps> {
    return this.iModel.nativeDb.updateElementGeometryCache(props);
  }

  public async createElementGeometryCache(id: Id64String, filter?: ElementGeometryCacheFilter): Promise<boolean> {
    const result = await this.updateElementGeometryCache({ id });
    if (BentleyStatus.SUCCESS !== result.status)
      return false;

    if (undefined === filter)
      return true;

    if (filter.minGeom && (undefined === result.numGeom || filter.minGeom > result.numGeom))
      return false;

    if (filter.maxGeom && (undefined === result.numGeom || filter.maxGeom < result.numGeom))
      return false;

    if (!filter.parts && (result.numPart ?? 0 > 0))
      return false;

    if (!filter.curves && (result.numCurve ?? 0 > 0))
      return false;

    if (!filter.surfaces && (result.numSurface ?? 0 > 0))
      return false;

    if (!filter.solids && (result.numSolid ?? 0 > 0))
      return false;

    if (!filter.other && (result.numOther ?? 0 > 0))
      return false;

    return true;
  }

  public async clearElementGeometryCache(): Promise<void> {
    await this.updateElementGeometryCache({});
  }

  private requestSubEntityGeometry(id: Id64String, subEntity: SubEntityProps): SubEntityGeometryResponseProps | undefined {
    let accepted: SubEntityGeometryResponseProps | undefined;
    const onResult: SubEntityGeometryFunction = (info: SubEntityGeometryResponseProps): void => {
      accepted = info;
    };
    const opProps: SubEntityGeometryRequestProps = { subEntity, onResult };
    const props: ElementGeometryCacheOperationRequestProps = { id, onSubEntityGeometry: opProps };
    this.iModel.nativeDb.elementGeometryCacheOperation(props);
    return accepted;
  }

  public async getSubEntityGeometry(id: Id64String, subEntity: SubEntityProps, opts: Omit<ElementGeometryResultOptions, "writeChanges" | "insertProps">): Promise<SubEntityGeometryProps | undefined> {
    const geometryProps = this.requestSubEntityGeometry(id, subEntity);
    if (undefined === geometryProps?.geometry || undefined === geometryProps?.category)
      return undefined;

    const resultProps: SubEntityGeometryProps = {};

    if (opts.wantGeometry)
      resultProps.geometry = geometryProps.geometry;

    if (opts.wantRange)
      resultProps.range = (geometryProps?.range ? ElementGeometry.toElementAlignedBox3d(geometryProps?.range) : undefined);

    if (opts.wantAppearance) {
      const appearance: SubEntityAppearanceProps = { category: geometryProps.category };

      appearance.subCategory = geometryProps.subCategory;
      appearance.material = geometryProps.material;
      appearance.color = geometryProps.color;
      appearance.transparency = geometryProps.transparency;
      appearance.weight = geometryProps.weight;

      resultProps.appearance = appearance;
    }

    if (!opts.wantGraphic)
      return resultProps;

    const requestId = opts.requestId ? opts.requestId : `SubEntity:${id}-${subEntity.id}`;
    const toleranceLog10 = (opts.chordTolerance ? Math.floor(Math.log10(opts.chordTolerance)) : -2);

    const requestProps: DynamicGraphicsRequest3dProps = {
      id: requestId,
      modelId: this.iModel.iModelId,
      toleranceLog10,
      type: "3d",
      placement: { origin: Point3d.createZero(), angles: YawPitchRollAngles.createDegrees(0, 0, 0) },
      categoryId: geometryProps.category,
      geometry: { format: "flatbuffer", data: [geometryProps.geometry] },
    };

    resultProps.graphic = await this.iModel.generateElementGraphics(requestProps);

    return resultProps;
  }

  public async locateSubEntities(id: Id64String, point: XYZProps, direction: XYZProps, options: LocateSubEntityProps): Promise<SubEntityLocationProps[] | undefined> {
    let accepted: SubEntityLocationProps[] | undefined;
    const onResult: LocateSubEntityFunction = (info: SubEntityLocationProps[]): void => {
      accepted = info;
    };
    const opProps: LocateSubEntityRequestProps = { point, direction, options, onResult };
    const props: ElementGeometryCacheOperationRequestProps = { id, onLocateSubEntity: opProps };
    this.iModel.nativeDb.elementGeometryCacheOperation(props);
    return accepted;
  }

  public async getClosestFace(id: Id64String, point: XYZProps, direction?: XYZProps): Promise<SubEntityLocationProps | undefined> {
    let accepted: SubEntityLocationProps | undefined;
    const onResult: ClosestFaceFunction = (info: SubEntityLocationProps): void => {
      accepted = info;
    };
    const opProps: ClosestFaceRequestProps = { point, direction, onResult };
    const props: ElementGeometryCacheOperationRequestProps = { id, onClosestFace: opProps };
    this.iModel.nativeDb.elementGeometryCacheOperation(props);
    return accepted;
  }

  private async getElementGeometryResults(id: Id64String, info: ElementGeometryInfo, opts: ElementGeometryResultOptions): Promise<ElementGeometryResultProps | undefined> {
    if (0 === info.entryArray.length || undefined === info.categoryId || undefined === info.bbox)
      return undefined;

    const resultProps: ElementGeometryResultProps = {};

    if (opts.wantGeometry)
      resultProps.geometry = info;

    if (opts.wantRange)
      resultProps.range = ElementGeometry.toElementAlignedBox3d(info.bbox);

    if (opts.wantAppearance)
      resultProps.categoryId = info.categoryId;

    if (!(opts.wantGraphic || opts.writeChanges))
      return resultProps;

    let placement: Placement3dProps;
    const sourceToWorld = (undefined === info?.sourceToWorld ? undefined : ElementGeometry.toTransform(info.sourceToWorld));
    if (undefined === sourceToWorld) {
      placement = { origin: Point3d.createZero(), angles: YawPitchRollAngles.createDegrees(0, 0, 0) };
    } else {
      const origin = sourceToWorld.getOrigin();
      const angles = new YawPitchRollAngles();
      YawPitchRollAngles.createFromMatrix3d(sourceToWorld.matrix, angles);
      placement = { origin, angles };
    }

    if (opts.writeChanges) {
      if (opts.insertProps) {
        opts.insertProps.placement = placement; // entryArray is local to this placement...
        delete opts.insertProps.geom; // Ignore geometry if present...
        resultProps.elementId = await this.insertGeometricElement(opts.insertProps, { entryArray: info.entryArray });
      } else {
        await this.updateGeometricElement(id, { entryArray: info.entryArray });
        resultProps.elementId = id;
      }
    }

    if (!opts.wantGraphic)
      return resultProps;

    const requestId = opts.requestId ? opts.requestId : `EGCacheOp:${id}`;
    const toleranceLog10 = (opts.chordTolerance ? Math.floor(Math.log10(opts.chordTolerance)) : -2);

    const requestProps: DynamicGraphicsRequest3dProps = {
      id: requestId,
      modelId: this.iModel.iModelId,
      toleranceLog10,
      type: "3d",
      placement,
      categoryId: info.categoryId,
      geometry: { format: "flatbuffer", data: info.entryArray },
    };

    resultProps.graphic = await this.iModel.generateElementGraphics(requestProps);

    return resultProps;
  }

  public async offsetFaces(id: Id64String, params: OffsetFacesProps, opts: ElementGeometryResultOptions): Promise<ElementGeometryResultProps | undefined> {
    let accepted: ElementGeometryInfo | undefined;
    const onResult: ElementGeometryFunction = (info: ElementGeometryInfo): void => {
      accepted = info;
    };

    const props: ElementGeometryCacheOperationRequestProps = { id, onOffsetFaces: params, onGeometry: onResult };
    this.iModel.nativeDb.elementGeometryCacheOperation(props);

    if (undefined === accepted)
      return undefined;

    return this.getElementGeometryResults(id, accepted, opts);
  }
}
