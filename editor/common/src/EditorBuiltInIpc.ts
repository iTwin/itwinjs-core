/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Editing
 */

import { CompressedId64Set, Id64String, IModelStatus } from "@itwin/core-bentley";
import { Matrix3dProps, Range3dProps, TransformProps, XYZProps } from "@itwin/core-geometry";
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
export interface ElementGeometryResultOptions {
  /** If true, return geometry as data that can be converted to a render graphic */
  wantGraphic?: true | undefined;
  /** If true, return geometry as flatbuffer format data.
   * The data is potentially large and may include brep entries that cannot be directly
   * inspected or manipulated on the frontend, request only as needed. */
  wantGeometry?: true | undefined;
  /** If true, return geometry range. */
  wantRange?: true | undefined;
  /** If true, return geometry appearance information. */
  wantAppearance?: true | undefined;
  /** The chord tolerance to use when creating the graphic (default is 0.01) */
  chordTolerance?: number;
  /** Unique identifier for the render graphic request */
  requestId?: string;
  /** If true, a successful result updates the source element or is inserted as a new element when insertProps is supplied */
  writeChanges?: true | undefined;
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
  /** The face normal in world coordinates of the identified location on sub-entity */
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
export interface OffsetFacesProps {
  /** The faces to offset */
  faces: SubEntityProps | SubEntityProps[];
  /** The offset to apply to all faces, or the offset for each face */
  distances: number | number[];
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
export interface SolidModelingCommandIpc extends EditCommandIpc {
  clearElementGeometryCache(): Promise<void>;
  createElementGeometryCache(id: Id64String, filter?: ElementGeometryCacheFilter): Promise<boolean>;
  getSubEntityGeometry(id: Id64String, subEntity: SubEntityProps, opts: Omit<ElementGeometryResultOptions, "writeChanges" | "insertProps">): Promise<SubEntityGeometryProps | undefined>;
  locateSubEntities(id: Id64String, spacePoint: XYZProps, direction: XYZProps, opts: LocateSubEntityProps): Promise<SubEntityLocationProps[] | undefined>;
  getClosestFace(id: Id64String, testPoint: XYZProps, preferredDirection?: XYZProps): Promise<SubEntityLocationProps | undefined>;
  offsetFaces(id: Id64String, params: OffsetFacesProps, opts: ElementGeometryResultOptions): Promise<ElementGeometryResultProps | undefined>;
}
