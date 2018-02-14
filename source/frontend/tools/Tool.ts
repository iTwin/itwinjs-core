/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Point3d, Point2d, XAndY } from "@bentley/geometry-core/lib/PointVector";
import { Viewport } from "../Viewport";
import { DecorateContext } from "../ViewContext";
import { HitDetail } from "../HitDetail";
import { LocateResponse } from "../ElementLocateManager";
import { I18NNamespace } from "../Localization";
import { iModelApp } from "../IModelApp";
import { IModelError } from "../../common/IModelError";
import { FuzzySearch, FuzzySearchResults } from "../FuzzySearch";

type CommandList = Array<typeof Tool>;

export const enum BeButton {
  Data = 0,
  Reset = 1,
  Middle = 2,
}

export enum BeCursor {
  Default = "default",
  CrossHair = "crosshair",
  OpenHand = "grab",
  ClosedHand = "grabbing",
  Rotate = "move",
  Arrow = "default",
  NotAllowed = "not-allowed",
  Text = "text",
  Busy = "wait",
  Dynamics = "move",
}

export const enum GestureId {
  None = 0,
  MultiFingerMove = 1, // two or more fingers dragging
  SingleFingerMove = 2, // a single finger dragging
  TwoFingerTap = 3, // tap with two fingers
  PressAndTap = 4, // long press followed by a tap
  SingleTap = 5, // One finger down and up; implies no LongPress active
  DoubleTap = 6, // One finger down and up; implies no LongPress active
  LongPress = 7, // One finger held down for more than some threshold
}

export const enum InputSource {
  Unknown = 0, // source not defined
  Mouse = 1,   // mouse or other pointing device
  Touch = 2,    // touch-sensitive device e.g. a touch screen
}

/** The "source" that generated this event. */
export const enum CoordSource {
  User = 0,    // event was created by an action from the user
  Precision = 1,    // event was created by a program or by a precision keyin
  TentativePoint = 2,  // event was created by a tentative point
  ElemSnap = 3,    // event was created by snapping to an element
}

export const enum BeModifierKey {
  None = 0,
  Control = 1 << 0,
  Shift = 1 << 2,
  Alt = 1 << 3,
}

export const enum BeVirtualKey {
  Shift,
  Control,
  Alt,
  Backspace,
  Tab,
  Return,
  Escape,
  Space,
  PageUp,
  PageDown,
  End,
  Home,
  Left,
  Up,
  Right,
  Down,
  Insert,
  Delete,
  Key0,
  Key1,
  Key2,
  Key3,
  Key4,
  Key5,
  Key6,
  Key7,
  Key8,
  Key9,
  A,
  B,
  C,
  D,
  E,
  F,
  G,
  H,
  I,
  J,
  K,
  L,
  M,
  N,
  O,
  P,
  Q,
  R,
  S,
  T,
  U,
  V,
  W,
  X,
  Y,
  Z,
  NumKey0,
  NumKey1,
  NumKey2,
  NumKey3,
  NumKey4,
  NumKey5,
  NumKey6,
  NumKey7,
  NumKey8,
  NumKey9,
  Multiply,
  Add,
  Separator,
  Subtract,
  Decimal,
  Divide,
  Comma,
  Period,
  F1,
  F2,
  F3,
  F4,
  F5,
  F6,
  F7,
  F8,
  F9,
  F10,
  F11,
  F12,
}

export class BeButtonState {
  private readonly _downUorPt: Point3d = new Point3d();
  private readonly _downRawPt: Point3d = new Point3d();
  public downTime: number = 0;
  public isDown: boolean = false;
  public isDoubleClick: boolean = false;
  public isDragging: boolean = false;
  public inputSource: InputSource = InputSource.Unknown;

  public get downRawPt() { return this._downRawPt; }
  public set downRawPt(pt: Point3d) { this._downRawPt.setFrom(pt); }
  public get downUorPt() { return this._downUorPt; }
  public set downUorPt(pt: Point3d) { this._downUorPt.setFrom(pt); }

  public init(downUorPt: Point3d, downRawPt: Point3d, downTime: number, isDown: boolean, isDoubleClick: boolean, isDragging: boolean, source: InputSource) {
    this.downUorPt = downUorPt;
    this.downRawPt = downRawPt;
    this.downTime = downTime;
    this.isDown = isDown;
    this.isDoubleClick = isDoubleClick;
    this.isDragging = isDragging;
    this.inputSource = source;
  }
}

