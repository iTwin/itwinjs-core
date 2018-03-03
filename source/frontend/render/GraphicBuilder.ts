/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "@bentley/bentleyjs-core";
import { IModelConnection } from "../IModelConnection";
import { Transform, Point3d, Point2d, ClipVector, Range3d, Range2d, Arc3d, BSplineCurve3d, BSplineSurface3d } from "@bentley/geometry-core";
import { GeometryStreamEntryId } from "@bentley/imodeljs-common/lib/geometry/GeometryStream";
import { PatternParams } from "@bentley/imodeljs-common/lib/geometry/AreaPattern";
import { ColorDef } from "@bentley/imodeljs-common/lib/ColorDef";
import { Viewport } from "../Viewport";
import { Graphic, GraphicParams, AsThickenedLine, GeometryParams, LinePixels } from "@bentley/imodeljs-common/lib/Render";

export abstract class Iterable<T> {
  constructor(protected list: T[]) { }
  public [Symbol.iterator]() {
    let key = 0;
    return { next: (): IteratorResult<T> => { const result = key < this.list.length ? { value: this.list[key], done: false } : { value: this.list[key - 1], done: true }; key++; return result; } };
  }
}

export class GraphicBuilderTileCorners extends Iterable<Point3d> {
  constructor(public pts: [Point3d, Point3d, Point3d, Point3d]) { super(pts); }
}

/**
 * Exposes methods for creating GraphicBuilder params.
 */
export class GraphicBuilderCreateParams {
  public iModel?: IModelConnection; // Same as DgnDb
  public readonly placement: Transform = Transform.createIdentity();
  public viewport?: Viewport;
  public type: GraphicType;

  public constructor(tf: Transform, type: GraphicType, vp?: Viewport, iModel?: IModelConnection) {
    this.viewport = vp;
    this.placement.setFrom(tf);
    this.type = type;
    if (iModel === undefined && vp && vp.view) {
      this.iModel = vp.view.iModel; // is this equivalent to vp.GetViewController().GetDgnDb() ??
    } else {
      this.iModel = iModel;
    }
  }

  /**
   * Create params for a graphic in world coordinates, not necessarily associated with any viewport.
   * When an iModel parameter is given, this function is chiefly used for tile generation code as the tolerance for faceting the graphic's geometry is independent of any viewport.
   * When an iModel parameter is not given, this function is chiefly used for code which produces 'normal' decorations and dynamics.
   * If this function is used outside of tile generation context, a default coarse tolerance will be used.
   * To get a tolerance appropriate to a viewport, use the overload accepting a Viewport.
   */
  public static scene(vp?: Viewport, placement: Transform = Transform.createIdentity(), iModel?: IModelConnection): GraphicBuilderCreateParams {
    if (!placement) {
      placement = Transform.createIdentity();
    }
    if (iModel) {
      return new GraphicBuilderCreateParams(placement, GraphicType.Scene, vp, iModel);
    } else {
      return new GraphicBuilderCreateParams(placement, GraphicType.Scene, vp);
    }
  }

  /**
   * Create params for a WorldDecoration-type Graphic
   * The faceting tolerance will be computed from the finished graphic's range and the viewport.
   */
  public static worldDecoration(vp: Viewport, placement: Transform = Transform.createIdentity()): GraphicBuilderCreateParams {
    return new GraphicBuilderCreateParams(placement, GraphicType.WorldDecoration, vp);
  }

  /**
   * Create params for a WorldOverlay-type Graphic
   * The faceting tolerance will be computed from the finished graphic's range and the viewport.
   */
  public static worldOverlay(vp: Viewport, placement: Transform = Transform.createIdentity()): GraphicBuilderCreateParams {
    return new GraphicBuilderCreateParams(placement, GraphicType.WorldOverlay, vp);
  }

  /**
   * Create params for a ViewOverlay-type Graphic
   */
  public static viewOverlay(vp: Viewport, placement: Transform = Transform.createIdentity()): GraphicBuilderCreateParams {
    return new GraphicBuilderCreateParams(placement, GraphicType.ViewOverlay, vp);
  }

  /**
   * Create params for a subgraphic
   */
  public subGraphic(placement: Transform = Transform.createIdentity()): GraphicBuilderCreateParams {
    return new GraphicBuilderCreateParams(placement, this.type, this.viewport, this.iModel);
  }

