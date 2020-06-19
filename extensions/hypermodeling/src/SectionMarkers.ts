/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import {
  assert,
  BeEvent,
} from "@bentley/bentleyjs-core";
import {
  Point2d,
  Point3d,
  XAndY,
  XYAndZ,
} from "@bentley/geometry-core";
import { I18N } from "@bentley/imodeljs-i18n";
import {
  BeButton,
  BeButtonEvent,
  Cluster,
  DecorateContext,
  InputSource,
  Marker,
  MarkerImage,
  MarkerSet,
  ScreenViewport,
  ViewClipTool,
} from "@bentley/imodeljs-frontend";
import {
  AbstractToolbarProps,
  BadgeType,
} from "@bentley/ui-abstract";

import { SectionLocationState } from "./SectionLocationState";

const markerSize = Point2d.create(40, 40);

/** Marker to show a section location. */
export class SectionMarker extends Marker {
  public isSelected = false;
  public readonly state: SectionLocationState;
  public readonly description: string;
  public readonly onMouseEnterEvent = new BeEvent<(marker: SectionMarker) => void>();
  public readonly onMouseButtonEvent = new BeEvent<(marker: SectionMarker) => void>();

  public constructor(state: SectionLocationState, pos: Point3d, description: string, icon: HTMLImageElement, tooltip: HTMLElement | undefined) {
    super(pos, markerSize);
    this.state = state;

    this.setImage(icon);
    this.title = tooltip ?? description;
    this.description = description;
    this.setScaleFactor({ low: .2, high: 1.4 }); // make size 20% at back of frustum and 140% at front of frustum (if camera is on)
  }

  public get isHilited(): boolean { return this._isHilited; }

  protected drawSelected(ctx: CanvasRenderingContext2D) {
    ctx.shadowBlur = 30;
    ctx.shadowColor = "gold";
    return false;
  }

  public drawDecoration(ctx: CanvasRenderingContext2D): void {
    if (!this.isSelected || !this.drawSelected(ctx))
      super.drawDecoration(ctx);
  }

  public onMouseEnter(ev: BeButtonEvent) {
    super.onMouseEnter(ev);
    this.onMouseEnterEvent.raiseEvent(this);
  }

  public onMouseButton(ev: BeButtonEvent): boolean {
    if (InputSource.Mouse === ev.inputSource && BeButton.Data === ev.button && ev.isDown && ev.viewport)
      this.onMouseButtonEvent.raiseEvent(this);

    return true; // Don't allow clicks to be sent to active tool...
  }

  public addMarker(context: DecorateContext) {
    super.addMarker(context);
    if (this.isHilited)
      ViewClipTool.drawClip(context, this.state.clip, undefined, { fillClipPlanes: true, hasPrimaryPlane: true });
  }

  public getToolbarProps(i18n: I18N): AbstractToolbarProps {
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

/** A Marker used to show a cluster of section locations. */
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

/** A MarkerSet to hold section locations. This class supplies to `getClusterMarker` method to create SectionMarkerCluster. */
export class SectionMarkerSet extends MarkerSet<SectionMarker> {
  public minimumClusterSize = 5;

  public get viewport(): ScreenViewport {
    assert(undefined !== super.viewport);
    return super.viewport;
  }
  protected getClusterMarker(cluster: Cluster<SectionMarker>): Marker { return SectionMarkerCluster.makeFrom(cluster.markers[0], cluster, cluster.markers[0].image); }
}
