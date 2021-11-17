/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Editing
 */

import { BentleyStatus, CompressedId64Set, DbResult, Id64String, IModelStatus } from "@itwin/core-bentley";
import { Matrix3d, Matrix3dProps, Point3d, PointString3d, Range3d, Range3dProps, Transform, TransformProps, XYZProps, YawPitchRollAngles } from "@itwin/core-geometry";
import { GeometricElement, IModelDb } from "@itwin/core-backend";
import { BRepEntity, ColorDefProps, DynamicGraphicsRequest3dProps, EcefLocation, EcefLocationProps, ElementGeometry, ElementGeometryDataEntry, ElementGeometryFunction, ElementGeometryInfo, ElementGeometryRequest, ElementGeometryUpdate, FilePropertyProps, GeometricElementProps, GeometryPartProps, GeometryStreamBuilder, IModelError, Placement3dProps } from "@itwin/core-common";
import { BasicManipulationCommandIpc, BlendEdgesProps, BooleanOperationProps, BRepEntityType, ChamferEdgesProps, ConnectedSubEntityProps, CutProps, DeleteSubEntityProps, EdgeParameterRangeProps, editorBuiltInCmdIds, ElementGeometryCacheFilter, ElementGeometryResultOptions, ElementGeometryResultProps, EmbossProps, EvaluatedEdgeProps, EvaluatedFaceProps, EvaluatedVertexProps, FaceParameterRangeProps, FlatBufferGeometricElementData, FlatBufferGeometryFilter, FlatBufferGeometryPartData, HollowFacesProps, ImprintProps, LocateSubEntityProps, LoftProps, OffsetEdgesProps, OffsetFacesProps, PointInsideResultProps, SewSheetProps, SolidModelingCommandIpc, SpinFacesProps, SubEntityAppearanceProps, SubEntityGeometryProps, SubEntityLocationProps, SubEntityProps, SubEntityType, SweepFacesProps, SweepPathProps, ThickenSheetProps, TransformSubEntityProps } from "@itwin/editor-common";
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

type GeometrySummaryFunction = (info: BRepEntityType[]) => void;
type SubEntityGeometryFunction = (info: SubEntityGeometryResponseProps) => void;
type SubEntityParameterRangeFunction = (info: FaceParameterRangeProps | EdgeParameterRangeProps) => void;
type SubEntityEvaluateFunction = (info: EvaluatedFaceProps | EvaluatedEdgeProps | EvaluatedVertexProps) => void;
type SubEntityArrayFunction = (info: SubEntityProps[]) => void;
type SubEntityLocationArrayFunction = (info: SubEntityLocationProps[]) => void;
type SubEntityLocationFunction = (info: SubEntityLocationProps) => void;
type PointInsideFunction = (info: PointInsideResultProps[]) => void;
type YesNoFunction = (info: boolean) => void;

interface GeometrySummaryRequestProps {
  /** Callback for result */
  onResult: GeometrySummaryFunction;
}

interface SubEntityGeometryRequestProps {
  /** Sub-entity to return geometry for */
  subEntity: SubEntityProps;
  /** Callback for result */
  onResult: SubEntityGeometryFunction;
}

interface SubEntityParameterRangeRequestProps {
  /** Sub-entity to query */
  subEntity: SubEntityProps;
  /** Callback for result */
  onResult: SubEntityParameterRangeFunction;
}

interface SubEntityEvaluateRequestProps {
  /** Sub-entity to query */
  subEntity: SubEntityProps;
  /** Face or edge u parameter to evaluate */
  uParam?: number;
  /** Face v parameter to evaluate */
  vParam?: number;
  /** Callback for result */
  onResult: SubEntityEvaluateFunction;
}

enum QuerySubEntity {
  /** Return whether the supplied face has a planar surface */
  PlanarFace = 0,
  /** Return whether the angle between the normals of the supplied edge's faces never exceeds the internal smooth angle tolerance along the length of the edge */
  SmoothEdge = 1,
  /** Return whether the supplied sub-entity is a laminar edge of a sheet body, i.e. boundary of a single face */
  LaminarEdge = 2,
  /** Return whether the supplied sub-entity is a linear edge */
  LinearEdge = 3,
  /** Return whether the angle between the normals of the supplied vertices's edges never exceeds the internal smooth angle tolerance along the length of the edge */
  SmoothVertex = 4,
}

