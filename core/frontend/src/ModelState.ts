/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ModelState
 */

import { Id64, Id64String, JsonUtils } from "@itwin/core-bentley";
import {
  GeometricModel2dProps, GeometricModel3dProps, GeometricModelProps, ModelProps, RealityDataFormat, RealityDataSourceKey, RealityModelDisplaySettings, RelatedElement,
} from "@itwin/core-common";
import { Point2d, Range3d } from "@itwin/core-geometry";
import { EntityState } from "./EntityState";
import { HitDetail } from "./HitDetail";
import { IModelConnection } from "./IModelConnection";
import { RealityDataSource } from "./RealityDataSource";
import { createOrbitGtTileTreeReference, createPrimaryTileTreeReference, createRealityTileTreeReference, TileTreeReference } from "./tile/internal";
import { ViewState } from "./ViewState";
import { SpatialClassifiersState } from "./SpatialClassifiersState";

/** Represents the front-end state of a [Model]($backend).
 * @public
 * @extensions
 */
export class ModelState extends EntityState implements ModelProps {
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
 * @extensions
 */
export abstract class GeometricModelState extends ModelState implements GeometricModelProps {
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
  public override get asGeometricModel(): GeometricModelState { return this; }
  /** Returns true if this is a 2d model (a [[GeometricModel2dState]]). */
  public get is2d(): boolean { return !this.is3d; }

  public override get isGeometricModel(): boolean { return true; }
  /** @internal */
  public get treeModelId(): Id64String { return this.id; }

  /** Query for the union of the ranges of all the elements in this GeometricModel.
   * @note This value is cached after the first time it is called.
   * @public
   */
  public async queryModelRange(): Promise<Range3d> {
    if (undefined === this._modelRange) {
      const ranges = await this.iModel.models.queryExtents(this.id);
      this._modelRange = Range3d.fromJSON(ranges[0]?.extents);
    }

    return this._modelRange;
  }

  /** @internal */
  public createTileTreeReference(view: ViewState): TileTreeReference {
    // If this is a reality model, its tile tree is obtained from reality data service URL.

    const spatialModel = this.asSpatialModel;
    const rdSourceKey = this.jsonProperties.rdSourceKey;
    const getDisplaySettings = () => view.displayStyle.settings.getRealityModelDisplaySettings(this.id) ?? RealityModelDisplaySettings.defaults;
    const getBackgroundBase = () => view.displayStyle.settings?.mapImagery.backgroundBase;
    const getBackgroundLayers = () => view.displayStyle.settings?.mapImagery.backgroundLayers

    if (rdSourceKey) {
      const useOrbitGtTileTreeReference = rdSourceKey.format === RealityDataFormat.OPC;

      const treeRef = (!useOrbitGtTileTreeReference) ?
        createRealityTileTreeReference({
          rdSourceKey,
          iModel: this.iModel,
          source: view,
          modelId: this.id,
          // url: tilesetUrl, // If rdSourceKey is defined, url is not used
          classifiers: undefined !== spatialModel ? spatialModel.classifiers : undefined,
          getDisplaySettings,
          getBackgroundBase,
          getBackgroundLayers,
        }) :
        createOrbitGtTileTreeReference({
          rdSourceKey,
          iModel: this.iModel,
          source: view,
          modelId: this.id,
          // orbitGtBlob: props.orbitGtBlob!, // If rdSourceKey is defined, orbitGtBlob is not used
          classifiers: undefined !== spatialModel ? spatialModel.classifiers : undefined,
          getDisplaySettings,
        });
      return treeRef;
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

      return createOrbitGtTileTreeReference({
        rdSourceKey: rdSourceKeyOGT,
        iModel: this.iModel,
        source: view,
        modelId: this.id,
        orbitGtBlob,
        name: orbitGtName,
        classifiers: undefined !== spatialModel ? spatialModel.classifiers : undefined,
        getDisplaySettings,
      });
    }

    // If this is a TileTree reality model, create it's reference
    const tilesetUrl = this.jsonProperties.tilesetUrl;

    if(tilesetUrl) {
      const rdSourceKeyCS = RealityDataSource.createKeyFromUrl(tilesetUrl);
      return createRealityTileTreeReference({
        rdSourceKey: rdSourceKeyCS,
        url : tilesetUrl,
        iModel: this.iModel,
        source: view,
        modelId: this.id,
        tilesetToDbTransform: this.jsonProperties.tilesetToDbTransform,
        classifiers: undefined !== spatialModel ? spatialModel.classifiers : undefined,
        getDisplaySettings,
        getBackgroundBase,
        getBackgroundLayers,
    });
    }

    return createPrimaryTileTreeReference(view, this, getBackgroundBase, getBackgroundLayers);
  }
}
/** Represents the front-end state of a [GeometricModel2d]($backend).
 * @public
 * @extensions
 */
export class GeometricModel2dState extends GeometricModelState implements GeometricModel2dProps {
  public static override get className() { return "GeometricModel2d"; }
  /** @internal */
  public readonly globalOrigin: Point2d;