export class BeButtonEvent {
  private readonly _point: Point3d = new Point3d();
  private readonly _rawPoint: Point3d = new Point3d();
  private readonly _viewPoint: Point3d = new Point3d();
  public viewport?: Viewport;
  public coordsFrom = CoordSource.User;   // how were the coordinate values in point generated?
  public keyModifiers = BeModifierKey.None;
  public isDoubleClick = false;
  public isDown = false;
  public button = BeButton.Data;
  public inputSource = InputSource.Unknown;
  public actualInputSource = InputSource.Unknown;

  public get point() { return this._point; }
  public set point(pt: Point3d) { this._point.setFrom(pt); }
  public get rawPoint() { return this._rawPoint; }
  public set rawPoint(pt: Point3d) { this._rawPoint.setFrom(pt); }
  public get viewPoint() { return this._viewPoint; }
  public set viewPoint(pt: Point3d) { this._viewPoint.setFrom(pt); }

  public initEvent(point: Point3d, rawPoint: Point3d, viewPt: Point3d, vp: Viewport, from: CoordSource, keyModifiers: BeModifierKey, button = BeButton.Data, isDown = true, doubleClick = false, source = InputSource.Unknown) {
    this.point = point;
    this.rawPoint = rawPoint;
    this.viewPoint = viewPt;
    this.viewport = vp;
    this.coordsFrom = from;
    this.keyModifiers = keyModifiers;
    this.isDoubleClick = doubleClick;
    this.isDown = isDown;
    this.button = button;
    this.inputSource = source;
    this.actualInputSource = source;
  }

  public getDisplayPoint(): Point2d { return new Point2d(this._viewPoint.x, this._viewPoint.y); }
  public get isControlKey() { return 0 !== (this.keyModifiers & BeModifierKey.Control); }
  public get isShiftKey() { return 0 !== (this.keyModifiers & BeModifierKey.Shift); }
  public get isAltKey() { return 0 !== (this.keyModifiers & BeModifierKey.Alt); }
  public reset() { this.viewport = undefined; }

  public setFrom(src: BeButtonEvent) {
    this.point = src.point;
    this.rawPoint = src.rawPoint;
    this.viewPoint = src.viewPoint;
    this.viewport = src.viewport;
    this.coordsFrom = src.coordsFrom;
    this.keyModifiers = src.keyModifiers;
    this.isDoubleClick = src.isDoubleClick;
    this.isDown = src.isDown;
    this.button = src.button;
    this.inputSource = src.inputSource;
    this.actualInputSource = src.actualInputSource;
  }
  public clone(result?: BeButtonEvent): BeButtonEvent {
    result = result ? result : new BeButtonEvent();
    result.setFrom(this);
    return result;
  }
}

/** Describes a "gesture" input originating from a touch-input device. */
export class GestureInfo {
  public gestureId = GestureId.None;
  public numberTouches = 0;
  public previousNumberTouches = 0;    // Only meaningful for GestureId::SingleFingerMove and GestureId::MultiFingerMove
  public touches: Point2d[] = [new Point2d(), new Point2d(), new Point2d()];
  public ptsLocation: Point2d = new Point2d();    // Location of centroid
  public distance = 0;                 // Only meaningful on motion with multiple touches
  public isEndGesture = false;
  public isFromMouse = false;

  public getViewPoint(vp: Viewport) {
    const screenRect = vp.viewRect;
    return new Point3d(this.ptsLocation.x - screenRect.left, this.ptsLocation.y - screenRect.bottom, 0.0);
  }

  public init(gestureId: GestureId, centerX: number, centerY: number, distance: number, touchPoints: XAndY[], isEnding: boolean, isFromMouse: boolean, prevNumTouches: number) {
    this.gestureId = gestureId;
    this.numberTouches = Math.min(touchPoints.length, 3);
    this.previousNumberTouches = prevNumTouches;
    this.isEndGesture = isEnding;
    this.isFromMouse = isFromMouse;

    this.ptsLocation.x = Math.floor(centerX);
    this.ptsLocation.y = Math.floor(centerY);
    this.distance = distance;

    for (let i = 0; i < this.numberTouches; ++i) {
      this.touches[i].x = Math.floor(touchPoints[i].x);
      this.touches[i].y = Math.floor(touchPoints[i].y);
    }
  }

