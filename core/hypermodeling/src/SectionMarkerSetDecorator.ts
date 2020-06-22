/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module HyperModeling
 */

import { Transform, XAndY } from "@bentley/geometry-core";
import { SectionType } from "@bentley/imodeljs-common";
import { AbstractToolbarProps } from "@bentley/ui-abstract";
import {
  DecorateContext, IModelApp, NotifyMessageDetails, OutputMessagePriority, OutputMessageType, ScreenViewport, TiledGraphicsProvider, ViewClipTool,
} from "@bentley/imodeljs-frontend";
import { SectionMarker, SectionMarkerSet } from "./SectionMarkers";
import { SectionDrawingLocationState } from "./SectionDrawingLocationState";
import { createSectionGraphicsProvider } from "./SectionGraphicsProvider";
import { PopupToolbarManager, PopupToolbarProvider } from "./PopupToolbar";

async function createMarkers(vp: ScreenViewport): Promise<SectionMarkerSet | undefined> {
  if (!vp.view.isSpatialView())
    return undefined;

  const states = await SectionDrawingLocationState.queryAll(vp.iModel);
  if (0 === states.length)
    return undefined;

  const markers = states.map((state) => new SectionMarker(state));
  return new SectionMarkerSet(vp, markers);
}

/** By setting members of this object, applications can control the display and behavior of the section markers.
 * @beta
 */
export interface SectionMarkerSetDecoratorProps {
  /** Determines what is returned by MarkupApp.stop */
  display: {
    /** Only show markers belonging to displayed models according to model selector */
    model: boolean,
    /** Show marker based on display of section location element's category */
    category: boolean;
    /** Show section markers */
    section: boolean;
    /** Show detail markers */
    detail: boolean;
    /** Show elevation markers */
    elevation: boolean;
    /** Show plan markers */
    plan: boolean;
    /** @internal Show selected markers only */
    selectedOnly: boolean;
  };
}

enum SyncRequest {
  /** Already in sync */
  None,
  /** Update visibility of current markers */
  Visibility,
  /** Create new markers */
  Markers,
}

class MarkerToolbarProvider implements PopupToolbarProvider {
  public readonly marker: SectionMarker;
  public readonly toolbarProps: AbstractToolbarProps;
  public readonly onToolbarItemExecuted: (id: string) => void;

  public constructor(marker: SectionMarker, decorator: SectionMarkerSetDecorator) {
    this.marker = marker;
    this.toolbarProps = marker.getToolbarProps();
    this.onToolbarItemExecuted = (id) => decorator.onToolbarItemExecuted(id);
  }

  public get overToolbarHotspot() {
    return this.marker.isHilited;
  }

  public get toolbarLocation(): XAndY {
    return IModelApp.uiAdmin.createXAndY(this.marker.rect.right, this.marker.rect.top);
  }
}

function propsKeyFromSectionType(sectionType: SectionType): "detail" | "plan" | "section" | "elevation" | undefined {
  switch (sectionType) {
    case SectionType.Detail:
      return "detail";
    case SectionType.Plan:
      return "plan";
    case SectionType.Section:
      return "section";
    case SectionType.Elevation:
      return "elevation";
    default:
      return undefined;
  }
}

/** A decorator that displays a [Marker]($frontend) for each [SectionDrawingLocation]($backend) in the view.
 * Clicking on a marker toggles the section and the display of associated 2d graphics.
 * Hovering over a marker opens a mini toolbar with additional interactions.
 * @beta
 */
export class SectionMarkerSetDecorator {
  private readonly _markers: SectionMarkerSet;
  private readonly _props: SectionMarkerSetDecoratorProps;
  private readonly _removeEventListeners = new Array<() => void>();
  private _syncRequest = SyncRequest.None;
  private _toolbarProvider?: MarkerToolbarProvider;
  private _tiledGraphicsProvider?: TiledGraphicsProvider;

  public static async create(vp: ScreenViewport, props?: SectionMarkerSetDecoratorProps): Promise<SectionMarkerSetDecorator | undefined> {
    if (!props)
      props = this.defaultProps;

    const markers = await createMarkers(vp /*, ###TODO, props.display.model */);
    return undefined !== markers ? new SectionMarkerSetDecorator(markers, props) : undefined;
  }

  public static getForViewport(vp: ScreenViewport): SectionMarkerSetDecorator | undefined {
    for (const decorator of IModelApp.viewManager.decorators)
      if (decorator instanceof SectionMarkerSetDecorator && decorator.viewport === vp)
        return decorator;

    return undefined;
  }

