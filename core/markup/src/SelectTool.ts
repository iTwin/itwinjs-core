/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module MarkupTools */

import { Point2d, Point3d, Transform, XAndY } from "@bentley/geometry-core";
import { BeButtonEvent, BeModifierKeys, EventHandled, IModelApp, InputSource } from "@bentley/imodeljs-frontend";
import { ArrayXY, Box, Circle, Container, Element as MarkupElement, G, Line, Matrix, Point, Polygon, Text as MarkupText } from "@svgdotjs/svg.js";
import { MarkupApp } from "./Markup";
import { MarkupTool } from "./MarkupTool";
import { EditTextTool } from "./TextEdit";
import { UndoManager } from "./Undo";
import { BeEvent } from "@bentley/bentleyjs-core";

/** Classes added to HTMLElements so they can be customized in CSS by applications.
 * A "modify handle" is a visible position on the screen that provides UI to modify a MarkupElement.
 * @beta
 */
export abstract class ModifyHandle {
  public vbToStartTrn!: Transform;

  constructor(public handles: Handles) { }
  /** perform the modification given a current mouse position. */
  public abstract modify(ev: BeButtonEvent): void;
  public onClick(_ev: BeButtonEvent) { }

  /** set the position for this handle on the screen given the current state of the element */
  public abstract setPosition(): void;
  /** the mouse just went down on this handle, begin modification. */
  public startDrag(_ev: BeButtonEvent, makeCopy = false): void {
    this.vbToStartTrn = this.handles.vbToBoxTrn.clone(); // save the starting vp -> element box transform
    this.startModify(makeCopy);
  }
  public startModify(makeCopy: boolean) {
    const handles = this.handles;
    const el = handles.el;
    const cloned = handles.el = el.cloneMarkup(); // make a clone of this element
    if (makeCopy) {
      el.after(cloned);
    } else {
      cloned.originalEl = el; // save original for undo
      el.replace(cloned); // put it into the DOM in place of the original
    }
  }
  public setMouseHandler(target: MarkupElement) {
    const node = target.node;
    node.onmousedown = (ev: MouseEvent) => {
      if (ev.button === 0 && undefined === this.handles.active)
        this.handles.active = this;
    };
    node.ontouchstart = (_ev: TouchEvent) => {
      if (undefined === this.handles.active)
        this.handles.active = this;
    };
  }
}

/** A ModifyHandle that changes the size of the element
 * @beta
 */
class StretchHandle extends ModifyHandle {
  private readonly _circle: Circle;
  public posNpc: Point2d;
  public startPos!: Point2d;
  public opposite!: Point2d;
  public startBox!: Box;
  public startCtm!: Matrix;
  constructor(handles: Handles, xy: ArrayXY, cursor: string) {
    super(handles);
    this.posNpc = new Point2d(xy[0], xy[1]);
    const props = MarkupApp.props.handles;
    this._circle = handles.group!.circle(props.size).addClass(MarkupApp.stretchHandleClass) // the visible "circle" for this handle
      .attr(props.stretch).attr("cursor", cursor + "-resize");
    this.setMouseHandler(this._circle);
  }
  public setPosition() {
    const pt = this.handles.npcToVb(this.posNpc); // convert to viewbox coords
    this._circle.center(pt.x, pt.y);
  }

  public startDrag(_ev: BeButtonEvent) {
    const handles = this.handles;
    this.startCtm = handles.el.screenCTM().lmultiplyO(MarkupApp.screenToVbMtx);
    this.startBox = handles.el.bbox(); // save starting size so we can preserve aspect ratio
    this.startPos = handles.npcToBox(this.posNpc);
    this.opposite = handles.npcToBox({ x: 1 - this.posNpc.x, y: 1 - this.posNpc.y });
    super.startDrag(_ev);
  }