  public isViewCoordinates(): boolean { return GraphicType.ViewBackground === this.type || GraphicType.ViewOverlay === this.type; }
  public isWorldCoordinates(): boolean { return !this.isViewCoordinates(); }
  public isSceneGraphic(): boolean { return GraphicType.Scene === this.type; }
  public isViewBackground(): boolean { return GraphicType.ViewBackground === this.type; }
  public isOverlay(): boolean { return GraphicType.ViewOverlay === this.type || GraphicType.WorldOverlay === this.type; }

  public setPlacement(tf: Transform): void { this.placement.setFrom(tf); }
}

/**
 * Exposes methods for constructing a Graphic from geometric primitives.
 */
export abstract class GraphicBuilder {
  //   //! Parameters used to construct a GraphicBuilder.
  //   struct CreateParams
  //   {
  //     private:
  //     DgnDbR          this.dgndb;
  //     Transform       this.placement;
  //     DgnViewportP    this.viewport;
  //     GraphicType     this.type;

  //     public:
  //     DGNPLATFORM_EXPORT CreateParams(DgnDbR db, TransformCR tf, DgnViewportP vp, GraphicType type);
  //     DGNPLATFORM_EXPORT CreateParams(DgnViewportR vp, TransformCR tf, GraphicType type);

  //         //! Create params for a graphic in world coordinates, not necessarily associated with any viewport.
  //         //! This function is chiefly used for tile generation code as the tolerance for faceting the graphic's geometry is independent of any viewport.
  //         //! If this function is used outside of tile generation context, a default coarse tolerance will be used.
  //         //! To get a tolerance appropriate to a viewport, use the overload accepting a DgnViewport.
  //         static CreateParams Scene(DgnDbR db, TransformCR placement = Transform:: FromIdentity(), DgnViewportP vp = nullptr)
  //     { return CreateParams(db, placement, vp, GraphicType:: Scene); }

  //         //! Create params for a graphic in world coordinates associated with a viewport.
  //         //! This function is chiefly used for code which produces 'normal' decorations and dynamics.
  //         static CreateParams Scene(DgnViewportR vp, TransformCR placement = Transform:: FromIdentity())
  //     { return CreateParams(vp, placement, GraphicType:: Scene); }

  //         //! Create params for a WorldDecoration-type Graphic
  //         //! The faceting tolerance will be computed from the finished graphic's range and the viewport.
  //         static CreateParams WorldDecoration(DgnViewportR vp, TransformCR placement = Transform:: FromIdentity())
  //     { return CreateParams(vp, placement, GraphicType:: WorldDecoration); }

  //         //! Create params for a WorldOverlay-type Graphic
  //         //! The faceting tolerance will be computed from the finished graphic's range and the viewport.
  //         static CreateParams WorldOverlay(DgnViewportR vp, TransformCR placement = Transform:: FromIdentity())
  //     { return CreateParams(vp, placement, GraphicType:: WorldOverlay); }

  //         //! Create params for a ViewOverlay-type Graphic
  //         static CreateParams ViewOverlay(DgnViewportR vp, TransformCR placement = Transform:: FromIdentity())
  //     { return CreateParams(vp, placement, GraphicType:: ViewOverlay); }

  //     //! Create params for a subgraphic
  //     CreateParams SubGraphic(TransformCR placement = Transform:: FromIdentity()) const
  //       { return CreateParams(m_dgndb, placement, this.viewport, this.type);
  //   }

  // }
  // TransformCR GetPlacement() const { return this.placement; }
  // DgnViewportP GetViewport() const { return this.viewport; }
  // GraphicType GetType() const { return this.type; }
  // bool IsViewCoordinates() const { return GraphicType:: ViewBackground == GetType() || GraphicType:: ViewOverlay == GetType(); }
  // bool IsWorldCoordinates() const { return !IsViewCoordinates(); }
  // bool IsSceneGraphic() const { return GraphicType:: Scene == GetType(); }
  // bool IsViewBackground() const { return GraphicType:: ViewBackground == GetType(); }
  // bool IsOverlay() const { return GraphicType:: ViewOverlay == GetType() || GraphicType:: WorldOverlay == GetType(); }

  // void SetPlacement(TransformCR tf) { this.placement = tf; }
  //     };