  /** By setting members of this object, applications can control the display and behavior of the section markers. */
  public static defaultProps = {
    /** Determines what is returned by MarkupApp.stop */
    display: {
      /** Only show markers belonging to displayed models according to model selector */
      model: true,
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

  public get viewport(): ScreenViewport { return this._markers.viewport; }

  /** enable: true to show, false to hide, undefined  to toggle. */
  public static async showOrHide(vp: ScreenViewport, enable?: boolean): Promise<void> {
    const decorator = this.getForViewport(vp);
    if (undefined === enable)
      enable = undefined === decorator;

    if (!enable) {
      if (undefined !== decorator)
        decorator.dispose();

      return;
    }

    if (!vp.view.isSpatialView())
      return;

    await this.create(vp);
  }

  public decorate(context: DecorateContext): void {
    this._markers.addDecoration(context);
  }

  private constructor(markers: SectionMarkerSet, props: SectionMarkerSetDecoratorProps) {
    this._markers = markers;
    this._props = { ...props };

    this.viewport.onChangeView.addOnce(() => {
      this.requestSync(SyncRequest.Markers);
    });

    // ###TODO per-model viewed categories not handled...
    this._removeEventListeners.push(this.viewport.onViewedCategoriesChanged.addListener(() => this.requestSync(SyncRequest.Visibility)));
    this._removeEventListeners.push(this.viewport.onViewedModelsChanged.addListener(() => this.requestSync(SyncRequest.Markers)));
    this._removeEventListeners.push(this.viewport.onDisposed.addListener(() => this.dispose()));

    for (const marker of markers.markers) {
      marker.onMouseEnterEvent.addListener((mkr) => this.showToolbarAfterTimeout(mkr));
      marker.onMouseButtonEvent.addListener((mkr) => this.toggleSection(mkr));
    }

    this.setMarkerVisibility();
    IModelApp.viewManager.addDecorator(this);
  }

  private dropTiledGraphicsProvider(): void {
    if (undefined === this._tiledGraphicsProvider)
      return;

    this.viewport.dropTiledGraphicsProvider(this._tiledGraphicsProvider);
    this._tiledGraphicsProvider = undefined;
  }

  private dispose(): void {
    if (!IModelApp.viewManager.dropDecorator(this))
      return;

    for (const remove of this._removeEventListeners)
      remove();

    this.dropTiledGraphicsProvider();
  }

  private showToolbarAfterTimeout(marker: SectionMarker): void {
    if (this._toolbarProvider?.marker !== marker)
      this._toolbarProvider = new MarkerToolbarProvider(marker, this);

    PopupToolbarManager.showToolbarAfterTimeout(this._toolbarProvider);
  }

  public onToolbarItemExecuted(id: string): void {
    const marker = this._toolbarProvider?.marker;
    if (!marker)
      return;

    switch (id) {
      case "toggle_section":
        this.toggleSection(marker); // tslint:disable-line:no-floating-promises
        break;
      case "align_view":
        this.alignView(marker);
        break;
      case "open_section":
        this.openSection(marker); // tslint:disable-line:no-floating-promises
        break;
      case "apply_view":
        this.applySpatialView(marker); // tslint:disable-line:no-floating-promises
        break;
      case "open_sheet":
        this.openSheet(marker); // tslint:disable-line:no-floating-promises
        break;
    }
  }

  private async toggleSection(marker: SectionMarker): Promise<void> {
    marker.isSelected = !marker.isSelected;

    ViewClipTool.enableClipVolume(this.viewport);
    ViewClipTool.setViewClip(this.viewport, marker.isSelected ? marker.state.clip : undefined);

    this._props.display.selectedOnly = marker.isSelected;
    this.requestSync(SyncRequest.Visibility);

    return this.toggleAttachment(marker);
  }

  private async toggleAttachment(marker: SectionMarker): Promise<void> {
    this.dropTiledGraphicsProvider();
    if (!marker.isSelected)
      return;

    this._tiledGraphicsProvider = await createSectionGraphicsProvider(marker.state);
    this.viewport.addTiledGraphicsProvider(this._tiledGraphicsProvider);
  }

  private alignView(marker: SectionMarker): void {
    const placement = marker.state.placement.transform;
    const origin = placement.origin;
    const matrix = placement.matrix;

    const vp = this.viewport;
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

  private async openSection(marker: SectionMarker): Promise<void> {
    const viewState = await marker.state.tryLoadDrawingView();
    if (viewState)
      this.viewport.changeView(viewState);
  }

  private async openSheet(marker: SectionMarker): Promise<void> {
    if (undefined === marker.state.viewAttachment)
      return;

    const viewState = await marker.state.tryLoadSheetView();
    if (!viewState)
      return;

    this.viewport.changeView(viewState);
    await this.viewport.zoomToElements(marker.state.viewAttachment.id);
  }

  private async applySpatialView(marker: SectionMarker): Promise<void> {
    const viewState = await marker.state.tryLoadSpatialView();
    if (viewState)
      this.viewport.changeView(viewState);
  }

  private requestSync(sync: SyncRequest): void {
    const needRequest = SyncRequest.None === this._syncRequest;
    if (this._syncRequest < sync)
      this._syncRequest = sync;

    if (needRequest)
      requestAnimationFrame(() => this.sync());
  }

  private async sync(): Promise<void> {
    const req = this._syncRequest;
    this._syncRequest = SyncRequest.None;

    switch (req) {
      case SyncRequest.Markers:
        this.dispose();
        this._props.display.selectedOnly = false;
        await SectionMarkerSetDecorator.create(this.viewport, this._props);
        break;
      case SyncRequest.Visibility:
        if (this.setMarkerVisibility()) {
          this._markers.markDirty();
          this.viewport.invalidateDecorations();
        }
        break;
    }
  }

  /** Set marker visibility based on category display */
  private setMarkerVisibility(): boolean {
    let haveVisibleChange = false;
    let haveVisibleCategory = false;
    let haveVisibleType = false;

    const vp = this.viewport;
    for (const marker of this._markers.markers) {
      const oldVisible = marker.visible;
      if (this._props.display.selectedOnly) {
        marker.visible = marker.isSelected;
      } else {
        if (marker.visible = (this._props.display.category ? vp.view.viewsCategory(marker.state.category) : true)) {
          haveVisibleCategory = true;
          if (marker.visible = this.getMarkerTypeDisplay(marker.state.sectionType))
            haveVisibleType = true;
        }
      }

      if (oldVisible !== marker.visible)
        haveVisibleChange = true;
    }

    if (!this._props.display.selectedOnly) {
      if (!haveVisibleCategory) {
        const msg = IModelApp.i18n.translate("HyperModeling:Error.NotFoundCategories");
        IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, msg, undefined, OutputMessageType.Toast));
      } else if (!haveVisibleType) {
        const msg = IModelApp.i18n.translate("HyperModeling:Error.NotFoundTypes");
        IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, msg, undefined, OutputMessageType.Toast));
      }
    }