  /** perform the stretch. Always stretch element with anchor at the opposite corner of the one being moved. */
  public modify(ev: BeButtonEvent): void {
    const evPt = MarkupApp.convertVpToVb(ev.viewPoint); // get cursor location in viewbox coords
    const diff = this.startPos.vectorTo(this.vbToStartTrn.multiplyPoint2d(evPt)); // movement of cursor from start, in viewbox coords
    const diag = this.startPos.vectorTo(this.opposite).normalize()!; // vector from opposite corner to this handle
    const diagVec = diag.scaleToLength(diff.dotProduct(diag)); // projected distance along diagonal

    // if the shift key is down, don't preserve aspect ratio
    const adjusted = ev.isShiftKey ? { x: diff.x, y: diff.y } : { x: diagVec.x, y: diagVec.y };
    let { x, y, h, w } = this.startBox;
    if (this.posNpc.x === 0) {
      x += adjusted.x;      // left edge
      w -= adjusted.x;
    } else if (this.posNpc.x === 1) {
      w += adjusted.x;      // right edge
    }
    if (this.posNpc.y === 0) {
      y += adjusted.y;      // top edge
      h -= adjusted.y;
    } else if (this.posNpc.y === 1) {
      h += adjusted.y;      // bottom edge
    }
    const mtx = this.startCtm.inverse().scaleO(this.startBox.w / w, this.startBox.h / h, this.opposite.x, this.opposite.y).inverseO();
    const minSize = 10;
    if (w > minSize && h > minSize)   // don't let element get too small
      this.handles.el.markupStretch(w, h, x, y, mtx);
  }
}

/** A ModifyHandle to rotate an element
 * @beta
 */
class RotateHandle extends ModifyHandle {
  private readonly _line: Line;
  private readonly _circle: Circle;
  public location!: Point2d;

  constructor(public handles: Handles) {
    super(handles);
    const props = MarkupApp.props.handles;

    this._line = handles.group!.line(0, 0, 1, 1).attr(props.rotateLine).addClass(MarkupApp.rotateLineClass);
    this._circle = handles.group!.circle(props.size * 1.25).attr(props.rotate).addClass(MarkupApp.rotateHandleClass);
    this.setMouseHandler(this._circle);
  }
  public get centerVb() { return this.handles.npcToVb({ x: .5, y: .5 }); }
  public get anchorVb() { return this.handles.npcToVb({ x: .5, y: 0 }); }
  public setPosition(): void {
    const anchor = this.anchorVb;
    const dir = this.centerVb.vectorTo(anchor).normalize()!;
    const loc = this.location = anchor.plusScaled(dir, MarkupApp.props.handles.size * 3);
    this._line.plot(anchor.x, anchor.y, loc.x, loc.y);
    this._circle.center(loc.x, loc.y);
  }
  public modify(ev: BeButtonEvent): void {
    const centerVp = this.centerVb;
    const currDir = centerVp.vectorTo(MarkupApp.convertVpToVb(ev.viewPoint));
    const dir = centerVp.vectorTo(this.location);
    this.handles.el.rotate(dir.angleTo(currDir).degrees);
  }
}

/** A VertexHandle to move a point on a line
 * @beta
 */
class VertexHandle extends ModifyHandle {
  private readonly _circle: Circle;
  private readonly _x: string;
  private readonly _y: string;

  constructor(public handles: Handles, index: number) {
    super(handles);
    const props = MarkupApp.props.handles;
    this._circle = handles.group!.circle(props.size).attr(props.vertex).addClass(MarkupApp.vertexHandleClass);
    this._x = "x" + (index + 1);
    this._y = "y" + (index + 1);
    this.setMouseHandler(this._circle);
  }
  public setPosition(): void {
    let point = new Point(this.handles.el.attr(this._x), this.handles.el.attr(this._y));
    const matrix = this.handles.el.screenCTM().lmultiplyO(MarkupApp.screenToVbMtx);
    point = point.transform(matrix);
    this._circle.center(point.x, point.y);
  }
  public modify(ev: BeButtonEvent): void {
    let point = new Point(ev.viewPoint.x, ev.viewPoint.y);
    const matrix = this.handles.el.screenCTM().inverseO().multiplyO(MarkupApp.getVpToScreenMtx());
    point = point.transform(matrix);
    const el = this.handles.el;
    el.attr(this._x, point.x);
    el.attr(this._y, point.y);
  }
}

/** A handle that moves (translates) an element.
 * @beta
 */
