/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { Point2d, Point3d, Transform, XAndY } from "@bentley/geometry-core";
import { BeButtonEvent, BeModifierKeys, EventHandled, IModelApp, InputSource } from "@bentley/imodeljs-frontend";
import { ArrayXY, Box, Circle, Element as MarkupElement, G, Line, Matrix, Point, Polygon, Svg, Text as MarkupText } from "@svgdotjs/svg.js";
import { MarkupApp } from "./Markup";
import { EditTextTool } from "./TextEdit";
import { UndoManager } from "./Undo";
import { MarkupTool } from "./MarkupTool";

/** A "modify handle" is a visible position on the screen that provides UI to modify a MarkupElement. */
abstract class ModifyHandle {
  public vpToStartTrn!: Transform;

  constructor(public handles: Handles) { }
  /** perform the modification given a current mouse position. */
  public abstract modify(ev: BeButtonEvent): void;
  public onClick(_ev: BeButtonEvent) { }

  /** set the position for this handle on the screen given the current state of the element */
  public abstract setPosition(): void;
  /** the mouse just went down on this handle, begin modification. */
  public startDrag(_ev: BeButtonEvent, makeCopy = false): void {
    this.vpToStartTrn = this.handles.vpToBoxTrn.clone(); // save the starting vp -> element box transform
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

/** A ModifyHandle that changes the size of the element */
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
    this._circle = handles.group!.circle(props.size).addClass("markup-stretchHandle") // the visible "circle" for this handle
      .attr(props.stretch).attr("cursor", cursor + "-resize");
    this.setMouseHandler(this._circle);
  }
  public setPosition() {
    const pt = this.handles.npcToVp(this.posNpc); // convert to vp coords
    this._circle.center(pt.x, pt.y);
  }

  public startDrag(_ev: BeButtonEvent) {
    const handles = this.handles;
    this.startCtm = handles.el.ctm();
    this.startBox = handles.el.bbox(); // save starting size so we can preserve aspect ratio
    this.startPos = handles.npcToBox(this.posNpc);
    this.opposite = handles.npcToBox({ x: 1 - this.posNpc.x, y: 1 - this.posNpc.y });
    super.startDrag(_ev);
  }

  public modify(ev: BeButtonEvent): void {
    const diff = this.startPos.vectorTo(this.vpToStartTrn.multiplyPoint2d(ev.viewPoint)); // movement of cursor from start, in view coords
    const diag = this.startPos.vectorTo(this.opposite).normalize()!; // vector from opposite corner to this handle
    const diagVec = diag.scaleToLength(diff.dotProduct(diag)); // projected distance along diagonal

    // if the shift key is down, don't preserve aspect ratio
    const adjusted = ev.isShiftKey ? { x: diff.x, y: diff.y } : { x: diagVec.x, y: diagVec.y };
    let { x, y, h, w } = this.startBox;
    if (this.posNpc.x === 0) {
      x += adjusted.x;
      w -= adjusted.x;
    } else if (this.posNpc.x === 1) {
      w += adjusted.x;
    }
    if (this.posNpc.y === 0) {
      y += adjusted.y;
      h -= adjusted.y;
    } else if (this.posNpc.y === 1) {
      h += adjusted.y;
    }
    const mtx = this.startCtm.inverse().scaleO(this.startBox.w / w, this.startBox.h / h, this.opposite.x, this.opposite.y).inverseO();
    const minSize = 10; // don't let element get too small
    if (w > minSize && h > minSize)
      this.handles.el.markupStretch(w, h, x, y, mtx);
  }
}

/** A ModifyHandle to rotate an element */
class RotateHandle extends ModifyHandle {
  private readonly _line: Line;
  private readonly _circle: Circle;
  public location!: Point2d;

  constructor(public handles: Handles) {
    super(handles);
    const props = MarkupApp.props.handles;

    this._line = handles.group!.line(0, 0, 1, 1).attr(props.rotateLine).addClass("markup-rotateLine");
    this._circle = handles.group!.circle(props.size * 1.25).attr(props.rotate).addClass("markup-rotateHandle");
    this.setMouseHandler(this._circle);
  }
  public get centerVp() { return this.handles.npcToVp({ x: .5, y: .5 }); }
  public get anchorVp() { return this.handles.npcToVp({ x: .5, y: 0 }); }
  public setPosition(): void {
    const anchor = this.anchorVp;
    const dir = this.centerVp.vectorTo(anchor).normalize()!;
    const loc = this.location = anchor.plusScaled(dir, MarkupApp.props.handles.size * 3);
    this._line.plot(anchor.x, anchor.y, loc.x, loc.y);
    this._circle.center(loc.x, loc.y);
  }
  public modify(ev: BeButtonEvent): void {
    const centerVp = this.centerVp;
    const currDir = centerVp.vectorTo(ev.viewPoint);
    const dir = centerVp.vectorTo(this.location);
    this.handles.el.rotate(dir.angleTo(currDir).degrees);
  }
}

/** A VertexHandle to move a point */
class VertexHandle extends ModifyHandle {
  private readonly _circle: Circle;
  private readonly _x: string;
  private readonly _y: string;

