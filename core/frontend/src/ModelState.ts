/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ModelState
 */

import { ByteStream, Id64, Id64String, JsonUtils, Logger } from "@itwin/core-bentley";
import {
  GeometricModel2dProps, GeometricModel3dProps, GeometricModelProps, ModelProps, RealityDataFormat, RealityDataSourceKey, RelatedElement, SpatialClassifiers,
} from "@itwin/core-common";
import { ClipPlane, ClipPrimitive, ClipShape, ClipUtilities, ConvexClipPlaneSet, LineString3d, Plane3dByOriginAndUnitNormal, Point2d, Point3d, Range3d, UnionOfConvexClipPlaneSets, Vector3d,
} from "@itwin/core-geometry";
import { EntityState } from "./EntityState";
import { HitDetail } from "./HitDetail";
import { IModelConnection } from "./IModelConnection";
import { RealityDataSource } from "./RealityDataSource";
import { RealityDataDisplayStyle } from "./RealityDataDisplayStyle";
import { createOrbitGtTileTreeReference, createPrimaryTileTreeReference, createRealityTileTreeReference, RealityModelTileTree, TileTreeReference } from "./tile/internal";
import { ViewState } from "./ViewState";
import { FrontendLoggerCategory } from "./FrontendLoggerCategory";

/** Represents the front-end state of a [Model]($backend).
 * @public
 */
export class ModelState extends EntityState implements ModelProps {
  /** @internal */
  public static override get className() { return "Model"; }
  public readonly modeledElement: RelatedElement;
  public readonly name: string;
  public parentModel: Id64String;
  public readonly isPrivate: boolean;
  public readonly isTemplate: boolean;

  constructor(props: ModelProps, iModel: IModelConnection, state?: ModelState) {
    super(props, iModel, state);
    this.modeledElement = RelatedElement.fromJSON(props.modeledElement)!;
    this.name = props.name ? props.name : "";
    this.parentModel = Id64.fromJSON(props.parentModel)!; // NB! Must always match the model of the modeledElement!
    this.isPrivate = JsonUtils.asBool(props.isPrivate);
    this.isTemplate = JsonUtils.asBool(props.isTemplate);
  }

  /** Add all custom-handled properties of a Model to a json object. */
  public override toJSON(): ModelProps {
    const val = super.toJSON() as ModelProps;
    val.modeledElement = this.modeledElement;
    val.parentModel = this.parentModel;
    val.name = this.name;
    if (this.isPrivate)
      val.isPrivate = this.isPrivate;
    if (this.isTemplate)
      val.isTemplate = this.isTemplate;
    return val;
  }

  /** Determine whether this is a GeometricModel */
  public get isGeometricModel(): boolean { return false; }

  /** Attempts to cast this model to a geometric model. */
  public get asGeometricModel(): GeometricModelState | undefined { return undefined; }
  /** Attempts to cast this model to a 3d geometric model. */
  public get asGeometricModel3d(): GeometricModel3dState | undefined { return undefined; }
  /** Attempts to cast this model to a 2d geometric model. */
  public get asGeometricModel2d(): GeometricModel2dState | undefined { return undefined; }
  /** Attempts to cast this model to a spatial model. */
  public get asSpatialModel(): SpatialModelState | undefined { return undefined; }

  /**
   * Return the tool tip for this model. This is called only if the hit does not return a tooltip.
   * @internal
   */
  public getToolTip(_hit: HitDetail): HTMLElement | string | undefined { return undefined; }
}

/** Represents the front-end state of a [GeometricModel]($backend).
 * The contents of a GeometricModelState can be rendered inside a [[Viewport]].
 * @public
 */
export abstract class GeometricModelState extends ModelState implements GeometricModelProps {
  /** @internal */
  public static override get className() { return "GeometricModel"; }
  /** @internal */
  public geometryGuid?: string;

  private _modelRange?: Range3d;

  constructor(props: GeometricModelProps, iModel: IModelConnection, state?: GeometricModelState) {
    super(props, iModel, state);
    this.geometryGuid = props.geometryGuid;
  }

  /** Returns true if this is a 3d model (a [[GeometricModel3dState]]). */
  public abstract get is3d(): boolean;
  /** @internal */
  public override get asGeometricModel(): GeometricModelState { return this; }
  /** Returns true if this is a 2d model (a [[GeometricModel2dState]]). */
  public get is2d(): boolean { return !this.is3d; }

  /** @internal */
  public override get isGeometricModel(): boolean { return true; }
  /** @internal */
  public get treeModelId(): Id64String { return this.id; }