  public currClip?: ClipVector;

  // GraphicBuilder(CreateParams const& params): this.createParams(params) { }

  public abstract isOpen(): boolean;
  protected abstract _finish(): Graphic;

  /**
   * Get the current GeometryStreamEntryId.
   * @return A GeometryStream entry identifier for the graphics that are currently being drawn.
   */
  public getGeometryStreamEntryId(): GeometryStreamEntryId | undefined { return undefined; }
  /** Set the current GeometryStreamEntryId. */
  public setGeometryStreamEntryId(_id: GeometryStreamEntryId): void { }
  /**
   * Set a GraphicParams to be the "active" GraphicParams for this Graphic.
   * @param graphicParams The new active GraphicParams. All geometry drawn via calls to this Graphic will use them
   * @param geomParams The source GeometryParams if graphicParams was created by cooking geomParams, nullptr otherwise.
   */
  public abstract activateGraphicParams(graphicParams: GraphicParams, geomParams?: GeometryParams): void;

  /**
   * Draw a 3D line string.
   * @param numPoints Number of vertices in points array.
   * @param points Array of vertices in the line string.
   */
  public abstract addLineString(numPoints: number, points: Point3d[]): void;
  /**
   * Draw a 2D line string.
   * @param numPoints Number of vertices in points array.
   * @param points Array of vertices in the line string.
   * @param zDepth Z depth value in local coordinates.
   */
  public abstract addLineString2d(numPoints: number, points: Point2d[], zDepth: number): void;
  /**
   * Draw a 3D point string. A point string is displayed as a series of points, one at each vertex in the array, with no vectors connecting the vertices.
   * @param numPoints Number of vertices in points array.
   * @param points Array of vertices in the point string.
   */
  public abstract addPointString(numPoints: number, points: Point3d[]): void;
  /**
   * Draw a 2D point string. A point string is displayed as a series of points, one at each vertex in the array, with no vectors connecting the vertices.
   * @param numPoints Number of vertices in points array.
   * @param points Array of vertices in the point string.
   * @param zDepth Z depth value.
   */
  public abstract addPointString2d(numPoints: number, points: Point2d[], zDepth: number): void;
  /**
   *  Draw a closed 3D shape.
   * @param numPoints Number of vertices in \c points array. If the last vertex in the array is not the same as the first vertex, an
   *  additional vertex will be added to close the shape.
   * @param points Array of vertices of the shape.
   * @param filled If true, the shape will be drawn filled.
   */
  public abstract addShape(numPoints: number, points: Point3d[], filled: boolean): void;
  /**
   * Draw a 2D shape.
   * @param numPoints Number of vertices in \c points array. If the last vertex in the array is not the same as the first vertex, an
   * additional vertex will be added to close the shape.
   * @param points Array of vertices of the shape.
   * @param zDepth Z depth value.
   * @param filled If true, the shape will be drawn filled.
   */
  public abstract addShape2d(numPoints: number, points: Point2d[], filled: boolean, zDepth: number): void;
  /**
   * Draw a filled triangle strip from 3D points.
   * @param numPoints Number of vertices in \c points array.
   * @param points Array of vertices.
   *  @param asThickenedLine whether the tri-strip represents a thickened line.
   */
  public abstract addTriStrip(numPoints: number, points: Point3d[], asThickenedLine: AsThickenedLine): void;
  /**
   * Draw a filled triangle strip from 2D points.
   * @param numPoints Number of vertices in \c points array.
   * @param points Array of vertices.
   * @param zDepth Z depth value.
   * @param asThickenedLine whether the tri-strip represents a thickened line.
   */
  public abstract addTriStrip2d(numPoints: number, points: Point2d[], asThickenedLine: AsThickenedLine, zDepth: number): void;
  /**
   * Draw a 3D elliptical arc or ellipse.
   * @param ellipse arc data.
   * @param isEllipse If true, and if full sweep, then draw as an ellipse instead of an arc.
   * @param filled If true, and isEllipse is also true, then draw ellipse filled.
   */
  public abstract addArc(ellipse: Arc3d, isEllipse: boolean, filled: boolean): void;
  /**
   * Draw a 2D elliptical arc or ellipse.
   * @param ellipse arc data.
   * @param isEllipse If true, and if full sweep, then draw as an ellipse instead of an arc.
   * @param filled If true, and isEllipse is also true, then draw ellipse filled.
   * @param zDepth Z depth value
   */
  public abstract addArc2d(ellipse: Arc3d, isEllipse: boolean, filled: boolean, zDepth: number): void;
  /** Draw a BSpline curve. */
  public abstract addBSplineCurve(curve: BSplineCurve3d, filled: boolean): void;
  /**
   * Draw a BSpline curve as 2d geometry with display priority.
   * @note Only necessary for non-ICachedDraw calls to support non-zero display priority.
   */
  public abstract addBSplineCurve2d(curve: BSplineCurve3d, filled: boolean, zDepth: number): void;
  // //! Draw a curve vector.
  // public abstract addCurveVector(CurveVectorCR curves, isFilled: boolean): void;
  // //! Draw a curve vector as 2d geometry with display priority.
  // //! @note Only necessary for non-ICachedDraw calls to support non-zero display priority.
  // public abstract addCurveVector2d(CurveVectorCR curves, isFilled: boolean, zDepth: number): void;
  // //! Draw a light-weight surface or solid primitive.
  // //! @remarks Solid primitives can be capped or uncapped, they include cones, torus, box, spheres, and sweeps.
  // public abstract addSolidPrimitive(ISolidPrimitiveCR primitive): void;