  constructor(props: GeometricModel2dProps, iModel: IModelConnection, state?: GeometricModel2dState) {
    super(props, iModel, state);
    this.globalOrigin = Point2d.fromJSON(props.globalOrigin);
  }

  public get is3d(): boolean { return false; }
  public override get asGeometricModel2d(): GeometricModel2dState { return this; }

  public override toJSON(): GeometricModel2dProps {
    const val = super.toJSON() as GeometricModel2dProps;
    val.globalOrigin = this.globalOrigin;
    return val;
  }
}

/** Represents the front-end state of a [GeometricModel3d]($backend).
 * @public
 * @extensions
 */
export class GeometricModel3dState extends GeometricModelState {
  public static override get className() { return "GeometricModel3d"; }

  constructor(props: GeometricModel3dProps, iModel: IModelConnection, state?: GeometricModel3dState) {
    super(props, iModel, state);
    this.isNotSpatiallyLocated = JsonUtils.asBool(props.isNotSpatiallyLocated);
    this.isPlanProjection = JsonUtils.asBool(props.isPlanProjection);
  }

  public override toJSON(): GeometricModel3dProps {
    const val = super.toJSON() as GeometricModel3dProps;
    if (this.isNotSpatiallyLocated)
      val.isNotSpatiallyLocated = true;

    if (this.isPlanProjection)
      val.isPlanProjection = true;

    return val;
  }

  public get is3d(): boolean { return true; }
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
 * @extensions
 */
export class SheetModelState extends GeometricModel2dState {
  public static override get className() { return "SheetModel"; }
}

/** Represents the front-end state of a [SpatialModel]($backend).
 * @public
 * @extensions
 */
export class SpatialModelState extends GeometricModel3dState {
  /** If this is a reality model, provides access to a list of available spatial classifiers that can be applied to it. */
  public readonly classifiers?: SpatialClassifiersState;

  public static override get className() { return "SpatialModel"; }

  public override get asSpatialModel(): SpatialModelState { return this; }

  public constructor(props: ModelProps, iModel: IModelConnection, state?: SpatialModelState) {
    super(props, iModel, state);
    if (this.isRealityModel)
      this.classifiers = SpatialClassifiersState.create(this.jsonProperties);
  }

  /** Return true if this is a reality model (represented by a 3d tile set). */
  public get isRealityModel(): boolean {
    return !!this.jsonProperties.tilesetUrl || !!this.jsonProperties.rdSourceKey || !!this.jsonProperties.orbitGtBlob;
  }
}

/** Represents the front-end state of a [PhysicalModel]($backend).
 * @public
 * @extensions
 */
export class PhysicalModelState extends SpatialModelState {
  public static override get className() { return "PhysicalModel"; }
}

/** Represents the front-end state of a [SpatialLocationModel]($backend).
 * @public
 * @extensions
 */
export class SpatialLocationModelState extends SpatialModelState {
  public static override get className() { return "SpatialLocationModel"; }
}

/** Represents the front-end state of a [DrawingModel]($backend).
 * @public
 * @extensions
 */
export class DrawingModelState extends GeometricModel2dState {
  public static override get className() { return "DrawingModel"; }
}

/** Represents the front-end state of a [SectionDrawingModel]($backend).
 * @public
 * @extensions
 */
export class SectionDrawingModelState extends DrawingModelState {
  public static override get className() { return "SectionDrawingModel"; }
}