    return haveVisibleChange;
  }

  private getMarkerTypeDisplay(type: SectionType): boolean {
    const key = propsKeyFromSectionType(type);
    return undefined !== key ? this._props.display[key] : this._props.display.section;
  }

  public setCategoryDisplay(display?: boolean): void {
    display = display ?? !this._props.display.category;
    if (display !== this._props.display.category) {
      this._props.display.category = display;
      this.requestSync(SyncRequest.Visibility);
    }
  }

  public setModelDisplay(display?: boolean): void {
    display = display ?? !this._props.display.model;
    if (display !== this._props.display.model) {
      this._props.display.model = display;
      this.requestSync(SyncRequest.Markers);
    }
  }

  public static setDefaultCategoryDisplay(display?: boolean): void {
    this.defaultProps.display.category = display ?? !this.defaultProps.display.category;
  }

  public static setDefaultModelDisplay(display?: boolean): void {
    this.defaultProps.display.model = display ?? !this.defaultProps.display.model;
  }

  public setMarkerTypeDisplay(type: SectionType, display?: boolean): void {
    SectionMarkerSetDecorator.setMarkerTypeDisplayForProps(type, display, this._props);
    this.requestSync(SyncRequest.Visibility);
  }

  public static setDefaultMarkerTypeDisplay(type: SectionType, display?: boolean): void {
    this.setMarkerTypeDisplayForProps(type, display, this.defaultProps);
  }

  private static setMarkerTypeDisplayForProps(type: SectionType, display: boolean | undefined, props: SectionMarkerSetDecoratorProps): void {
    const key = propsKeyFromSectionType(type);
    if (undefined === key)
      return;

    if (undefined === display)
      display = !props.display[key];

    props.display[key] = display;
  }
}
