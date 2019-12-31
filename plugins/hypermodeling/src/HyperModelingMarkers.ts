/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { Logger, Id64Array, Id64 } from "@bentley/bentleyjs-core";
import { Point2d, XYAndZ, XAndY, Point3d, ClipVector, Transform } from "@bentley/geometry-core";
import { SectionLocationProps, SectionType, Placement3d, ViewAttachmentProps, RelatedElement } from "@bentley/imodeljs-common";
import {
  BeButton,
  BeButtonEvent,
  Cluster,
  DecorateContext,
  IModelApp,
  IModelConnection,
  InputSource,
  Marker,
  MarkerImage,
  MarkerSet,
  NotifyMessageDetails,
  OutputMessagePriority,
  OutputMessageType,
  ScreenViewport,
  TiledGraphicsProvider,
  ViewClipTool,
  ViewState,
  Viewport,
  imageElementFromUrl,
} from "@bentley/imodeljs-frontend";
import { HyperModelingPlugin } from "./HyperModeling";
import { createSectionGraphicsProvider } from "./SectionGraphicsProvider";
import { AbstractToolbarProps, BadgeType } from "@bentley/ui-abstract";

// cSpell:ignore hotspot sectionmarkersprite detailmarkersprite elevationmarkersprite planmarkersprite

interface PopupToolbarProvider {
  toolbarProps: AbstractToolbarProps;
  overToolbarHotspot: boolean;
  toolbarLocation: XAndY;
  toolbarOffset?: XAndY;
  onToolbarItemExecuted?(item: any): void;
}

class PopupToolbarManager {
  private static _provider?: PopupToolbarProvider;
  private static _current?: PopupToolbarProvider;

  private static show(): boolean {
    if (undefined !== PopupToolbarManager._provider && PopupToolbarManager._provider.overToolbarHotspot &&
      IModelApp.uiAdmin.showToolbar(PopupToolbarManager._provider.toolbarProps, PopupToolbarManager._provider.toolbarLocation,
        undefined !== PopupToolbarManager._provider.toolbarOffset ? PopupToolbarManager._provider.toolbarOffset : IModelApp.uiAdmin.createXAndY(0, 0),
        PopupToolbarManager._itemExecuted, PopupToolbarManager._cancel)) {
      PopupToolbarManager._current = PopupToolbarManager._provider;
      PopupToolbarManager._provider = undefined;
      PopupToolbarManager.closeAfterTimeout();
      return true;
    }
    return false;
  }

  private static _itemExecuted = (item: any) => { if (undefined !== PopupToolbarManager._current && undefined !== PopupToolbarManager._current.onToolbarItemExecuted) PopupToolbarManager._current.onToolbarItemExecuted(item); PopupToolbarManager.close(); };
  private static _cancel = () => { if (undefined === PopupToolbarManager._current || !PopupToolbarManager._current.overToolbarHotspot) PopupToolbarManager.close(); }; // Don't hide when click is over hotspot...
  private static close(): boolean { PopupToolbarManager._current = undefined; return IModelApp.uiAdmin.hideToolbar(); }

  private static closeAfterTimeout() {
    if (undefined === PopupToolbarManager._current)
      return;
    if (PopupToolbarManager._current.overToolbarHotspot || undefined === IModelApp.toolAdmin.cursorView)
      setTimeout(() => { PopupToolbarManager.closeAfterTimeout(); }, 500); // Cursor not in view or over hotspot, check again...
    else
      PopupToolbarManager.close();
  }

  public static toolbarShowAfterTimeout(provider: PopupToolbarProvider) {
    if (PopupToolbarManager._current === provider)
      return;
    PopupToolbarManager._provider = provider;
    setTimeout(() => { PopupToolbarManager.show(); }, 500);
  }
}

/** Marker to show a section location.
 * @beta
 */
class SectionLocation extends Marker implements PopupToolbarProvider {
  private static _size = Point2d.create(40, 40);
  private _clip?: ClipVector;
  private _tiledGraphicsProvider?: TiledGraphicsProvider;
  public isSelected: boolean = false;