  /** Query for the union of the ranges of all the elements in this GeometricModel.
   * @internal
   */
  public async queryModelRange(): Promise<Range3d> {
    if (undefined === this._modelRange) {
      const ranges = await this.iModel.models.queryModelRanges(this.id);
      this._modelRange = Range3d.fromJSON(ranges[0]);
    }
    return this._modelRange;
  }

  /** @internal */
  public createTileTreeReference(view: ViewState): TileTreeReference {
    // If this is a reality model, its tile tree is obtained from reality data service URL.

    const spatialModel = this.asSpatialModel;
    const rdSourceKey = this.jsonProperties.rdSourceKey;
    let tileTreeReference: TileTreeReference | undefined;

    if (rdSourceKey) {
      const useOrbitGtTileTreeReference = rdSourceKey.format === RealityDataFormat.OPC;
      tileTreeReference = (!useOrbitGtTileTreeReference) ?
        createRealityTileTreeReference({
          rdSourceKey,
          iModel: this.iModel,
          source: view,
          modelId: this.id,
          // url: tilesetUrl, // If rdSourceKey is defined, url is not used
          classifiers: undefined !== spatialModel ? spatialModel.classifiers : undefined,
          realityDataDisplayStyle: undefined !== spatialModel ? spatialModel.realityDataDisplayStyle : undefined,
        }) :
        createOrbitGtTileTreeReference({
          rdSourceKey,
          iModel: this.iModel,
          source: view,
          modelId: this.id,
          // orbitGtBlob: props.orbitGtBlob!, // If rdSourceKey is defined, orbitGtBlob is not used
          classifiers: undefined !== spatialModel ? spatialModel.classifiers : undefined,
        });
    }

    const orbitGtBlob = this.jsonProperties.orbitGtBlob;

    // If this is an OrbitGt reality model, create it's reference
    if(orbitGtBlob) {
      let orbitGtName = "";
      if (orbitGtBlob.blobFileName !== "") {
        if (orbitGtBlob.blobFileName[0] === "/")
          orbitGtName = orbitGtBlob.blobFileName.substring(1);
        else
          orbitGtName = orbitGtBlob.blobFileName;
      }
      // Create rdSourceKey if not provided
      const rdSourceKeyOGT: RealityDataSourceKey = RealityDataSource.createKeyFromOrbitGtBlobProps(orbitGtBlob);

      tileTreeReference =  createOrbitGtTileTreeReference({
        rdSourceKey: rdSourceKeyOGT,
        iModel: this.iModel,
        source: view,
        modelId: this.id,
        orbitGtBlob,
        name: orbitGtName,
        classifiers: undefined !== spatialModel ? spatialModel.classifiers : undefined,
      });
    }

    // If this is a TileTree reality model, create it's reference
    const tilesetUrl = this.jsonProperties.tilesetUrl;

    if(tilesetUrl) {
      const rdSourceKeyCS = RealityDataSource.createKeyFromUrl(tilesetUrl);
      tileTreeReference = createRealityTileTreeReference({
        rdSourceKey: rdSourceKeyCS,
        url : tilesetUrl,
        iModel: this.iModel,
        source: view,
        modelId: this.id,
        tilesetToDbTransform: this.jsonProperties.tilesetToDbTransform,
        classifiers: undefined !== spatialModel ? spatialModel.classifiers : undefined,
        realityDataDisplayStyle: undefined !== spatialModel ? spatialModel.realityDataDisplayStyle : undefined,
      });
    }

    if (tileTreeReference === undefined) {
      return createPrimaryTileTreeReference(view, this);
    }

    // Try to query clips from the iModel
    if (undefined !== this.id) {
      const clipEcsql = `SELECT SmModelClips FROM ScalableMesh.ScalableMeshModel WHERE ECInstanceId=${this.id}`;

      // Query clips stored in the iModel for this reality data.
      this.iModel.query(clipEcsql).next().then((row) => this.parseAndAddClips(tileTreeReference as RealityModelTileTree.Reference, row, "LineString")).catch(() => {
        const errMsg = `Error querying or parsing line string clips for Model Id=${this.id}`;
        Logger.logError(FrontendLoggerCategory.RealityData, errMsg);
      });

      const clipVectorEcsql = `SELECT SmModelClipVectors FROM ScalableMesh.ScalableMeshModel WHERE ECInstanceId=${this.id}`;

      // Query clips stored in the iModel for this reality data.
      this.iModel.query(clipVectorEcsql).next().then((row) => this.parseAndAddClips(tileTreeReference as RealityModelTileTree.Reference, row, "Vector")).catch(() => {
        const errMsg = `Error querying or parsing vector clips for Model Id=${this.id}`;
        Logger.logError(FrontendLoggerCategory.RealityData, errMsg);
      });
    }

    return tileTreeReference;
  }