  /** Draw a BSpline surface. */
  public abstract addBSplineSurface(surface: BSplineSurface3d): void;
  // //! @remarks Wireframe fill display supported for non-illuminated meshes.
  // public abstract addPolyface(PolyfaceQueryCR meshData, filled: boolean = false): void;
  // //! Draw a BRep surface/solid entity from the solids kernel.
  // public abstract addBody(IBRepEntityCR): void;
  // //! Draw a series of Glyphs.
  // //! @param text Text drawing parameters
  // public abstract addTextString(TextStringCR text): void;
  // //! Draw a series of Glyphs with display priority.
  // //! @param text   Text drawing parameters
  // //! @param zDepth Priority value in 2d
  // public abstract addTextString2d(TextStringCR text, zDepth: number): void;

  public abstract addSubGraphic(graphic: Graphic, trans: Transform, params: GraphicParams, clip?: ClipVector): void;
  public abstract createSubGraphic(trans: Transform, clip?: ClipVector): GraphicBuilder;
  // public wantStrokeLineStyle(LineStyleSymbCR, IFacetOptionsPtr &) { return true; }
  public wantStrokePattern(_pattern: PatternParams) { return true; }
  public finish(): Graphic | undefined { assert(this.isOpen()); return this.isOpen() ? this._finish() : undefined; }

  public setCurrentClip(clip?: ClipVector) { this.currClip = clip; }
  public GgtCurrentClip() { return this.currClip; }
  // CreateParams const& GetCreateParams() const { return this.createParams;}
  // DgnDbR GetDgnDb() const { return this.createParams.GetDgnDb();}
  // TransformCR GetLocalToWorldTransform() const { return this.createParams.GetPlacement();}
  // DgnViewportP GetViewport() const { return this.createParams.GetViewport();}
  // bool IsWorldCoordinates() const { return this.createParams.IsWorldCoordinates();}
  // bool IsViewCoordinates() const { return this.createParams.IsViewCoordinates();}
  // bool WantStrokeLineStyle(LineStyleSymbCR symb, IFacetOptionsPtr & facetOptions) { return _WantStrokeLineStyle(symb, facetOptions); }
  // bool WantStrokePattern(PatternParamsCR pattern) { return _WantStrokePattern(pattern); }
  // bool WantPreBakedBody(IBRepEntityCR body) { return _WantPreBakedBody(body); }

  // //! Helper Methods to draw simple SolidPrimitives.
  // void AddTorus(DPoint3dCR center, DVec3dCR vectorX, DVec3dCR vectorY, double majorRadius, double minorRadius, double sweepAngle, bool capped) { AddSolidPrimitive(* ISolidPrimitive:: CreateDgnTorusPipe(DgnTorusPipeDetail(center, vectorX, vectorY, majorRadius, minorRadius, sweepAngle, capped))); }
  // void AddBox(DVec3dCR primary, DVec3dCR secondary, DPoint3dCR basePoint, DPoint3dCR topPoint, double baseWidth, double baseLength, double topWidth, double topLength, bool capped) { AddSolidPrimitive(* ISolidPrimitive:: CreateDgnBox(DgnBoxDetail:: InitFromCenters(basePoint, topPoint, primary, secondary, baseWidth, baseLength, topWidth, topLength, capped))); }

