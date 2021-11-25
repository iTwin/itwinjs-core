/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Editing
 */

import { CompressedId64Set, Id64String, IModelStatus } from "@itwin/core-bentley";
import { AngleProps, Matrix3dProps, Range1dProps, Range3dProps, TransformProps, XYZProps } from "@itwin/core-geometry";
import { ColorDefProps, EcefLocationProps, ElementGeometryDataEntry, ElementGeometryInfo, ElementGeometryOpcode, GeometricElementProps, GeometryPartProps } from "@itwin/core-common";
import { EditCommandIpc } from "./EditorIpc";

/** @alpha */
export const editorBuiltInCmdIds = {
  cmdBasicManipulation: "basicManipulation",
  cmdSolidModeling: "solidModeling",
};

/** @alpha */
export interface FlatBufferGeometricElementData {
  /** The geometry stream data */
  entryArray: ElementGeometryDataEntry[];
  /** Whether entries are supplied local to placement transform or in world coordinates */
  isWorld?: boolean;
  /** If true, create geometry that displays oriented to face the camera */
  viewIndependent?: boolean;
}

/** @alpha */
export interface FlatBufferGeometryPartData {
  /** The geometry stream data */
  entryArray: ElementGeometryDataEntry[];
  /** If true, create geometry part with 2d geometry */
  is2dPart?: boolean;
}

/** @alpha */
export interface FlatBufferGeometryFilter {
  /** Optional limit on number of displayable entries to accept */
  maxDisplayable?: number;
  /** Optional array of displayable opCodes to accept */
  accept?: ElementGeometryOpcode[];
  /** Optional array of displayable opCodes to reject */
  reject?: ElementGeometryOpcode[];
  /** Optional geometry type filter
   * curves - true to accept single curves and paths
   * surfaces - true to accept loops, planar regions, open polyfaces, and sheet bodies
   * solids - true to accept capped solids, closed polyfaces, and solid bodies
   */
  geometry?: { curves: boolean, surfaces: boolean, solids: boolean };
}

/** @alpha */
export interface BasicManipulationCommandIpc extends EditCommandIpc {
  deleteElements(ids: CompressedId64Set): Promise<IModelStatus>;
  transformPlacement(ids: CompressedId64Set, transform: TransformProps): Promise<IModelStatus>;
  rotatePlacement(ids: CompressedId64Set, matrix: Matrix3dProps, aboutCenter: boolean): Promise<IModelStatus>;

  /** Create and insert a new geometric element.
   * @param props Properties for the new [GeometricElement]($backend)
   * @param data Optional binary format GeometryStream representation used in lieu of [[GeometricElementProps.geom]].
   * @see [GeometryStream]($docs/learning/common/geometrystream.md), [ElementGeometry]($backend)
   * @throws [[IModelError]] if unable to insert the element
   */
  insertGeometricElement(props: GeometricElementProps, data?: FlatBufferGeometricElementData): Promise<Id64String>;

  /** Create and insert a new geometry part element.
   * @param props Properties for the new [GeometryPart]($backend)
   * @param data Optional binary format GeometryStream representation used in lieu of [[GeometryPartProps.geom]].
   * @see [GeometryStream]($docs/learning/common/geometrystream.md), [ElementGeometry]($backend)
   * @throws [[IModelError]] if unable to insert the element
   */
  insertGeometryPart(props: GeometryPartProps, data?: FlatBufferGeometryPartData): Promise<Id64String>;

  /** Update an existing geometric element.
   * @param propsOrId Properties or element id to update for an existing [GeometricElement]($backend)
   * @param data Optional binary format GeometryStream representation used in lieu of [[GeometricElementProps.geom]].
   * @see [GeometryStream]($docs/learning/common/geometrystream.md), [ElementGeometry]($backend)
   * @throws [[IModelError]] if unable to update the element
   */
  updateGeometricElement(propsOrId: GeometricElementProps | Id64String, data?: FlatBufferGeometricElementData): Promise<void>;