  /** @internal */
  private parseAndAddClips(tileTreeReference: RealityModelTileTree.Reference, dbRow: IteratorResult<any,any> | undefined, clipType: String): void {
    if (undefined === dbRow) {
      // Skip models with no clips
      return;
    }

    for (const value of dbRow.value) {
      if (value !== undefined) {
        const stream = new ByteStream(value.buffer);
        while (stream.curPos !== stream.length) {
          /* const clipId =*/ stream.nextId64;
          if (clipType === "LineString") {
            tileTreeReference.clips?.appendClone(this.createClipPrimitiveFromLineString(stream));
          } else if (clipType === "Vector") {
            /* const type =*/ stream.nextInt32;
            /* const isActive =*/ stream.nextUint8;
            /* const geomType =*/ stream.nextUint32;
            const nbPrimitives = stream.nextUint32;
            for (let i = 0; i < nbPrimitives; i++) {
              tileTreeReference.clips?.appendClone(this.createClipPrimitiveFromVector(stream));
            }
          } else {
            throw new Error("Unknown clip type");
          }
        }
      }
    }
  }

  /** @internal */
  private createClipPrimitiveFromLineString(stream: ByteStream): ClipPrimitive {
    const nbClipShapePoints = stream.nextInt32;
    /* const upper =*/ stream.nextInt32;
    const points: Point3d[] = [];
    for (let i = 0; i < nbClipShapePoints; i++) {
      points.push(new Point3d(stream.nextFloat64, stream.nextFloat64, stream.nextFloat64));
    }
    const type = stream.nextInt32;
    const isActive = stream.nextUint8;
    /* const geomType =*/ stream.nextUint32;

    const lineString = LineString3d.create(points);
    const clipTransform = lineString.fractionToFrenetFrame(0.0);
    clipTransform.multiplyInversePoint3dArrayInPlace(points);
    const shape = ClipShape.createShape(points, undefined, undefined, clipTransform, type === 0, isActive === 0);
    return ClipPrimitive.createCapture(shape?.fetchClipPlanesRef());
  }

  /** @internal */
  private createClipPrimitiveFromVector(stream: ByteStream): ClipPrimitive {
    const nbConvexPlaneSets = stream.nextUint32;
    let unionOfConvexClipPlaneSet = UnionOfConvexClipPlaneSets.createEmpty();
    for (let j = 0; j < nbConvexPlaneSets; j++) {
      const nbPlanes = stream.nextUint32;
      const convexPlanes = ConvexClipPlaneSet.createEmpty();
      for (let k = 0; k < nbPlanes; k++) {
        const origin = new Point3d(stream.nextFloat64, stream.nextFloat64, stream.nextFloat64);
        const normal = new Vector3d(stream.nextFloat64, stream.nextFloat64, stream.nextFloat64);
        const newPlane = Plane3dByOriginAndUnitNormal.create(origin, normal);
        if (newPlane !== undefined)
          convexPlanes.addPlaneToConvexSet(ClipPlane.createPlane(newPlane, undefined, undefined, undefined));
      }
      unionOfConvexClipPlaneSet.addConvexSet(convexPlanes);
    }
    const isMask = stream.nextUint8 === 1 ? true : false;
    const isInvisible = stream.nextUint8 === 1 ? true : false;
    if (isMask === true) {
      const origConvexCPS = unionOfConvexClipPlaneSet.clone();
      unionOfConvexClipPlaneSet = UnionOfConvexClipPlaneSets.createEmpty();
      for (const convexSet of origConvexCPS.convexSets) {
        const complimentarySet = ClipUtilities.createComplementaryClips(convexSet);
        for (const complimentaryConvexSet of complimentarySet.convexSets) {
          unionOfConvexClipPlaneSet.addConvexSet(complimentaryConvexSet);
        }
      }
    }

    unionOfConvexClipPlaneSet.setInvisible(isInvisible);
    const hasZClip = stream.nextUint8 === 1 ? true : false;
    if (hasZClip) {
      const zLow = stream.nextFloat64;
      const zHigh = stream.nextFloat64;
      unionOfConvexClipPlaneSet.addOutsideZClipSets(isMask, zLow, zHigh);
    }
    return ClipPrimitive.createCapture(unionOfConvexClipPlaneSet);
  }
}
/** Represents the front-end state of a [GeometricModel2d]($backend).
 * @public
 */