  constructor(public handles: Handles, index: number) {
    super(handles);
    const props = MarkupApp.props.handles;
    this._circle = handles.group!.circle(props.size).attr(props.vertex).addClass("markup-vertexHandle");
    this._x = "x" + (index + 1);
    this._y = "y" + (index + 1);
    this.setMouseHandler(this._circle);
  }
  public setPosition(): void {
    let point = new Point(this.handles.el.attr(this._x), this.handles.el.attr(this._y));
    const matrix = this.handles.el.ctm();
    point = point.transform(matrix);
    this._circle.center(point.x, point.y);
  }
  public startDrag(ev: BeButtonEvent) {
    super.startDrag(ev);
  }
  public modify(ev: BeButtonEvent): void {
    let point = new Point(ev.viewPoint.x, ev.viewPoint.y);
    const matrix = this.handles.el.ctm().inverse();
    point = point.transform(matrix);
    this.handles.el.attr(this._x, point.x);
    this.handles.el.attr(this._y, point.y);
  }
}

/** A handle that moves an element. */
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
      const rect = clone.getOutline().attr(props.move).attr({ fill: "none" });

      const group = handles.group.group();
      group.add(this._outline);
      group.add(rect);
      group.add(clone);
      this._shape = group;
    } else {
      clone.addTo(handles.group);
      this._shape = clone;
    }

    this._shape.addClass("markup-moveHandle");
    this.setMouseHandler(this._shape);
  }
  public onClick(_ev: BeButtonEvent) {
    const el = this.handles.el;
    if (el instanceof MarkupText)
      new EditTextTool(el).run();
  }
  public setPosition() {
    if (undefined !== this._outline) {
      const pts = [new Point2d(0, 0), new Point2d(0, 1), new Point2d(1, 1), new Point2d(1, 0)];
      this._outline.plot(this.handles.npcToVpArray(pts).map((pt) => [pt.x, pt.y] as ArrayXY)); // draws the outline of the element's bbox
    }
  }
  public startDrag(ev: BeButtonEvent) {
    super.startDrag(ev, ev.isShiftKey);
    this._lastPos = ev.viewPoint;
  }
  public modify(ev: BeButtonEvent): void {
    const handles = this.handles;
    const dist = ev.viewPoint.minus(this._lastPos!);
    this._lastPos = ev.viewPoint;
    handles.el.translate(dist.x, dist.y);
  }
}

/** The set of ModifyHandles active. Only applies if there is a single element selected. */
class Handles {
  public readonly handles: ModifyHandle[] = [];
  public active?: ModifyHandle;
  public dragging = false;
  public group: G;
  public npcToVpTrn!: Transform;
  public vpToBoxTrn!: Transform;

  constructor(public ss: SelectionSet, public el: MarkupElement) {
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
    const angle = el.ctm().decompose().rotate || 0;
    const start = Math.round(-angle / 45); // so that we rotate the cursors for rotated elements
    pts.forEach((h, i) => this.handles.push(new StretchHandle(this, h as ArrayXY, cursors[(i + start + 8) % 8])));
    this.draw(); // show starting state
  }

  public npcToBox(p: XAndY) { const pt = this.npcToVp(p); return this.vpToBox(pt, pt); }
  public npcToVp(p: XAndY, result?: Point2d): Point2d { return this.npcToVpTrn.multiplyPoint2d(p, result); }
  public vpToBox(p: XAndY, result?: Point2d): Point2d { return this.vpToBoxTrn.multiplyPoint2d(p, result); }
  public npcToVpArray(pts: Point2d[]): Point2d[] { pts.forEach((pt) => this.npcToVp(pt, pt)); return pts; }

  public draw() {
    const el = this.el;
    const bb = el.bbox();
    const ctm = el.ctm();
    this.vpToBoxTrn = ctm.inverse().toIModelTransform();
    this.npcToVpTrn = new Matrix().scaleO(bb.w, bb.h).translateO(bb.x, bb.y).lmultiplyO(ctm).toIModelTransform();
    this.handles.forEach((h) => h.setPosition());
  }

  public remove() {
    if (this.dragging)
      this.cancelDrag();
    this.group.remove();
  }