interface QuerySubEntityRequestProps  {
  /** Sub-entity to test */
  subEntity: SubEntityProps;
  /** What to check */
  query: QuerySubEntity;
  /** Callback for result */
  onResult: YesNoFunction;
}

enum QueryBody {
  /** Return whether the geometric primitive index is a disjoint body */
  DisjointBody = 0,
  /** Return whether the geometric primitive index is a sheet body with a single planar face */
  SingleFacePlanarSheet = 1,
  /** Return whether the geometric primitive index is a sheet or solid entity that has all planar faces */
  OnlyPlanarFaces = 2,
  /** Return whether the geometric primitive index is a body with any edge that is non-linear or any face that is non-planar */
  CurvedFaceOrEdge = 3,
  /** Return whether the geometric primitive index is a planar sheet or wire body */
  PlanarBody = 4,
}

interface QueryBodyRequestProps  {
  /** Geometric primitive index to test */
  index: number;
  /** What to check */
  query: QueryBody;
  /** Callback for result */
  onResult: YesNoFunction;
}

interface BodySubEntitiesRequestProps {
  /** What type of sub-entities to return, ex. faces of edge. */
  type: SubEntityType;
  /** Option to return only first sub-entity of each body instead of all sub-entities. */
  firstOnly?: true;
  /** Callback for result */
  onResult: SubEntityArrayFunction;
}

interface ConnectedSubEntityRequestProps {
  /** Sub-entity to return connected sub-entities for */
  subEntity: SubEntityProps;
  /** What type of connected sub-entities to return, ex. faces of edge. */
  type: SubEntityType;
  /** Options for returning connected edges and adjacent faces. */
  options?: ConnectedSubEntityProps;
  /** Callback for result */
  onResult: SubEntityArrayFunction;
}

interface LocateSubEntityRequestProps  {
  /** Space point for boresite origin */
  point: XYZProps;
  /** Vector for bosite direction */
  direction: XYZProps;
  /** The maximum number of faces, edges, and vertices to return */
  options: LocateSubEntityProps;
  /** Callback for result */
  onResult: SubEntityLocationArrayFunction;
}

interface LocateFaceRequestProps {
  /** The face to return the ray intersection for */
  subEntity: SubEntityProps;
  /** Space point for boresite origin */
  point: XYZProps;
  /** Vector for bosite direction */
  direction: XYZProps;
  /** Callback for result */
  onResult: SubEntityLocationArrayFunction;
}

interface ClosestSubEntityRequestProps {
  /** Space point */
  point: XYZProps;
  /** Optional direction for choosing face from edge or vertex hit... */
  direction?: XYZProps;
  /** Callback for result */
  onResult: SubEntityLocationFunction;
}

interface ClosestPointRequestProps {
  /** Space point */
  point: XYZProps;
  /** The face or edge sub-entity to return closest point for */
  subEntity: SubEntityProps;
  /** Callback for result */
  onResult: SubEntityLocationFunction;
}

interface PointInsideRequestProps {
  /** Space point */
  point: XYZProps;
  /** Callback for result */
  onResult: PointInsideFunction;
}

enum OperationType {
  GeometrySummary = 0,
  SubEntityGeometry = 1,
  SubEntityParameterRange = 2,
  SubEntityEvaluate = 3,
  SubEntityQuery = 4,
  BodyQuery = 5,
  BodySubEntities = 6,
  ConnectedSubEntity = 7,
  LocateSubEntity = 8,
  LocateFace = 9,
  ClosestSubEntity = 10,
  ClosestFace = 11,
  ClosestPoint = 12,
  PointInside = 13,
  BooleanOp = 14,
  SewSheets = 15,
  ThickenSheets = 16,
  OffsetFaces = 17,
  OffsetEdges = 18,
  HollowFaces = 19,
  SweepFaces = 20,
  SpinFaces = 21,
  DeleteSubEntity = 22,
  TransformSubEntity = 23,
  Blend = 24,
  Chamfer = 25,
  Cut = 26,
  Emboss = 27,
  Imprint = 28,
  SweepPath = 29,
  Loft = 30,
}

