/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { BeEvent } from "@itwin/core-bentley";
import { createButton, createComboBox } from "@itwin/frontend-devtools";
import { ClipPlane, ClipPrimitive, ClipVector, ConvexClipPlaneSet, Point3d, Vector3d } from "@itwin/core-geometry";
import { ModelClipGroup, ModelClipGroups } from "@itwin/core-common";
import { AccuDrawHintBuilder, IModelApp, ScreenViewport, ViewClipDecorationProvider, Viewport } from "@itwin/core-frontend";
import { ToolBarDropDown } from "./ToolBar";

function setFocusToHome(): void {
  const element = document.activeElement as HTMLElement;
  if (element && element !== document.body) {
    element.blur();
    document.body.focus();
  }
}

export class SectionsPanel extends ToolBarDropDown {
  private readonly _vp: ScreenViewport;
  private readonly _element: HTMLElement;
  private _toolName = "ViewClip.ByPlane";

  public constructor(vp: ScreenViewport, parent: HTMLElement) {
    super();
    this._vp = vp;
    this._element = IModelApp.makeHTMLElement("div", { className: "toolMenu", parent });
    this._element.style.cssFloat = "left";
    this._element.style.display = "block";

    createComboBox({
      parent: this._element,
      id: "section_Type",
      name: "Clip type: ",
      value: this._toolName,
      handler: (select: HTMLSelectElement) => this._toolName = select.value,
      entries: [
        { name: "Plane", value: "ViewClip.ByPlane" },
        { name: "Range", value: "ViewClip.ByRange" },
        { name: "Element", value: "ViewClip.ByElement" },
        { name: "Shape", value: "ViewClip.ByShape" },
      ],
    });

    const div = IModelApp.makeHTMLElement("div", { parent: this._element });
    div.style.textAlign = "center";
    createButton({
      value: "Define",
      handler: async () => { await IModelApp.tools.run(this._toolName, ViewClipDecorationProvider.create()); setFocusToHome(); },
      parent: div,
      inline: true,
      tooltip: "Define clip",
    });
    createButton({
      value: "Edit",
      handler: async () => ViewClipDecorationProvider.create().toggleDecoration(this._vp),
      parent: div,
      inline: true,
      tooltip: "Show clip edit handles",
    });
    createButton({
      value: "Clear",
      handler: async () => IModelApp.tools.run("ViewClip.Clear", ViewClipDecorationProvider.create()),
      parent: div,
      inline: true,
      tooltip: "Clear clips",
    });

    let negate = false;
    createButton({
      value: "Add Panel",
      handler: () => {
        // Add Clip Model Group UI
        const props: DividingLineProps = {
          sideL: vp.getClientRect().width / 2,
          bounds: vp.getClientRect(),
          buffer: 10,
          parent: vp.canvas.parentElement!,
          onDragged: (left, _right) => ModelClipTool.applyModelClipping(vp, new Point3d(left, (vp.getClientRect().height / 2), 0), negate),
        };
        const divider = new TwoPanelDivider(props);
        divider.dividerElem.style.zIndex = "10";
      },
      parent: div,
      inline: false,
      tooltip: "Add Panels",
    });
    createButton({
      value: "Negate Plane",
      handler: () => { negate = !negate; },
      parent: div,
      inline: true,
      tooltip: "Negate Plane",
    });
  }

  protected _open(): void { this._element.style.display = "block"; }
  protected _close(): void { this._element.style.display = "none"; }
  public get isOpen(): boolean { return "block" === this._element.style.display; }
}

class ModelClipTool {
  private static _leftModels: string[] = [];
  private static _rightModels: string[] = [];
  public static applyModelClipping(vp: Viewport, clipPoint: Point3d, negate: boolean): void {
    const view = vp.view;
    if (!view || !view.isSpatialView())
      return;
    const createClip = (vector: Vector3d, p: Point3d) => {
      const plane = ClipPlane.createNormalAndPoint(vector, p)!;
      const planes = ConvexClipPlaneSet.createPlanes([plane]);
      const primitive = ClipPrimitive.createCapture(planes);
      return ClipVector.createCapture([primitive]);
    };

    let point = clipPoint.clone();
    point = vp.viewToWorld(point);

    const boresite = AccuDrawHintBuilder.getBoresite(point, vp);
    const viewY = vp.rotation.rowY();
    let normal = viewY.crossProduct(boresite.direction);

    let left = true;
    if (this._leftModels.length === 0 && this._rightModels.length === 0)
      view.modelSelector.models.forEach((id) => {
        (left ? this._leftModels : this._rightModels).push(id);
        left = !left;
      });
    if (negate) normal = normal.negate();
    view.details.modelClipGroups = new ModelClipGroups([
      ModelClipGroup.create(createClip(normal, point), this._rightModels),
      ModelClipGroup.create(createClip(normal.negate(), point), this._leftModels),
    ]);
    vp.invalidateScene();
  }
}