class MoveHandle extends ModifyHandle {
  private readonly _shape: MarkupElement;
  private readonly _outline?: Polygon;
  private _lastPos?: Point3d;
  constructor(public handles: Handles, showBBox: boolean) {
    super(handles);
    const props = MarkupApp.props.handles;
    const clone = this.handles.el.cloneMarkup();
    clone.css(props.move);
    clone.forElementsOfGroup((child) => child.css(props.move));

    if (showBBox) {
      this._outline = handles.group.polygon().attr(props.moveOutline);
      const rect = this.handles.el.getOutline().attr(props.move).attr({ fill: "none" });

      const group = handles.group.group();
      group.add(this._outline);
      group.add(rect);
      group.add(clone);
      this._shape = group;
    } else {
      clone.addTo(handles.group);
      this._shape = clone;
    }

    this._shape.addClass(MarkupApp.moveHandleClass);
    this.setMouseHandler(this._shape);
  }
  public onClick(_ev: BeButtonEvent) {
    const el = this.handles.el;
    if (el instanceof MarkupText || (el instanceof G && el.node.className.baseVal === MarkupApp.boxedTextClass)) // if they click on the move handle of a text element, start the text editor
      new EditTextTool(el).run();
  }
  /*** draw the outline of the element's bbox (in viewbox coordinates) */
  public setPosition() {
    if (undefined !== this._outline) {
      const pts = [new Point2d(0, 0), new Point2d(0, 1), new Point2d(1, 1), new Point2d(1, 0)];
      this._outline.plot(this.handles.npcToVbArray(pts).map((pt) => [pt.x, pt.y] as ArrayXY));
    }
  }
  public startDrag(ev: BeButtonEvent) {
    super.startDrag(ev, ev.isShiftKey);
    this._lastPos = MarkupApp.convertVpToVb(ev.viewPoint); // save stating position in viewbox coordinates
  }
  public modify(ev: BeButtonEvent): void {
    const evPt = MarkupApp.convertVpToVb(ev.viewPoint);
    const dist = evPt.minus(this._lastPos!);
    this._lastPos = evPt;
    this.handles.el.translate(dist.x, dist.y); // move the element
  }
}

/** The set of ModifyHandles active. Only applies if there is a single element selected.
 * @beta
 */
export class Handles {
  public readonly handles: ModifyHandle[] = [];
  public active?: ModifyHandle;
  public dragging = false;
  public group: G;
  public npcToVbTrn!: Transform;
  public vbToBoxTrn!: Transform;

  constructor(public ss: MarkupSelected, public el: MarkupElement) {
    this.group = ss.svg.group();

    if (el instanceof Line) {
      this.handles.push(new MoveHandle(this, false));
      this.handles.push(new VertexHandle(this, 0));
      this.handles.push(new VertexHandle(this, 1));
      this.draw(); // show starting state
      return;
    }

    // move box is in the back
    this.handles.push(new MoveHandle(this, true));
    // then rotate handle
    this.handles.push(new RotateHandle(this));

    // then add all the stretch handles
    const pts = [[0, 0], [0, .5], [0, 1], [.5, 1], [1, 1], [1, .5], [1, 0], [.5, 0]];
    const cursors = ["nw", "w", "sw", "s", "se", "e", "ne", "n"];
    const angle = el.screenCTM().decompose().rotate || 0;
    const start = Math.round(-angle / 45); // so that we rotate the cursors for rotated elements
    pts.forEach((h, i) => this.handles.push(new StretchHandle(this, h as ArrayXY, cursors[(i + start + 8) % 8])));
    this.draw(); // show starting state
  }

  public npcToBox(p: XAndY) { const pt = this.npcToVb(p); return this.vbToBox(pt, pt); }
  public npcToVb(p: XAndY, result?: Point2d): Point2d { return this.npcToVbTrn.multiplyPoint2d(p, result); }
  public vbToBox(p: XAndY, result?: Point2d): Point2d { return this.vbToBoxTrn.multiplyPoint2d(p, result); }
  public npcToVbArray(pts: Point2d[]): Point2d[] { pts.forEach((pt) => this.npcToVb(pt, pt)); return pts; }

  public draw() {
    const el = this.el;
    const bb = el.bbox();
    const ctm = el.screenCTM().lmultiplyO(MarkupApp.screenToVbMtx);
    this.vbToBoxTrn = ctm.inverse().toIModelTransform();
    this.npcToVbTrn = new Matrix().scaleO(bb.w, bb.h).translateO(bb.x, bb.y).lmultiplyO(ctm).toIModelTransform();
    this.handles.forEach((h) => h.setPosition());
  }

  public remove() {
    if (this.dragging)
      this.cancelDrag();
    this.group.remove();
  }