  /** Create a new SectionLocation */
  constructor(public props: SectionLocationProps, pos: Point3d, title: string, icon: HTMLImageElement) {
    super(pos, SectionLocation._size);
    this.setImage(icon);
    this.title = title;
    this.setScaleFactor({ low: .2, high: 1.4 }); // make size 20% at back of frustum and 140% at front of frustum (if camera is on)
  }

  private get clip(): ClipVector {
    if (undefined === this._clip) {
      this._clip = this.props.clipGeometry ? ClipVector.fromJSON(JSON.parse(this.props.clipGeometry)) : ClipVector.createEmpty();
      if (undefined !== this.props.placement)
        this._clip.transformInPlace(Placement3d.fromJSON(this.props.placement).transform);
    }
    return this._clip;
  }

  private async getViewState(iModel: IModelConnection): Promise<ViewState | undefined> {
    if (undefined === this.props.viewAttachment)
      return undefined;
    const attachmentId = RelatedElement.idFromJson(this.props.viewAttachment);
    if (Id64.isInvalid(attachmentId))
      return undefined;
    try {
      const attachments = await iModel.elements.getProps(attachmentId) as ViewAttachmentProps[];
      if (1 !== attachments.length)
        return undefined;
      return await iModel.views.load(attachments[0].view.id);
    } catch {
      return undefined;
    }
  }

  private toggleClip(vp: ScreenViewport): void {
    ViewClipTool.enableClipVolume(vp);
    ViewClipTool.setViewClip(vp, this.isSelected ? this.clip : undefined);
    SectionLocationSetDecoration.props.display.selectedOnly = this.isSelected;
    SectionLocationSetDecoration.show(vp, true, false); // tslint:disable-line:no-floating-promises
  }

  private async toggleAttachment(vp: ScreenViewport): Promise<void> {
    if (undefined !== this._tiledGraphicsProvider) {
      vp.dropTiledGraphicsProvider(this._tiledGraphicsProvider);
      this._tiledGraphicsProvider = undefined;
    }

    if (!this.isSelected)
      return Promise.resolve();

    this._tiledGraphicsProvider = await createSectionGraphicsProvider(this.props, vp.iModel);
    vp.addTiledGraphicsProvider(this._tiledGraphicsProvider);
  }

  private async toggleSection(vp: ScreenViewport): Promise<void> {
    this.isSelected = !this.isSelected;
    this.toggleClip(vp);
    return this.toggleAttachment(vp);
  }

  private async openSection(vp: ScreenViewport): Promise<void> {
    const viewState = await this.getViewState(vp.view.iModel);
    if (undefined === viewState)
      return;
    vp.changeView(viewState);
  }

  private alignView(vp: ScreenViewport): void {
    if (undefined === this.props.placement)
      return;
    const placement = Placement3d.fromJSON(this.props.placement).transform;
    const origin = placement.origin;
    const matrix = placement.matrix;
    const targetMatrix = matrix.multiplyMatrixMatrix(vp.rotation);
    const rotateTransform = Transform.createFixedPointAndMatrix(origin, targetMatrix);
    const startFrustum = vp.getFrustum();
    const newFrustum = startFrustum.clone();
    newFrustum.multiply(rotateTransform);
    if (startFrustum.equals(newFrustum))
      return;
    vp.view.setupFromFrustum(newFrustum);
    vp.synchWithView();
    vp.animateFrustumChange();
  }

  public toolbarProps: AbstractToolbarProps = {
    items: [
      { label: HyperModelingPlugin.plugin!.i18n.translate("HyperModeling:Message.ToggleSection"), iconSpec: "icon-section-tool", badgeType: BadgeType.None, applicationData: "toggle_section", execute: () => { } },
      { label: HyperModelingPlugin.plugin!.i18n.translate("HyperModeling:Message.AlignSection"), iconSpec: "icon-image", badgeType: BadgeType.None, applicationData: "align_view", execute: () => { } },
      { label: HyperModelingPlugin.plugin!.i18n.translate("HyperModeling:Message.OpenSection"), iconSpec: "icon-import", badgeType: BadgeType.None, applicationData: "open_section", execute: () => { } },
    ],
  };

  public get overToolbarHotspot(): boolean { return this._isHilited; }
  public get toolbarLocation(): XAndY { return IModelApp.uiAdmin.createXAndY(this.rect.right, this.rect.top); }