interface ElementGeometryCacheOperationRequestProps {
  /** Target element id, tool element ids can be supplied by parameters... */
  id: Id64String;
  /** Requested operation */
  op: OperationType;
  /** Parameters for operation */
  params?: GeometrySummaryRequestProps | SubEntityGeometryRequestProps | SubEntityParameterRangeRequestProps | SubEntityEvaluateRequestProps | QuerySubEntityRequestProps | QueryBodyRequestProps | BodySubEntitiesRequestProps | ConnectedSubEntityRequestProps | LocateSubEntityRequestProps | LocateFaceRequestProps | ClosestSubEntityRequestProps | ClosestPointRequestProps | PointInsideRequestProps| BooleanOperationProps | SewSheetProps | ThickenSheetProps | CutProps | EmbossProps | ImprintProps | SweepPathProps | LoftProps | OffsetFacesProps | OffsetEdgesProps | HollowFacesProps | SweepFacesProps | SpinFacesProps | DeleteSubEntityProps | TransformSubEntityProps | BlendEdgesProps | ChamferEdgesProps;
  /** Callback for result when element's geometry stream is requested in flatbuffer or graphic formats */
  onGeometry?: ElementGeometryFunction;
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

  public async summarizeElementGeometryCache(id: Id64String): Promise<BRepEntityType[] | undefined> {
    let accepted: BRepEntityType[] | undefined;
    const onResult: GeometrySummaryFunction = (info: BRepEntityType[]): void => {
      accepted = info;
    };
    const params: GeometrySummaryRequestProps = { onResult };
    const props: ElementGeometryCacheOperationRequestProps = { id, op: OperationType.GeometrySummary, params };
    this.iModel.nativeDb.elementGeometryCacheOperation(props);
    return accepted;
  }

  private requestSubEntityGeometry(id: Id64String, subEntity: SubEntityProps): SubEntityGeometryResponseProps | undefined {
    let accepted: SubEntityGeometryResponseProps | undefined;
    const onResult: SubEntityGeometryFunction = (info: SubEntityGeometryResponseProps): void => {
      accepted = info;
    };
    const params: SubEntityGeometryRequestProps = { subEntity, onResult };
    const props: ElementGeometryCacheOperationRequestProps = { id, op: OperationType.SubEntityGeometry, params };
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
      elementId: id,
      geometry: { format: "flatbuffer", data: [geometryProps.geometry] },
    };

    resultProps.graphic = await this.iModel.generateElementGraphics(requestProps);