  public startDrag(ev: BeButtonEvent): EventHandled {
    if (this.active) {
      this.active.startDrag(ev);
      this.dragging = true;
      MarkupApp.markup!.disablePick();
      IModelApp.toolAdmin.setCursor(IModelApp.viewManager.dynamicsCursor);
    }
    return EventHandled.Yes;
  }
  public drag(ev: BeButtonEvent) {
    if (this.dragging) {
      this.active!.modify(ev);
      this.draw();
    }
  }
  /** complete the modification for the active handle. */
  public endDrag(undo: UndoManager): EventHandled {
    undo.doGroup(() => {
      const el = this.el;
      const original = el.originalEl!; // save original element
      if (original === undefined) {
        this.ss.emptyAll();
        this.ss.add(el);
        undo.onAdded(el);
      } else {
        el.originalEl = undefined; // clear original element
        undo.onModified(el, original);
      }
    });
    this.draw();
    this.dragging = false;
    this.active = undefined;
    MarkupApp.markup!.enablePick();
    return EventHandled.Yes;
  }

  /** called when the reset button is pressed. */
  public cancelDrag() {
    if (!this.dragging)
      return;
    const el = this.el;
    const original = el.originalEl!;
    if (original) {
      el.replace(original);
      this.el = original;
    }
    this.draw();
    this.active = undefined;
    MarkupApp.markup!.enablePick();
  }
}

/** The set of currently selected SVG elements. When elements are added to the set, they are hilited.
 * @beta
 */
export class MarkupSelected {
  public readonly elements = new Set<MarkupElement>();
  public handles?: Handles;

  /** Called whenever elements are added or removed from this SelectionSet */
  public readonly onChanged = new BeEvent<(selected: MarkupSelected) => void>();

  public get size() { return this.elements.size; }
  public get isEmpty() { return this.size === 0; }
  public has(el: MarkupElement) { return this.elements.has(el); }
  public emptyAll(): void {
    this.clearEditors();
    if (this.isEmpty)
      return; // Don't send onChanged if already empty.
    this.elements.forEach((el) => el.unHilite());
    this.elements.clear();
    this.onChanged.raiseEvent(this);
  }
  public restart(el?: MarkupElement) {
    this.emptyAll();
    if (el) this.add(el);
  }
  public constructor(public svg: G) { }
  public clearEditors() {
    if (this.handles) {
      this.handles.remove();
      this.handles = undefined;
    }
  }
  public sizeChanged() {
    this.clearEditors();
    if (this.elements.size === 1)
      this.handles = new Handles(this, this.elements.values().next().value);
    this.onChanged.raiseEvent(this);
  }
  /** Add a new element to the SS */
  public add(el: MarkupElement) {
    this.elements.add(el);
    el.hilite();
    this.sizeChanged();
  }
  /** Remove an element from the selection set and unhilite it.
   * @returns true if the element was in the SS and was removed.
   */
  public drop(el: MarkupElement): boolean { el.unHilite(); return this.elements.delete(el) ? (this.sizeChanged(), true) : false; }
  /** Replace an entry in the selection set with a different element. */
  public replace(oldEl: MarkupElement, newEl: MarkupElement) { if (this.drop(oldEl)) this.add(newEl); }

  public deleteAll(undo: UndoManager) {
    undo.doGroup(() => this.elements.forEach((el) => { undo.onDelete(el); el.remove(); }));
    this.emptyAll();
  }

  public groupAll(undo: UndoManager) {
    if (this.size < 2)
      return;
    const first = this.elements.values().next().value;
    const parent = first.parent() as Container;
    const group = parent.group();

    const ordered: MarkupElement[] = [];
    this.elements.forEach((el) => { ordered.push(el); });
    ordered.sort((lhs, rhs) => parent.index(lhs) - parent.index(rhs)); // Preserve relative z ordering

    undo.doGroup(() => {
      ordered.forEach((el) => {
        const oldParent = el.parent() as MarkupElement;
        const oldPos = el.position();
        el.unHilite(); undo.onRepositioned(el.addTo(group), oldPos, oldParent);
      }), undo.onAdded(group);
    });
    this.restart(group);
  }

  public ungroupAll(undo: UndoManager) {
    const groups = new Set<MarkupElement>();
    this.elements.forEach((el) => { if (el instanceof G) groups.add(el); });
    if (0 === groups.size)
      return;
    undo.doGroup(() => {
      groups.forEach((g) => {
        g.unHilite(); this.elements.delete(g); undo.onDelete(g);
        g.each((index, children) => { const child = children[index]; const oldPos = child.position(); child.toParent(g.parent()); undo.onRepositioned(child, oldPos, g); }, false);
        g.untransform(); // Don't want undo of ungroup to push the current group transform...
        g.remove();
      });
    });
    this.sizeChanged();
  }