export interface DividingLineProps {
  bounds: DOMRect;
  onDragged?: (leftPanelWidth: number, rightPanelWidth: number) => void;
  buffer?: number;
  sideL?: number;
  sideR?: number;
  parent?: HTMLElement;
  id?: string;
}

export class TwoPanelDivider {
  private limitToBounds(n: number): number {
    n = Math.min(n, this._bounds.right - (this.dividerElem.clientWidth + this._buffer));
    n = Math.max(n, this._bounds.left + this._buffer);
    return n;
  }

  private _buffer: number;
  private _bounds: DOMRect;
  private _oldPosition: number = 0;

  public dividerElem: HTMLElement;
  public onDraggedEvent: BeEvent<(leftPanelWidth: number, rightPanelWidth: number) => void>;

  public setDivider(left: number): void {
    this.dividerElem.style.left = `${left}px`;
  }

  public updateBounds(rect: DOMRect): void {
    this.dividerElem.style.top = `${rect.top}px`;
    this.dividerElem.style.height = `${rect.height}px`;
  }

  constructor(props: DividingLineProps) {
    this._bounds = props.bounds;
    this._buffer = undefined === props.buffer ? 0 : props.buffer;
    this.onDraggedEvent = new BeEvent<(leftPanelWidth: number, rightPanelWidth: number) => void>();

    let left: number;
    if (undefined !== props.sideL)
      left = props.sideL;
    else if (undefined !== props.sideR)
      left = props.bounds.width - props.sideR;
    else
      left = props.bounds.width / 2;

    this.dividerElem = IModelApp.makeHTMLElement("div");
    this.dividerElem.setAttribute("style", "width: 4px; position: fixed; display: flex; background-color: #f1f1f1; border: 1px solid #d3d3d3; /*dde0e3*/ pointer-events: visible;");

    if (props.id !== undefined)
      this.dividerElem.id = props.id;

    this.updateBounds(this._bounds);
    this.setDivider(left);
    this.dividerElem.onmousedown = this._mouseDownDraggable;
    if (props.parent)
      props.parent.appendChild(this.dividerElem);

    const handle = IModelApp.makeHTMLElement("div");
    handle.setAttribute("style", "position: relative;  box-shadow: 0px 1px 5px 0px rgba(0, 0, 0, 0.25);  left: -10px;  padding: 12px;  height: 32px;  border-radius: 1.5px;  cursor: col-resize;  align-self: center;  background-color: #69ade3; /* dde0e3 */  /* dots c8ccd0*/  color: #fff;");
    this.dividerElem.appendChild(handle);

    if (props.onDragged)
      this.onDraggedEvent.addListener(props.onDragged);
  }

  private _mouseDownDraggable = (e: MouseEvent) => {
    e.preventDefault();
    document.addEventListener("mousemove", this._mouseMoveDraggable);
    document.addEventListener("mouseup", this._mouseUpDraggable);
    this._oldPosition = e.clientX;
  };

  private _mouseMoveDraggable = (e: MouseEvent) => {
    e.preventDefault();
    if (undefined === this.dividerElem) return;

    const newPosition = this.limitToBounds(this.dividerElem.offsetLeft - (this._oldPosition - e.clientX));
    this._oldPosition = this.limitToBounds(e.clientX);

    this.setDivider(newPosition);

    const left = newPosition - this._bounds.left;
    const right = this._bounds.right - left - this.dividerElem.clientWidth;
    this.onDraggedEvent.raiseEvent(left, right);
  };

  private _mouseUpDraggable = (_e: MouseEvent) => {
    document.removeEventListener("mousemove", this._mouseMoveDraggable);
    document.removeEventListener("mouseup", this._mouseUpDraggable);
  };
}