  public copyFrom(src: GestureInfo) {
    this.gestureId = src.gestureId;
    this.numberTouches = src.numberTouches;
    this.previousNumberTouches = src.previousNumberTouches;
    this.isEndGesture = src.isEndGesture;

    this.ptsLocation.x = src.ptsLocation.x;
    this.ptsLocation.y = src.ptsLocation.y;
    this.distance = src.distance;

    for (let i = 0; i < this.numberTouches; ++i) {
      this.touches[i].x = src.touches[i].x;
      this.touches[i].y = src.touches[i].y;
    }

    this.isFromMouse = src.isFromMouse;
  }
  public clone(result?: GestureInfo) {
    result = result ? result : new GestureInfo();
    result.copyFrom(this);
    return result;
  }
}

/** Specialization of ButtonEvent describing a gesture event originating from touch input. */
export class BeGestureEvent extends BeButtonEvent {
  public gestureInfo?: GestureInfo;
  public setFrom(src: BeGestureEvent) {
    super.setFrom(src);
    this.gestureInfo = src.gestureInfo;
  }
  public clone(result?: BeGestureEvent): BeGestureEvent {
    result = result ? result : new BeGestureEvent();
    result.setFrom(this);
    return result;
  }
}

/** Information about movement of the mouse wheel. */
export class BeWheelEvent extends BeButtonEvent {
  public constructor(public wheelDelta: number = 0) { super(); }
  public setFrom(src: BeWheelEvent): void {
    super.setFrom(src);
    this.wheelDelta = src.wheelDelta;
  }
  public clone(result?: BeWheelEvent): BeWheelEvent {
    result = result ? result : new BeWheelEvent();
    result.setFrom(this);
    return result;
  }
}

/**
 * Base Tool class for handling user input events from Viewports.
 */
export class Tool {
  public static hidden = false;
  public static toolId = "";
  public static namespace: I18NNamespace;
  protected static _keyin?: string; // localized (fetched only once, first time needed).

  public constructor(..._args: any[]) { }
  /**
   * Register this Tool class with the ToolRegistry.
   * @param namespace optional namespace to supply to ToolRegistry.register. If undefined, use namespace from superclass.
   */
  public static register(namespace?: I18NNamespace) { iModelApp.tools.register(this, namespace); }

  /**
   * Get the localized keyin string for this Tool class. This returns the value of "tools." + this.toolId + ".keyin" from the
   * .json file for the current locale of its registered NameSpace (e.g. "en/MyApp.json")
   */
  public static get keyin(): string {
    if (!this._keyin) {
      this._keyin = iModelApp.i18N.translate(this.namespace.name + ":tools." + this.toolId + ".keyin");
    }
    return this._keyin!;
  }

  /**
   * Get the toolId string for this Tool class. This string is used to identify the Tool in the ToolRegistry and is used to localize
   * the keyin, description, etc. from the current locale.
   */
  public get toolId(): string { return (this.constructor as typeof Tool).toolId; }

  /** Get the localized keyin string from this Tool's class */
  public get keyin(): string { return (this.constructor as typeof Tool).keyin; }

  /**
   * run this instance of a Tool. Subclasses should override to perform their action.
   * @returns true if the tool executed successfully.
   */
  public run(..._arg: any[]): boolean { return true; }
}

/**
 * A Tool that may be installed, via ToolAdmin, to handle user input. The ToolAdmin manages the currently installed ViewingTool, PrimitiveTool,
 * InputCollector, and IdleTool. Each must derive from this class and there may only be one of each type installed at a time.
 */