  /** Move all of the entries to a new position in the DOM via a callback. */
  public reposition(undo: UndoManager, fn: (el: MarkupElement) => void) {
    undo.doGroup(() => this.elements.forEach((el) => {
      const oldParent = el.parent() as MarkupElement;
      const oldPos = el.position();
      fn(el);
      undo.onRepositioned(el, oldPos, oldParent);
    }));
    this.sizeChanged();
  }
}

/** Provides UI for selection, delete, move, copy, bring-to-front, send-to-back, etc. for Markup SVG elements
 * @beta
 */
export class SelectTool extends MarkupTool {
  public static toolId = "Markup.Select";
  private _flashedElement?: MarkupElement;
  private readonly _dragging: MarkupElement[] = [];
  private _anchorPt!: Point3d;

  public get flashedElement(): MarkupElement | undefined { return this._flashedElement; }
  public set flashedElement(el: MarkupElement | undefined) {
    if (el === this._flashedElement) return;
    if (undefined !== this._flashedElement) this._flashedElement.unFlash();
    if (undefined !== el) el.flash();
    this._flashedElement = el;
  }
  private initSelect() {
    this.markup.setCursor("default");
    this.markup.enablePick();
    this.flashedElement = undefined;
  }
  private clearSelect() {
    this.cancelDrag();
    this.markup.selected.emptyAll();
  }
  public onCleanup(): void { this.clearSelect(); }
  protected showPrompt(): void { this.outputMarkupPrompt("Select.Prompts.IdentifyMarkup"); }
  public onPostInstall() { this.initSelect(); super.onPostInstall(); }
  public onRestartTool(): void { this.initSelect(); }

  /** When we start a drag operation, we add a new set of elements to the DOM and start modifying them.
   * If we cancel the operation, we need remove them from the DOM.
   */
  private cancelDrag() {
    this._dragging.forEach((el) => el.remove()); // remove temporary elements from DOM
    this._dragging.length = 0;
  }
  public async onResetButtonUp(_ev: BeButtonEvent): Promise<EventHandled> {
    const selected = this.markup.selected;
    const handles = selected.handles;
    if (handles && handles.dragging)
      handles.cancelDrag();

    this.cancelDrag();
    selected.sizeChanged();
    return EventHandled.Yes;
  }

  /** Called when there is a mouse "click" (down+up without any motion) */
  public async onDataButtonUp(ev: BeButtonEvent): Promise<EventHandled> {
    const markup = this.markup;
    const selected = markup.selected;
    const handles = selected.handles;
    if (handles) {
      if (handles.dragging)
        return handles.endDrag(markup.undo);
      if (handles.active) { // clicked on a handle
        handles.active.onClick(ev);
        handles.active = undefined;
        return EventHandled.Yes;
      }
    }

    const el = this.flashedElement = this.pickElement(ev.viewPoint);
    if (ev.isControlKey) {
      if (el && selected.drop(el))
        return EventHandled.Yes;
    } else {
      selected.emptyAll();
    }

    if (el !== undefined)
      selected.add(el);
    return EventHandled.Yes;
  }

  /** called when the mouse moves while the data button is down. */
  public async onMouseStartDrag(ev: BeButtonEvent): Promise<EventHandled> {
    const markup = this.markup;
    const selected = markup.selected;
    const handles = selected.handles;
    if (handles && handles.active) {
      this.flashedElement = undefined; // make sure there are no elements flashed while dragging
      return handles.startDrag(ev);
    }

    const flashed = this.flashedElement = this.pickElement(ev.viewPoint);
    if (undefined === flashed) {
      selected.emptyAll();
      // TODO: drag select?
      return EventHandled.Yes;
    }

    if (!selected.has(flashed))
      selected.restart(flashed); // we clicked on an element not in the selection set, replace current selection with just this element

    selected.clearEditors();
    this._anchorPt = MarkupApp.convertVpToVb(ev.viewPoint);  // save the starting point. This is the point where the "down" occurred.
    this.cancelDrag();

    selected.elements.forEach((el) => { // add all selected elements to the "dragging" set
      const cloned = el.cloneMarkup(); // make a clone of this element
      el.after(cloned); // put it into the DOM after its original
      cloned.originalEl = el; // save original element so we can remove it if this is a "move" command
      this._dragging.push(cloned); // add to dragging set
    });
    return EventHandled.Yes;
  }