  /** Add DRange3d edges */
  public addRangeBox(range: Range3d) {
    const p: Point3d[] = [];
    for (let i = 0; i < 8; ++i)
      p[i] = new Point3d();

    p[0].x = p[3].x = p[4].x = p[5].x = range.low.x;
    p[1].x = p[2].x = p[6].x = p[7].x = range.high.x;
    p[0].y = p[1].y = p[4].y = p[7].y = range.low.y;
    p[2].y = p[3].y = p[5].y = p[6].y = range.high.y;
    p[0].z = p[1].z = p[2].z = p[3].z = range.low.z;
    p[4].z = p[5].z = p[6].z = p[7].z = range.high.z;

    const tmpPts: Point3d[] = [];
    tmpPts[0] = p[0]; tmpPts[1] = p[1]; tmpPts[2] = p[2];
    tmpPts[3] = p[3]; tmpPts[4] = p[5]; tmpPts[5] = p[6];
    tmpPts[6] = p[7]; tmpPts[7] = p[4]; tmpPts[8] = p[0];

    this.addLineString(9, tmpPts);
    this.addLineString(2, [p[0], p[3]]);
    this.addLineString(2, [p[4], p[5]]);
    this.addLineString(2, [p[1], p[7]]);
    this.addLineString(2, [p[2], p[6]]);
  }

  /** Add DRange2d edges */
  public addRangeBox2d(range: Range2d, zDepth: number) {
    const tmpPts: Point2d[] = [];
    tmpPts[0] = new Point2d(range.low.x, range.low.y);
    tmpPts[1] = new Point2d(range.high.x, range.low.y);
    tmpPts[2] = new Point2d(range.high.x, range.high.y);
    tmpPts[3] = new Point2d(range.low.x, range.high.y);
    tmpPts[4] = tmpPts[0];
    this.addLineString2d(5, tmpPts, zDepth);
  }

  /**
   * Set symbology for decorations that are only used for display purposes. Pickable decorations require a category, must initialize
   * a GeometryParams and cook it into a GraphicParams to have a locatable decoration.
   */
  public setSymbology(lineColor: ColorDef, fillColor: ColorDef, lineWidth: number, linePixels = LinePixels.Solid) {
    this.activateGraphicParams(GraphicParams.fromSymbology(lineColor, fillColor, lineWidth, linePixels));
  }

  /**
   * Set blanking fill symbology for decorations that are only used for display purposes. Pickable decorations require a category, must initialize
   * a GeometryParams and cook it into a GraphicParams to have a locatable decoration.
   */
  public setBlankingFill(fillColor: ColorDef) { this.activateGraphicParams(GraphicParams.FromBlankingFill(fillColor)); }
}

/**
 * Describes the type of a Graphic. Used when creating a GraphicBuilder to specify the purpose of the Graphic.
 * For Graphics like overlays and view background for which depth testing is disabled:
 *  - The individual geometric primitives are rendered in the order in which they were defined in the GraphicBuilder; and
 *  - The individual Graphics within the DecorationList are rendered in the order in which they appear in the list.
 */
export const enum GraphicType {
  /** Renders behind all other graphics. Coordinates: view. RenderMode: smooth. Lighting: none. Z-testing: disabled. */
  ViewBackground,
  /** Renders as if it were part of the scene. Coordinates: world. RenderMode: from view. Lighting: from view. Z-testing: enabled. */
  /** Used for the scene itself, dynamics, and 'normal' decorations. */
  Scene,
  /** Renders within the scene. Coordinates: world. RenderMode: smooth. Lighting: default. Z-testing: enabled */
  WorldDecoration,
  /**
   * Renders atop the scene. Coordinates: world. RenderMode: smooth. Lighting: none. Z-testing: disabled
   * Used for things like the ACS triad and the grid.
   */
  WorldOverlay,
  /**
   * Renders atop the scene. Coordinates: view. RenderMode: smooth. Lighting: none. Z-testing: disabled
   * Used for things like the locate circle.
   */
  ViewOverlay,
}