export abstract class InteractiveTool extends Tool {
  /** Override to execute additional logic after tool becomes active */
  public onPostInstall(): void { }
  /** Override to execute additional logic when tool is installed. Return false to prevent this tool from becoming active */
  public onInstall(): boolean { return true; }
  public abstract exitTool(): void;
  /** Invoked when the tool becomes no longer active, to perform additional cleanup logic */
  public onCleanup() { }
  /** Implement to handle data-button-down events */
  public abstract onDataButtonDown(ev: BeButtonEvent): void;
  /** Invoked when the data-button-up events. */
  public onDataButtonUp(_ev: BeButtonEvent): boolean { return false; }
  /** Invoked when the reset-button-down events. */
  public onResetButtonDown(_ev: BeButtonEvent): boolean { return false; }
  /** Invoked when the reset button is released. */
  public onResetButtonUp(_ev: BeButtonEvent): boolean { return false; }
  /** Invoked when the middle mouse button is pressed. */
  public onMiddleButtonDown(_ev: BeButtonEvent): boolean { return false; }
  /** Invoked when the middle mouse button is released. */
  public onMiddleButtonUp(_ev: BeButtonEvent): boolean { return false; }
  /** Invoked when the cursor is moving */
  public onModelMotion(_ev: BeButtonEvent): void { }
  /** Invoked when the cursor is not moving */
  public onModelNoMotion(_ev: BeButtonEvent): void { }
  /** Invoked when the cursor was previously moving, and has stopped moving. */
  public onModelMotionStopped(_ev: BeButtonEvent): void { }
  /** Invoked when the cursor begins moving while a button is depressed */
  public onModelStartDrag(_ev: BeButtonEvent): boolean { return false; }
  /** Invoked when the cursor stops moving while a button is depressed */
  public onModelEndDrag(ev: BeButtonEvent) { return this.onDataButtonDown(ev); }
  /** Invoked to allow tools to filter which elements can be located.
   * return true to reject hit (fill out response with reason, if it is defined)
   */
  public onPostLocate(_hit: HitDetail, _out?: LocateResponse) { return false; }
  /** Invoked when the mouse wheel moves. */
  public onMouseWheel(_ev: BeWheelEvent): boolean { return false; }
  /** Implemented by direct subclasses to handle when the tool becomes no longer active. Generally not overridden by other subclasses */
  /** Invoked when the dimensions of the tool's viewport change */
  public onViewportResized() { }
  /** Invoked to allow a tool to update any view decorations it may have created */
  public updateDynamics(_ev: BeButtonEvent) { }
  public onTouchMotionPaused(): boolean { return false; }
  public onEndGesture(_ev: BeGestureEvent): boolean { return false; }
  public onSingleFingerMove(_ev: BeGestureEvent): boolean { return false; }
  public onMultiFingerMove(_ev: BeGestureEvent): boolean { return false; }
  public onTwoFingerTap(_ev: BeGestureEvent): boolean { return false; }
  public onPressAndTap(_ev: BeGestureEvent): boolean { return false; }
  public onSingleTap(_ev: BeGestureEvent): boolean { return false; }
  public onDoubleTap(_ev: BeGestureEvent): boolean { return false; }
  public onLongPress(_ev: BeGestureEvent): boolean { return false; }
  public isValidLocation(_ev: BeButtonEvent, _isButtonEvent: boolean): boolean { return true; }
  public isCompatibleViewport(vp: Viewport, _isSelectedViewChange: boolean): boolean { return !!vp; }

  /** Called when Control, Shift, or Alt qualifier keys are pressed or released.
   * @param _wentDown up or down key event
   * @param _key One of VirtualKey.Control, VirtualKey.Shift, or VirtualKey.Alt
   * @return true to refresh view decorations or update dynamics.
   */
  public onModifierKeyTransition(_wentDown: boolean, _key: BeModifierKey): boolean { return false; }

  /** Called when  keys are pressed or released.
   * @param wentDown up or down key event
   * @param key One of VirtualKey enum values
   * @param shiftIsDown the shift key is down
   * @param ctrlIsDown  the control key is down
   * @return true to prevent further processing of this event
   * @note In case of Shift, Control and Alt key, onModifierKeyTransition is used.
   */
  public onKeyTransition(_wentDown: boolean, _key: BeVirtualKey, _shiftIsDown: boolean, _ctrlIsDown: boolean): boolean { return false; }

  /**
   * Called to allow an active tool to display non-element decorations in overlay mode.
   * This method is NOT called while the tool is suspended by a viewing tool or input collector.
   */
  public decorate(_context: DecorateContext) { }

  /**
   * Called to allow a suspended tool to display non-element decorations in overlay mode.
   * This method is ONLY called when the tool is suspended by a viewing tool or input collector.
   * @note Applies only to PrimitiveTool and InputCollector, a ViewTool can't be suspended.
   */
  public decorateSuspended(_context: DecorateContext) { }

  /**
   * Invoked just before the locate tooltip is displayed to retrieve the info text. Allows the tool to override the default description.
   * @param hit The HitDetail whose info is needed.
   * @param _delimiter Use this string to break lines of the description.
   * @return the string to describe the hit.
   * @note If you override this method, you may decide whether to call your superclass' implementation or not (it is not required).
   * The default implementation shows hit description
   */
  public getInfoString(hit: HitDetail, _delimiter: string): string { return hit.hitDescription; }
}

