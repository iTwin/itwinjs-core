/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module ModelState */

import { Id64, JsonUtils, dispose } from "@bentley/bentleyjs-core";
import { EntityState } from "./EntityState";
import { Point2d } from "@bentley/geometry-core";
import { ModelProps, GeometricModel2dProps, AxisAlignedBox3d, RelatedElement, TileTreeProps } from "@bentley/imodeljs-common";
import { IModelConnection } from "./IModelConnection";
import { IModelApp } from "./IModelApp";
import { TileTree, TileLoader, IModelTileLoader } from "./tile/TileTree";
import { ScalableMeshTileTree, ScalableMeshTileLoader, ScalableMeshTileTreeProps } from "./tile/ScalableMeshTileTree";
import { WebMercatorTileTree, WebMercatorTileLoader, WebMercatorTileTreeProps } from "./tile/WebMercatorTileTree";
import { DecorateContext } from "./ViewContext";
import { SheetBorder } from "./Sheet";
import { GraphicBuilder } from "./render/GraphicBuilder";
import { RenderGraphic } from "./render/System";

/** The state of a Model */
export class ModelState extends EntityState implements ModelProps {
  public readonly modeledElement: RelatedElement;
  public readonly name: string;
  public parentModel: Id64;
  public readonly isPrivate: boolean;
  public readonly isTemplate: boolean;

  constructor(props: ModelProps, iModel: IModelConnection) {
    super(props, iModel);
    this.modeledElement = RelatedElement.fromJSON(props.modeledElement)!;
    this.name = props.name ? props.name : "";
    this.parentModel = Id64.fromJSON(props.parentModel)!; // NB! Must always match the model of the modeledElement!
    this.isPrivate = JsonUtils.asBool(props.isPrivate);
    this.isTemplate = JsonUtils.asBool(props.isTemplate);
  }

  /** Add all custom-handled properties of a Model to a json object. */
  public toJSON(): ModelProps {
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
  public getExtents(): AxisAlignedBox3d { return new AxisAlignedBox3d(); } // NEEDS_WORK

  /** Determine whether this is a GeometricModel */
  public get isGeometricModel(): boolean { return false; }

  /** Runs when the iModel this iModelState represents closes. */
  public onIModelConnectionClose() { }
}

/** The state of a geometric model */
export abstract class GeometricModelState extends ModelState {
  private _tileTree?: TileTree;
  private _loadStatus: TileTree.LoadStatus = TileTree.LoadStatus.NotLoaded;

  public abstract get is3d(): boolean;
  public get is2d(): boolean { return !this.is3d; }
  /** @hidden */
  public get tileTree(): TileTree | undefined { return this._tileTree; }
  /** Override of ModelState method, returns true */
  public get isGeometricModel(): boolean { return true; }

  public getOrLoadTileTree(): TileTree | undefined {
    if (undefined === this.tileTree)
      this.loadTileTree();

    return this.tileTree;
  }