  public onToolbarItemExecuted = (item: any) => {
    const vp = SectionLocationSetDecoration.sectionViewport();
    if (undefined === vp)
      return;

    switch (item.applicationData) {
      case "toggle_section": {
        this.toggleSection(vp); // tslint:disable-line:no-floating-promises
        break;
      }
      case "align_view": {
        this.alignView(vp);
        break;
      }
      case "open_section": {
        this.openSection(vp); // tslint:disable-line:no-floating-promises
        break;
      }
    }
  }

  protected drawSelected(ctx: CanvasRenderingContext2D) {
    ctx.shadowBlur = 30;
    ctx.shadowColor = "gold";
    return false;
  }

  public drawDecoration(ctx: CanvasRenderingContext2D): void {
    if (this.isSelected && this.drawSelected(ctx))
      return;
    super.drawDecoration(ctx);
  }

  public onMouseEnter(ev: BeButtonEvent) {
    super.onMouseEnter(ev);
    PopupToolbarManager.toolbarShowAfterTimeout(this);
  }

  public onMouseButton(ev: BeButtonEvent): boolean {
    if (InputSource.Mouse === ev.inputSource && BeButton.Data === ev.button && ev.isDown && ev.viewport)
      this.toggleSection(ev.viewport); // tslint:disable-line:no-floating-promises
    return true; // Don't allow clicks to be sent to active tool...
  }

  public addMarker(context: DecorateContext) {
    super.addMarker(context);
    if (!this._isHilited || undefined === this.props.clipGeometry)
      return;
    ViewClipTool.drawClip(context, this.clip, undefined, { fillClipPlanes: true, hasPrimaryPlane: true });
  }
}

/** A Marker used to show a cluster of section locations.
 * @beta
 */
class SectionLocationClusterMarker extends Marker {
  /** Create a new cluster marker */
  constructor(location: XYAndZ, size: XAndY, cluster: Cluster<SectionLocation>, image: Promise<MarkerImage>) {
    super(location, size);

    this.imageOffset = new Point3d(0, 30);
    this.label = cluster.markers.length.toLocaleString();
    this.labelColor = "black";
    this.labelFont = "bold 14px san-serif";

    const maxLen = 10;
    let title = "";
    cluster.markers.forEach((marker, index: number) => {
      if (index < maxLen) {
        if (title !== "")
          title += "<br>";
        title += marker.title;
      }
    });
    if (cluster.markers.length > maxLen)
      title += "<br>...";

    const div = document.createElement("div");
    div.innerHTML = title;
    this.title = div;
    this.setImage(image);
  }