  /** Request geometry from an existing element. Because a GeometryStream can be large and may contain information
   * that is not always useful to frontend code, filter options are provided to restrict what GeometryStreams are returned.
   * For example, a tool may only be interested in a GeometryStream that stores a single CurveCollection.
   * @param id Element id of an existing [GeometricElement]($backend) or [GeometryPart]($backend).
   * @param filter Optional criteria for accepting a GeometryStream.
   * @see [GeometryStream]($docs/learning/common/geometrystream.md), [ElementGeometry]($backend)
   * @throws [[IModelError]] if unable to query the element
   */
  requestElementGeometry(id: Id64String, filter?: FlatBufferGeometryFilter): Promise<ElementGeometryInfo | undefined>;

  /** Update the project extents for the iModel.
   * @param extents New project extents.
   * @throws [[IModelError]] if unable to update the extents property.
   */
  updateProjectExtents(extents: Range3dProps): Promise<void>;

  /** Update the position of the iModel on the earth.
   * @param ecefLocation New ecef location properties.
   * @throws [[IModelError]] if unable to update the ecef location property.
   * @note Clears the geographic coordinate reference system of the iModel, should only be called if invalid.
   */
  updateEcefLocation(ecefLocation: EcefLocationProps): Promise<void>;
}

/** @alpha */
export interface ElementGeometryCacheFilter {
  /** Optional lower limit on number of geometric primitives to accept */
  minGeom?: number;
  /** Optional upper limit on number of geometric primitives to accept */
  maxGeom?: number;
  /** Whether to accept geometry from parts. */
  parts: boolean;
  /** Whether to accept single curves and paths. */
  curves: boolean;
  /** Whether to accept loops, planar regions, open polyfaces, and sheet bodies. */
  surfaces: boolean;
  /** Whether to accept capped solids, closed polyfaces, and solid bodies. */
  solids: boolean;
  /** Whether to accept text, image graphics, etc. */
  other: boolean;
}

/** @alpha */
export enum BRepEntityType {
  /** Body consisting of at least one solid region */
  Solid = 0,
  /** Body consisting of connected sets of faces having edges that are shared by a maximum of two faces */
  Sheet = 1,
  /** Body consisting of connected sets of edges having vertices that are shared by a maximum of two edges */
  Wire = 2,
  /** Body can not be used to represent this geometric entry */
  Invalid = 3,
}

/** @alpha */
export interface ElementGeometryResultOptions {
  /** If true, return geometry as data that can be converted to a render graphic */
  wantGraphic?: true;
  /** If true, return geometry as flatbuffer format data.
   * The data is potentially large and may include brep entries that cannot be directly
   * inspected or manipulated on the frontend, request only as needed. */
  wantGeometry?: true;
  /** If true, return geometry range. */
  wantRange?: true;
  /** If true, return geometry appearance information. */
  wantAppearance?: true;
  /** The chord tolerance to use when creating the graphic (default is 0.01) */
  chordTolerance?: number;
  /** Unique identifier for the render graphic request */
  requestId?: string;
  /** If true, a successful result updates the source element or is inserted as a new element when insertProps is supplied */
  writeChanges?: true;
  /** If specified, writeChanges inserts a new [GeometricElement]($backend) using these properties */
  insertProps?: GeometricElementProps;
}

/** @alpha */
export interface ElementGeometryResultProps {
  /** The element's geometry stream graphic data in world coordinates */
  graphic?: Uint8Array;
  /** The element's geometry stream information */
  geometry?: ElementGeometryInfo;
  /** The element's range box (available as ElementGeometryInfo.bbox when returning geometry) */
  range?: Range3dProps;
  /** The element's category (available as ElementGeometryInfo.category when returning geometry) */
  categoryId?: Id64String;
  /** The result element id (different than source id when requesting insert instead of update) */
  elementId?: Id64String;
}