  /** @hidden */
  public loadTileTree(): TileTree.LoadStatus {
    if (TileTree.LoadStatus.NotLoaded !== this._loadStatus)
      return this._loadStatus;

    this._loadStatus = TileTree.LoadStatus.Loading;
    switch (this.classFullName) {
      case "ScalableMesh:ScalableMeshModel":
        /* case "PointCloud2:PointCloud2Model": */
        {
          const json = (this.classFullName === "ScalableMesh:ScalableMeshModel") ? this.jsonProperties.scalablemesh : this.jsonProperties.pointcloud2;
          if (json !== undefined && json.FileId !== undefined) {
            ScalableMeshTileTree.getTileTreeProps(json.FileId, this.iModel).then((tileTreeProps: ScalableMeshTileTreeProps) => {
              this.setTileTree(tileTreeProps, new ScalableMeshTileLoader(tileTreeProps));
              IModelApp.viewManager.onNewTilesReady();
            }).catch((_err) => {
              this._loadStatus = TileTree.LoadStatus.NotFound;
            });
          }

          break;
        }
      case "BisCore:WebMercatorModel":
        {
          WebMercatorTileTree.getTileTreeProps(this.jsonProperties.webMercatorModel, this.iModel).then((tileTreeProps: WebMercatorTileTreeProps) => {
            this.setTileTree(tileTreeProps, new WebMercatorTileLoader(tileTreeProps));
          }).catch((_err) => {
            this._loadStatus = TileTree.LoadStatus.NotFound;
          });
          break;

      /*
            case "PointCloud:PointCloudModel":   // WIP - Testing.
              {
                {
                  const url = "http://realitymodeling-pw.bentley.com/a3D/Cesium/CesiumPointCloud/PoliceCar/Model_32/Model_32.json";
                  ScalableMeshTileTree.getTileTreeProps(url, this.iModel).then((tileTreeProps: ScalableMeshTileTreeProps) => {
                    this.setTileTree(tileTreeProps, new ScalableMeshTileLoader(tileTreeProps));
                    IModelApp.viewManager.onNewTilesReady();
                  }).catch((_err) => {
                    this._loadStatus = TileTree.LoadStatus.NotFound;
                  });
                }
                break;
              }
      */
      default:
        {
          const ids = Id64.toIdSet(this.id);
          this.iModel.tiles.getTileTreeProps(ids).then((result: TileTreeProps[]) => {
            this.setTileTree(result[0], new IModelTileLoader(this.iModel, Id64.fromJSON(result[0].id)));
            IModelApp.viewManager.onNewTilesReady();
          }).catch((_err) => {
            this._loadStatus = TileTree.LoadStatus.NotFound;
          });

          break;
        }
    }

    return this._loadStatus;
  }

  private setTileTree(props: TileTreeProps, loader: TileLoader) {
    this._tileTree = new TileTree(TileTree.Params.fromJSON(props, this, loader));
    this._loadStatus = TileTree.LoadStatus.Loaded;
  }

  public onIModelConnectionClose() {
    dispose(this._tileTree);  // we do not track if we are disposed... catch this at the tiletree level
    super.onIModelConnectionClose();
  }
}

/** The state of a 2d Geometric Model */
export class GeometricModel2dState extends GeometricModelState implements GeometricModel2dProps {
  public readonly globalOrigin: Point2d;
  constructor(props: GeometricModel2dProps, iModel: IModelConnection) {
    super(props, iModel);
    this.globalOrigin = Point2d.fromJSON(props.globalOrigin);
  }

  public get is3d(): boolean { return false; }

  public toJSON(): GeometricModel2dProps {
    const val = super.toJSON() as GeometricModel2dProps;
    val.globalOrigin = this.globalOrigin;
    return val;
  }
}

/** The state of a 3d Geometric Model */
export class GeometricModel3dState extends GeometricModelState {
  /** Returns true. */
  public get is3d(): boolean { return true; }
}

/**
 * The state of a SheetModel.
 *
 * A SheetModel is a GeometricModel2d that has the following characteristics:
 * * Has finite extents, specified in meters (the *page size*.)
 * * Can contain views of other models, like pictures pasted on a photo album.
 */
export class SheetModelState extends GeometricModel2dState {
  /** Draw border graphics (called during update) */
  public static createBorder(width: number, height: number, viewContext: DecorateContext): RenderGraphic {
    const border = SheetBorder.create(width, height, viewContext);
    const builder: GraphicBuilder = viewContext.createViewBackground();
    border.addToBuilder(builder);
    return builder.finish();
  }
}

/** The state of a SpatialModel */
export class SpatialModelState extends GeometricModel3dState { }

/** The state of a DrawingModel */
export class DrawingModelState extends GeometricModel2dState { }

/** The state of a SectionDrawingModel */
export class SectionDrawingModelState extends DrawingModelState { }