/**
 * The ToolRegistry holds a mapping between toolId and Tool class. This provides the mechanism to
 * find Tools by their toolId, and also a way to iterate over the collection of Tools available.
 */
export class ToolRegistry {
  public map: Map<string, typeof Tool> = new Map<string, typeof Tool>();
  private _keyinList?: CommandList;

  /**
   * Register a Tool class. This establishes a connection between the toolId of the class and the class itself.
   * @param toolId the toolId of a previously registered tool to unRegister.
   */
  public unRegister(toolId: string) { this.map.delete(toolId); }

  /**
   * Register a Tool class. This establishes a connection between the toolId of the class and the class itself.
   * @param toolClass the subclass of Tool to register.
   * @param namespace the namespace for the localized strings for this tool. If undefined, use namespace from superclass.
   */
  public register(toolClass: typeof Tool, namespace?: I18NNamespace) {
    if (namespace) // namespace is optional because it can come from superclass
      toolClass.namespace = namespace;

    if (toolClass.toolId.length === 0)
      return; // must be an abstract class

    if (!toolClass.namespace)
      throw new IModelError(-1, "Tools must have a namespace");

    this.map.set(toolClass.toolId, toolClass);

    // throw away the current _keyinList and produce a new one when asked.
    this._keyinList = undefined;
  }

  /**
   * register all the Tool classes found in a module.
   * @param modelObj the module to search for subclasses of Tool.
   */
  public registerModule(moduleObj: any, namespace?: I18NNamespace) {
    for (const thisMember in moduleObj) {
      if (!thisMember)
        continue;

      const thisTool = moduleObj[thisMember];
      if (thisTool.prototype instanceof Tool) {
        this.register(thisTool, namespace);
      }
    }
  }

  /** Look up a tool by toolId */
  public find(toolId: string): typeof Tool | undefined { return this.map.get(toolId); }

  /**
   * Look up a tool by toolId and, if found, create an instance with the supplied arguments.
   * @param toolId the toolId of the tool
   * @param args arguments to pass to the constructor.
   * @returns an instance of the registered Tool class, or undefined if toolId is not registered.
   */
  public create(toolId: string, ...args: any[]): Tool | undefined {
    const toolClass = this.find(toolId);
    return toolClass ? new toolClass(...args) : undefined;
  }

  /**
   * Look up a tool by toolId and, if found, create an instance with the supplied arguments and run it.
   * @param toolId toolId of the immediate tool
   * @param args arguments to pass to the constructor.
   * @return true if the tool was found and successfully run.
   */
  public run(toolId: string, ...args: any[]): boolean {
    const tool = this.create(toolId, ...args);
    return !!tool && tool.run(...args);
  }

  private async getKeyinList(): Promise<CommandList> {
    if (this._keyinList) return this._keyinList;
    const thePromise: Promise<CommandList> = new Promise<CommandList>((resolve: any, reject: any) => {
      iModelApp.i18N.waitForAllRead().then(() => {
        this._keyinList = new Array<typeof Tool>();
        for (const thisTool of this.map.values()) {
          this._keyinList!.push(thisTool);
        }
        resolve(this._keyinList);
      }, () => { reject(); });
    });
    return thePromise;
  }

  public async findPartialMatches(keyin: string): Promise<FuzzySearchResults<typeof Tool>> {
    const commandList: CommandList = await iModelApp.tools.getKeyinList();
    const searcher: FuzzySearch<typeof Tool> = new FuzzySearch<typeof Tool>();
    const searchResults: FuzzySearchResults<typeof Tool> = searcher.search(commandList, ["keyin"], keyin);
    return searchResults;
  }

  public async executeExactMatch(keyin: string, ...args: any[]): Promise<boolean> {
    const foundClass: typeof Tool | undefined = await this.findExactMatch(keyin);
    if (!foundClass)
      return false;
    return new foundClass(...args).run(...args);
  }

  public async findExactMatch(keyin: string): Promise<typeof Tool | undefined> {
    const commandList: CommandList = await iModelApp.tools.getKeyinList();
    for (const thisTool of commandList) {
      if (thisTool.keyin === keyin)
        return thisTool;
    }
    return undefined;
  }
}