/** @alpha */
export enum SubEntityType {
  /** A single bounded part of a surface */
  Face = 0,
  /** A single bounded part of a curve */
  Edge = 1,
  /** A single point */
  Vertex = 2,
}

/** @alpha */
export interface SubEntityProps {
  /** Identifies the geometric primitive in the geometry stream that owns this sub-entity when there are more than one */
  index?: number;
  /** Identifies the type of sub-entity */
  type: SubEntityType;
  /** Identifies a face, edge, or vertex of the geometric primitive */
  id: number;
}

/** @alpha */
export interface SubEntityLocationProps {
  /** The information to identify the sub-entity */
  subEntity: SubEntityProps;
  /** The face, edge, or vertex location in world coordinates from closest point or locate request */
  point?: XYZProps;
  /** The face normal vector in world coordinates of the identified location on sub-entity */
  normal?: XYZProps;
  /** The face or edge u parameter of identified location on sub-entity */
  uParam?: number;
  /** The face v parameter of identified location on sub-entity */
  vParam?: number;
}

/** @alpha */
export interface SubEntityAppearanceProps {
  /** Category id for geometry. */
  category: Id64String;
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

/** @alpha */
export interface SubEntityGeometryProps {
  /** The face, edge, or vertex graphic data in world coordinates */
  graphic?: Uint8Array;
  /** The face, edge, or vertex geometry in world coordinates */
  geometry?: ElementGeometryDataEntry;
  /** The face or edge range box for the sub-entity geometry */
  range?: Range3dProps;
  /** The appearance information for the sub-entity geometry */
  appearance?: SubEntityAppearanceProps;
}

/** @alpha */
export interface SubEntityFilter {
  /** true to reject non-planar faces */
  nonPlanarFaces?: true;
  /** true to reject non-linear edges */
  nonLinearEdges?: true;
  /** true to reject laminar edges */
  laminarEdges?: true;
  /** true to reject smooth edges */
  smoothEdges?: true;
  /** true to reject smooth vertices */
  smoothVertices?: true;
}

/** @alpha */
export interface LocateSubEntityProps {
  /** The maximum number of face hits to return. Pass 0 to not pick faces. */
  maxFace: number;
  /** The maximum number of edge hits to return. Pass 0 to not pick edges. */
  maxEdge: number;
  /** The maximum number of vertex hits to return. Pass 0 to not pick vertices. */
  maxVertex: number;
  /** An edge will be picked if it is within this distance from the ray, a vertex twice this distance. */
  maxDistance?: number;
  /** When not locating faces, true to allow locate of back edges and vertices. */
  hiddenEdgesVisible: boolean;
  /** Optional filter to reject common types of faces, edges, and vertices. */
  filter?: SubEntityFilter;
}

/** @alpha */
export interface ConnectedSubEntityProps {
  /** Set to return edges comprising the single loop of this face that contains the supplied edge */
  loopFace?: SubEntityProps;
  /** Set to return edges that are connected and tangent to the supplied edge */
  smoothEdges?: true;
  /** Set to return faces that are smoothly connected to the supplied face */
  smoothFaces?: true;
  /** Set to return adjacent faces to the supplied face or limit smooth face propagation */
  adjacentFaces?: true;
  /** Set to include adjacent faces with identical surface geometry to the supplied face */
  sameSurface?: true;
}

/** @alpha */
export interface EvaluatedFaceProps {
  /** The face location in world coordinates of the supplied uv parameter */
  point: XYZProps;
  /** The face normal vector in world coordinates of the supplied uv parameter */
  normal: XYZProps;
  /** The first derivative with respect to u at the uv parameter */
  uDir: XYZProps;
  /** The first derivative with respect to v at the uv parameter */
  vDir: XYZProps;
}

/** @alpha */
export interface EvaluatedEdgeProps {
  /** The edge location in world coordinates of the supplied u parameter */
  point: XYZProps;
  /** The normalized curve tangent in world coordinates at the u parameter */
  uDir: XYZProps;
}

/** @alpha */
export interface EvaluatedVertexProps {
  /** The vertex location in world coordinates */
  point: XYZProps;
}

/** @alpha */
export interface FaceParameterRangeProps {
  /** The u parameter range of the face */
  uRange: Range1dProps;
  /** The v parameter range of the face */
  vRange: Range1dProps;
}

/** @alpha */
export interface EdgeParameterRangeProps {
  /** The u parameter range of the edge */
  uRange: Range1dProps;
}

/** @alpha */
export interface PointInsideResultProps {
  /** Identifies the geometric primitive in the geometry stream */
  index: number;
  /** Result status */
  inside: boolean;
}

/** @alpha */
export enum BooleanMode {
  /** Unite target with one or more tool entities */
  Unite = 0,
  /** Subtract one or more tool entities from target entity */
  Subtract = 1,
  /** Intersect target with one or more tool entities */
  Intersect = 2,
}

/** @alpha */
export interface BooleanOperationProps {
  /** Specifies boolean mode */
  mode: BooleanMode;
  /** The elements to use as tool bodies (consumed in boolean) */
  tools: Id64String | Id64String[];
}

/** @alpha */
export interface SewSheetProps {
  /** The elements to use as tool bodies (consumed in boolean) */
  tools: Id64String | Id64String[];
}

/** @alpha */
export interface ThickenSheetProps {
  /** The offset distance in the direction of the sheet body face normal */
  front: number;
  /** The offset distance in the opposite direction of the sheet body face normal */
  back: number;
}

/** @alpha */
export interface OffsetFacesProps {
  /** The faces to offset. */
  faces: SubEntityProps | SubEntityProps[];
  /** The offset to apply to all faces, or the offset for each face */
  distances: number | number[];
  /** Set to use faces only to identify which geometric primitives to offset, same offset applied to all faces of body */
  offsetAll?: true;
}

/** @alpha */
export interface OffsetEdgesProps {
  /** The edges to offset with the first edge used as the reference edge for the offset distance. Edges that don't share a face with the reference edge are ignored. */
  edges: SubEntityProps | SubEntityProps[];
  /** The offset direction relative to the reference edge */
  direction: XYZProps;
  /** The offset distance for each edge */
  distance: number;
  /** Whether to automatically continue blend along connected and tangent edges that aren't explicitly specified. */
  propagateSmooth: boolean;
}

/** When shelling, a positive offset goes outwards (in the direction of the surface normal),
 * a negative offset is inwards, and a face with zero offset will be pierced/removed.
 * @alpha
 */
export interface HollowFacesProps {
  /** The offset distance to apply to any face not specifically included in the faces array */
  defaultDistance: number;
  /** The faces to offset by values other than the default offset distance */
  faces: SubEntityProps | SubEntityProps[];
  /** The offset to apply to all specified faces, or the offset for each face in array */
  distances: number | number[];
}

/** @alpha */
export interface SweepFacesProps {
  /** Optional faces to be swept. Leave undefined to sweep a wire or sheet body. */
  faces?: SubEntityProps | SubEntityProps[];
  /** A scaled vector to define the sweep direction and distance */
  path: XYZProps;
}

/** @alpha */
export interface SpinFacesProps {
  /** Optional faces to be spun. Leave undefined to spin a wire or sheet body. */
  faces?: SubEntityProps | SubEntityProps[];
  /** The axis origin */
  origin: XYZProps;
  /** The axis direction */
  direction: XYZProps;
  /** The sweep angle (value in range of -2pi to 2pi), Full sweep if undefined. */
  angle?: AngleProps;
}

/** @alpha */
export interface DeleteSubEntityProps {
  /** The sub-entities to remove. All sub-entities should be of the same [[SubEntityType]]. [[SubEntityType.Vertex]] unsupported. */
  subEntities: SubEntityProps | SubEntityProps[];
}

/** @alpha */
export interface TransformSubEntityProps {
  /** The sub-entities to transform. All sub-entities should be of the same [[SubEntityType]]. */
  subEntities: SubEntityProps | SubEntityProps[];
  /** The transform to apply to all sub-entities, or the transforms for each sub-entity */
  transforms: TransformProps[];
}

/** @alpha */
export interface BlendEdgesProps {
  /** The edges to blend */
  edges: SubEntityProps | SubEntityProps[];
  /** The radius to apply to all edges, or the radius for each edge */
  radii: number | number[];
  /** Whether to automatically continue blend along connected and tangent edges that aren't explicitly specified. */
  propagateSmooth: boolean;
}

/** @alpha */
export enum ChamferMode {
  /** Chamfer ranges */
  Ranges = 0,
  /** Chamfer length. Specify lengths using values1, values2 is unused. */
  Length = 1,
  /** Right/Left distances. Equal distance if values2 is undefined. */
  Distances = 2,
  /** Right distance and angle (radians) */
  DistanceAngle = 3,
  /** Angle (radians) and left distance */
  AngleDistance = 4,
}

/** @alpha */
export interface ChamferEdgesProps {
  /** Specifies chamfer type and determines how values1 and values2 are interpreted and used */
  mode: ChamferMode;
  /** The edges to chamfer */
  edges: SubEntityProps | SubEntityProps[];
  /** The chamfer value to apply to all edges, or the value for each edge. Meaning varies by ChamferMode. */
  values1: number | number[];
  /** The chamfer value to apply to all edges, or the value for each edge. Meaning varies by ChamferMode, unused for (Unused for ChamferMode.Length. */
  values2?: number | number[];
  /** Whether to automatically continue blend along connected and tangent edges that aren't explicitly specified. */
  propagateSmooth: boolean;
}

/** @alpha */
export enum CutDirectionMode {
  /** Remove material in direction of surface normal */
  Forward = 0,
  /** Remove material in opposite direction of surface normal */
  Backward = 1,
  /** Remove material in both directions */
  Both = 2,
  /** Choose forward or backward from tool and target hint points */
  Auto = 3,
}

/** @alpha */
export enum CutDepthMode {
  /** Cut extends through entire solid */
  All = 0,
  /** Cut extends to a specified depth */
  Blind = 1,
}

/** @alpha */
export enum ProfileClosure {
  /** Close by extending end tangents to point of intersection or outside range of target */
  Natural = 0,
  /** Whether to reverse the natural closure direction */
  Reverse = 1,
  /** Choose natural or reverse closure direction based on tool and target hint points */
  Auto = 2,
}

/** @alpha */
export interface CutProps {
  /** The element to use as the cutting profile */
  profile: Id64String;
  /** Sweep direction relative to the sheet body normal of the cut profile. Default CutDirectionMode.Both */
  direction?: CutDirectionMode;
  /** Extend cut through the entire target body or only create a pocket of fixed depth. Default CutDepthMode.All */
  depth?: CutDepthMode;
  /** Depth of cut for CutDepthMode.Blind */
  distance?: number;
  /** Whether to remove material outside profile instead of inside */
  outside?: true;
  /** Whether to attempt to close open profiles according to specified closure option */
  closeOpen?: ProfileClosure;
  /** The normal to use when closing an open path without a well defined normal, ex. a single line segment */
  defaultNormal?: XYZProps;
  /** Hint point on target for auto direction and closure options. Identifies which side of profile normal to keep material for. */
  targetPoint?: XYZProps;
  /** Hint point on tool for auto direction and closure options. Identifies outside of profile closure to keep material for. */
  toolPoint?: XYZProps;
}

/** @alpha */
export enum EmbossDirectionMode {
  /** Material is added in the direction of surface normal when creating a pad. */
  Forward = 0,
  /** Material is added in the opposite direction of surface normal when creating a pad. */
  Backward = 1,
  /** Choose forward or backward from target hint point */
  Auto = 2,
}

/** @alpha */
export interface EmbossProps {
  /** The element to use as the cutting profile, must be planar region or sheet body */
  profile: Id64String;
  /** Emboss direction, determines which side of profile normal material is added on. Default EmbossDirectionMode.Forward */
  direction?: EmbossDirectionMode;
  /** Hint point on target for auto direction. */
  targetPoint?: XYZProps;
}

/** @alpha */
export interface ImprintProps {
  /** The source of the geometry to imprint, can be a path, planar region, sheet, solid, or edges to offset. */
  imprint: Id64String | SubEntityProps[] | ElementGeometryDataEntry;
  /** Optional project direction when imprinting a curve, uses curvature if undefined. */
  direction?: XYZProps;
  /** The target face sub-entity to be imprinted, uses target body if undefined. Required when supplying offset edges. */
  face?: SubEntityProps;
  /** Offset distance when imprinting offset edges onto a face. First edge used as reference. */
  distance?: number;
  /* Whether to extend an open curve (or tool surface) to ensure that it splits the face. */
  extend?: true;
}

/** @alpha */
export interface SweepPathProps {
  /** The element to use as the open or closed path to sweep along. */
  path: Id64String;
  /** true to keep profile at a fixed angle to global axis instead of path tangent (and lock direction). */
  alignParallel?: true;
  /** true to force a sheet body to be created from a closed profile which would normally produce a solid body. */
  createSheet?: true;
  /** Optionally keep profile at a fixed angle relative to the path tangent projected into a plane perpendicular to the lock direction. Only valid when alignParallel is undefined. */
  lockDirection?: XYZProps;
  /** Optionally spin profile as it moves along the path. */
  twistAngle?: AngleProps;
  /** Optionally scale profile as it moves along the path. */
  scale?: number;
  /** The profile point to scale about, required when applying scale. */
  scalePoint?: XYZProps;
}

/** @alpha */
export interface LoftProps {
  /** The elements to use as tool profile curves. Target element is first profile curve. */
  tools: Id64String | Id64String[];
  /** An optional set of guide curves for controlling the loft. */
  guides?: Id64String | Id64String[];
  /** true if start profile is also used as end profile to create a periodic result in loft direction. */
  periodic?: true;
  /** true to order curves by their relative location instead of preserving input order. */
  orderCurves?: true;
  /** true to orient curve directions and normals. */
  orientCurves?: true;
}

/** @alpha */
export interface SolidModelingCommandIpc extends EditCommandIpc {
  /** Clear geometry cache for all elements */
  clearElementGeometryCache(): Promise<void>;
  /** Create new geometry cache entries for the supplied geometric element, or check existing an cache against supplied filter. */
  createElementGeometryCache(id: Id64String, filter?: ElementGeometryCacheFilter): Promise<boolean>;
  /** Report the type of brep entity that would be created for each entry referenced by the supplied geometric element. */
  summarizeElementGeometryCache(id: Id64String): Promise<BRepEntityType[] | undefined>;
  /** Get the geometric representation of a sub-entity in flatbuffer format or graphic data. */
  getSubEntityGeometry(id: Id64String, subEntity: SubEntityProps, opts: Omit<ElementGeometryResultOptions, "writeChanges" | "insertProps">): Promise<SubEntityGeometryProps | undefined>;
  /** Get face uv parameter range, or edge u parameter range */
  getSubEntityParameterRange(id: Id64String, subEntity: SubEntityProps): Promise<FaceParameterRangeProps | EdgeParameterRangeProps | undefined>;
  /** Evaluate location on face, edge, or vertex. uParam and vParam required for face, uParam required for edge. */
  evaluateSubEntity(id: Id64String, subEntity: SubEntityProps, uParam?: number, vParam?: number): Promise<EvaluatedFaceProps | EvaluatedEdgeProps | EvaluatedVertexProps | undefined>;
  /** Return whether the supplied face has a planar surface */
  isPlanarFace(id: Id64String, subEntity: SubEntityProps): Promise<boolean>;
  /** Return whether the angle between the normals of the supplied edge's faces never exceeds the internal smooth angle tolerance along the length of the edge */
  isSmoothEdge(id: Id64String, subEntity: SubEntityProps): Promise<boolean>;
  /** Return whether the supplied sub-entity is a laminar edge of a sheet body, i.e. boundary of a single face */
  isLaminarEdge(id: Id64String, subEntity: SubEntityProps): Promise<boolean>;
  /** Return whether the supplied sub-entity is a linear edge */
  isLinearEdge(id: Id64String, subEntity: SubEntityProps): Promise<boolean>;
  /** Return whether the supplied sub-entity is a redundant edge (containing faces share surface) */
  isRedundantEdge(id: Id64String, subEntity: SubEntityProps): Promise<boolean>;
  /** Return whether the angle between the normals of the supplied vertices's edges never exceeds the internal smooth angle tolerance along the length of the edge */
  isSmoothVertex(id: Id64String, subEntity: SubEntityProps): Promise<boolean>;
  /** Return whether the supplied geometric primitive index is a disjoint body */
  isDisjointBody(id: Id64String, index: number): Promise<boolean>;
  /** Return whether the supplied geometric primitive index is a planar path or region */
  isPlanarBody(id: Id64String, index: number): Promise<boolean>;
  /** Return whether the supplied geometric primitive index is a sheet body with a single planar face */
  isSingleFacePlanarSheet(id: Id64String, index: number): Promise<boolean>;
  /** Return whether the supplied geometric primitive index is a sheet or solid entity that has all planar faces */
  hasOnlyPlanarFaces(id: Id64String, index: number): Promise<boolean>;
  /** Return whether the supplied geometric primitive index is a body with any edge that is non-linear or any face that is non-planar */
  hasCurvedFaceOrEdge(id: Id64String, index: number): Promise<boolean>;
  /** Get sub-entities of the requested type for the supplied element */
  getBodySubEntities(id: Id64String, type: SubEntityType, firstOnly?: true): Promise<SubEntityProps[] | undefined>;
  /** Get related sub-entities for the supplied sub-entity. For example, get the array of faces containing a supplied edge. */
  getConnectedSubEntities(id: Id64String, subEntity: SubEntityProps, type: SubEntityType, opts?: ConnectedSubEntityProps): Promise<SubEntityProps[] | undefined>;
  /** Identify face, edge, and vertex sub-entities from the supplied element by their proximity to a ray. */
  locateSubEntities(id: Id64String, spacePoint: XYZProps, direction: XYZProps, opts: LocateSubEntityProps): Promise<SubEntityLocationProps[] | undefined>;
  /** Find the ray intersection with a face */
  locateFace(id: Id64String, subEntity: SubEntityProps, point: XYZProps, direction: XYZProps): Promise<SubEntityLocationProps[] | undefined>;
  /** Find the closest sub-entity from the supplied element to a given point. */
  getClosestSubEntity(id: Id64String, testPoint: XYZProps): Promise<SubEntityLocationProps | undefined>;
  /** Find the closest face from the supplied element to a given point. */
  getClosestFace(id: Id64String, testPoint: XYZProps, preferredDirection?: XYZProps): Promise<SubEntityLocationProps | undefined>;
  /** Find the closest point on a face or edge to a given point */
  getClosestPoint(id: Id64String, subEntity: SubEntityProps, point: XYZProps): Promise<SubEntityLocationProps | undefined>;
  /** Test if a point is inside or on the boundary of any body from the supplied element */
  isPointInside(id: Id64String, point: XYZProps): Promise<PointInsideResultProps[] | undefined>;
  /** Perform the specified boolean operation between the target element and one or more tool elements. */
  booleanOperation(id: Id64String, params: BooleanOperationProps, opts: ElementGeometryResultOptions): Promise<ElementGeometryResultProps | undefined>;
  /** Sew the sheet bodies from the target element and one or more tool elements together by joining those that share edges in common. */
  sewSheets(id: Id64String, params: SewSheetProps, opts: ElementGeometryResultOptions): Promise<ElementGeometryResultProps | undefined>;
  /** Modify sheet bodies from the supplied element by thickening to create solids bodies. */
  thickenSheets(id: Id64String, params: ThickenSheetProps, opts: ElementGeometryResultOptions): Promise<ElementGeometryResultProps | undefined>;
  /** Modify solid bodies from the supplied element by subtracting a cutting sheet tool body swept according to the specified cut direction and depth. */
  cutSolid(id: Id64String, params: CutProps, opts: ElementGeometryResultOptions): Promise<ElementGeometryResultProps | undefined>;
  /** Modify solid and sheet bodies from the supplied element by creating a pad or pocket according to the specified emboss options. */
  embossBody(id: Id64String, params: EmbossProps, opts: ElementGeometryResultOptions): Promise<ElementGeometryResultProps | undefined>;
  /** Modify solid and sheet bodies from the supplied element by imprinting new edges according to the specified imprint options. */
  imprintBody(id: Id64String, params: ImprintProps, opts: ElementGeometryResultOptions): Promise<ElementGeometryResultProps | undefined>;
  /** Create a new sheet or solid body by sweeping a cross section profile along a path. */
  sweepAlongPath(id: Id64String, params: SweepPathProps, opts: ElementGeometryResultOptions): Promise<ElementGeometryResultProps | undefined>;
  /** Create a new sheet or solid body by lofting through a set of profiles. */
  loftProfiles(id: Id64String, params: LoftProps, opts: ElementGeometryResultOptions): Promise<ElementGeometryResultProps | undefined>;
  /** Modify solid and sheet bodies by offsetting selected faces. */
  offsetFaces(id: Id64String, params: OffsetFacesProps, opts: ElementGeometryResultOptions): Promise<ElementGeometryResultProps | undefined>;
  /** Modify solid and sheet bodies by offsetting selected edges. */
  offsetEdges(id: Id64String, params: OffsetEdgesProps, opts: ElementGeometryResultOptions): Promise<ElementGeometryResultProps | undefined>;
  /** Modify solid bodies by hollowing selected faces. */
  hollowFaces(id: Id64String, params: HollowFacesProps, opts: ElementGeometryResultOptions): Promise<ElementGeometryResultProps | undefined>;
  /** Modify solid and sheet bodies by sweeping selected faces along a path vector. Sweep of sheet faces does not create a solid, specifying all faces of a body is invalid. */
  sweepFaces(id: Id64String, params: SweepFacesProps, opts: ElementGeometryResultOptions): Promise<ElementGeometryResultProps | undefined>;
  /** Modify solid and sheet bodies by spinning selected faces along an arc specified by a revolve axis and sweep angle. */
  spinFaces(id: Id64String, params: SpinFacesProps, opts: ElementGeometryResultOptions): Promise<ElementGeometryResultProps | undefined>;
  /** Modify the target solid or sheet body by removing selected faces oe edges. */
  deleteSubEntities(id: Id64String, params: DeleteSubEntityProps, opts: ElementGeometryResultOptions): Promise<ElementGeometryResultProps | undefined>;
  /** Modify the target solid or sheet body by transforming selected faces, edges, or vertices. */
  transformSubEntities(id: Id64String, params: TransformSubEntityProps, opts: ElementGeometryResultOptions): Promise<ElementGeometryResultProps | undefined>;
  /** Modify the specified edges by changing them into faces having the requested blending surface geometry. */
  blendEdges(id: Id64String, params: BlendEdgesProps, opts: ElementGeometryResultOptions): Promise<ElementGeometryResultProps | undefined>;
  /** Modify the specified edges by changing them into faces having the requested chamfer surface geometry. */
  chamferEdges(id: Id64String, params: ChamferEdgesProps, opts: ElementGeometryResultOptions): Promise<ElementGeometryResultProps | undefined>;
}
