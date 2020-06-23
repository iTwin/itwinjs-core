/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module HyperModeling
 */

import { assert, BeEvent } from "@bentley/bentleyjs-core";
import { Point2d, Point3d, XAndY, XYAndZ } from "@bentley/geometry-core";
import { IModelReadRpcInterface } from "@bentley/imodeljs-common";
import {
  BeButton, BeButtonEvent, Cluster, DecorateContext, IModelApp, InputSource, Marker, MarkerImage, MarkerSet, ScreenViewport, ViewClipTool,
} from "@bentley/imodeljs-frontend";
import { AbstractToolbarProps, BadgeType } from "@bentley/ui-abstract";
import { SectionDrawingLocationState } from "./SectionDrawingLocationState";
import { HyperModeling } from "./HyperModelingApi";

const markerSize = Point2d.create(40, 40);

/** A [Marker]($frontend) associated with a [[SectionDrawingLocationState]], displayed as a canvas decoration at the location of the section.
 * Clicking on the marker toggles display of the section graphics. Mousing over the marker produces a toolbar with additional interactions.
 * @see [[SectionMarkerSetDecorator]]
 * @beta
 */
export class SectionMarker extends Marker {
  /** @internal */
  public isSelected = false;
  /** The section drawing location state associated with the marker. */
  public readonly state: SectionDrawingLocationState;
  /** A description displayed as part of the tooltip when this marker is clustered with other markers. */
  public readonly description: string;
  /** @internal */
  public readonly onMouseEnterEvent = new BeEvent<(marker: SectionMarker) => void>();
  /** @internal */
  public readonly onMouseButtonEvent = new BeEvent<(marker: SectionMarker) => void>();

  /** Constructor. Typically invoked indirectly via [[SectionMarkerSetDecorator]].
   * @param state The section drawing location state this marker will represent.
   * @param pos The world coordinates at which to display the marker.
   * @param description A brief description of this marker, used as part of the tooltip when this marker is part of a cluster.
   * @param icon The icon displayed by the marker.
   * @param tooltip Optional detailed tooltip displayed on mouse hover. If undefined, the `description` is used instead.
   */
  public constructor(state: SectionDrawingLocationState) {
    super(state.placement.origin.clone(), markerSize);
    this.state = state;

    const data = HyperModeling.getMarkerData(state.sectionType);
    this.description = data.label;
    if (data.image)
      this.setImage(data.image);

    this.setScaleFactor({ low: .2, high: 1.4 }); // make size 20% at back of frustum and 140% at front of frustum (if camera is on)
  }

  /** @internal */
  public get isHilited(): boolean { return this._isHilited; }

  /** @internal */
  protected drawSelected(ctx: CanvasRenderingContext2D) {
    ctx.shadowBlur = 30;
    ctx.shadowColor = "gold";
    return false;
  }

  /** @internal */
  public drawDecoration(ctx: CanvasRenderingContext2D): void {
    if (!this.isSelected || !this.drawSelected(ctx))
      super.drawDecoration(ctx);
  }

  /** @internal */
  public onMouseEnter(ev: BeButtonEvent) {
    // Lazily load the tooltip.
    if (undefined === this.title) {
      IModelReadRpcInterface.getClient().getToolTipMessage(this.state.iModel.getRpcProps(), this.state.id).then((tooltipMsg) => {
        this.title = IModelApp.formatElementToolTip(tooltipMsg);
      }).catch((_) => {
        this.title = this.description;
      });
    }

    super.onMouseEnter(ev);
    this.onMouseEnterEvent.raiseEvent(this);
  }

  /** @internal */
  public onMouseButton(ev: BeButtonEvent): boolean {
    if (InputSource.Mouse === ev.inputSource && BeButton.Data === ev.button && ev.isDown && ev.viewport)
      this.onMouseButtonEvent.raiseEvent(this);

    return true; // Don't allow clicks to be sent to active tool...
  }

  /** @internal */
  public addMarker(context: DecorateContext) {
    super.addMarker(context);
    if (this.isHilited)
      ViewClipTool.drawClip(context, this.state.clip, undefined, { fillClipPlanes: true, hasPrimaryPlane: true });
  }

  /** ###TODO Move elsewhere for customization.
   * @internal
   */
  public getToolbarProps(): AbstractToolbarProps {
    const i18n = IModelApp.i18n;
    return {
      items: [
        {
          id: "toggle_section",
          itemPriority: 10,
          label: i18n.translate("HyperModeling:Message.ToggleSection"),
          icon: "icon-section-tool",
          badgeType: BadgeType.None,
          execute: () => { },
        },
        {
          id: "align_view",
          itemPriority: 20,
          label: i18n.translate("HyperModeling:Message.AlignSection"),
          icon: "icon-plane",
          badgeType: BadgeType.None,
          execute: () => { },
        },
        {
          id: "apply_view",
          itemPriority: 40,
          label: i18n.translate("HyperModeling:Message.ApplyView"),
          icon: "icon-3d",
          badgeType: BadgeType.New,
          execute: () => { },
          isDisabled: false,
        },
        {
          id: "open_section",
          itemPriority: 30,
          label: i18n.translate("HyperModeling:Message.OpenSection"),
          icon: "icon-2d",
          badgeType: BadgeType.None,
          execute: () => { },
          isDisabled: false,
        },
        {
          id: "open_sheet",
          itemPriority: 30,
          label: i18n.translate("HyperModeling:Message.OpenSheet"),
          icon: "icon-boundary-offset",
          badgeType: BadgeType.New,
          execute: () => { },
          isDisabled: undefined === this.state.viewAttachment?.viewId,
        },
      ],
    };
  }
}

/** A Marker used to show a cluster of section locations.
 * @internal
 */
export class SectionMarkerCluster extends Marker {
  /** Create a new cluster marker */
  constructor(location: XYAndZ, size: XAndY, cluster: Cluster<SectionMarker>, image: Promise<MarkerImage>) {
    super(location, size);

    this.imageOffset = new Point3d(0, 30);
    this.label = cluster.markers.length.toLocaleString();
    this.labelColor = "black";
    this.labelFont = "bold 14px sans-serif";

    const maxLen = 10;
    let title = "";
    cluster.markers.forEach((marker, index: number) => {
      if (index < maxLen) {
        if (title !== "")
          title += "<br>";
        title += marker.description;
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

/** A [MarkerSet]($frontend) containing [[SectionMarker]]s identifying [SectionDrawingLocation]($backend)s within a spatial view.
 * @see [[SectionMarkerSetDecorator]]
 * @beta
 */
export class SectionMarkerSet extends MarkerSet<SectionMarker> {
  public minimumClusterSize = 5;

  /** Constructor
   * @param viewport The viewport in which the markers are to be displayed.
   * @param markers The markers to be displayed.
   * @note Each marker's [[SectionDrawingLocationState]] must be associated with the same [IModelConnection]($frontend) as the viewport; if not, it will be ignored.
   */
  public constructor(viewport: ScreenViewport, markers: SectionMarker[]) {
    super(viewport);
    for (const marker of markers) {
      if (marker.state.iModel === viewport.iModel)
        this.markers.add(marker);
    }
  }

  /** The viewport in which the markers are to be displayed. */
  public get viewport(): ScreenViewport {
    assert(undefined !== super.viewport);
    return super.viewport;
  }

  /** @internal */
  protected getClusterMarker(cluster: Cluster<SectionMarker>): Marker {
    return SectionMarkerCluster.makeFrom(cluster.markers[0], cluster, cluster.markers[0].image);
  }
}