    return resultProps;
  }

  public async getSubEntityParameterRange(id: Id64String, subEntity: SubEntityProps): Promise<FaceParameterRangeProps | EdgeParameterRangeProps | undefined> {
    let accepted: FaceParameterRangeProps | EdgeParameterRangeProps | undefined;
    const onResult: SubEntityParameterRangeFunction = (info: FaceParameterRangeProps | EdgeParameterRangeProps): void => {
      accepted = info;
    };

    const params: SubEntityParameterRangeRequestProps = { subEntity, onResult };
    const props: ElementGeometryCacheOperationRequestProps = { id, op: OperationType.SubEntityParameterRange, params };
    this.iModel.nativeDb.elementGeometryCacheOperation(props);
    return accepted;
  }

  public async evaluateSubEntity(id: Id64String, subEntity: SubEntityProps, uParam?: number, vParam?: number): Promise<EvaluatedFaceProps | EvaluatedEdgeProps | EvaluatedVertexProps | undefined> {
    let accepted: EvaluatedFaceProps | EvaluatedEdgeProps | EvaluatedVertexProps | undefined;
    const onResult: SubEntityEvaluateFunction = (info: EvaluatedFaceProps | EvaluatedEdgeProps | EvaluatedVertexProps): void => {
      accepted = info;
    };

    const params: SubEntityEvaluateRequestProps = { subEntity, uParam, vParam, onResult };
    const props: ElementGeometryCacheOperationRequestProps = { id, op: OperationType.SubEntityEvaluate, params };
    this.iModel.nativeDb.elementGeometryCacheOperation(props);
    return accepted;
  }

  private async subEntityQuery(id: Id64String, subEntity: SubEntityProps, query: QuerySubEntity): Promise<boolean> {
    let accepted = false;
    const onResult: YesNoFunction = (info: boolean): void => {
      accepted = info;
    };

    const params: QuerySubEntityRequestProps = { subEntity, query, onResult };
    const props: ElementGeometryCacheOperationRequestProps = { id, op: OperationType.SubEntityQuery, params };
    this.iModel.nativeDb.elementGeometryCacheOperation(props);
    return accepted;
  }

  public async isPlanarFace(id: Id64String, subEntity: SubEntityProps): Promise<boolean> {
    return this.subEntityQuery(id, subEntity, QuerySubEntity.PlanarFace);
  }

  public async isSmoothEdge(id: Id64String, subEntity: SubEntityProps): Promise<boolean> {
    return this.subEntityQuery(id, subEntity, QuerySubEntity.SmoothEdge);
  }

  public async isLaminarEdge(id: Id64String, subEntity: SubEntityProps): Promise<boolean> {
    return this.subEntityQuery(id, subEntity, QuerySubEntity.LaminarEdge);
  }

  public async isLinearEdge(id: Id64String, subEntity: SubEntityProps): Promise<boolean> {
    return this.subEntityQuery(id, subEntity, QuerySubEntity.LinearEdge);
  }

  public async isSmoothVertex(id: Id64String, subEntity: SubEntityProps): Promise<boolean> {
    return this.subEntityQuery(id, subEntity, QuerySubEntity.SmoothVertex);
  }

  private async bodyQuery(id: Id64String, index: number, query: QueryBody): Promise<boolean> {
    let accepted = false;
    const onResult: YesNoFunction = (info: boolean): void => {
      accepted = info;
    };

    const params: QueryBodyRequestProps = { index, query, onResult };
    const props: ElementGeometryCacheOperationRequestProps = { id, op: OperationType.BodyQuery, params };
    this.iModel.nativeDb.elementGeometryCacheOperation(props);
    return accepted;
  }

  public async isDisjointBody(id: Id64String, index: number): Promise<boolean> {
    return this.bodyQuery(id, index, QueryBody.DisjointBody);
  }

  public async isPlanarBody(id: Id64String, index: number): Promise<boolean> {
    return this.bodyQuery(id, index, QueryBody.PlanarBody);
  }

  public async isSingleFacePlanarSheet(id: Id64String, index: number): Promise<boolean> {
    return this.bodyQuery(id, index, QueryBody.SingleFacePlanarSheet);
  }

  public async hasOnlyPlanarFaces(id: Id64String, index: number): Promise<boolean> {
    return this.bodyQuery(id, index, QueryBody.OnlyPlanarFaces);
  }

  public async hasCurvedFaceOrEdge(id: Id64String, index: number): Promise<boolean> {
    return this.bodyQuery(id, index, QueryBody.CurvedFaceOrEdge);
  }

  public async getBodySubEntities(id: Id64String, type: SubEntityType, firstOnly?: true): Promise<SubEntityProps[] | undefined> {
    let accepted: SubEntityProps[] | undefined;
    const onResult: SubEntityArrayFunction = (info: SubEntityProps[]): void => {
      accepted = info;
    };

    const params: BodySubEntitiesRequestProps = { type, firstOnly, onResult };
    const props: ElementGeometryCacheOperationRequestProps = { id, op: OperationType.BodySubEntities, params };
    this.iModel.nativeDb.elementGeometryCacheOperation(props);
    return accepted;
  }

  public async getConnectedSubEntities(id: Id64String, subEntity: SubEntityProps, type: SubEntityType, options?: ConnectedSubEntityProps): Promise<SubEntityProps[] | undefined> {
    let accepted: SubEntityProps[] | undefined;
    const onResult: SubEntityArrayFunction = (info: SubEntityProps[]): void => {
      accepted = info;
    };

    const params: ConnectedSubEntityRequestProps = { subEntity, type, options, onResult };
    const props: ElementGeometryCacheOperationRequestProps = { id, op: OperationType.ConnectedSubEntity, params };
    this.iModel.nativeDb.elementGeometryCacheOperation(props);
    return accepted;
  }

  public async locateSubEntities(id: Id64String, point: XYZProps, direction: XYZProps, options: LocateSubEntityProps): Promise<SubEntityLocationProps[] | undefined> {
    let accepted: SubEntityLocationProps[] | undefined;
    const onResult: SubEntityLocationArrayFunction = (info: SubEntityLocationProps[]): void => {
      accepted = info;
    };
    const params: LocateSubEntityRequestProps = { point, direction, options, onResult };
    const props: ElementGeometryCacheOperationRequestProps = { id, op: OperationType.LocateSubEntity, params };
    this.iModel.nativeDb.elementGeometryCacheOperation(props);
    return accepted;
  }

  public async locateFace(id: Id64String, subEntity: SubEntityProps, point: XYZProps, direction: XYZProps): Promise<SubEntityLocationProps[] | undefined> {
    let accepted: SubEntityLocationProps[] | undefined;
    const onResult: SubEntityLocationArrayFunction = (info: SubEntityLocationProps[]): void => {
      accepted = info;
    };
    const params: LocateFaceRequestProps = { subEntity, point, direction, onResult };
    const props: ElementGeometryCacheOperationRequestProps = { id, op: OperationType.LocateFace, params };
    this.iModel.nativeDb.elementGeometryCacheOperation(props);
    return accepted;
  }

  public async getClosestSubEntity(id: Id64String, point: XYZProps): Promise<SubEntityLocationProps | undefined> {
    let accepted: SubEntityLocationProps | undefined;
    const onResult: SubEntityLocationFunction = (info: SubEntityLocationProps): void => {
      accepted = info;
    };
    const params: ClosestSubEntityRequestProps = { point, onResult };
    const props: ElementGeometryCacheOperationRequestProps = { id, op: OperationType.ClosestSubEntity, params };
    this.iModel.nativeDb.elementGeometryCacheOperation(props);
    return accepted;
  }

  public async getClosestFace(id: Id64String, point: XYZProps, direction?: XYZProps): Promise<SubEntityLocationProps | undefined> {
    let accepted: SubEntityLocationProps | undefined;
    const onResult: SubEntityLocationFunction = (info: SubEntityLocationProps): void => {
      accepted = info;
    };
    const params: ClosestSubEntityRequestProps = { point, direction, onResult };
    const props: ElementGeometryCacheOperationRequestProps = { id, op: OperationType.ClosestFace, params };
    this.iModel.nativeDb.elementGeometryCacheOperation(props);
    return accepted;
  }

  public async getClosestPoint(id: Id64String, subEntity: SubEntityProps, point: XYZProps): Promise<SubEntityLocationProps | undefined> {
    let accepted: SubEntityLocationProps | undefined;
    const onResult: SubEntityLocationFunction = (info: SubEntityLocationProps): void => {
      accepted = info;
    };
    const params: ClosestPointRequestProps = { subEntity, point, onResult };
    const props: ElementGeometryCacheOperationRequestProps = { id, op: OperationType.ClosestPoint, params };
    this.iModel.nativeDb.elementGeometryCacheOperation(props);
    return accepted;
  }

  public async isPointInside(id: Id64String, point: XYZProps): Promise<PointInsideResultProps[] | undefined> {
    let accepted: PointInsideResultProps[] | undefined;
    const onResult: PointInsideFunction = (info: PointInsideResultProps[]): void => {
      accepted = info;
    };
    const params: PointInsideRequestProps = { point, onResult };
    const props: ElementGeometryCacheOperationRequestProps = { id, op: OperationType.PointInside, params };
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
        const updateProps = this.iModel.elements.getElementProps<GeometricElementProps>({ id });
        updateProps.category = info.categoryId; // allow category change...
        updateProps.placement = placement; // entryArray is local to this placement...
        await this.updateGeometricElement(updateProps, { entryArray: info.entryArray });
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
      elementId: id,
      geometry: { format: "flatbuffer", data: info.entryArray },
    };

    resultProps.graphic = await this.iModel.generateElementGraphics(requestProps);

    return resultProps;
  }

  private async doElementGeometryOperation(props: ElementGeometryCacheOperationRequestProps, opts: ElementGeometryResultOptions): Promise<ElementGeometryResultProps | undefined> {
    let accepted: ElementGeometryInfo | undefined;
    const onGeometry: ElementGeometryFunction = (info: ElementGeometryInfo): void => {
      accepted = info;
    };

    props.onGeometry = onGeometry;
    this.iModel.nativeDb.elementGeometryCacheOperation(props);

    if (undefined === accepted)
      return undefined;

    return this.getElementGeometryResults(props.id, accepted, opts);
  }

  public async booleanOperation(id: Id64String, params: BooleanOperationProps, opts: ElementGeometryResultOptions): Promise<ElementGeometryResultProps | undefined> {
    const props: ElementGeometryCacheOperationRequestProps = { id, op: OperationType.BooleanOp, params };
    const resultProps = await this.doElementGeometryOperation(props, opts);

    // target insert = keep tools, target update = delete tools...
    if (undefined !== resultProps && opts.writeChanges && undefined === opts.insertProps) {
      for (const toolId of params.tools)
        this.iModel.elements.deleteElement(toolId);
    }

    return resultProps;
  }

  public async sewSheets(id: Id64String, params: SewSheetProps, opts: ElementGeometryResultOptions): Promise<ElementGeometryResultProps | undefined> {
    const props: ElementGeometryCacheOperationRequestProps = { id, op: OperationType.SewSheets, params };
    const resultProps = await this.doElementGeometryOperation(props, opts);

    // target insert = keep tools, target update = delete tools...
    if (undefined !== resultProps && opts.writeChanges && undefined === opts.insertProps) {
      for (const toolId of params.tools)
        this.iModel.elements.deleteElement(toolId);
    }

    return resultProps;
  }

  public async thickenSheets(id: Id64String, params: ThickenSheetProps, opts: ElementGeometryResultOptions): Promise<ElementGeometryResultProps | undefined> {
    const props: ElementGeometryCacheOperationRequestProps = { id, op: OperationType.ThickenSheets, params };
    return this.doElementGeometryOperation(props, opts);
  }

  public async cutSolid(id: Id64String, params: CutProps, opts: ElementGeometryResultOptions): Promise<ElementGeometryResultProps | undefined> {
    const props: ElementGeometryCacheOperationRequestProps = { id, op: OperationType.Cut, params };
    const resultProps = this.doElementGeometryOperation(props, opts);

    // target insert = keep profile, target update = delete profile...
    if (undefined !== resultProps && opts.writeChanges && undefined === opts.insertProps)
      this.iModel.elements.deleteElement(params.profile);

    return resultProps;
  }

  public async embossBody(id: Id64String, params: EmbossProps, opts: ElementGeometryResultOptions): Promise<ElementGeometryResultProps | undefined> {
    const props: ElementGeometryCacheOperationRequestProps = { id, op: OperationType.Emboss, params };
    const resultProps = this.doElementGeometryOperation(props, opts);

    // target insert = keep profile, target update = delete profile...
    if (undefined !== resultProps && opts.writeChanges && undefined === opts.insertProps)
      this.iModel.elements.deleteElement(params.profile);

    return resultProps;
  }

  public async imprintBody(id: Id64String, params: ImprintProps, opts: ElementGeometryResultOptions): Promise<ElementGeometryResultProps | undefined> {
    const props: ElementGeometryCacheOperationRequestProps = { id, op: OperationType.Imprint, params };
    const resultProps = this.doElementGeometryOperation(props, opts);

    // target insert = keep profile, target update = delete profile...
    if (undefined !== resultProps && opts.writeChanges && undefined === opts.insertProps && "string" === typeof(params.imprint) )
      this.iModel.elements.deleteElement(params.imprint);

    return resultProps;
  }

  public async sweepAlongPath(id: Id64String, params: SweepPathProps, opts: ElementGeometryResultOptions): Promise<ElementGeometryResultProps | undefined> {
    const props: ElementGeometryCacheOperationRequestProps = { id, op: OperationType.SweepPath, params };
    const resultProps = this.doElementGeometryOperation(props, opts);

    // target insert = keep path, target update = delete path...
    if (undefined !== resultProps && opts.writeChanges && undefined === opts.insertProps)
      this.iModel.elements.deleteElement(params.path);

    return resultProps;
  }

  public async loftProfiles(id: Id64String, params: LoftProps, opts: ElementGeometryResultOptions): Promise<ElementGeometryResultProps | undefined> {
    const props: ElementGeometryCacheOperationRequestProps = { id, op: OperationType.Loft, params };
    const resultProps = this.doElementGeometryOperation(props, opts);

    // target insert = keep profiles and guides, target update = delete profiles and guides...
    if (undefined !== resultProps && opts.writeChanges && undefined === opts.insertProps) {
      for (const toolId of params.tools)
        this.iModel.elements.deleteElement(toolId);

      if (undefined !== params.guides) {
        for (const guideId of params.guides)
          this.iModel.elements.deleteElement(guideId);
      }
    }

    return resultProps;
  }

  public async offsetFaces(id: Id64String, params: OffsetFacesProps, opts: ElementGeometryResultOptions): Promise<ElementGeometryResultProps | undefined> {
    const props: ElementGeometryCacheOperationRequestProps = { id, op: OperationType.OffsetFaces, params };
    return this.doElementGeometryOperation(props, opts);
  }

  public async offsetEdges(id: Id64String, params: OffsetEdgesProps, opts: ElementGeometryResultOptions): Promise<ElementGeometryResultProps | undefined> {
    const props: ElementGeometryCacheOperationRequestProps = { id, op: OperationType.OffsetEdges, params };
    return this.doElementGeometryOperation(props, opts);
  }

  public async hollowFaces(id: Id64String, params: HollowFacesProps, opts: ElementGeometryResultOptions): Promise<ElementGeometryResultProps | undefined> {
    const props: ElementGeometryCacheOperationRequestProps = { id, op: OperationType.HollowFaces, params };
    return this.doElementGeometryOperation(props, opts);
  }

  public async sweepFaces(id: Id64String, params: SweepFacesProps, opts: ElementGeometryResultOptions): Promise<ElementGeometryResultProps | undefined> {
    const props: ElementGeometryCacheOperationRequestProps = { id, op: OperationType.SweepFaces, params };
    return this.doElementGeometryOperation(props, opts);
  }

  public async spinFaces(id: Id64String, params: SpinFacesProps, opts: ElementGeometryResultOptions): Promise<ElementGeometryResultProps | undefined> {
    const props: ElementGeometryCacheOperationRequestProps = { id, op: OperationType.SpinFaces, params };
    return this.doElementGeometryOperation(props, opts);
  }

  public async deleteSubEntities(id: Id64String, params: DeleteSubEntityProps, opts: ElementGeometryResultOptions): Promise<ElementGeometryResultProps | undefined> {
    const props: ElementGeometryCacheOperationRequestProps = { id, op: OperationType.DeleteSubEntity, params };
    return this.doElementGeometryOperation(props, opts);
  }

  public async transformSubEntities(id: Id64String, params: TransformSubEntityProps, opts: ElementGeometryResultOptions): Promise<ElementGeometryResultProps | undefined> {
    const props: ElementGeometryCacheOperationRequestProps = { id, op: OperationType.TransformSubEntity, params };
    return this.doElementGeometryOperation(props, opts);
  }

  public async blendEdges(id: Id64String, params: BlendEdgesProps, opts: ElementGeometryResultOptions): Promise<ElementGeometryResultProps | undefined> {
    const props: ElementGeometryCacheOperationRequestProps = { id, op: OperationType.Blend, params };
    return this.doElementGeometryOperation(props, opts);
  }

  public async chamferEdges(id: Id64String, params: ChamferEdgesProps, opts: ElementGeometryResultOptions): Promise<ElementGeometryResultProps | undefined> {
    const props: ElementGeometryCacheOperationRequestProps = { id, op: OperationType.Chamfer, params };
    return this.doElementGeometryOperation(props, opts);
  }
}