  /** Called whenever the mouse moves while this tool is active. */
  public async onMouseMotion(ev: BeButtonEvent): Promise<void> {
    const markup = this.markup;
    const handles = markup.selected.handles;
    if (handles && handles.dragging) {
      this.receivedDownEvent = true; // necessary to tell ToolAdmin to send us the button up event
      return handles.drag(ev); // drag the handle
    }

    if (this._dragging.length === 0) {
      if (InputSource.Touch !== ev.inputSource)
        this.flashedElement = this.pickElement(ev.viewPoint);  // if we're not dragging, try to find an element under the cursor
      return;
    }

    // we have a set of elements being dragged. NOTE: coordinates are viewbox
    const vbPt = MarkupApp.convertVpToVb(ev.viewPoint);
    const delta = vbPt.minus(this._anchorPt);
    this._dragging.forEach((el) => el.translate(delta.x, delta.y));
    this._anchorPt = vbPt; // translate moves from last mouse location
  }

  /** Called when the mouse goes up after dragging. */
  public async onMouseEndDrag(ev: BeButtonEvent): Promise<EventHandled> {
    const markup = this.markup;
    const selected = markup.selected;
    const handles = selected.handles;
    if (handles && handles.dragging)  // if we have handles up, and if they're in the "dragging" state, send the event to them
      return handles.endDrag(markup.undo);

    if (this._dragging.length === 0)
      return EventHandled.Yes;    // we had nothing selected, nothing to do

    // NOTE: all units should be in viewbox coordinates
    const delta = MarkupApp.convertVpToVb(ev.viewPoint).minus(this._anchorPt);
    const undo = markup.undo;
    if (ev.isShiftKey) // shift key means "add to existing," otherwise new selection replaces old
      selected.emptyAll();

    // move or copy all of the elements in dragged set
    undo.doGroup(() => this._dragging.forEach((el) => {
      el.translate(delta.x, delta.y); // move to final location
      const original = el.originalEl!; // save original element
      el.originalEl = undefined; // clear original element
      if (ev.isShiftKey) {
        selected.add(el);
        undo.onAdded(el);  // shift key means copy element
      } else {
        original.replace(el);
        undo.onModified(el, original);
      }
    }));

    this._dragging.length = 0; // empty dragging set
    selected.sizeChanged(); // notify that size of selection set changed
    return EventHandled.Yes;
  }

  /** called when a modifier key is pressed or released. Updates stretch handles, if present */
  public async onModifierKeyTransition(_wentDown: boolean, modifier: BeModifierKeys, _event: KeyboardEvent): Promise<EventHandled> {
    if (modifier !== BeModifierKeys.Shift) // we only care about the shift key
      return EventHandled.No;
    const selected = this.markup.selected;
    const handles = selected.handles;
    if (undefined === handles || !handles.dragging) // and only if we're currently dragging
      return EventHandled.No;
    const ev = new BeButtonEvent(); // we need to simulate a mouse motion by sending a drag event at the last cursor position
    IModelApp.toolAdmin.fillEventFromCursorLocation(ev);
    return (undefined === ev.viewport) ? EventHandled.No : (handles.drag(ev), EventHandled.Yes);
  }

  /** called whenever a key is pressed while this tool is active. */
  public async onKeyTransition(wentDown: boolean, key: KeyboardEvent): Promise<EventHandled> {
    if (!wentDown)
      return EventHandled.No;
    const markup = this.markup;
    switch (key.key.toLowerCase()) {
      case "delete": // delete key or backspace = delete current selection set
      case "backspace":
        markup.deleteSelected();
        return EventHandled.Yes;
      case "escape": // esc = cancel current operation
        this.exitTool();
        return EventHandled.Yes;
      case "b": // alt-shift-b = send to back
        return (key.altKey && key.shiftKey) ? (markup.sendToBack(), EventHandled.Yes) : EventHandled.No;
      case "f": // alt-shift-f = bring to front
        return (key.altKey && key.shiftKey) ? (markup.bringToFront(), EventHandled.Yes) : EventHandled.No;
      case "g": // ctrl-g = create group
        return (key.ctrlKey) ? (markup.groupSelected(), EventHandled.Yes) : EventHandled.No;
      case "u": // ctrl-u = ungroup
        return (key.ctrlKey) ? (markup.ungroupSelected(), EventHandled.Yes) : EventHandled.No;
    }
    return EventHandled.No;
  }
}