export class GeometricModel2dState extends GeometricModelState implements GeometricModel2dProps {
  /** @internal */
  public static override get className() { return "GeometricModel2d"; }
  /** @internal */
  public readonly globalOrigin: Point2d;

  constructor(props: GeometricModel2dProps, iModel: IModelConnection, state?: GeometricModel2dState) {
    super(props, iModel, state);
    this.globalOrigin = Point2d.fromJSON(props.globalOrigin);
  }

  /** @internal */
  public get is3d(): boolean { return false; }
  /** @internal */
  public override get asGeometricModel2d(): GeometricModel2dState { return this; }

  public override toJSON(): GeometricModel2dProps {
    const val = super.toJSON() as GeometricModel2dProps;
    val.globalOrigin = this.globalOrigin;
    return val;
  }
}

/** Represents the front-end state of a [GeometricModel3d]($backend).
 * @public
 */
export class GeometricModel3dState extends GeometricModelState {
  /** @internal */
  public static override get className() { return "GeometricModel3d"; }

  constructor(props: GeometricModel3dProps, iModel: IModelConnection, state?: GeometricModel3dState) {
    super(props, iModel, state);
    this.isNotSpatiallyLocated = JsonUtils.asBool(props.isNotSpatiallyLocated);
    this.isPlanProjection = JsonUtils.asBool(props.isPlanProjection);
  }

  /** @internal */
  public override toJSON(): GeometricModel3dProps {
    const val = super.toJSON() as GeometricModel3dProps;
    if (this.isNotSpatiallyLocated)
      val.isNotSpatiallyLocated = true;

    if (this.isPlanProjection)
      val.isPlanProjection = true;

    return val;
  }

  /** @internal */
  public get is3d(): boolean { return true; }
  /** @internal */
  public override get asGeometricModel3d(): GeometricModel3dState { return this; }

  /** If true, then the elements in this GeometricModel3dState are expected to be in an XY plane.
   * @note The associated ECProperty was added to the BisCore schema in version 1.0.8
   */
  public readonly isPlanProjection: boolean;

  /** If true, then the elements in this GeometricModel3dState are not in real-world coordinates and will not be in the spatial index.
   * @note The associated ECProperty was added to the BisCore schema in version 1.0.8
   */
  public readonly isNotSpatiallyLocated: boolean;

  /** If true, then the elements in this GeometricModel3dState are in real-world coordinates and will be in the spatial index. */
  public get isSpatiallyLocated(): boolean { return !this.isNotSpatiallyLocated; }
}

/** Represents the front-end state of a [SheetModel]($backend).
 * @public
 */
export class SheetModelState extends GeometricModel2dState {
  /** @internal */
  public static override get className() { return "SheetModel"; }
}

/** Represents the front-end state of a [SpatialModel]($backend).
 * @public
 */
export class SpatialModelState extends GeometricModel3dState {
  /** If this is a reality model, provides access to a list of available spatial classifiers that can be applied to it. */
  public readonly classifiers?: SpatialClassifiers;
  public readonly realityDataDisplayStyle?: RealityDataDisplayStyle;

  /** @internal */
  public static override get className() { return "SpatialModel"; }
  /** @internal */
  public override get asSpatialModel(): SpatialModelState { return this; }

  public constructor(props: ModelProps, iModel: IModelConnection, state?: SpatialModelState) {
    super(props, iModel, state);
    if (this.isRealityModel) {
      this.classifiers = new SpatialClassifiers(this.jsonProperties);
      this.realityDataDisplayStyle = RealityDataDisplayStyle.fromJSON(this.jsonProperties.scalablemesh);
    }
  }

  /** Return true if this is a reality model (represented by a 3d tile set). */
  public get isRealityModel(): boolean {
    return undefined !== this.jsonProperties.tilesetUrl;
  }
}

/** Represents the front-end state of a [PhysicalModel]($backend).
 * @public
 */
export class PhysicalModelState extends SpatialModelState {
  /** @internal */
  public static override get className() { return "PhysicalModel"; }
}

/** Represents the front-end state of a [SpatialLocationModel]($backend).
 * @public
 */
export class SpatialLocationModelState extends SpatialModelState {
  /** @internal */
  public static override get className() { return "SpatialLocationModel"; }
}

/** Represents the front-end state of a [DrawingModel]($backend).
 * @public
 */
export class DrawingModelState extends GeometricModel2dState {
  /** @internal */
  public static override get className() { return "DrawingModel"; }
}

/** Represents the front-end state of a [SectionDrawingModel]($backend).
 * @public
 */
export class SectionDrawingModelState extends DrawingModelState {
  /** @internal */
  public static override get className() { return "SectionDrawingModel"; }
}