  public startDrag(ev: BeButtonEvent) {
    if (this.active) {
      this.active.startDrag(ev);
      this.dragging = true;
      MarkupApp.markup!.disablePick();
      IModelApp.toolAdmin.setCursor(IModelApp.viewManager.dynamicsCursor);
    }
  }
  public drag(ev: BeButtonEvent) {
    if (this.dragging) {
      this.active!.modify(ev);
      this.draw();
    }
  }
  /** complete the modification for the active handle. */
  public endDrag(undo: UndoManager) {
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

/** The set of currently selected SVG elements. When elements are added to the set, they are hilited. */
export class SelectionSet {
  public readonly elements = new Set<MarkupElement>();
  public handles?: Handles;

  public get size() { return this.elements.size; }
  public get isEmpty() { return this.size === 0; }
  public has(el: MarkupElement) { return this.elements.has(el); }
  public emptyAll(): void {
    this.clearEditors();
    this.elements.forEach((el) => el.unHilite());
    this.elements.clear();
  }
  public restart(el?: MarkupElement) {
    this.emptyAll();
    if (el) this.add(el);
  }
  public constructor(public svg: Svg) { }
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
    const parent = first.parent("svg") as Svg;
    const group = parent.group();
    undo.doGroup(() => {
      this.elements.forEach((el) => {
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

/** Provides UI for selection, delete, move, copy, bring-to-front, send-to-back, etc. for Markup SVG elements */
export class SelectTool extends MarkupTool {
  public static toolId = "Markup.Select";
  private _flashedElement?: MarkupElement;
  private readonly _dragging: MarkupElement[] = [];
  private readonly _anchor = new Point3d();

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
      if (handles.dragging) {
        handles.endDrag(markup.undo);
        return EventHandled.Yes;
      }
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
    // console.log("start drag");
    const markup = this.markup;
    const selected = markup.selected;
    const handles = selected.handles;
    if (handles && handles.active) {
      this.flashedElement = undefined;
      handles.startDrag(ev);
      return EventHandled.Yes;
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
    this._anchor.setFrom(ev.viewPoint);  // save the starting point. This is the point where the "down" occurred.
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
    // console.log("motion");
    const markup = this.markup;
    const handles = markup.selected.handles;
    if (handles && handles.dragging) {
      this.receivedDownEvent = true;
      handles.drag(ev);
      return;
    }

    if (this._dragging.length === 0) {
      if (InputSource.Touch === ev.inputSource)
        return;
      this.flashedElement = this.pickElement(ev.viewPoint);  // if we're not dragging, try to find an element under the cursor
      return;
    }

    // we have a set of elements being dragged
    const delta = ev.viewPoint.minus(this._anchor);
    this._anchor.setFrom(ev.viewPoint); // translate moves from last mouse location
    this._dragging.forEach((el) => {
      el.translate(delta.x, delta.y);
    });
  }

  /** Called when the mouse goes up after dragging. */
  public async onMouseEndDrag(ev: BeButtonEvent): Promise<EventHandled> {
    // console.log("end drag");
    const markup = this.markup;
    const selected = markup.selected;
    const handles = selected.handles;
    if (handles && handles.dragging) {
      handles.endDrag(markup.undo);
      return EventHandled.Yes;
    }

    if (this._dragging.length === 0) // we had nothing selected
      return EventHandled.Yes;

    const delta = ev.viewPoint.minus(this._anchor);
    const undo = markup.undo;
    if (ev.isShiftKey)
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

    this._dragging.length = 0;
    selected.sizeChanged();
    return EventHandled.Yes;
  }

  public async onModifierKeyTransition(_wentDown: boolean, modifier: BeModifierKeys, _event: KeyboardEvent): Promise<EventHandled> {
    if (modifier !== BeModifierKeys.Shift)
      return EventHandled.No;
    const selected = this.markup.selected;
    const handles = selected.handles;
    if (undefined === handles || !handles.dragging)
      return EventHandled.No;
    const ev = new BeButtonEvent();
    IModelApp.toolAdmin.fillEventFromCursorLocation(ev);
    if (undefined === ev.viewport)
      return EventHandled.No;
    handles.drag(ev);
    return EventHandled.Yes;
  }

  /** called whenever a key is pressed while this tool is active. */
  public async onKeyTransition(wentDown: boolean, key: KeyboardEvent): Promise<EventHandled> {
    if (!wentDown)
      return EventHandled.No;

    const tools = IModelApp.tools;
    const markup = this.markup;
    switch (key.key.toLowerCase()) {
      case "delete":
      case "backspace":
        markup.deleteSelected();
        return EventHandled.Yes;
      case "escape":
        this.exitTool();
        return EventHandled.Yes;
      case "f":
        markup.bringToFront();
        return EventHandled.Yes;
      case "b":
        markup.sendToBack();
        return EventHandled.Yes;
      case "a":
        tools.run("Markup.Arrow"); // ###TODO - Testing, Need stage w/tool icons...
        return EventHandled.Yes;
      case "c":
        tools.run("Markup.Circle");
        return EventHandled.Yes;
      case "g":
        if (!key.ctrlKey)
          return EventHandled.No;
        markup.groupSelected();
        return EventHandled.Yes;
      case "u":
        if (!key.ctrlKey)
          return EventHandled.No;
        markup.ungroupSelected();
        return EventHandled.Yes;
      case "d":
        tools.run("Markup.Cloud");
        return EventHandled.Yes;
      case "e":
        tools.run("Markup.Ellipse");
        return EventHandled.Yes;
      case "l":
        tools.run("Markup.Line");
        return EventHandled.Yes;
      case "p":
        tools.run("Markup.Polygon");
        return EventHandled.Yes;
      case "r":
        tools.run("Markup.Rectangle");
        return EventHandled.Yes;
      case "s":
        tools.run("Markup.Sketch");
        return EventHandled.Yes;
      case "t":
        tools.run("Markup.Text.Place");
        return EventHandled.Yes;
    }
    return EventHandled.No;
  }
}