  /** Show the cluster as a white circle with an outline */
  public drawFunc(ctx: CanvasRenderingContext2D): void {
    ctx.beginPath();
    ctx.strokeStyle = "#372528";
    ctx.fillStyle = "white";
    ctx.lineWidth = 5;
    ctx.arc(0, 0, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  public onMouseButton(_ev: BeButtonEvent): boolean { return true; } // Don't allow clicks to be sent to active tool...
}

/** A MarkerSet to hold section locations. This class supplies to `getClusterMarker` method to create SectionLocationClusterMarkers.
 * @beta
 */
class SectionLocationSet extends MarkerSet<SectionLocation> {
  public minimumClusterSize = 5;
  protected getClusterMarker(cluster: Cluster<SectionLocation>): Marker { return SectionLocationClusterMarker.makeFrom(cluster.markers[0], cluster, cluster.markers[0].image); }
}

/**
 * @beta
 */
export class SectionLocationSetDecoration {
  private _sectionLocations: SectionLocationSet;
  private _detailMarkerImage?: HTMLImageElement;
  private _elevationMarkerImage?: HTMLImageElement;
  private _planMarkerImage?: HTMLImageElement;
  public static decorator?: SectionLocationSetDecoration; // static variable so we can tell if the decorator is active.

  /** By setting members of this object, applications can control the display and behavior of the section markers. */
  public static props = {
    /** Determines what is returned by MarkupApp.stop */
    display: {
      /** Show marker based on display of section location element's category */
      category: true,
      /** Show section markers */
      section: true,
      /** Show detail markers */
      detail: true,
      /** Show elevation markers */
      elevation: true,
      /** Show plan markers */
      plan: true,
      /** @internal Show selected markers only */
      selectedOnly: false,
    },
  };

  public constructor(vp: ScreenViewport, private _sectionMarkerImage: HTMLImageElement) { this._sectionLocations = new SectionLocationSet(vp); }

  private getMarkerImage(props: SectionLocationProps): HTMLImageElement {
    switch (props.sectionType) {
      case SectionType.Detail:
        return (undefined !== this._detailMarkerImage ? this._detailMarkerImage : this._sectionMarkerImage);
      case SectionType.Elevation:
        return (undefined !== this._elevationMarkerImage ? this._elevationMarkerImage : this._sectionMarkerImage);
      case SectionType.Plan:
        return (undefined !== this._planMarkerImage ? this._planMarkerImage : this._sectionMarkerImage);
      default:
        return this._sectionMarkerImage;
    }
  }

  private getMarkerTitle(props: SectionLocationProps): string {
    if (undefined !== props.userLabel)
      return props.userLabel;
    switch (props.sectionType) {
      case SectionType.Detail:
        return HyperModelingPlugin.plugin!.i18n.translate("HyperModeling:Message.DetailCallout");
      case SectionType.Elevation:
        return HyperModelingPlugin.plugin!.i18n.translate("HyperModeling:Message.ElevationCallout");
      case SectionType.Plan:
        return HyperModelingPlugin.plugin!.i18n.translate("HyperModeling:Message.PlanCallout");
      default:
        return HyperModelingPlugin.plugin!.i18n.translate("HyperModeling:Message.SectionCallout");
    }
  }

  private getMarkerTypeDisplay(props: SectionLocationProps): boolean {
    switch (props.sectionType) {
      case SectionType.Detail:
        return SectionLocationSetDecoration.props.display.detail;
      case SectionType.Elevation:
        return SectionLocationSetDecoration.props.display.elevation;
      case SectionType.Plan:
        return SectionLocationSetDecoration.props.display.plan;
      default:
        return SectionLocationSetDecoration.props.display.section;
    }
  }

  /** Populate marker set from section locations */
  private createMarkers(secLocPropList: SectionLocationProps[]): void {
    const pos = new Point3d();
    secLocPropList.forEach((secLocProps) => {
      if (undefined !== secLocProps.placement && undefined !== secLocProps.clipGeometry) {
        pos.setFromJSON(secLocProps.placement!.origin);
        this._sectionLocations.markers.add(new SectionLocation(secLocProps, pos, this.getMarkerTitle(secLocProps), this.getMarkerImage(secLocProps)));
      }
    });
  }

  /** Set marker visibility based on category display */
  private setMarkerVisibility(vp: Viewport): boolean {
    let haveVisibleChange = false;
    let haveVisibleCategory = false;
    let haveVisibleType = false;
    for (const marker of this._sectionLocations.markers) {
      const oldVisible = marker.visible;
      if (SectionLocationSetDecoration.props.display.selectedOnly) {
        marker.visible = marker.isSelected;
      } else {
        if (marker.visible = (SectionLocationSetDecoration.props.display.category ? vp.view.viewsCategory(marker.props.category) : true)) {
          haveVisibleCategory = true;
          if (marker.visible = this.getMarkerTypeDisplay(marker.props))
            haveVisibleType = true;
        }
      }
      if (oldVisible !== marker.visible)
        haveVisibleChange = true;
    }
    if (!SectionLocationSetDecoration.props.display.selectedOnly) {
      if (!haveVisibleCategory) {
        const msg = HyperModelingPlugin.plugin!.i18n.translate("HyperModeling:Error.NotFoundCategories");
        IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, msg, undefined, OutputMessageType.Toast));
      } else if (!haveVisibleType) {
        const msg = HyperModelingPlugin.plugin!.i18n.translate("HyperModeling:Error.NotFoundTypes");
        IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, msg, undefined, OutputMessageType.Toast));
      }
    }
    return haveVisibleChange;
  }

  /** We added this class as a ViewManager.decorator below. This method is called to ask for our decorations. We add the MarkerSet. */
  public decorate(context: DecorateContext): void { this._sectionLocations.addDecoration(context); }

  // Load one image, logging if there was an error
  private static async loadImage(src: string): Promise<HTMLImageElement | undefined> {
    try {
      return await imageElementFromUrl(src); // note: "return await" is necessary inside try/catch
    } catch (err) {
      Logger.logError("SectionLocationSetDecoration", "Could not load image " + src);
    }
    return undefined;
  }

  /** The ScreenViewport of this MarkerSet. */
  public static sectionViewport(): ScreenViewport | undefined { return (undefined !== SectionLocationSetDecoration.decorator ? SectionLocationSetDecoration.decorator._sectionLocations.viewport : undefined); }

  /** Stop showing markers if currently active. */
  public static clear(): void {
    if (undefined === SectionLocationSetDecoration.decorator)
      return;
    IModelApp.viewManager.dropDecorator(SectionLocationSetDecoration.decorator);
    SectionLocationSetDecoration.decorator = undefined;
    SectionLocationSetDecoration.props.display.selectedOnly = false;
  }

  /** Start showing markers if not currently active (or optionally refresh when currently displayed). */
  public static async show(vp: ScreenViewport, sync: boolean, update: boolean): Promise<void> {
    if (undefined !== SectionLocationSetDecoration.decorator) {
      const currentVp = SectionLocationSetDecoration.decorator._sectionLocations.viewport;
      if (currentVp && currentVp !== vp) {
        if (sync || update)
          vp = currentVp;
        else
          update = true; // clear and show in new view...
      }
      if (!update) {
        if (sync && SectionLocationSetDecoration.decorator.setMarkerVisibility(vp)) {
          SectionLocationSetDecoration.decorator._sectionLocations.markDirty();
          vp.invalidateDecorations();
        }
        return;
      }
      this.clear();
    } else if (sync || update) {
      return;
    }

    if (undefined === HyperModelingPlugin.plugin || !vp.view.isSpatialView())
      return;

    const sectionMarkerImage = await this.loadImage(HyperModelingPlugin.plugin.resolveResourceUrl("sectionmarkersprite.ico"));
    if (undefined === sectionMarkerImage)
      return; // No point continuing if we don't have a marker image to show...

    const modelIds = new Set<string>();
    vp.view.forEachModel((model) => { modelIds.add(model.id); });
    if (0 === modelIds.size)
      return;

    let secLocPropList;
    const where = [...modelIds].join(",");
    const ecsql = "SELECT ECInstanceId as id FROM BisCore.SectionLocation WHERE Model.Id IN (" + where + ")";
    try {
      const secLocIds: Id64Array = [];
      for await (const row of vp.view.iModel.query(ecsql))
        secLocIds.push(row.id);
      if (0 !== secLocIds.length)
        secLocPropList = await vp.view.iModel.elements.getProps(secLocIds) as SectionLocationProps[];
    } catch (_) { }

    if (undefined === secLocPropList || 0 === secLocPropList.length) {
      const msg = HyperModelingPlugin.plugin.i18n.translate("HyperModeling:Error.NotFoundModels");
      IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Warning, msg, undefined, OutputMessageType.Toast));
      return;
    }

    // Start by creating the decoration object and adding it as a ViewManager decorator.
    SectionLocationSetDecoration.decorator = new SectionLocationSetDecoration(vp, sectionMarkerImage);
    SectionLocationSetDecoration.decorator._detailMarkerImage = await this.loadImage(HyperModelingPlugin.plugin.resolveResourceUrl("detailmarkersprite.ico"));
    SectionLocationSetDecoration.decorator._elevationMarkerImage = await this.loadImage(HyperModelingPlugin.plugin.resolveResourceUrl("elevationmarkersprite.ico"));
    SectionLocationSetDecoration.decorator._planMarkerImage = await this.loadImage(HyperModelingPlugin.plugin.resolveResourceUrl("planmarkersprite.ico"));
    SectionLocationSetDecoration.decorator.createMarkers(secLocPropList);

    if (0 === SectionLocationSetDecoration.decorator._sectionLocations.markers.size) {
      const msg = HyperModelingPlugin.plugin.i18n.translate("HyperModeling:Error.NotFoundModels");
      IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Warning, msg, undefined, OutputMessageType.Toast));
      return;
    }

    SectionLocationSetDecoration.decorator.setMarkerVisibility(vp);
    IModelApp.viewManager.addDecorator(SectionLocationSetDecoration.decorator);
    vp.onChangeView.addOnce(() => this.clear());
  }
}
