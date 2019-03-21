// @public
class AccuDraw {
  // (undocumented)
  protected _acsPickId?: string;
  // (undocumented)
  protected _animationFrames: number;
  // (undocumented)
  protected _compassSizeInches: number;
  // (undocumented)
  protected readonly _fillColor: ColorDef;
  // (undocumented)
  protected readonly _fillColorNoFocus: ColorDef;
  // (undocumented)
  protected readonly _frameColor: ColorDef;
  // (undocumented)
  protected readonly _frameColorNoFocus: ColorDef;
  // (undocumented)
  protected readonly _indexColor: ColorDef;
  // (undocumented)
  protected _indexToleranceInches: number;
  // (undocumented)
  protected readonly _xColor: ColorDef;
  // (undocumented)
  protected readonly _yColor: ColorDef;
  // (undocumented)
  accountForAuxRotationPlane(rot: ThreeAxes, plane: RotationMode): void;
  // (undocumented)
  activate(): void;
  // (undocumented)
  adjustPoint(pointActive: Point3d, vp: ScreenViewport, fromSnap: boolean): boolean;
  // (undocumented)
  alwaysShowCompass: boolean;
  // (undocumented)
  angleLock(): void;
  // (undocumented)
  autoFocusFields: boolean;
  // (undocumented)
  autoPointPlacement: boolean;
  // (undocumented)
  readonly axes: ThreeAxes;
  // (undocumented)
  axisIndexing: boolean;
  // (undocumented)
  readonly baseAxes: ThreeAxes;
  // (undocumented)
  changeBaseRotationMode(mode: RotationMode): void;
  // (undocumented)
  changeCompassMode(animate?: boolean): void;
  // (undocumented)
  clearTentative(): boolean;
  // (undocumented)
  compassMode: CompassMode;
  // (undocumented)
  contextSensitive: boolean;
  // (undocumented)
  currentState: CurrentState;
  // (undocumented)
  currentView?: ScreenViewport;
  // (undocumented)
  deactivate(): void;
  // (undocumented)
  decorate(context: DecorateContext): void;
  // (undocumented)
  readonly delta: Vector3d;
  // (undocumented)
  disableForSession(): void;
  // (undocumented)
  distanceIndexing: boolean;
  // (undocumented)
  distanceLock(synchText: boolean, saveInHistory: boolean): void;
  // (undocumented)
  doAutoPoint(index: ItemField, mode: CompassMode): void;
  // (undocumented)
  doLockAngle(isSnapped: boolean): void;
  // (undocumented)
  dontMoveFocus: boolean;
  // (undocumented)
  downgradeInactiveState(): boolean;
  // (undocumented)
  enableForSession(): void;
  // (undocumented)
  fixPointPolar(vp: Viewport): void;
  // (undocumented)
  fixPointRectangular(vp: Viewport): void;
  // (undocumented)
  readonly flags: Flags;
  // (undocumented)
  floatingOrigin: boolean;
  // (undocumented)
  static getCurrentOrientation(vp: Viewport, checkAccuDraw: boolean, checkACS: boolean, rMatrix?: Matrix3d): Matrix3d | undefined;
  // (undocumented)
  getDecorationGeometry(hit: HitDetail): GeometryStreamProps | undefined;
  // (undocumented)
  getFieldLock(index: ItemField): boolean;
  // (undocumented)
  getKeyinStatus(index: ItemField): KeyinStatus;
  // (undocumented)
  getRotation(rMatrix?: Matrix3d): Matrix3d;
  // (undocumented)
  static getSnapRotation(snap: SnapDetail, currentVp: Viewport | undefined, out?: Matrix3d): Matrix3d | undefined;
  // (undocumented)
  static getStandardRotation(nStandard: StandardViewId, vp: Viewport | undefined, useACS: boolean, out?: Matrix3d): Matrix3d;
  // (undocumented)
  getValueByIndex(index: ItemField): number;
  grabInputFocus(): void;
  hardConstructionPlane(outPtP: Point3d, inPtP: Point3d, pointOnPlaneP: Point3d, normalVectorP: Vector3d, vp: Viewport, isSnap: boolean): boolean;
  // (undocumented)
  readonly hasInputFocus: boolean;
  // (undocumented)
  indexed: LockedStates;
  // (undocumented)
  readonly isActive: boolean;
  // (undocumented)
  readonly isDeactivated: boolean;
  // (undocumented)
  readonly isEnabled: boolean;
  // (undocumented)
  readonly isInactive: boolean;
  // (undocumented)
  isZLocked(vp: Viewport): boolean;
  // (undocumented)
  readonly lastAxes: ThreeAxes;
  // (undocumented)
  locked: LockedStates;
  // (undocumented)
  newFocus: ItemField;
  // (undocumented)
  onBeginDynamics(): boolean;
  // (undocumented)
  onCompassModeChange(): void;
  // (undocumented)
  onEndDynamics(): boolean;
  // (undocumented)
  onFieldLockChange(_index: ItemField): void;
  // (undocumented)
  onFieldValueChange(_index: ItemField): void;
  // (undocumented)
  onInitialized(): void;
  // (undocumented)
  onInputCollectorExit(): boolean;
  // (undocumented)
  onInputCollectorInstall(): boolean;
  onMotion(_ev: BeButtonEvent): void;
  // (undocumented)
  onPostButtonEvent(ev: BeButtonEvent): boolean;
  // (undocumented)
  onPreButtonEvent(ev: BeButtonEvent): boolean;
  // (undocumented)
  onPrimitiveToolInstall(): boolean;
  // (undocumented)
  onRotationModeChange(): void;
  // (undocumented)
  onSelectedViewportChanged(previous: ScreenViewport | undefined, current: ScreenViewport | undefined): void;
  // (undocumented)
  onSnap(snap: SnapDetail): boolean;
  // (undocumented)
  onTentative(): boolean;
  // (undocumented)
  onViewToolExit(): boolean;
  // (undocumented)
  onViewToolInstall(): boolean;
  // (undocumented)
  readonly origin: Point3d;
  // (undocumented)
  readonly planePt: Point3d;
  // (undocumented)
  readonly point: Point3d;
  // (undocumented)
  processFieldInput(index: ItemField, input: string, synchText: boolean): void;
  // (undocumented)
  processHints(): void;
  // (undocumented)
  readonly published: AccudrawData;
  // (undocumented)
  refreshDecorationsAndDynamics(): void;
  // (undocumented)
  restoreState(stateBuffer: SavedState): void;
  // (undocumented)
  rotationMode: RotationMode;
  // (undocumented)
  saveCoordinate(index: ItemField, value: number): void;
  // (undocumented)
  readonly savedStateInputCollector: SavedState;
  // (undocumented)
  readonly savedStateViewTool: SavedState;
  // (undocumented)
  saveState(stateBuffer: SavedState): void;
  // (undocumented)
  sendDataPoint(pt: Point3d, vp: ScreenViewport): void;
  // (undocumented)
  setCompassMode(mode: CompassMode): void;
  // (undocumented)
  setContext(flags: AccuDrawFlags, originP?: Point3d, orientationP?: Matrix3d | Vector3d, deltaP?: Vector3d, distanceP?: number, angleP?: number, transP?: Transform): BentleyStatus;
  // (undocumented)
  setContextRotation(rMatrix: Matrix3d, locked: boolean, animate: boolean): void;
  // (undocumented)
  setFieldLock(index: ItemField, locked: boolean): void;
  // (undocumented)
  setFocusItem(_index: ItemField): void;
  // (undocumented)
  setKeyinStatus(index: ItemField, status: KeyinStatus): void;
  // (undocumented)
  setLastPoint(pt: Point3d): void;
  // (undocumented)
  protected setNewFocus(index: ItemField): void;
  // (undocumented)
  setRotationMode(mode: RotationMode): void;
  // (undocumented)
  setValueByIndex(index: ItemField, value: number): void;
  // (undocumented)
  smartKeyin: boolean;
  // (undocumented)
  softConstructionPlane(outPtP: Point3d, inPtP: Point3d, pointOnPlaneP: Point3d, normalVectorP: Vector3d, vp: Viewport, isSnap: boolean): boolean;
  // (undocumented)
  stickyZLock: boolean;
  // (undocumented)
  testDecorationHit(id: string): boolean;
  // (undocumented)
  unlockAllFields(): void;
  // (undocumented)
  static updateAuxCoordinateSystem(acs: AuxCoordSystemState, vp: Viewport, allViews?: boolean): void;
  // (undocumented)
  updateFieldLock(index: ItemField, locked: boolean): void;
  // (undocumented)
  updateRotation(animate?: boolean, newRotationIn?: Matrix3d): void;
  // (undocumented)
  upgradeToActiveState(): boolean;
  // (undocumented)
  readonly vector: Vector3d;
}

// @public (undocumented)
class AccudrawData {
  // (undocumented)
  angle: number;
  // (undocumented)
  readonly delta: Point3d;
  // (undocumented)
  distance: number;
  // (undocumented)
  flags: number;
  // (undocumented)
  readonly origin: Point3d;
  // (undocumented)
  readonly rMatrix: Matrix3d;
  // (undocumented)
  readonly vector: Vector3d;
  // (undocumented)
  zero(): void;
}

// @public (undocumented)
enum AccuDrawFlags {
  // (undocumented)
  AlwaysSetOrigin = 2097156,
  // (undocumented)
  Disable = 4096,
  // (undocumented)
  FixedOrigin = 8,
  // (undocumented)
  Lock_X = 512,
  // (undocumented)
  Lock_Y = 1024,
  // (undocumented)
  Lock_Z = 2048,
  // (undocumented)
  LockAngle = 524288,
  // (undocumented)
  LockDistance = 256,
  // (undocumented)
  OrientACS = 131072,
  // (undocumented)
  OrientDefault = 16384,
  // (undocumented)
  RedrawCompass = 4194304,
  // (undocumented)
  SetDistance = 128,
  // (undocumented)
  SetFocus = 32768,
  // (undocumented)
  SetModePolar = 1,
  // (undocumented)
  SetModeRect = 2,
  // (undocumented)
  SetNormal = 64,
  // (undocumented)
  SetOrigin = 4,
  // (undocumented)
  SetRMatrix = 16,
  // (undocumented)
  SetXAxis = 32,
  // (undocumented)
  SetXAxis2 = 262144,
  // (undocumented)
  SmartRotation = 16777216,
  // (undocumented)
  UpdateRotation = 8388608
}

// @public
class AccuDrawHintBuilder {
  // (undocumented)
  enableSmartRotation: boolean;
  sendHints(activate?: boolean): boolean;
  // (undocumented)
  setAngle(angle: number): void;
  // (undocumented)
  setDistance(distance: number): void;
  // (undocumented)
  setLockAngle: boolean;
  // (undocumented)
  setLockDistance: boolean;
  // (undocumented)
  setLockX: boolean;
  // (undocumented)
  setLockY: boolean;
  // (undocumented)
  setLockZ: boolean;
  // (undocumented)
  setModePolar(): void;
  // (undocumented)
  setModeRectangular(): void;
  // (undocumented)
  setNormal(normal: Vector3d): void;
  // (undocumented)
  setOrigin(origin: Point3d): void;
  // (undocumented)
  setOriginAlways: boolean;
  // (undocumented)
  setOriginFixed: boolean;
  // (undocumented)
  setRotation(rMatrix: Matrix3d): void;
  // (undocumented)
  setXAxis(xAxis: Vector3d): void;
  // (undocumented)
  setXAxis2(xAxis: Vector3d): void;
}

// @public
class AccuDrawShortcuts {
  // (undocumented)
  static alignView(): void;
  // (undocumented)
  static changeCompassMode(): void;
  // (undocumented)
  static defineACSByElement(): void;
  // (undocumented)
  static defineACSByPoints(): void;
  // (undocumented)
  static getACS(acsName: string | undefined, useOrigin: boolean, useRotation: boolean): BentleyStatus;
  // (undocumented)
  static itemFieldAcceptInput(index: ItemField, str: string): void;
  // (undocumented)
  static itemFieldLockToggle(index: ItemField): void;
  // (undocumented)
  static itemFieldNavigate(index: ItemField, str: string, forward: boolean): void;
  // (undocumented)
  static itemFieldNewInput(index: ItemField): void;
  // (undocumented)
  static itemFieldUnlockAll(): void;
  // (undocumented)
  static itemRotationModeChange(rotation: RotationMode): void;
  // (undocumented)
  static lockAngle(): void;
  // (undocumented)
  static lockDistance(): void;
  // (undocumented)
  lockIndex(): void;
  // (undocumented)
  static lockSmart(): void;
  // (undocumented)
  static lockX(): void;
  // (undocumented)
  static lockY(): void;
  // (undocumented)
  static lockZ(): void;
  // (undocumented)
  static processPendingHints(): void;
  // (undocumented)
  static requestInputFocus(): void;
  // (undocumented)
  static rotate90(axis: number): void;
  // (undocumented)
  static rotateAxes(aboutCurrentZ: boolean): void;
  // (undocumented)
  static rotateAxesByPoint(isSnapped: boolean, aboutCurrentZ: boolean): boolean;
  // (undocumented)
  static rotateCycle(updateCurrentACS: boolean): void;
  // (undocumented)
  static rotateToACS(): void;
  // (undocumented)
  static rotateToBase(): void;
  // (undocumented)
  static rotateToElement(updateCurrentACS: boolean): void;
  // (undocumented)
  static setOrigin(explicitOrigin?: Point3d): void;
  // (undocumented)
  static setStandardRotation(rotation: RotationMode): void;
  // (undocumented)
  static updateACSByPoints(acs: AuxCoordSystemState, vp: Viewport, points: Point3d[], isDynamics: boolean): boolean;
  // (undocumented)
  static writeACS(_acsName: string): BentleyStatus;
}

// @public (undocumented)
class AccuDrawTool {
  // (undocumented)
  activateAccuDrawOnStart(): boolean;
  // (undocumented)
  abstract doManipulation(ev: BeButtonEvent | undefined, isMotion: boolean): Promise<boolean>;
  // (undocumented)
  doManipulationStart(): void;
  // (undocumented)
  doManipulationStop(cancel: boolean): void;
  // (undocumented)
  static installTool(shortcut: AccuDrawTool): boolean;
  // (undocumented)
  onDecorate(_context: DecorateContext): void;
  // (undocumented)
  onManipulationComplete(): AccuDrawFlags;
  // (undocumented)
  static outputPrompt(messageKey: string): void;
}

// @public (undocumented)
class AccuSnap {
}

// @public (undocumented)
enum ACSDisplayOptions {
  // (undocumented)
  Active = 1,
  // (undocumented)
  CheckVisible = 8,
  // (undocumented)
  Deemphasized = 2,
  // (undocumented)
  Dynamics = 16,
  // (undocumented)
  Hilite = 4,
  // (undocumented)
  None = 0
}

// @public (undocumented)
enum ACSType {
  // (undocumented)
  Cylindrical = 2,
  // (undocumented)
  None = 0,
  // (undocumented)
  Rectangular = 1,
  // (undocumented)
  Spherical = 3
}

// @public
class ActivityMessageDetails {
  constructor(showProgressBar: boolean, showPercentInMessage: boolean, supportsCancellation: boolean, showDialogInitially?: boolean);
  onActivityCancelled(): void;
  onActivityCompleted(): void;
  // (undocumented)
  showDialogInitially: boolean;
  // (undocumented)
  showPercentInMessage: boolean;
  // (undocumented)
  showProgressBar: boolean;
  // (undocumented)
  supportsCancellation: boolean;
  // (undocumented)
  wasCancelled: boolean;
}

// @public
enum ActivityMessageEndReason {
  // (undocumented)
  Cancelled = 1,
  // (undocumented)
  Completed = 0
}

// WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
// @internal
class AnimationBranchState {
  constructor(transform?: Transform, clip?: RenderClipVolume, omit?: boolean);
  // (undocumented)
  readonly clip?: RenderClipVolume;
  // (undocumented)
  readonly omit?: boolean;
  // (undocumented)
  readonly transform?: Transform;
}

// @public (undocumented)
interface AppearanceOverrideProps {
  // (undocumented)
  color?: ColorDefProps;
  // (undocumented)
  ids?: Id64Set;
  // (undocumented)
  overrideType?: FeatureOverrideType;
}

// @public
interface ArrayValue extends BasePropertyValue {
  // (undocumented)
  items: PropertyRecord[];
  // (undocumented)
  itemsTypeName: string;
  // (undocumented)
  valueFormat: PropertyValueFormat.Array;
}

// WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
// @internal (undocumented)
module Attachments {
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  class Attachment {
    protected constructor(props: ViewAttachmentProps, view: ViewState);
    // WARNING: The type "Tree" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    protected _tree?: Tree;
    clearClipping(): void;
    // (undocumented)
    clip: ClipVector;
    static readonly DEBUG_BOUNDING_BOX_COLOR: ColorDef;
    debugDrawBorder(context: SceneContext): void;
    // (undocumented)
    displayPriority: number;
    getOrCreateClip(transform?: Transform): ClipVector;
    // (undocumented)
    id: Id64String;
    readonly is2d: boolean;
    readonly isReady: boolean;
    // WARNING: The type "State" needs to be exported by the package (e.g. added to index.ts)
    abstract load(sheetView: SheetViewState, sceneContext: SceneContext): State;
    // (undocumented)
    placement: Placement2d;
    // (undocumented)
    scale: number;
    // WARNING: The type "Tree" needs to be exported by the package (e.g. added to index.ts)
    tree: Tree | undefined;
    // (undocumented)
    readonly view: ViewState;
  }

  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  class Attachment2d extends Attachment {
    constructor(props: ViewAttachmentProps, view: ViewState2d);
    // (undocumented)
    readonly is2d: boolean;
    // WARNING: The type "State" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    load(_sheetView: SheetViewState, _sceneContext: SceneContext): State;
  }

  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  class Attachment3d extends Attachment {
    constructor(props: ViewAttachmentProps, view: ViewState3d);
    // WARNING: The type "State" needs to be exported by the package (e.g. added to index.ts)
    getState(depth: number): State;
    // (undocumented)
    readonly is2d: boolean;
    // WARNING: The type "State" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    load(sheetView: SheetViewState, sceneContext: SceneContext): State;
    // WARNING: The type "State" needs to be exported by the package (e.g. added to index.ts)
    setState(depth: number, state: State): void;
  }

  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  class AttachmentList {
    constructor();
    // WARNING: The type "Attachment" needs to be exported by the package (e.g. added to index.ts)
    add(attachment: Attachment): void;
    readonly allReady: boolean;
    clear(): void;
    // WARNING: The type "Attachment" needs to be exported by the package (e.g. added to index.ts)
    drop(attachment: Attachment): void;
    readonly length: number;
    // WARNING: The type "Attachment" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    readonly list: Attachment[];
    // WARNING: The type "State" needs to be exported by the package (e.g. added to index.ts)
    load(idx: number, sheetView: SheetViewState, sceneContext: SceneContext): State;
  }

  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  class AttachmentTileLoader extends TileLoader {
    // (undocumented)
    getChildrenProps(_parent: Tile): Promise<TileProps[]>;
    // (undocumented)
    readonly is3dAttachment: boolean;
    // WARNING: The type "Tile.LoadPriority" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    readonly priority: Tile.LoadPriority;
    // WARNING: The type "TileRequest.Response" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    requestTileContent(_tile: Tile): Promise<TileRequest.Response>;
    // WARNING: The type "Tile.Params" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    tileRequiresLoading(_params: Tile.Params): boolean;
  }

  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  class AttachmentViewport extends OffScreenViewport {
    // WARNING: The type "State" needs to be exported by the package (e.g. added to index.ts)
    // WARNING: The type "State" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    createScene(currentState: State): State;
    // (undocumented)
    readonly isAspectRatioLocked: boolean;
    // (undocumented)
    renderImage(): ImageBuffer | undefined;
    // (undocumented)
    rendering: boolean;
    // (undocumented)
    renderTexture(): void;
    // WARNING: The type "Tree3d" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    setSceneDepth(depth: number, tree: Tree3d): void;
    // (undocumented)
    readonly texture: RenderTexture | undefined;
    // (undocumented)
    toParent: Transform;
  }

  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal
  enum State {
    // (undocumented)
    Empty = 1,
    // (undocumented)
    Loading = 2,
    // (undocumented)
    NotLoaded = 0,
    // (undocumented)
    Ready = 3
  }

  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  class Tile2d extends Tile {
    // WARNING: The type "Tree2d" needs to be exported by the package (e.g. added to index.ts)
    constructor(root: Tree2d, range: ElementAlignedBox2d);
    // WARNING: The type "Tile.DrawArgs" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    drawGraphics(args: Tile.DrawArgs): void;
    // (undocumented)
    readonly hasChildren: boolean;
    // (undocumented)
    readonly hasGraphics: boolean;
  }

  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  class Tile3d extends Tile {
    // WARNING: The type "Tree3d" needs to be exported by the package (e.g. added to index.ts)
    // WARNING: The type "Tile3d" needs to be exported by the package (e.g. added to index.ts)
    // WARNING: The type "Tile3dPlacement" needs to be exported by the package (e.g. added to index.ts)
    // WARNING: The type "Tile3d" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    static create(root: Tree3d, parent: Tile3d | undefined, placement: Tile3dPlacement): Tile3d;
    // (undocumented)
    createGraphics(context: SceneContext): void;
    // (undocumented)
    createPolyfaces(context: SceneContext): void;
    // WARNING: The type "Tile.DrawArgs" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    drawGraphics(args: Tile.DrawArgs): void;
    // (undocumented)
    readonly hasChildren: boolean;
    // (undocumented)
    readonly hasGraphics: boolean;
    // (undocumented)
    prepareChildren(): Tile[] | undefined;
    // WARNING: The type "Tile.DrawArgs" needs to be exported by the package (e.g. added to index.ts)
    // WARNING: The type "Tile.SelectParent" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    selectTiles(selected: Tile[], args: Tile.DrawArgs, _numSkipped?: number): Tile.SelectParent;
  }

  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal
  enum Tile3dPlacement {
    // (undocumented)
    LowerLeft = 2,
    // (undocumented)
    LowerRight = 3,
    // (undocumented)
    Root = 4,
    // (undocumented)
    UpperLeft = 0,
    // (undocumented)
    UpperRight = 1
  }

  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  class Tree extends TileTree {
    // WARNING: The type "AttachmentTileLoader" needs to be exported by the package (e.g. added to index.ts)
    constructor(loader: AttachmentTileLoader, iModel: IModelConnection, modelId: Id64String);
    // (undocumented)
    graphicsClip?: ClipVector;
  }

  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  class Tree2d extends Tree {
    // WARNING: The type "Attachment2d" needs to be exported by the package (e.g. added to index.ts)
    // WARNING: The type "State" needs to be exported by the package (e.g. added to index.ts)
    static create(attachment: Attachment2d): State;
    // (undocumented)
    readonly drawingToAttachment: Transform;
    // WARNING: The type "FeatureSymbology.Overrides" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    readonly symbologyOverrides: FeatureSymbology.Overrides;
    // (undocumented)
    readonly view: ViewState2d;
    // (undocumented)
    readonly viewRoot: TileTree;
  }

  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  class Tree3d extends Tree {
    // WARNING: The type "Attachment3d" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    readonly attachment: Attachment3d;
    // (undocumented)
    readonly biasDistance: number;
    // WARNING: The type "Attachment3d" needs to be exported by the package (e.g. added to index.ts)
    // WARNING: The type "Tree3d" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    static create(sheetView: SheetViewState, attachment: Attachment3d, sceneContext: SceneContext): Tree3d;
    // (undocumented)
    readonly featureTable: PackedFeatureTable;
    getRootRange(result?: Range3d): Range3d;
    // WARNING: The type "State" needs to be exported by the package (e.g. added to index.ts)
    getState(depth: number): State;
    // WARNING: The type "State" needs to be exported by the package (e.g. added to index.ts)
    setState(depth: number, state: State): void;
    // (undocumented)
    readonly sheetView: SheetViewState;
    // (undocumented)
    readonly tileColor: ColorDef;
    // WARNING: The type "AttachmentViewport" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    readonly viewport: AttachmentViewport;
  }

}

// @public
class AuthorizedFrontendRequestContext extends AuthorizedClientRequestContext {
  constructor(accessToken: AccessToken, activityId?: string);
  static create(activityId?: string): Promise<AuthorizedFrontendRequestContext>;
}

// @public
class AuxCoordSystem2dState extends AuxCoordSystemState, implements AuxCoordSystem2dProps {
  constructor(props: AuxCoordSystem2dProps, iModel: IModelConnection);
  // (undocumented)
  angle: number;
  // (undocumented)
  getOrigin(result?: Point3d): Point3d;
  // (undocumented)
  getRotation(result?: Matrix3d): Matrix3d;
  // (undocumented)
  readonly origin: Point2d;
  // (undocumented)
  setOrigin(val: XYAndZ | XAndY): void;
  // (undocumented)
  setRotation(val: Matrix3d): void;
  // (undocumented)
  toJSON(): AuxCoordSystem2dProps;
}

// @public
class AuxCoordSystem3dState extends AuxCoordSystemState, implements AuxCoordSystem3dProps {
  constructor(props: AuxCoordSystem3dProps, iModel: IModelConnection);
  // (undocumented)
  getOrigin(result?: Point3d): Point3d;
  // (undocumented)
  getRotation(result?: Matrix3d): Matrix3d;
  // (undocumented)
  readonly origin: Point3d;
  // (undocumented)
  pitch: number;
  // (undocumented)
  roll: number;
  // (undocumented)
  setOrigin(val: XYAndZ | XAndY): void;
  // (undocumented)
  setRotation(rMatrix: Matrix3d): void;
  // (undocumented)
  toJSON(): AuxCoordSystem3dProps;
  // (undocumented)
  yaw: number;
}

// @public
class AuxCoordSystemSpatialState extends AuxCoordSystem3dState {
}

// @public
class AuxCoordSystemState extends ElementState, implements AuxCoordSystemProps {
  constructor(props: AuxCoordSystemProps, iModel: IModelConnection);
  static createNew(acsName: string, iModel: IModelConnection): AuxCoordSystemState;
  // (undocumented)
  description?: string;
  // (undocumented)
  display(context: DecorateContext, options: ACSDisplayOptions): void;
  // (undocumented)
  drawGrid(context: DecorateContext): void;
  // (undocumented)
  static fromProps(props: AuxCoordSystemProps, iModel: IModelConnection): AuxCoordSystemState;
  // (undocumented)
  abstract getOrigin(result?: Point3d): Point3d;
  abstract getRotation(result?: Matrix3d): Matrix3d;
  // (undocumented)
  readonly is3d: boolean;
  static isOriginInView(drawOrigin: Point3d, viewport: Viewport, adjustOrigin: boolean): boolean;
  // (undocumented)
  isValidForView(view: ViewState): boolean;
  // (undocumented)
  abstract setOrigin(val: XYAndZ | XAndY): void;
  // (undocumented)
  abstract setRotation(val: Matrix3d): void;
  // (undocumented)
  toJSON(): AuxCoordSystemProps;
  // (undocumented)
  type: number;
}

// @public
interface BasePropertyEditorParams {
  // (undocumented)
  type: PropertyEditorParamTypes;
}

// @public
interface BasePropertyValue {
  // (undocumented)
  valueFormat: PropertyValueFormat;
}

// @public (undocumented)
enum BeButton {
  // (undocumented)
  Data = 0,
  // (undocumented)
  Middle = 2,
  // (undocumented)
  Reset = 1
}

// @public (undocumented)
class BeButtonEvent {
  // (undocumented)
  button: BeButton;
  // (undocumented)
  clone(result?: BeButtonEvent): BeButtonEvent;
  // (undocumented)
  coordsFrom: CoordSource;
  // (undocumented)
  getDisplayPoint(): Point2d;
  // (undocumented)
  initEvent(point: Point3d, rawPoint: Point3d, viewPt: Point3d, vp: ScreenViewport, from: CoordSource, keyModifiers?: BeModifierKeys, button?: BeButton, isDown?: boolean, doubleClick?: boolean, isDragging?: boolean, source?: InputSource): void;
  // (undocumented)
  inputSource: InputSource;
  // (undocumented)
  invalidate(): void;
  // (undocumented)
  readonly isAltKey: boolean;
  // (undocumented)
  readonly isControlKey: boolean;
  // (undocumented)
  isDoubleClick: boolean;
  // (undocumented)
  isDown: boolean;
  // (undocumented)
  isDragging: boolean;
  // (undocumented)
  readonly isShiftKey: boolean;
  // (undocumented)
  readonly isValid: boolean;
  // (undocumented)
  keyModifiers: BeModifierKeys;
  // (undocumented)
  point: Point3d;
  // (undocumented)
  rawPoint: Point3d;
  // (undocumented)
  setFrom(src: BeButtonEvent): void;
  // (undocumented)
  viewPoint: Point3d;
  // (undocumented)
  viewport?: ScreenViewport;
}

// @public (undocumented)
class BeButtonState {
  // (undocumented)
  downRawPt: Point3d;
  // (undocumented)
  downTime: number;
  // (undocumented)
  downUorPt: Point3d;
  // (undocumented)
  init(downUorPt: Point3d, downRawPt: Point3d, downTime: number, isDown: boolean, isDoubleClick: boolean, isDragging: boolean, source: InputSource): void;
  // (undocumented)
  inputSource: InputSource;
  // (undocumented)
  isDoubleClick: boolean;
  // (undocumented)
  isDown: boolean;
  // (undocumented)
  isDragging: boolean;
}

// @public
enum BeModifierKeys {
  // (undocumented)
  Alt = 4,
  // (undocumented)
  Control = 1,
  // (undocumented)
  None = 0,
  // (undocumented)
  Shift = 2
}

// @public
class BeTouchEvent extends BeButtonEvent {
  constructor(touchInfo: TouchEvent);
  // (undocumented)
  clone(result?: BeTouchEvent): BeTouchEvent;
  // (undocumented)
  static findTouchById(list: TouchList, id: number): Touch | undefined;
  // (undocumented)
  static getTouchListCentroid(list: TouchList, vp: ScreenViewport): Point2d | undefined;
  // (undocumented)
  static getTouchPosition(touch: Touch, vp: ScreenViewport): Point2d;
  // (undocumented)
  readonly isDoubleTap: boolean;
  // (undocumented)
  readonly isSingleTap: boolean;
  // (undocumented)
  readonly isSingleTouch: boolean;
  // (undocumented)
  readonly isTwoFingerTap: boolean;
  // (undocumented)
  readonly isTwoFingerTouch: boolean;
  // (undocumented)
  setFrom(src: BeTouchEvent): void;
  // (undocumented)
  tapCount: number;
  // (undocumented)
  readonly touchCount: number;
  // (undocumented)
  touchInfo: TouchEvent;
}

// @public
class BeWheelEvent extends BeButtonEvent {
  constructor(wheelDelta?: number);
  // (undocumented)
  clone(result?: BeWheelEvent): BeWheelEvent;
  // (undocumented)
  setFrom(src: BeWheelEvent): void;
  // (undocumented)
  wheelDelta: number;
}

// @public
interface ButtonGroupEditorParams extends BasePropertyEditorParams {
  // (undocumented)
  buttons: IconDefinition[];
  // (undocumented)
  type: PropertyEditorParamTypes.ButtonGroupData;
}

// @public
interface CanvasDecoration {
  decorationCursor?: string;
  drawDecoration(ctx: CanvasRenderingContext2D): void;
  onMouseButton?(ev: BeButtonEvent): boolean;
  onMouseEnter?(ev: BeButtonEvent): void;
  onMouseLeave?(): void;
  onMouseMove?(ev: BeButtonEvent): void;
  onWheel?(ev: BeWheelEvent): boolean;
  pick?(pt: XAndY): boolean;
  position?: XAndY;
}

// @public
class CategorySelectorState extends ElementState {
  constructor(props: CategorySelectorProps, iModel: IModelConnection);
  addCategories(arg: Id64Arg): void;
  // (undocumented)
  categories: Set<string>;
  changeCategoryDisplay(arg: Id64Arg, add: boolean): void;
  dropCategories(arg: Id64Arg): void;
  equalState(other: CategorySelectorState): boolean;
  has(id: Id64String): boolean;
  isCategoryViewed(categoryId: Id64String): boolean;
  readonly name: string;
  // (undocumented)
  toJSON(): CategorySelectorProps;
}

// @public
interface CheckBoxIconsEditorParams extends BasePropertyEditorParams {
  // (undocumented)
  offIconDefinition?: IconDefinition;
  // (undocumented)
  onIconDefinition?: IconDefinition;
  // (undocumented)
  type: PropertyEditorParamTypes.CheckBoxIcons;
}

// @public
enum ClassifierType {
  // (undocumented)
  Planar = 1,
  // (undocumented)
  Volume = 0
}

// @public
enum ClippingType {
  Mask = 1,
  None = 0,
  Planes = 2
}

// @public
enum ClipResult {
  NewElements = 1,
  NotSupported = 0,
  OriginalElements = 2
}

// WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
// @internal
class Clips {
  // (undocumented)
  clear(): void;
  // (undocumented)
  readonly count: number;
  // (undocumented)
  readonly isValid: boolean;
  // WARNING: The type "TextureHandle" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  set(numPlanes: number, texture: TextureHandle): void;
  // WARNING: The type "TextureHandle" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  readonly texture: TextureHandle | undefined;
}

// @public
class Cluster<T extends Marker> {
  constructor(markers: T[]);
  // (undocumented)
  clusterMarker?: Marker;
  // (undocumented)
  readonly markers: T[];
  // (undocumented)
  readonly rect: ViewRect;
}

// @public
interface ColorEditorParams extends BasePropertyEditorParams {
  colorValues: number[];
  numColumns?: number;
  // (undocumented)
  type: PropertyEditorParamTypes.ColorData;
}

// @public (undocumented)
enum CompassMode {
  // (undocumented)
  Polar = 0,
  // (undocumented)
  Rectangular = 1
}

// @public (undocumented)
enum ContextMode {
  // (undocumented)
  Locked = 0,
  // (undocumented)
  None = 15,
  // (undocumented)
  XAxis = 1,
  // (undocumented)
  XAxis2 = 4,
  // (undocumented)
  YAxis = 2,
  // (undocumented)
  ZAxis = 3
}

// WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
// @internal (undocumented)
class ContextRealityModelState implements TileTreeModelState {
  constructor(props: ContextRealityModelProps, iModel: IModelConnection);
  // (undocumented)
  protected _iModel: IModelConnection;
  // (undocumented)
  protected _modelId: Id64String;
  // (undocumented)
  protected _name: string;
  // (undocumented)
  protected _tilesetUrl: string;
  // (undocumented)
  protected _tileTreeState: TileTreeState;
  static findAvailableRealityModels(projectid: string, modelCartographicRange?: CartographicRange | undefined): Promise<ContextRealityModelProps[]>;
  intersectsProjectExtents(): Promise<boolean>;
  // WARNING: The type "TileTree.LoadStatus" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  readonly loadStatus: TileTree.LoadStatus;
  // WARNING: The type "TileTree.LoadStatus" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  loadTileTree(_batchType: BatchType, _edgesRequired: boolean, _animationId?: Id64String, _classifierExpansion?: number): TileTree.LoadStatus;
  matches(other: ContextRealityModelState): boolean;
  // (undocumented)
  readonly name: string;
  // (undocumented)
  readonly tileTree: TileTree | undefined;
  // (undocumented)
  readonly treeModelId: Id64String;
  // (undocumented)
  readonly url: string;
}

// @public
class ConversionData implements UnitConversion {
  // (undocumented)
  factor: number;
  // (undocumented)
  offset: number;
}

// @public (undocumented)
enum CoordinateLockOverrides {
  // (undocumented)
  ACS = 2,
  // (undocumented)
  All = 65535,
  // (undocumented)
  Grid = 4,
  // (undocumented)
  None = 0
}

// @public
enum CoordSource {
  ElemSnap = 3,
  Precision = 1,
  TentativePoint = 2,
  User = 0
}

// @public
enum CoordSystem {
  Npc = 1,
  View = 0,
  World = 2
}

// @public (undocumented)
class CurrentInputState {
  // (undocumented)
  adjustLastDataPoint(ev: BeButtonEvent): void;
  // (undocumented)
  button: BeButtonState[];
  // (undocumented)
  changeButtonToDownPoint(ev: BeButtonEvent): void;
  // (undocumented)
  clearKeyQualifiers(): void;
  // (undocumented)
  clearViewport(vp: Viewport): void;
  // (undocumented)
  fromButton(vp: ScreenViewport, pt: XAndY, source: InputSource, applyLocks: boolean): void;
  // (undocumented)
  fromPoint(vp: ScreenViewport, pt: XAndY, source: InputSource): void;
  // (undocumented)
  readonly hasMotionStopped: boolean;
  // (undocumented)
  inputSource: InputSource;
  // (undocumented)
  readonly isAltDown: boolean;
  // (undocumented)
  readonly isControlDown: boolean;
  // (undocumented)
  isDragging(button: BeButton): boolean;
  // (undocumented)
  readonly isShiftDown: boolean;
  // (undocumented)
  isStartDrag(button: BeButton): boolean;
  // (undocumented)
  lastButton: BeButton;
  // (undocumented)
  lastMotion: Point2d;
  // (undocumented)
  lastTouchStart?: BeTouchEvent;
  // (undocumented)
  lastWheelEvent?: BeWheelEvent;
  // (undocumented)
  motionTime: number;
  // (undocumented)
  onButtonDown(button: BeButton): void;
  // (undocumented)
  onButtonUp(button: BeButton): void;
  // (undocumented)
  onInstallTool(): void;
  // (undocumented)
  onMotion(pt2d: XAndY): void;
  // (undocumented)
  onStartDrag(button: BeButton): void;
  // (undocumented)
  qualifiers: BeModifierKeys;
  // (undocumented)
  rawPoint: Point3d;
  // (undocumented)
  setKeyQualifiers(ev: MouseEvent | KeyboardEvent | TouchEvent): void;
  // (undocumented)
  toEvent(ev: BeButtonEvent, useSnap: boolean): void;
  // (undocumented)
  toEventFromLastDataPoint(ev: BeButtonEvent): void;
  // (undocumented)
  touchTapCount?: number;
  // (undocumented)
  touchTapTimer?: number;
  // (undocumented)
  uorPoint: Point3d;
  // (undocumented)
  updateDownPoint(ev: BeButtonEvent): void;
  // (undocumented)
  viewPoint: Point3d;
  // (undocumented)
  viewport?: ScreenViewport;
  // (undocumented)
  readonly wasMotion: boolean;
}

// @public (undocumented)
enum CurrentState {
  // (undocumented)
  Active = 3,
  // (undocumented)
  Deactivated = 1,
  // (undocumented)
  Inactive = 2,
  // (undocumented)
  NotEnabled = 0
}

// @public
class DecorateContext extends RenderContext {
  // @internal
  constructor(vp: ScreenViewport, _decorations: Decorations);
  addCanvasDecoration(decoration: CanvasDecoration, atFront?: boolean): void;
  addDecoration(type: GraphicType, decoration: RenderGraphic): void;
  addDecorationFromBuilder(builder: GraphicBuilder): void;
  addHtmlDecoration(decoration: HTMLElement): void;
  createGraphicBuilder(type: GraphicType, transform?: Transform, id?: Id64String): GraphicBuilder;
  decorationDiv: HTMLDivElement;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  static drawGrid(graphic: GraphicBuilder, doIsogrid: boolean, drawDots: boolean, gridOrigin: Point3d, xVec: Vector3d, yVec: Vector3d, gridsPerRef: number, repetitions: Point2d, vp: Viewport): void;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  drawStandardGrid(gridOrigin: Point3d, rMatrix: Matrix3d, spacing: XAndY, gridsPerRef: number, isoGrid?: boolean, fixedRepetitions?: Point2d): void;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  static getGridDimension(props: {
          nRepetitions: number;
          min: number;
      }, gridSize: number, org: Point3d, dir: Point3d, points: Point3d[]): boolean;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  static getGridPlaneViewIntersections(planePoint: Point3d, planeNormal: Vector3d, vp: Viewport, useProjectExtents: boolean): Point3d[];
  readonly screenViewport: ScreenViewport;
  setSkyBox(graphic: RenderGraphic): void;
  setViewBackground(graphic: RenderGraphic): void;
}

// @public
class DecorationAnimator implements ViewportAnimator {
  constructor(duration: BeDuration);
  // (undocumented)
  animate(vp: Viewport): RemoveMe;
  animateDecorations(_viewport: Viewport, _durationPercent: number): RemoveMe;
  // (undocumented)
  onInterrupted(vp: Viewport): void;
}

// @public
class Decorations implements IDisposable {
  // (undocumented)
  canvasDecorations?: CanvasDecorationList;
  // (undocumented)
  dispose(): void;
  normal: GraphicList | undefined;
  skyBox: RenderGraphic | undefined;
  viewBackground: RenderGraphic | undefined;
  viewOverlay: GraphicList | undefined;
  world: GraphicList | undefined;
  worldOverlay: GraphicList | undefined;
}

// @public
interface Decorator {
  decorate(context: DecorateContext): void;
  getDecorationGeometry?(hit: HitDetail): GeometryStreamProps | undefined;
  getDecorationToolTip?(hit: HitDetail): Promise<HTMLElement | string>;
  onDecorationButtonEvent?(hit: HitDetail, ev: BeButtonEvent): Promise<EventHandled>;
  testDecorationHit?(id: string): boolean;
}

// @public (undocumented)
class DefaultViewTouchTool extends ViewManip {
  constructor(startEv: BeTouchEvent, _ev: BeTouchEvent);
  // (undocumented)
  onDataButtonDown(_ev: BeButtonEvent): Promise<EventHandled>;
  // (undocumented)
  onDataButtonUp(_ev: BeButtonEvent): Promise<EventHandled>;
  // (undocumented)
  onStart(ev: BeTouchEvent): void;
  // (undocumented)
  onTouchCancel(_ev: BeTouchEvent): Promise<void>;
  // (undocumented)
  onTouchComplete(_ev: BeTouchEvent): Promise<void>;
  // (undocumented)
  onTouchMove(ev: BeTouchEvent): Promise<void>;
  // (undocumented)
  static toolId: string;
}

// @public
class DepthRangeNpc {
  constructor(minimum?: number, maximum?: number);
  // (undocumented)
  maximum: number;
  middle(): number;
  // (undocumented)
  minimum: number;
}

// @public
class DisplayStyle2dState extends DisplayStyleState {
  constructor(props: DisplayStyleProps, iModel: IModelConnection);
  // (undocumented)
  readonly settings: DisplayStyleSettings;
}

// @public
class DisplayStyle3dState extends DisplayStyleState {
  constructor(props: DisplayStyleProps, iModel: IModelConnection);
  environment: Environment;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // WARNING: The type "SkyBox.CreateParams" needs to be exported by the package (e.g. added to index.ts)
  // @internal
  loadSkyBoxParams(system: RenderSystem): SkyBox.CreateParams | undefined;
  // (undocumented)
  readonly settings: DisplayStyle3dSettings;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  skyboxMaterial: RenderMaterial | undefined;
}

// @public
class DisplayStyleState extends ElementState, implements DisplayStyleProps {
  constructor(props: DisplayStyleProps, iModel: IModelConnection);
  analysisStyle: AnalysisStyle | undefined;
  backgroundColor: ColorDef;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // WARNING: The type "BackgroundMapState" needs to be exported by the package (e.g. added to index.ts)
  // @internal (undocumented)
  readonly backgroundMap: BackgroundMapState;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  readonly backgroundMapPlane: Plane3dByOriginAndUnitNormal | undefined;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  containsContextRealityModel(contextRealityModel: ContextRealityModelState): boolean;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  contextRealityModels: ContextRealityModelState[];
  dropSubCategoryOverride(id: Id64String): void;
  equalState(other: DisplayStyleState): boolean;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  forEachContextRealityModel(func: (model: TileTreeModelState) => void): void;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  getAnimationBranches(scheduleTime: number): AnimationBranchStates | undefined;
  getSubCategoryOverride(id: Id64String): SubCategoryOverride | undefined;
  readonly hasSubCategoryOverride: boolean;
  is3d(): this is DisplayStyle3dState;
  monochromeColor: ColorDef;
  readonly name: string;
  overrideSubCategory(id: Id64String, ovr: SubCategoryOverride): void;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // WARNING: The type "RenderScheduleState.Script" needs to be exported by the package (e.g. added to index.ts)
  // @internal (undocumented)
  readonly scheduleScript: RenderScheduleState.Script | undefined;
  setBackgroundMap(mapProps: BackgroundMapProps): void;
  readonly settings: DisplayStyleSettings;
  viewFlags: ViewFlags;
}

// @public
class DrawingModelState extends GeometricModel2dState {
}

// @public
class DrawingViewState extends ViewState2d {
  // (undocumented)
  static readonly className: string;
  // (undocumented)
  static createFromProps(props: ViewStateProps, iModel: IModelConnection): ViewState | undefined;
  // (undocumented)
  readonly defaultExtentLimits: ExtentLimits;
}

// @public
class DynamicsContext extends RenderContext {
  addGraphic(graphic: RenderGraphic): void;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  changeDynamics(): void;
}

// @public
module EditManipulator {
  // (undocumented)
  enum EventType {
    // (undocumented)
    Accept = 2,
    // (undocumented)
    Cancel = 1,
    // (undocumented)
    Synch = 0
  }

  // (undocumented)
  class HandleProvider {
    constructor(iModel: IModelConnection);
    // (undocumented)
    protected _isActive: boolean;
    // (undocumented)
    protected _removeDecorationListener?: () => void;
    // (undocumented)
    protected _removeManipulatorToolListener?: () => void;
    // (undocumented)
    protected _removeSelectionListener?: () => void;
    // (undocumented)
    protected clearControls(): void;
    protected abstract createControls(): Promise<boolean>;
    // (undocumented)
    decorate(_context: DecorateContext): void;
    // (undocumented)
    iModel: IModelConnection;
    protected abstract modifyControls(_hit: HitDetail, _ev: BeButtonEvent): boolean;
    // (undocumented)
    onDecorationButtonEvent(hit: HitDetail, ev: BeButtonEvent): Promise<EventHandled>;
    // (undocumented)
    protected onDoubleClick(_hit: HitDetail, _ev: BeButtonEvent): Promise<EventHandled>;
    // WARNING: The type "EventType" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    onManipulatorEvent(_eventType: EventType): void;
    // (undocumented)
    onManipulatorToolEvent(_tool: Tool, event: ManipulatorToolEvent): void;
    // (undocumented)
    protected onRightClick(_hit: HitDetail, _ev: BeButtonEvent): Promise<EventHandled>;
    // (undocumented)
    onSelectionChanged(iModel: IModelConnection, _eventType: SelectEventType, _ids?: Set<string>): void;
    // (undocumented)
    protected stop(): void;
    // (undocumented)
    protected updateControls(): Promise<void>;
    // (undocumented)
    protected updateDecorationListener(add: boolean): void;
  }

  // (undocumented)
  class HandleTool extends InputCollector {
    // WARNING: The type "HandleProvider" needs to be exported by the package (e.g. added to index.ts)
    constructor(manipulator: HandleProvider);
    // (undocumented)
    protected abstract accept(_ev: BeButtonEvent): boolean;
    // (undocumented)
    protected cancel(_ev: BeButtonEvent): boolean;
    // (undocumented)
    static hidden: boolean;
    protected init(): void;
    // WARNING: The type "HandleProvider" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    manipulator: HandleProvider;
    // (undocumented)
    onDataButtonDown(ev: BeButtonEvent): Promise<EventHandled>;
    // (undocumented)
    onPostInstall(): void;
    // (undocumented)
    onResetButtonUp(ev: BeButtonEvent): Promise<EventHandled>;
    // (undocumented)
    onTouchCancel(ev: BeTouchEvent): Promise<void>;
    // (undocumented)
    onTouchComplete(ev: BeTouchEvent): Promise<void>;
    // (undocumented)
    onTouchMove(ev: BeTouchEvent): Promise<void>;
    // (undocumented)
    static toolId: string;
  }

  // (undocumented)
  class HandleUtils {
    static getArrowShape(baseStart?: number, baseWidth?: number, tipStart?: number, tipEnd?: number, tipWidth?: number, flangeStart?: number, flangeWidth?: number): Point3d[];
    static getArrowTransform(vp: Viewport, base: Point3d, direction: Vector3d, sizeInches: number): Transform | undefined;
    // (undocumented)
    static getBoresite(origin: Point3d, vp: Viewport, checkAccuDraw?: boolean, checkACS?: boolean): Ray3d;
    // (undocumented)
    static projectPointToLineInView(spacePt: Point3d, linePt: Point3d, lineDirection: Vector3d, vp: Viewport, checkAccuDraw?: boolean, checkACS?: boolean): Point3d | undefined;
    // (undocumented)
    static projectPointToPlaneInView(spacePt: Point3d, planePt: Point3d, planeNormal: Vector3d, vp: Viewport, checkAccuDraw?: boolean, checkACS?: boolean): Point3d | undefined;
  }

}

// @public
interface EditorPosition {
  columnIndex: number;
  columnSpan?: number;
  rowPriority: number;
}

// @public (undocumented)
class ElementAgenda {
  constructor(iModel: IModelConnection);
  add(arg: Id64Arg): boolean;
  clear(): void;
  // (undocumented)
  readonly count: number;
  // (undocumented)
  readonly elements: string[];
  find(id: Id64String): boolean;
  // WARNING: The type "ModifyElementSource.Unknown" needs to be exported by the package (e.g. added to index.ts)
  getSource(): ModifyElementSource.Unknown | ModifyElementSource;
  // (undocumented)
  readonly groupMarks: GroupMark[];
  // (undocumented)
  has(id: string): boolean;
  hilite(): void;
  // (undocumented)
  hilitedState: HilitedState;
  hiliteOnAdd: boolean;
  // (undocumented)
  iModel: IModelConnection;
  invert(arg: Id64Arg): boolean;
  // (undocumented)
  readonly isEmpty: boolean;
  // (undocumented)
  readonly length: number;
  popGroup(): void;
  // (undocumented)
  remove(arg: Id64Arg): boolean;
  setSource(val: ModifyElementSource): void;
}

// @public (undocumented)
class ElementLocateManager {
  // (undocumented)
  readonly apertureInches: number;
  // (undocumented)
  clear(): void;
  // (undocumented)
  currHit?: HitDetail;
  // (undocumented)
  doLocate(response: LocateResponse, newSearch: boolean, testPoint: Point3d, view: ScreenViewport | undefined, source: InputSource, filterHits?: boolean): Promise<HitDetail | undefined>;
  // (undocumented)
  filterHit(hit: HitDetail, _action: LocateAction, out: LocateResponse): Promise<LocateFilterStatus>;
  static getFailureMessageKey(key: string): string;
  // (undocumented)
  getNextHit(): HitDetail | undefined;
  getPreLocatedHit(): HitDetail | undefined;
  // (undocumented)
  hitList?: HitList<HitDetail>;
  // (undocumented)
  initLocateOptions(): void;
  // (undocumented)
  initToolLocate(): void;
  // (undocumented)
  onInitialized(): void;
  // (undocumented)
  readonly options: LocateOptions;
  // (undocumented)
  readonly picker: ElementPicker;
  // (undocumented)
  setCurrHit(hit?: HitDetail): void;
  // (undocumented)
  setHitList(list?: HitList<HitDetail>): void;
  // (undocumented)
  readonly touchApertureInches: number;
}

// @public (undocumented)
class ElementPicker {
  doPick(vp: ScreenViewport, pickPointWorld: Point3d, pickRadiusView: number, options: LocateOptions): number;
  // (undocumented)
  empty(): void;
  getHit(i: number): HitDetail | undefined;
  getHitList(takeOwnership: boolean): HitList<HitDetail>;
  // (undocumented)
  getNextHit(): HitDetail | undefined;
  // (undocumented)
  hitList?: HitList<HitDetail>;
  // (undocumented)
  readonly pickPointWorld: Point3d;
  // (undocumented)
  resetCurrentHit(): void;
  // (undocumented)
  testHit(hit: HitDetail, vp: ScreenViewport, pickPointWorld: Point3d, pickRadiusView: number, options: LocateOptions): boolean;
  // (undocumented)
  viewport?: Viewport;
}

// @public
class ElementState extends EntityState, implements ElementProps {
  constructor(props: ElementProps, iModel: IModelConnection);
  // (undocumented)
  readonly code: Code;
  // (undocumented)
  readonly federationGuid?: GuidString;
  // (undocumented)
  readonly model: Id64String;
  // (undocumented)
  readonly parent?: RelatedElement;
  // (undocumented)
  toJSON(): ElementProps;
  // (undocumented)
  readonly userLabel?: string;
}

// @public
enum ElemMethod {
  Add = 0,
  Invert = 1
}

// @public
enum ElemSource {
  Fence = 1,
  Pick = 0,
  SelectionSet = 2
}

// @public
class EmphasizeElements implements FeatureOverrideProvider {
  // WARNING: The type "FeatureSymbology.Overrides" needs to be exported by the package (e.g. added to index.ts)
  addFeatureOverrides(overrides: FeatureSymbology.Overrides, vp: Viewport): void;
  static clear(vp: Viewport, inactiveOnly?: boolean): void;
  clearAlwaysDrawnElements(vp: Viewport): boolean;
  clearEmphasizedElements(vp: Viewport): boolean;
  clearHiddenElements(vp: Viewport): boolean;
  clearIsolatedElements(vp: Viewport): boolean;
  clearNeverDrawnElements(vp: Viewport): boolean;
  clearOverriddenElements(vp: Viewport, key?: number): boolean;
  // WARNING: The type "FeatureSymbology.Appearance" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  protected createAppearanceFromKey(key: number): FeatureSymbology.Appearance;
  // WARNING: The type "FeatureSymbology.Appearance" needs to be exported by the package (e.g. added to index.ts)
  createDefaultAppearance(): FeatureSymbology.Appearance;
  // (undocumented)
  protected createOverrideKey(color: ColorDef, override: FeatureOverrideType): number | undefined;
  // WARNING: The type "FeatureSymbology.Appearance" needs to be exported by the package (e.g. added to index.ts)
  readonly defaultAppearance: FeatureSymbology.Appearance | undefined;
  // WARNING: The type "FeatureSymbology.Appearance" needs to be exported by the package (e.g. added to index.ts)
  emphasizeElements(ids: Id64Arg, vp: Viewport, defaultAppearance?: FeatureSymbology.Appearance, replace?: boolean): boolean;
  // WARNING: The type "FeatureSymbology.Appearance" needs to be exported by the package (e.g. added to index.ts)
  emphasizeSelectedElements(vp: Viewport, defaultAppearance?: FeatureSymbology.Appearance, replace?: boolean, clearSelection?: boolean): boolean;
  // (undocumented)
  fromJSON(props: EmphasizeElementsProps, vp: Viewport): boolean;
  static get(vp: Viewport): EmphasizeElements | undefined;
  getAlwaysDrawnElements(vp: Viewport): Id64Set | undefined;
  getEmphasizedElements(vp: Viewport): Id64Set | undefined;
  getHiddenElements(vp: Viewport): Id64Set | undefined;
  getIsolatedElements(vp: Viewport): Id64Set | undefined;
  getNeverDrawnElements(vp: Viewport): Id64Set | undefined;
  static getOrCreate(vp: Viewport): EmphasizeElements;
  getOverriddenElements(): Map<number, Id64Set> | undefined;
  getOverriddenElementsByKey(key: number): Id64Set | undefined;
  getOverrideFromKey(key: number, color: ColorDef): FeatureOverrideType;
  hideElements(ids: Id64Arg, vp: Viewport, replace?: boolean): boolean;
  hideSelectedElements(vp: Viewport, replace?: boolean, clearSelection?: boolean): boolean;
  isActive(vp: Viewport): boolean;
  isolateElements(ids: Id64Arg, vp: Viewport, replace?: boolean): boolean;
  isolateSelectedElements(vp: Viewport, replace?: boolean, clearSelection?: boolean): boolean;
  overrideElements(ids: Id64Arg, vp: Viewport, color: ColorDef, override?: FeatureOverrideType, replace?: boolean): boolean;
  overrideSelectedElements(vp: Viewport, color: ColorDef, override?: FeatureOverrideType, replace?: boolean, clearSelection?: boolean): boolean;
  setAlwaysDrawnElements(ids: Id64Arg, vp: Viewport, exclusive?: boolean, replace?: boolean): boolean;
  setNeverDrawnElements(ids: Id64Arg, vp: Viewport, replace?: boolean): boolean;
  // (undocumented)
  toJSON(vp: Viewport): EmphasizeElementsProps;
}

// @public (undocumented)
interface EmphasizeElementsProps {
  // (undocumented)
  alwaysDrawn?: Id64Set;
  // (undocumented)
  appearanceOverride?: AppearanceOverrideProps[];
  // (undocumented)
  defaultAppearance?: FeatureSymbology.AppearanceProps;
  // (undocumented)
  isAlwaysDrawnExclusive?: boolean;
  // (undocumented)
  neverDrawn?: Id64Set;
}

// @public
class EntityState implements EntityProps {
  constructor(props: EntityProps, iModel: IModelConnection, _state?: EntityState);
  // (undocumented)
  readonly classFullName: string;
  static readonly className: string;
  clone(iModel?: IModelConnection): this;
  // (undocumented)
  equals(other: this): boolean;
  static getClassFullName(): string;
  // (undocumented)
  readonly id: Id64String;
  // (undocumented)
  readonly iModel: IModelConnection;
  // (undocumented)
  readonly jsonProperties: {
    [key: string]: any;
  }
  // (undocumented)
  static schemaName: string;
  // (undocumented)
  static readonly sqlName: string;
  // (undocumented)
  toJSON(): EntityProps;
}

// @public
interface EnumerationChoice {
  // (undocumented)
  label: string;
  // (undocumented)
  value: string | number;
}

// @public
interface EnumerationChoicesInfo {
  // (undocumented)
  choices: EnumerationChoice[];
  // (undocumented)
  isStrict?: boolean;
  // (undocumented)
  maxDisplayedRows?: number;
}

// @public
class Environment implements EnvironmentProps {
  constructor(json?: EnvironmentProps);
  // (undocumented)
  readonly ground: GroundPlane;
  // (undocumented)
  readonly sky: SkyBox;
  // (undocumented)
  toJSON(): EnvironmentProps;
}

// @public
enum ErrorNums {
  NoFence = 0,
  NoFenceElems = 1,
  NoFenceElemsOutside = 2,
  NoSSElems = 3,
  NotSupportedElmType = 4
}

// @public
class EventController {
  constructor(vp: ScreenViewport);
  // (undocumented)
  destroy(): void;
  // (undocumented)
  vp: ScreenViewport;
}

// @public (undocumented)
enum EventHandled {
  // (undocumented)
  No = 0,
  // (undocumented)
  Yes = 1
}

// @public
interface ExtentLimits {
  max: number;
  min: number;
}

// @public
export function extractImageSourceDimensions(source: ImageSource): Promise<Point2d>;

// @public
interface FeatureOverrideProvider {
  // WARNING: The type "FeatureSymbology.Overrides" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  addFeatureOverrides(overrides: FeatureSymbology.Overrides, viewport: Viewport): void;
}

// @public
enum FeatureOverrideType {
  // (undocumented)
  AlphaOnly = 1,
  // (undocumented)
  ColorAndAlpha = 2,
  // (undocumented)
  ColorOnly = 0
}

// @public
module FeatureSymbology {
  class Appearance implements AppearanceProps {
    // WARNING: The type "Appearance" needs to be exported by the package (e.g. added to index.ts)
    static readonly defaults: Appearance;
    // WARNING: The type "Appearance" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    equals(other: Appearance): boolean;
    // WARNING: The type "Appearance" needs to be exported by the package (e.g. added to index.ts)
    // WARNING: The type "Appearance" needs to be exported by the package (e.g. added to index.ts)
    extendAppearance(base: Appearance): Appearance;
    // WARNING: The type "AppearanceProps" needs to be exported by the package (e.g. added to index.ts)
    // WARNING: The type "Appearance" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    static fromJSON(props?: AppearanceProps): Appearance;
    // WARNING: The type "Appearance" needs to be exported by the package (e.g. added to index.ts)
    static fromRgb(color: ColorDef): Appearance;
    // WARNING: The type "Appearance" needs to be exported by the package (e.g. added to index.ts)
    static fromRgba(color: ColorDef): Appearance;
    // WARNING: The type "Appearance" needs to be exported by the package (e.g. added to index.ts)
    static fromSubCategoryOverride(ovr: SubCategoryOverride): Appearance;
    // WARNING: The type "Appearance" needs to be exported by the package (e.g. added to index.ts)
    static fromTransparency(transparencyValue: number): Appearance;
    readonly ignoresMaterial?: true | undefined;
    // (undocumented)
    readonly isFullyTransparent: boolean;
    readonly linePixels?: LinePixels;
    readonly nonLocatable?: true | undefined;
    // (undocumented)
    readonly overridesLinePixels: boolean;
    // (undocumented)
    readonly overridesRgb: boolean;
    // (undocumented)
    readonly overridesSymbology: boolean;
    // (undocumented)
    readonly overridesTransparency: boolean;
    // (undocumented)
    readonly overridesWeight: boolean;
    readonly rgb?: RgbColor;
    // WARNING: The type "AppearanceProps" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    toJSON(): AppearanceProps;
    readonly transparency?: number;
    readonly weight?: number;
  }

  interface AppearanceProps {
    ignoresMaterial?: true | undefined;
    linePixels?: LinePixels;
    nonLocatable?: true | undefined;
    rgb?: RgbColor;
    transparency?: number;
    weight?: number;
  }

  class Overrides {
    constructor(view?: ViewState);
    // @internal
    protected readonly _alwaysDrawn: Id64.Uint32Set;
    // @internal
    protected _constructions: boolean;
    // WARNING: The type "Appearance" needs to be exported by the package (e.g. added to index.ts)
    // @internal
    protected _defaultOverrides: Appearance;
    // @internal
    protected _dimensions: boolean;
    // WARNING: The type "Appearance" needs to be exported by the package (e.g. added to index.ts)
    // @internal
    protected readonly _elementOverrides: Id64.Uint32Map<Appearance>;
    // @internal
    protected _lineWeights: boolean;
    // WARNING: The type "Appearance" needs to be exported by the package (e.g. added to index.ts)
    // @internal
    protected readonly _modelOverrides: Id64.Uint32Map<Appearance>;
    // @internal
    protected readonly _neverDrawn: Id64.Uint32Set;
    // @internal
    protected _patterns: boolean;
    // WARNING: The type "Appearance" needs to be exported by the package (e.g. added to index.ts)
    // @internal
    protected readonly _subCategoryOverrides: Id64.Uint32Map<Appearance>;
    // @internal
    protected readonly _visibleSubCategories: Id64.Uint32Set;
    // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
    // WARNING: The type "Appearance" needs to be exported by the package (e.g. added to index.ts)
    // @internal
    readonly animationNodeOverrides: Map<number, Appearance>;
    // WARNING: The type "Appearance" needs to be exported by the package (e.g. added to index.ts)
    readonly defaultOverrides: Appearance;
    // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
    // WARNING: The type "Appearance" needs to be exported by the package (e.g. added to index.ts)
    // @internal
    getAppearance(elemLo: number, elemHi: number, subcatLo: number, subcatHi: number, geomClass: GeometryClass, modelLo: number, modelHi: number, type: BatchType, animationNodeId: number): Appearance | undefined;
    // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
    // WARNING: The type "Appearance" needs to be exported by the package (e.g. added to index.ts)
    // @internal
    protected getClassifierAppearance(elemLo: number, elemHi: number, subcatLo: number, subcatHi: number, modelLo: number, modelHi: number): Appearance | undefined;
    // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
    // WARNING: The type "Appearance" needs to be exported by the package (e.g. added to index.ts)
    // @internal (undocumented)
    protected getElementOverrides(idLo: number, idHi: number, animationNodeId: number): Appearance | undefined;
    // WARNING: The type "Appearance" needs to be exported by the package (e.g. added to index.ts)
    getElementOverridesById(id: Id64String): Appearance | undefined;
    // WARNING: The type "Appearance" needs to be exported by the package (e.g. added to index.ts)
    getFeatureAppearance(feature: Feature, modelId: Id64String, type?: BatchType): Appearance | undefined;
    // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
    // WARNING: The type "Appearance" needs to be exported by the package (e.g. added to index.ts)
    // @internal (undocumented)
    protected getModelOverrides(idLo: number, idHi: number): Appearance | undefined;
    // WARNING: The type "Appearance" needs to be exported by the package (e.g. added to index.ts)
    getModelOverridesById(id: Id64String): Appearance | undefined;
    // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
    // WARNING: The type "Appearance" needs to be exported by the package (e.g. added to index.ts)
    // @internal (undocumented)
    protected getSubCategoryOverrides(idLo: number, idHi: number): Appearance | undefined;
    // WARNING: The type "Appearance" needs to be exported by the package (e.g. added to index.ts)
    getSubCategoryOverridesById(id: Id64String): Appearance | undefined;
    // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
    // @internal
    initFromView(view: ViewState): void;
    // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
    // @internal (undocumented)
    protected isAlwaysDrawn(idLo: number, idHi: number): boolean;
    isAlwaysDrawnExclusive: boolean;
    // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
    // @internal (undocumented)
    isClassVisible(geomClass: GeometryClass): boolean;
    isFeatureVisible(feature: Feature): boolean;
    // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
    // @internal (undocumented)
    protected isNeverDrawn(elemIdLo: number, elemIdHi: number, animationNodeId: number): boolean;
    isSubCategoryIdVisible(id: Id64String): boolean;
    // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
    // @internal
    protected isSubCategoryVisible(idLo: number, idHi: number): boolean;
    readonly lineWeights: boolean;
    // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
    // @internal
    readonly neverDrawnAnimationNodes: Set<number>;
    // WARNING: The type "Appearance" needs to be exported by the package (e.g. added to index.ts)
    overrideAnimationNode(id: number, app: Appearance): void;
    // WARNING: The type "Appearance" needs to be exported by the package (e.g. added to index.ts)
    overrideElement(id: Id64String, app: Appearance, replaceExisting?: boolean): void;
    // WARNING: The type "Appearance" needs to be exported by the package (e.g. added to index.ts)
    overrideModel(id: Id64String, app: Appearance, replaceExisting?: boolean): void;
    // WARNING: The type "Appearance" needs to be exported by the package (e.g. added to index.ts)
    overrideSubCategory(id: Id64String, app: Appearance, replaceExisting?: boolean): void;
    setAlwaysDrawn(id: Id64String): void;
    setAlwaysDrawnSet(ids: Id64Set, exclusive: boolean): void;
    setAnimationNodeNeverDrawn(id: number): void;
    // WARNING: The type "Appearance" needs to be exported by the package (e.g. added to index.ts)
    setDefaultOverrides(appearance: Appearance, replaceExisting?: boolean): void;
    setNeverDrawn(id: Id64String): void;
    setNeverDrawnSet(ids: Id64Set): void;
    setVisibleSubCategory(id: Id64String): void;
  }

}

// @public
enum FenceClipMode {
  Copy = 3,
  None = 0,
  Original = 1
}

// @public
class FenceParams {
  // (undocumented)
  clip?: ClipVector;
  // (undocumented)
  clipMode: FenceClipMode;
  // (undocumented)
  readonly fenceRangeNPC: Range3d;
  // (undocumented)
  hasOverlaps: boolean;
  // (undocumented)
  onTolerance: number;
  // (undocumented)
  overlapMode: boolean;
  // (undocumented)
  viewport?: Viewport;
}

// @public
class FitViewTool extends ViewTool {
  constructor(viewport: ScreenViewport, oneShot: boolean, doAnimate?: boolean, isolatedOnly?: boolean);
  // (undocumented)
  doAnimate: boolean;
  // (undocumented)
  doFit(viewport: ScreenViewport, oneShot: boolean, doAnimate?: boolean, isolatedOnly?: boolean): Promise<boolean>;
  // (undocumented)
  isolatedOnly: boolean;
  // (undocumented)
  onDataButtonDown(ev: BeButtonEvent): Promise<EventHandled>;
  // (undocumented)
  oneShot: boolean;
  // (undocumented)
  onPostInstall(): void;
  // (undocumented)
  static toolId: string;
}

// @public (undocumented)
class Flags {
  // (undocumented)
  animateRotation: boolean;
  // (undocumented)
  auxRotationPlane: RotationMode;
  // (undocumented)
  baseMode: number;
  // (undocumented)
  baseRotation: RotationMode;
  // (undocumented)
  bearingFixToPlane2D: boolean;
  // (undocumented)
  contextRotMode: number;
  // (undocumented)
  dialogNeedsUpdate: boolean;
  // (undocumented)
  fixedOrg: boolean;
  // (undocumented)
  haveValidOrigin: boolean;
  // (undocumented)
  ignoreDataButton: boolean;
  // (undocumented)
  inDataPoint: boolean;
  // (undocumented)
  indexLocked: boolean;
  // (undocumented)
  lockedRotation: boolean;
  // (undocumented)
  pointIsOnPlane: boolean;
  // (undocumented)
  redrawCompass: boolean;
  // (undocumented)
  rotationNeedsUpdate: boolean;
  // (undocumented)
  softAngleLock: boolean;
}

// @public
class FlyViewTool extends ViewManip {
  constructor(vp: ScreenViewport, oneShot?: boolean, isDraggingRequired?: boolean);
  // (undocumented)
  onReinitialize(): void;
  // (undocumented)
  static toolId: string;
}

// WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
// @internal (undocumented)
export function fromSumOf(p: Point3d, v: Vector3d, scale: number, out?: Point3d): Point3d;

// @public
class FrontendRequestContext extends ClientRequestContext {
  constructor(activityId?: string);
}

// WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
// @internal
class FrustumUniforms {
  constructor();
  // (undocumented)
  readonly farPlane: number;
  // (undocumented)
  readonly frustum: Float32Array;
  // (undocumented)
  readonly frustumPlanes: Float32Array;
  // (undocumented)
  readonly is2d: boolean;
  // (undocumented)
  readonly nearPlane: number;
  // (undocumented)
  setFrustum(nearPlane: number, farPlane: number, type: FrustumUniformType): void;
  // (undocumented)
  setPlanes(top: number, bottom: number, left: number, right: number): void;
  // (undocumented)
  readonly type: FrustumUniformType;
}

// WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
// @internal (undocumented)
enum FrustumUniformType {
  // (undocumented)
  Orthographic = 1,
  // (undocumented)
  Perspective = 2,
  // (undocumented)
  TwoDee = 0
}

// @public (undocumented)
class FuzzySearch<T> {
  onGetMultiWordSearchOptions(): Fuse.FuseOptions<T>;
  onGetSingleWordSearchOptions(): Fuse.FuseOptions<T>;
  search(searchedObjects: T[], keys: Array<keyof T>, pattern: string): FuzzySearchResults<T>;
}

// @public
interface FuzzySearchResult<T> {
  getBoldMask(): boolean[];
  getMatchedKey(): string;
  getMatchedValue(): string;
  getResult(): T;
}

// @public
class FuzzySearchResults<T> implements Iterable<T> {
  // WARNING: The name "__@iterator" contains unsupported characters; API names should use only letters, numbers, and underscores
  // (undocumented)
  [Symbol.iterator](): any;
  constructor(results: any[] | undefined);
  // (undocumented)
  getResult(resultIndex: number): FuzzySearchResult<T> | undefined;
  // (undocumented)
  readonly length: number;
  // (undocumented)
  results: any[];
}

// WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
// @internal
class GeoConverter {
  constructor(iModel: IModelConnection, datum: string);
  // (undocumented)
  getGeoCoordinatesFromIModelCoordinates(iModelPoints: XYZProps[]): Promise<GeoCoordinatesResponseProps>;
  // (undocumented)
  getIModelCoordinatesFromGeoCoordinates(geoPoints: XYZProps[]): Promise<IModelCoordinatesResponseProps>;
}

// @public
class GeometricModel2dState extends GeometricModelState, implements GeometricModel2dProps {
  constructor(props: GeometricModel2dProps, iModel: IModelConnection);
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  readonly asGeometricModel2d: GeometricModel2dState;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  readonly globalOrigin: Point2d;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  readonly is3d: boolean;
  // (undocumented)
  toJSON(): GeometricModel2dProps;
}

// @public
class GeometricModel3dState extends GeometricModelState {
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  readonly asGeometricModel3d: GeometricModel3dState;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  readonly is3d: boolean;
}

// @public
class GeometricModelState extends ModelState, implements TileTreeModelState {
  // @internal (undocumented)
  protected _classifierTileTreeState: TileTreeState;
  // @internal (undocumented)
  protected _tileTreeState: TileTreeState;
  // WARNING: The type "SpatialClassification.PropertiesProps" needs to be exported by the package (e.g. added to index.ts)
  // @beta
  addSpatialClassifier(classifier: SpatialClassification.PropertiesProps): void;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  readonly asGeometricModel: GeometricModelState;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  readonly classifierTileTree: TileTree | undefined;
  // @beta
  getActiveSpatialClassifier(): number;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal
  getOrLoadTileTree(batchType: BatchType, edgesRequired: boolean): TileTree | undefined;
  // WARNING: The type "SpatialClassification.Properties" needs to be exported by the package (e.g. added to index.ts)
  // @beta
  getSpatialClassifier(index: number): SpatialClassification.Properties | undefined;
  readonly is2d: boolean;
  readonly is3d: boolean;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  readonly isGeometricModel: boolean;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // WARNING: The type "TileTree.LoadStatus" needs to be exported by the package (e.g. added to index.ts)
  // @internal
  loadStatus: TileTree.LoadStatus;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // WARNING: The type "TileTree.LoadStatus" needs to be exported by the package (e.g. added to index.ts)
  // @internal
  loadTileTree(batchType: BatchType, edgesRequired: boolean, animationId?: Id64String, classifierExpansion?: number): TileTree.LoadStatus;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  onIModelConnectionClose(): void;
  queryModelRange(): Promise<Range3d>;
  // @beta
  setActiveSpatialClassifier(classifierIndex: number, active: boolean): Promise<void>;
  // WARNING: The type "SpatialClassification.Properties" needs to be exported by the package (e.g. added to index.ts)
  // @beta
  setSpatialClassifier(index: number, classifier: SpatialClassification.Properties): void;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal
  readonly tileTree: TileTree | undefined;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  readonly treeModelId: Id64String;
}

// WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
// @internal
class GeoServices {
  constructor(iModel: IModelConnection);
  // (undocumented)
  getConverter(datum?: string): GeoConverter;
}

// @public
export function getImageSourceFormatForMimeType(mimeType: string): ImageSourceFormat | undefined;

// @public
export function getImageSourceMimeType(format: ImageSourceFormat): string;

// @public
class GraphicBranch implements IDisposable, RenderMemory.Consumer {
  constructor(ownsEntries?: boolean);
  add(graphic: RenderGraphic): void;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal
  animationId?: string;
  clear(): void;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // WARNING: The type "RenderMemory.Statistics" needs to be exported by the package (e.g. added to index.ts)
  // @internal (undocumented)
  collectStatistics(stats: RenderMemory.Statistics): void;
  // (undocumented)
  dispose(): void;
  readonly entries: RenderGraphic[];
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  getViewFlags(flags: ViewFlags, out?: ViewFlags): ViewFlags;
  // (undocumented)
  readonly isEmpty: boolean;
  readonly ownsEntries: boolean;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  setViewFlagOverrides(ovr: ViewFlag.Overrides): void;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  setViewFlags(flags: ViewFlags): void;
  // WARNING: The type "FeatureSymbology.Overrides" needs to be exported by the package (e.g. added to index.ts)
  symbologyOverrides?: FeatureSymbology.Overrides;
}

// @public
class GraphicBuilder {
  // @internal
  protected constructor(placement: Transform | undefined, type: GraphicType, viewport: Viewport, pickId?: Id64String);
  abstract activateGraphicParams(graphicParams: GraphicParams): void;
  abstract addArc(arc: Arc3d, isEllipse: boolean, filled: boolean): void;
  abstract addArc2d(ellipse: Arc3d, isEllipse: boolean, filled: boolean, zDepth: number): void;
  abstract addLineString(points: Point3d[]): void;
  abstract addLineString2d(points: Point2d[], zDepth: number): void;
  abstract addLoop(loop: Loop): void;
  abstract addPath(path: Path): void;
  abstract addPointString(points: Point3d[]): void;
  abstract addPointString2d(points: Point2d[], zDepth: number): void;
  abstract addPolyface(meshData: Polyface, filled: boolean): void;
  // @public
  addRangeBox(range: Range3d): void;
  abstract addShape(points: Point3d[]): void;
  abstract addShape2d(points: Point2d[], zDepth: number): void;
  abstract finish(): RenderGraphic;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  readonly iModel: IModelConnection;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  readonly isOverlay: boolean;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  readonly isSceneGraphic: boolean;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  readonly isViewBackground: boolean;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  readonly isViewCoordinates: boolean;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  readonly isWorldCoordinates: boolean;
  // (undocumented)
  pickId?: string;
  placement: Transform;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal
  setBlankingFill(fillColor: ColorDef): void;
  setSymbology(lineColor: ColorDef, fillColor: ColorDef, lineWidth: number, linePixels?: LinePixels): void;
  readonly type: GraphicType;
  readonly viewport: Viewport;
}

// @public
enum GraphicType {
  Scene = 1,
  ViewBackground = 0,
  ViewOverlay = 4,
  WorldDecoration = 2,
  WorldOverlay = 3
}

// @public
enum GridOrientationType {
  AuxCoord = 4,
  View = 0,
  // (undocumented)
  WorldXY = 1,
  // (undocumented)
  WorldXZ = 3,
  // (undocumented)
  WorldYZ = 2
}

// @public (undocumented)
interface GroupMark {
  // (undocumented)
  source: ModifyElementSource;
  // (undocumented)
  start: number;
}

// @public
class HilitedSet {
  constructor(iModel: IModelConnection);
  clearAll(): void;
  readonly elements: Set<string>;
  has(id: string): boolean;
  // (undocumented)
  iModel: IModelConnection;
  isHilited(id: Id64String): boolean;
  setHilite(arg: Id64Arg, onOff: boolean): void;
  readonly size: number;
}

// @public (undocumented)
enum HilitedState {
  No = 2,
  Unknown = 0,
  Yes = 1
}

// @public
class HitDetail {
  constructor(testPoint: Point3d, viewport: ScreenViewport, hitSource: HitSource, hitPoint: Point3d, sourceId: string, priority: HitPriority, distXY: number, distFraction: number, subCategoryId?: string | undefined, geometryClass?: GeometryClass | undefined);
  clone(): HitDetail;
  // (undocumented)
  readonly distFraction: number;
  // (undocumented)
  readonly distXY: number;
  draw(_context: DecorateContext): void;
  // (undocumented)
  readonly geometryClass?: GeometryClass | undefined;
  getHitType(): HitDetailType;
  getPoint(): Point3d;
  getToolTip(): Promise<HTMLElement | string>;
  // (undocumented)
  readonly hitPoint: Point3d;
  // (undocumented)
  readonly hitSource: HitSource;
  readonly isElementHit: boolean;
  // (undocumented)
  readonly isModelHit: boolean;
  isSameHit(otherHit?: HitDetail): boolean;
  // (undocumented)
  readonly priority: HitPriority;
  // (undocumented)
  readonly sourceId: string;
  // (undocumented)
  readonly subCategoryId?: string | undefined;
  // (undocumented)
  readonly testPoint: Point3d;
  // (undocumented)
  readonly viewport: ScreenViewport;
}

// @public (undocumented)
enum HitDetailType {
  // (undocumented)
  Hit = 1,
  // (undocumented)
  Intersection = 3,
  // (undocumented)
  Snap = 2
}

// @public
enum HitGeomType {
  // (undocumented)
  Arc = 4,
  // (undocumented)
  Curve = 3,
  // (undocumented)
  None = 0,
  // (undocumented)
  Point = 1,
  // (undocumented)
  Segment = 2,
  // (undocumented)
  Surface = 5
}

// @public
class HitList<T extends HitDetail> {
  addHit(newHit: T): number;
  compare(hit1: HitDetail | undefined, hit2: HitDetail | undefined): -1 | 1 | 0;
  // (undocumented)
  currHit: number;
  // (undocumented)
  dropNulls(): void;
  // (undocumented)
  empty(): void;
  // (undocumented)
  getCurrentHit(): T | undefined;
  getHit(hitNum: number): T | undefined;
  // (undocumented)
  getNextHit(): T | undefined;
  // (undocumented)
  hits: T[];
  insertHit(i: number, hit: T): void;
  // (undocumented)
  readonly length: number;
  removeCurrentHit(): void;
  removeHit(hitNum: number): void;
  removeHitsFrom(sourceId: string): boolean;
  // (undocumented)
  resetCurrentHit(): void;
  // (undocumented)
  setCurrentHit(hit: T): void;
  setHit(i: number, p: T | undefined): void;
}

// @public (undocumented)
interface HitListHolder {
  // (undocumented)
  setHitList(list: HitList<HitDetail> | undefined): void;
}

// @public
enum HitParentGeomType {
  // (undocumented)
  Mesh = 4,
  // (undocumented)
  None = 0,
  // (undocumented)
  Sheet = 2,
  // (undocumented)
  Solid = 3,
  // (undocumented)
  Text = 5,
  // (undocumented)
  Wire = 1
}

// @public (undocumented)
enum HitPriority {
  // (undocumented)
  NonPlanarEdge = 2,
  // (undocumented)
  NonPlanarSurface = 5,
  // (undocumented)
  PlanarEdge = 1,
  // (undocumented)
  PlanarSurface = 4,
  // (undocumented)
  SilhouetteEdge = 3,
  // (undocumented)
  Unknown = 6,
  // (undocumented)
  WireEdge = 0
}

// @public
enum HitSource {
  // (undocumented)
  AccuSnap = 3,
  // (undocumented)
  Application = 6,
  // (undocumented)
  DataPoint = 5,
  // (undocumented)
  EditAction = 7,
  // (undocumented)
  EditActionSS = 8,
  // (undocumented)
  FromUser = 1,
  // (undocumented)
  MotionLocate = 2,
  // (undocumented)
  None = 0,
  // (undocumented)
  TentativeSnap = 4
}

// @public
interface IconDefinition {
  iconClass: string;
  // (undocumented)
  isEnabledFunction?: () => boolean;
}

// @public
interface IconEditorParams extends BasePropertyEditorParams {
  // (undocumented)
  definition: IconDefinition;
  // (undocumented)
  type: PropertyEditorParamTypes.Icon;
}

// @public
class IconSprites {
  static emptyAll(): void;
  static getSpriteFromUrl(spriteUrl: string): Sprite;
}

// @public
class IdleTool extends InteractiveTool {
  // (undocumented)
  exitTool(): void;
  // (undocumented)
  static hidden: boolean;
  // (undocumented)
  onMiddleButtonUp(ev: BeButtonEvent): Promise<EventHandled>;
  // (undocumented)
  onMouseStartDrag(ev: BeButtonEvent): Promise<EventHandled>;
  // (undocumented)
  onMouseWheel(ev: BeWheelEvent): Promise<EventHandled>;
  // (undocumented)
  onTouchMoveStart(ev: BeTouchEvent, startEv: BeTouchEvent): Promise<EventHandled>;
  // (undocumented)
  onTouchTap(ev: BeTouchEvent): Promise<EventHandled>;
  // (undocumented)
  run(): boolean;
  // (undocumented)
  static toolId: string;
}

// @public
export function imageBufferToBase64EncodedPng(buffer: ImageBuffer): string | undefined;

// @public
export function imageBufferToPngDataUrl(buffer: ImageBuffer): string | undefined;

// @public
export function imageElementFromImageSource(source: ImageSource): Promise<HTMLImageElement>;

// @public
export function imageElementFromUrl(url: string): Promise<HTMLImageElement>;

// @public
class IModelApp {
  // (undocumented)
  protected static _imodelClient?: IModelClient;
  // (undocumented)
  protected static _initialized: boolean;
  static accuDraw: AccuDraw;
  static accuSnap: AccuSnap;
  static applicationId: string;
  static applicationVersion: string;
  static authorizationClient: IAuthorizationClient | undefined;
  // (undocumented)
  static readonly features: FeatureGates;
  // (undocumented)
  static readonly hasRenderSystem: boolean;
  static i18n: I18N;
  // (undocumented)
  static iModelClient: IModelClient;
  // (undocumented)
  static readonly initialized: boolean;
  // (undocumented)
  static locateManager: ElementLocateManager;
  static notifications: NotificationManager;
  protected static onStartup(): void;
  static quantityFormatter: QuantityFormatter;
  static readonly renderSystem: RenderSystem;
  static sessionId: GuidString;
  static settings: SettingsAdmin;
  static shutdown(): void;
  static startup(imodelClient?: IModelClient): void;
  protected static supplyI18NOptions(): I18NOptions | undefined;
  protected static supplyRenderSystem(): RenderSystem;
  // (undocumented)
  static tentativePoint: TentativePoint;
  static tileAdmin: TileAdmin;
  static toolAdmin: ToolAdmin;
  static readonly tools: ToolRegistry;
  static viewManager: ViewManager;
}

// @public (undocumented)
class IModelConnection {
}

// @public
class InputCollector extends InteractiveTool {
  // (undocumented)
  exitTool(): void;
  // (undocumented)
  onResetButtonUp(_ev: BeButtonEvent): Promise<EventHandled>;
  // (undocumented)
  run(): boolean;
}

// @public
interface InputEditorSizeParams extends BasePropertyEditorParams {
  maxLength?: number;
  size?: number;
  // (undocumented)
  type: PropertyEditorParamTypes.InputEditorSize;
}

// @public
enum InputSource {
  Mouse = 1,
  Touch = 2,
  Unknown = 0
}

// @public
interface InstancedGraphicParams {
  readonly count: number;
  readonly featureIds?: Uint8Array;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal
  readonly symbologyOverrides?: Uint8Array;
  readonly transformCenter: Point3d;
  readonly transforms: Float32Array;
}

// @public
class InteractiveTool extends Tool {
  applyToolSettingPropertyChange(_updatedValue: ToolSettingsPropertySyncItem): boolean;
  beginDynamics(): void;
  changeLocateState(enableLocate: boolean, enableSnap?: boolean, cursor?: string, coordLockOvr?: CoordinateLockOverrides): void;
  decorate(_context: DecorateContext): void;
  decorateSuspended(_context: DecorateContext): void;
  endDynamics(): void;
  // (undocumented)
  abstract exitTool(): void;
  filterHit(_hit: HitDetail, _out?: LocateResponse): Promise<LocateFilterStatus>;
  getCurrentButtonEvent(ev: BeButtonEvent): void;
  getDecorationGeometry(_hit: HitDetail): GeometryStreamProps | undefined;
  getToolTip(_hit: HitDetail): Promise<HTMLElement | string>;
  initLocateElements(enableLocate?: boolean, enableSnap?: boolean, cursor?: string, coordLockOvr?: CoordinateLockOverrides): void;
  // (undocumented)
  isCompatibleViewport(_vp: Viewport, _isSelectedViewChange: boolean): boolean;
  readonly isDynamicsStarted: boolean;
  // (undocumented)
  isValidLocation(_ev: BeButtonEvent, _isButtonEvent: boolean): boolean;
  onCleanup(): void;
  onDataButtonDown(_ev: BeButtonEvent): Promise<EventHandled>;
  onDataButtonUp(_ev: BeButtonEvent): Promise<EventHandled>;
  onDynamicFrame(_ev: BeButtonEvent, _context: DynamicsContext): void;
  onInstall(): boolean;
  onKeyTransition(_wentDown: boolean, _keyEvent: KeyboardEvent): Promise<EventHandled>;
  onMiddleButtonDown(_ev: BeButtonEvent): Promise<EventHandled>;
  onMiddleButtonUp(_ev: BeButtonEvent): Promise<EventHandled>;
  onModifierKeyTransition(_wentDown: boolean, _modifier: BeModifierKeys, _event: KeyboardEvent): Promise<EventHandled>;
  onMouseEndDrag(ev: BeButtonEvent): Promise<EventHandled>;
  onMouseMotion(_ev: BeButtonEvent): Promise<void>;
  onMouseMotionStopped(_ev: BeButtonEvent): Promise<void>;
  onMouseNoMotion(_ev: BeButtonEvent): Promise<void>;
  onMouseStartDrag(_ev: BeButtonEvent): Promise<EventHandled>;
  onMouseWheel(_ev: BeWheelEvent): Promise<EventHandled>;
  onPostInstall(): void;
  onReinitialize(): void;
  onResetButtonDown(_ev: BeButtonEvent): Promise<EventHandled>;
  onResetButtonUp(_ev: BeButtonEvent): Promise<EventHandled>;
  onSelectedViewportChanged(_previous: Viewport | undefined, _current: Viewport | undefined): void;
  onSuspend(): void;
  onTouchCancel(_ev: BeTouchEvent): Promise<void>;
  onTouchComplete(_ev: BeTouchEvent): Promise<void>;
  onTouchEnd(_ev: BeTouchEvent): Promise<void>;
  onTouchMove(_ev: BeTouchEvent): Promise<void>;
  onTouchMoveStart(_ev: BeTouchEvent, _startEv: BeTouchEvent): Promise<EventHandled>;
  onTouchStart(_ev: BeTouchEvent): Promise<void>;
  onTouchTap(_ev: BeTouchEvent): Promise<EventHandled>;
  onUnsuspend(): void;
  receivedDownEvent: boolean;
  supplyToolSettingsProperties(): ToolSettingsPropertyRecord[] | undefined;
  syncToolSettingsProperties(syncData: ToolSettingsPropertySyncItem[]): void;
  testDecorationHit(_id: string): boolean;
}

// @public (undocumented)
class IntersectDetail extends SnapDetail {
  constructor(from: SnapDetail, heat: SnapHeat | undefined, snapPoint: XYZProps, otherPrimitive: CurvePrimitive, otherId: string);
  // (undocumented)
  draw(context: DecorateContext): void;
  // (undocumented)
  readonly otherId: string;
  // (undocumented)
  readonly otherPrimitive: CurvePrimitive;
}

// @public (undocumented)
enum ItemField {
  // (undocumented)
  ANGLE_Item = 1,
  // (undocumented)
  DIST_Item = 0,
  // (undocumented)
  X_Item = 2,
  // (undocumented)
  Y_Item = 3,
  // (undocumented)
  Z_Item = 4
}

// @public
interface JsonEditorParams extends BasePropertyEditorParams {
  // (undocumented)
  json: any;
  // (undocumented)
  type: PropertyEditorParamTypes.JSON;
}

// @public (undocumented)
enum KeyinStatus {
  // (undocumented)
  DontUpdate = 2,
  // (undocumented)
  Dynamic = 0,
  // (undocumented)
  Partial = 1
}

// WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
// @internal (undocumented)
export function linePlaneIntersect(outP: Point3d, linePt: Point3d, lineNormal: Vector3d | undefined, planePt: Point3d, planeNormal: Vector3d, perpendicular: boolean): void;

// @public
interface LinkElementsInfo {
  matcher?: (displayValue: string) => Array<{
          start: number;
          end: number;
      }>;
  onClick: (record: PropertyRecord, text: string) => void;
}

// @public
enum LocateAction {
  // (undocumented)
  AutoLocate = 1,
  // (undocumented)
  Identify = 0
}

// @public
enum LocateFilterStatus {
  // (undocumented)
  Accept = 0,
  // (undocumented)
  Reject = 1
}

// @public
class LocateOptions {
  allowDecorations: boolean;
  allowNonLocatable: boolean;
  clone(): LocateOptions;
  hitSource: HitSource;
  // (undocumented)
  init(): void;
  maxHits: number;
  // (undocumented)
  setFrom(other: LocateOptions): void;
}

// @public (undocumented)
class LocateResponse {
  // (undocumented)
  explanation: string;
  // (undocumented)
  reason?: string;
  // (undocumented)
  snapStatus: SnapStatus;
}

// @public (undocumented)
enum LockedStates {
  // (undocumented)
  ANGLE_BM = 7,
  // (undocumented)
  DIST_BM = 8,
  // (undocumented)
  NONE_LOCKED = 0,
  // (undocumented)
  VEC_BM = 4,
  // (undocumented)
  X_BM = 1,
  // (undocumented)
  XY_BM = 3,
  // (undocumented)
  Y_BM = 2
}

// @public
class LookViewTool extends ViewManip {
  constructor(vp: ScreenViewport, oneShot?: boolean, isDraggingRequired?: boolean);
  // (undocumented)
  onReinitialize(): void;
  // (undocumented)
  static toolId: string;
}

// @public (undocumented)
enum ManipulatorToolEvent {
  // (undocumented)
  Start = 1,
  // (undocumented)
  Stop = 2,
  // (undocumented)
  Suspend = 3,
  // (undocumented)
  Unsuspend = 4
}

// @public
class MarginPercent {
  constructor(left: number, top: number, right: number, bottom: number);
  // (undocumented)
  bottom: number;
  // (undocumented)
  left: number;
  // (undocumented)
  right: number;
  // (undocumented)
  top: number;
}

// @public
class Marker implements CanvasDecoration {
  constructor(worldLocation: XYAndZ, size: XAndY);
  protected _hiliteColor?: ColorDef;
  protected _isHilited: boolean;
  // (undocumented)
  protected _scaleFactor?: Point2d;
  // (undocumented)
  protected _scaleFactorRange?: Range1d;
  addDecoration(context: DecorateContext): void;
  addMarker(context: DecorateContext): void;
  drawDecoration(ctx: CanvasRenderingContext2D): void;
  drawFunc?(ctx: CanvasRenderingContext2D): void;
  protected drawHilited(ctx: CanvasRenderingContext2D): boolean;
  image?: MarkerImage;
  imageOffset?: XAndY;
  imageSize?: XAndY;
  label?: string;
  labelAlign?: MarkerTextAlign;
  labelBaseline?: MarkerTextBaseline;
  labelColor?: MarkerFillStyle;
  labelFont?: string;
  labelOffset?: XAndY;
  static makeFrom<T extends Marker>(other: Marker, ...args: any[]): T;
  onMouseButton?(_ev: BeButtonEvent): boolean;
  onMouseEnter(ev: BeButtonEvent): void;
  onMouseLeave(): void;
  onMouseMove(ev: BeButtonEvent): void;
  pick(pt: XAndY): boolean;
  position: Point3d;
  readonly rect: ViewRect;
  setImage(image: MarkerImage | Promise<MarkerImage>): void;
  setImageUrl(url: string): void;
  setPosition(vp: Viewport): boolean;
  setScaleFactor(range: Range1dProps): void;
  size: Point2d;
  title?: string;
  tooltipOptions?: ToolTipOptions;
  visible: boolean;
  readonly wantImage: boolean;
  worldLocation: Point3d;
}

// @public
class MarkerSet<T extends Marker> {
  // (undocumented)
  protected _entries: Array<T | Cluster<T>>;
  // (undocumented)
  protected readonly _worldToViewMap: Matrix4d;
  addDecoration(context: DecorateContext): void;
  protected abstract getClusterMarker(cluster: Cluster<T>): Marker;
  readonly markers: Set<T>;
  minimumClusterSize: number;
}

// @public (undocumented)
class MeasureDistanceTool extends PrimitiveTool {
  // WARNING: The type "MeasureMarker" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  protected readonly _acceptedSegments: {
          distance: number;
          slope: number;
          start: Point3d;
          end: Point3d;
          delta: Vector3d;
          refAxes: Matrix3d;
          marker: MeasureMarker;
      }[];
  // (undocumented)
  protected readonly _locationData: {
          point: Point3d;
          refAxes: Matrix3d;
      }[];
  // (undocumented)
  protected _snapGeomId?: string;
  // (undocumented)
  protected _totalDistance: number;
  // WARNING: The type "MeasureLabel" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  protected _totalDistanceMarker?: MeasureLabel;
  // (undocumented)
  protected acceptNewSegments(): Promise<void>;
  // (undocumented)
  decorate(context: DecorateContext): void;
  // (undocumented)
  decorateSuspended(context: DecorateContext): void;
  // (undocumented)
  protected displayDelta(context: DecorateContext, seg: any): void;
  // (undocumented)
  protected displayDynamicDistance(context: DecorateContext, points: Point3d[]): void;
  // (undocumented)
  getDecorationGeometry(_hit: HitDetail): GeometryStreamProps | undefined;
  // (undocumented)
  protected getMarkerToolTip(distance: number, slope: number, start: Point3d, end: Point3d, delta?: Vector3d): Promise<string>;
  // (undocumented)
  protected getReferenceAxes(vp?: Viewport): Matrix3d;
  // (undocumented)
  protected getSnapPoints(): Point3d[] | undefined;
  // (undocumented)
  isCompatibleViewport(vp: Viewport | undefined, isSelectedViewChange: boolean): boolean;
  // (undocumented)
  onDataButtonDown(ev: BeButtonEvent): Promise<EventHandled>;
  // (undocumented)
  onMouseMotion(ev: BeButtonEvent): Promise<void>;
  // (undocumented)
  onPostInstall(): void;
  // (undocumented)
  onResetButtonUp(ev: BeButtonEvent): Promise<EventHandled>;
  // (undocumented)
  onRestartTool(): void;
  // (undocumented)
  onUndoPreviousStep(): Promise<boolean>;
  // (undocumented)
  onUnsuspend(): void;
  // (undocumented)
  protected reportMeasurements(): void;
  // (undocumented)
  requireWriteableTarget(): boolean;
  // (undocumented)
  protected setupAndPromptForNextAction(): void;
  // (undocumented)
  protected showPrompt(): void;
  // (undocumented)
  testDecorationHit(id: string): boolean;
  // (undocumented)
  static toolId: string;
  // (undocumented)
  protected updateSelectedMarkerToolTip(seg: any): Promise<void>;
  // (undocumented)
  protected updateTotals(): Promise<void>;
}

// @public (undocumented)
class MeasureLocationTool extends PrimitiveTool {
  // WARNING: The type "MeasureMarker" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  protected readonly _acceptedLocations: MeasureMarker[];
  // (undocumented)
  decorate(context: DecorateContext): void;
  // (undocumented)
  decorateSuspended(context: DecorateContext): void;
  // (undocumented)
  protected getMarkerToolTip(point: Point3d): Promise<string>;
  // (undocumented)
  isCompatibleViewport(vp: Viewport | undefined, isSelectedViewChange: boolean): boolean;
  // (undocumented)
  onDataButtonDown(ev: BeButtonEvent): Promise<EventHandled>;
  // (undocumented)
  onPostInstall(): void;
  // (undocumented)
  onResetButtonUp(_ev: BeButtonEvent): Promise<EventHandled>;
  // (undocumented)
  onRestartTool(): void;
  // (undocumented)
  onUndoPreviousStep(): Promise<boolean>;
  // (undocumented)
  onUnsuspend(): void;
  // (undocumented)
  protected reportMeasurements(): void;
  // (undocumented)
  requireWriteableTarget(): boolean;
  // (undocumented)
  protected setupAndPromptForNextAction(): void;
  // (undocumented)
  protected showPrompt(): void;
  // (undocumented)
  static toolId: string;
}

// @public
enum MessageBoxIconType {
  // (undocumented)
  Critical = 4,
  // (undocumented)
  Information = 1,
  // (undocumented)
  NoSymbol = 0,
  // (undocumented)
  Question = 2,
  // (undocumented)
  Warning = 3
}

// @public
enum MessageBoxType {
  // (undocumented)
  LargeOk = 2,
  // (undocumented)
  MediumAlert = 3,
  // (undocumented)
  Ok = 1,
  // (undocumented)
  OkCancel = 0,
  // (undocumented)
  YesNo = 5,
  // (undocumented)
  YesNoCancel = 4
}

// @public
enum MessageBoxValue {
  // (undocumented)
  Apply = 1,
  // (undocumented)
  Cancel = 4,
  // (undocumented)
  Default = 5,
  // (undocumented)
  Help = 10,
  // (undocumented)
  No = 7,
  // (undocumented)
  NoToAll = 12,
  // (undocumented)
  Ok = 3,
  // (undocumented)
  Reset = 2,
  // (undocumented)
  Retry = 8,
  // (undocumented)
  Stop = 9,
  // (undocumented)
  Yes = 6,
  // (undocumented)
  YesToAll = 11
}

// WARNING: Unsupported export: SystemFactory
// WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
// @internal
module MockRender {
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal
  class App extends IModelApp {
    // WARNING: The type "System" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    protected static createDefaultRenderSystem(): System;
    // (undocumented)
    static shutdown(): void;
    // (undocumented)
    protected static supplyRenderSystem(): RenderSystem;
    // WARNING: The type "SystemFactory" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    static systemFactory: SystemFactory;
  }

  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  class Batch extends Graphic {
    constructor(graphic: RenderGraphic, featureTable: PackedFeatureTable, range: ElementAlignedBox3d);
    // (undocumented)
    dispose(): void;
    // (undocumented)
    readonly featureTable: PackedFeatureTable;
    // (undocumented)
    readonly graphic: RenderGraphic;
    // (undocumented)
    readonly range: ElementAlignedBox3d;
  }

  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  class Branch extends Graphic {
    constructor(branch: GraphicBranch, transform: Transform, clips?: RenderClipVolume | undefined);
    // (undocumented)
    readonly branch: GraphicBranch;
    // (undocumented)
    readonly clips?: RenderClipVolume | undefined;
    // (undocumented)
    dispose(): void;
    // (undocumented)
    readonly transform: Transform;
  }

  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  class Builder extends PrimitiveBuilder {
    // WARNING: The type "System" needs to be exported by the package (e.g. added to index.ts)
    constructor(system: System, placement: Transform | undefined, type: GraphicType, viewport: Viewport, pickId?: Id64String);
  }

  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  class Graphic extends RenderGraphic {
    constructor();
    // WARNING: The type "RenderMemory.Statistics" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    collectStatistics(_stats: RenderMemory.Statistics): void;
    // (undocumented)
    dispose(): void;
  }

  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  class List extends Graphic {
    constructor(graphics: RenderGraphic[]);
    // (undocumented)
    dispose(): void;
    // (undocumented)
    readonly graphics: RenderGraphic[];
  }

  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  class OffScreenTarget extends Target {
    // WARNING: The type "System" needs to be exported by the package (e.g. added to index.ts)
    constructor(system: System, _viewRect: ViewRect);
    // (undocumented)
    setViewRect(rect: ViewRect, _temp: boolean): void;
    // (undocumented)
    readonly viewRect: ViewRect;
  }

  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  class OnScreenTarget extends Target {
    // WARNING: The type "System" needs to be exported by the package (e.g. added to index.ts)
    constructor(system: System, _canvas: HTMLCanvasElement);
    // (undocumented)
    setViewRect(_rect: ViewRect, _temp: boolean): void;
    // (undocumented)
    readonly viewRect: ViewRect;
  }

  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  class System extends RenderSystem {
    // WARNING: The type "Batch" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    createBatch(graphic: RenderGraphic, features: PackedFeatureTable, range: ElementAlignedBox3d): Batch;
    // WARNING: The type "Branch" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    createBranch(branch: GraphicBranch, transform: Transform, clips?: RenderClipVolume): Branch;
    // WARNING: The type "Builder" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    createGraphicBuilder(placement: Transform, type: GraphicType, viewport: Viewport, pickableId?: Id64String): Builder;
    // WARNING: The type "List" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    createGraphicList(primitives: RenderGraphic[]): List;
    // WARNING: The type "MeshParams" needs to be exported by the package (e.g. added to index.ts)
    // WARNING: The type "Graphic" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    createMesh(_params: MeshParams): Graphic;
    // (undocumented)
    createOffscreenTarget(rect: ViewRect): RenderTarget;
    // WARNING: The type "PointCloudArgs" needs to be exported by the package (e.g. added to index.ts)
    // WARNING: The type "Graphic" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    createPointCloud(_args: PointCloudArgs, _imodel: IModelConnection): Graphic;
    // WARNING: The type "PointStringParams" needs to be exported by the package (e.g. added to index.ts)
    // WARNING: The type "Graphic" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    createPointString(_params: PointStringParams): Graphic;
    // WARNING: The type "PolylineParams" needs to be exported by the package (e.g. added to index.ts)
    // WARNING: The type "Graphic" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    createPolyline(_params: PolylineParams): Graphic;
    // WARNING: The type "OnScreenTarget" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    createTarget(canvas: HTMLCanvasElement): OnScreenTarget;
    // (undocumented)
    dispose(): void;
    // (undocumented)
    readonly isValid: boolean;
    // (undocumented)
    readonly maxTextureSize: number;
  }

  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  class Target extends RenderTarget {
    // WARNING: The type "System" needs to be exported by the package (e.g. added to index.ts)
    protected constructor(_system: System);
    // (undocumented)
    animationFraction: number;
    // (undocumented)
    readonly cameraFrustumNearScaleLimit: number;
    // (undocumented)
    changeDecorations(_decs: Decorations): void;
    // (undocumented)
    changeDynamics(_dynamics?: GraphicList): void;
    // (undocumented)
    changeRenderPlan(_plan: RenderPlan): void;
    // (undocumented)
    changeScene(_scene: GraphicList): void;
    // (undocumented)
    changeTerrain(_terrain: GraphicList): void;
    // (undocumented)
    drawFrame(_sceneTime?: number): void;
    // WARNING: The type "Pixel.Selector" needs to be exported by the package (e.g. added to index.ts)
    // WARNING: The type "Pixel.Receiver" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    readPixels(_rect: ViewRect, _selector: Pixel.Selector, receiver: Pixel.Receiver, _excludeNonLocatable: boolean): void;
    // (undocumented)
    readonly renderSystem: RenderSystem;
    // (undocumented)
    updateViewRect(): boolean;
    // (undocumented)
    readonly wantInvertBlackBackground: boolean;
  }

}

// @public
class ModelSelectorState extends ElementState {
  constructor(props: ModelSelectorProps, iModel: IModelConnection);
  addModels(arg: Id64Arg): void;
  containsModel(modelId: Id64String): boolean;
  dropModels(arg: Id64Arg): void;
  // @public
  equalState(other: ModelSelectorState): boolean;
  has(id: string): boolean;
  load(): Promise<void>;
  readonly models: Set<string>;
  readonly name: string;
  // (undocumented)
  toJSON(): ModelSelectorProps;
}

// @public
class ModelState extends EntityState, implements ModelProps {
  constructor(props: ModelProps, iModel: IModelConnection);
  readonly asGeometricModel: GeometricModelState | undefined;
  readonly asGeometricModel2d: GeometricModel2dState | undefined;
  readonly asGeometricModel3d: GeometricModel3dState | undefined;
  readonly isGeometricModel: boolean;
  // (undocumented)
  readonly isPrivate: boolean;
  // (undocumented)
  readonly isTemplate: boolean;
  // (undocumented)
  readonly modeledElement: RelatedElement;
  // (undocumented)
  readonly name: string;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal
  onIModelConnectionClose(): void;
  // (undocumented)
  parentModel: Id64String;
  toJSON(): ModelProps;
}

// @public (undocumented)
enum ModifyElementSource {
  DragSelect = 5,
  Fence = 3,
  Group = 4,
  Selected = 1,
  SelectionSet = 2,
  Unknown = 0
}

// @public
interface MultilineTextEditorParams extends BasePropertyEditorParams {
  // (undocumented)
  heightInRows: number;
  // (undocumented)
  type: PropertyEditorParamTypes.MultilineText;
}

// WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
// @internal
class NoRenderApp extends IModelApp {
  // (undocumented)
  protected static supplyRenderSystem(): RenderSystem;
}

// @public
class NotificationManager {
  protected _showToolTip(_htmlElement: HTMLElement, _message: HTMLElement | string, _location?: XAndY, _options?: ToolTipOptions): void;
  clearToolTip(): void;
  closePointerMessage(): void;
  endActivityMessage(_reason: ActivityMessageEndReason): boolean;
  readonly isToolTipOpen: boolean;
  readonly isToolTipSupported: boolean;
  openMessageBox(_mbType: MessageBoxType, _message: string, _icon: MessageBoxIconType): Promise<MessageBoxValue>;
  openToolTip(_htmlElement: HTMLElement, message: HTMLElement | string, location?: XAndY, options?: ToolTipOptions): void;
  outputActivityMessage(_messageText: string, _percentComplete: number): boolean;
  outputMessage(_message: NotifyMessageDetails): void;
  outputPrompt(_prompt: string): void;
  outputPromptByKey(key: string): void;
  setupActivityMessage(_details: ActivityMessageDetails): boolean;
  // (undocumented)
  readonly toolTipLocation: Point2d;
}

// @public
class NotifyMessageDetails {
  constructor(priority: OutputMessagePriority, briefMessage: string, detailedMessage?: string | undefined, msgType?: OutputMessageType, openAlert?: OutputMessageAlert);
  // (undocumented)
  briefMessage: string;
  // (undocumented)
  detailedMessage?: string | undefined;
  // (undocumented)
  displayPoint?: Point2d;
  // (undocumented)
  displayTime: BeDuration;
  // (undocumented)
  msgType: OutputMessageType;
  // (undocumented)
  openAlert: OutputMessageAlert;
  // (undocumented)
  priority: OutputMessagePriority;
  // (undocumented)
  relativePosition: RelativePosition;
  setPointerTypeDetails(viewport: HTMLElement, displayPoint: XAndY, relativePosition?: RelativePosition): void;
  // (undocumented)
  viewport?: HTMLElement;
}

// WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
// @internal
class NullRenderSystem extends RenderSystem {
  constructor();
  // (undocumented)
  createBatch(): any;
  // (undocumented)
  createBranch(): any;
  // (undocumented)
  createGraphicBuilder(): any;
  // (undocumented)
  createGraphicList(): any;
  // (undocumented)
  createOffscreenTarget(): NullTarget;
  // (undocumented)
  createTarget(): NullTarget;
  // (undocumented)
  dispose(): void;
  // (undocumented)
  readonly isValid: boolean;
}

// WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
// @internal
class NullTarget extends RenderTarget {
  // (undocumented)
  animationBranches: AnimationBranchStates | undefined;
  // (undocumented)
  animationFraction: number;
  // (undocumented)
  readonly cameraFrustumNearScaleLimit: number;
  // (undocumented)
  changeDecorations(): void;
  // (undocumented)
  changeDynamics(): void;
  // (undocumented)
  changeRenderPlan(): void;
  // (undocumented)
  changeScene(): void;
  // (undocumented)
  changeTerrain(): void;
  // (undocumented)
  dispose(): void;
  // (undocumented)
  drawFrame(_sceneMilSecElapsed?: number): void;
  // (undocumented)
  onDestroy(): void;
  // (undocumented)
  onResized(): void;
  // (undocumented)
  overrideFeatureSymbology(): void;
  // (undocumented)
  readImage(): undefined;
  // (undocumented)
  readPixels(): void;
  // (undocumented)
  readonly renderSystem: any;
  // (undocumented)
  reset(): void;
  // (undocumented)
  setFlashed(): void;
  // (undocumented)
  setHiliteSet(): void;
  // (undocumented)
  setViewRect(): void;
  // (undocumented)
  updateViewRect(): boolean;
  // (undocumented)
  readonly viewRect: ViewRect;
  // (undocumented)
  readonly wantInvertBlackBackground: boolean;
}

// WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
// @internal (undocumented)
class OffScreenTarget extends Target {
  constructor(rect: ViewRect);
  // (undocumented)
  protected _assignDC(): boolean;
  // (undocumented)
  protected _beginPaint(): void;
  // (undocumented)
  protected _endPaint(): void;
  // (undocumented)
  animationFraction: number;
  // (undocumented)
  onResized(): void;
  // (undocumented)
  setViewRect(rect: ViewRect, temporary: boolean): void;
  // (undocumented)
  updateViewRect(): boolean;
  // (undocumented)
  readonly viewRect: ViewRect;
}

// WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
// @internal
class OffScreenViewport extends Viewport {
  // (undocumented)
  static create(view: ViewState, viewRect?: ViewRect): OffScreenViewport;
  // (undocumented)
  setRect(rect: ViewRect, temporary?: boolean): void;
  // (undocumented)
  readonly viewRect: ViewRect;
}

// @public
class OidcBrowserClient extends OidcClient, implements IOidcFrontendClient {
  constructor(_configuration: OidcFrontendClientConfiguration);
  dispose(): void;
  getAccessToken(requestContext?: ClientRequestContext): Promise<AccessToken>;
  handleRedirectCallback(): Promise<boolean>;
  readonly hasExpired: boolean;
  readonly hasSignedIn: boolean;
  initialize(requestContext: FrontendRequestContext): Promise<void>;
  readonly isAuthorized: boolean;
  readonly onUserStateChanged: BeEvent<(token: AccessToken | undefined, message: string) => void>;
  signIn(requestContext: ClientRequestContext): Promise<AccessToken>;
  signOut(requestContext: ClientRequestContext): Promise<void>;
}

// @public (undocumented)
class OidcClientWrapper {
  // (undocumented)
  static initialize(requestContext: ClientRequestContext, config: OidcFrontendClientConfiguration): Promise<void>;
  // (undocumented)
  static readonly oidcClient: IOidcFrontendClient;
}

// WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
// @internal
class OnScreenTarget extends Target {
  constructor(canvas: HTMLCanvasElement);
  // (undocumented)
  protected _assignDC(): boolean;
  // (undocumented)
  protected _beginPaint(): void;
  // (undocumented)
  protected _endPaint(): void;
  // (undocumented)
  animationFraction: number;
  // (undocumented)
  protected debugPaint(): void;
  // (undocumented)
  dispose(): void;
  // (undocumented)
  protected drawOverlayDecorations(): void;
  // (undocumented)
  onResized(): void;
  // (undocumented)
  pickOverlayDecoration(pt: XAndY): CanvasDecoration | undefined;
  // (undocumented)
  setViewRect(_rect: ViewRect, _temporary: boolean): void;
  // (undocumented)
  updateViewRect(): boolean;
  // (undocumented)
  readonly viewRect: ViewRect;
}

// @public
class OrthographicViewState extends SpatialViewState {
  constructor(props: SpatialViewDefinitionProps, iModel: IModelConnection, categories: CategorySelectorState, displayStyle: DisplayStyle3dState, modelSelector: ModelSelectorState);
  // (undocumented)
  static readonly className: string;
  // (undocumented)
  supportsCamera(): boolean;
}

// @public
enum OutputMessageAlert {
  // (undocumented)
  Balloon = 2,
  // (undocumented)
  Dialog = 1,
  // (undocumented)
  None = 0
}

// @public
enum OutputMessagePriority {
  // (undocumented)
  Debug = 13,
  // (undocumented)
  Error = 10,
  // (undocumented)
  Fatal = 17,
  // (undocumented)
  Info = 12,
  // (undocumented)
  None = 0,
  // (undocumented)
  Warning = 11
}

// @public
enum OutputMessageType {
  Alert = 4,
  // (undocumented)
  InputField = 3,
  // (undocumented)
  Pointer = 1,
  // (undocumented)
  Sticky = 2,
  Toast = 0
}

// @public (undocumented)
interface PackedFeature {
  // (undocumented)
  animationNodeId: number;
  // (undocumented)
  elementId: Id64.Uint32Pair;
  // (undocumented)
  geometryClass: GeometryClass;
  // (undocumented)
  subCategoryId: Id64.Uint32Pair;
}

// @public
class PackedFeatureTable {
  // @internal
  constructor(data: Uint32Array, modelId: Id64String, numFeatures: number, maxFeatures: number, type: BatchType, animationNodeIds?: Uint8Array | Uint16Array | Uint32Array);
  // (undocumented)
  readonly anyDefined: boolean;
  // (undocumented)
  readonly byteLength: number;
  findElementId(featureIndex: number): Id64String | undefined;
  findFeature(featureIndex: number): Feature | undefined;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  getAnimationNodeId(featureIndex: number): number;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  getElementIdPair(featureIndex: number): Id64.Uint32Pair;
  getFeature(featureIndex: number): Feature;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  getPackedFeature(featureIndex: number): PackedFeature;
  // (undocumented)
  readonly isClassifier: boolean;
  // (undocumented)
  readonly isPlanarClassifier: boolean;
  readonly isUniform: boolean;
  // (undocumented)
  readonly isVolumeClassifier: boolean;
  // (undocumented)
  readonly maxFeatures: number;
  // (undocumented)
  readonly modelId: Id64String;
  // (undocumented)
  readonly numFeatures: number;
  static pack(featureTable: FeatureTable): PackedFeatureTable;
  // (undocumented)
  readonly type: BatchType;
  readonly uniform: Feature | undefined;
  unpack(): FeatureTable;
}

// @public
class PanViewTool extends ViewManip {
  constructor(vp: ScreenViewport | undefined, oneShot?: boolean, isDraggingRequired?: boolean);
  // (undocumented)
  onReinitialize(): void;
  // (undocumented)
  static toolId: string;
}

// WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
// @internal (undocumented)
class PerformanceMetrics {
  constructor(gatherGlFinish?: boolean, gatherCurPerformanceMetrics?: boolean);
  // (undocumented)
  curSpfTimeIndex: number;
  // (undocumented)
  endFrame(operationName?: string): void;
  // (undocumented)
  fpsTimer: StopWatch;
  // (undocumented)
  fpsTimerStart: number;
  // (undocumented)
  frameTimings: Map<string, number>;
  // (undocumented)
  gatherCurPerformanceMetrics: boolean;
  // (undocumented)
  gatherGlFinish: boolean;
  // (undocumented)
  loadTileSum: number;
  // (undocumented)
  loadTileTimes: number[];
  // (undocumented)
  recordTime(operationName: string): void;
  // (undocumented)
  renderSpfSum: number;
  // (undocumented)
  renderSpfTimes: number[];
  // (undocumented)
  spfSum: number;
  // (undocumented)
  spfTimes: number[];
  // (undocumented)
  startNewFrame(sceneTime?: number): void;
}

// WARNING: Unsupported export: Receiver
// @public
module Pixel {
  interface Buffer {
    // WARNING: The type "Data" needs to be exported by the package (e.g. added to index.ts)
    getPixel(x: number, y: number): Data;
  }

  class Data {
    // WARNING: The type "GeometryType" needs to be exported by the package (e.g. added to index.ts)
    // WARNING: The type "Planarity" needs to be exported by the package (e.g. added to index.ts)
    constructor(feature?: Feature | undefined, distanceFraction?: number, type?: GeometryType, planarity?: Planarity, featureTable?: PackedFeatureTable | undefined);
    // (undocumented)
    readonly distanceFraction: number;
    // (undocumented)
    readonly elementId: Id64String | undefined;
    // (undocumented)
    readonly feature?: Feature | undefined;
    // (undocumented)
    readonly featureTable?: PackedFeatureTable | undefined;
    // (undocumented)
    readonly geometryClass: GeometryClass | undefined;
    // WARNING: The type "Planarity" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    readonly planarity: Planarity;
    // (undocumented)
    readonly subCategoryId: Id64String | undefined;
    // WARNING: The type "GeometryType" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    readonly type: GeometryType;
  }

  enum GeometryType {
    Edge = 4,
    Linear = 3,
    None = 1,
    Silhouette = 5,
    Surface = 2,
    Unknown = 0
  }

  enum Planarity {
    None = 1,
    NonPlanar = 3,
    Planar = 2,
    Unknown = 0
  }

  enum Selector {
    All = 5,
    Feature = 1,
    GeometryAndDistance = 4,
    // (undocumented)
    None = 0
  }

}

// WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
// @internal
class PlanarClassifiers {
  // WARNING: The type "PlanarClassifier" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  readonly classifier: PlanarClassifier | undefined;
  // (undocumented)
  readonly isValid: boolean;
  // (undocumented)
  pop(): void;
  // WARNING: The type "PlanarClassifier" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  push(texture: PlanarClassifier): void;
}

// @public
class Plugin {
  constructor(name: string, versionsRequired: string);
  // (undocumented)
  name: string;
  abstract onExecute(_args: string[]): void;
  onLoad(_args: string[]): void;
  // (undocumented)
  versionsRequired: string;
}

// @public
class PluginAdmin {
  static getPlugin(pluginName: string): Promise<Plugin> | undefined;
  static loadPlugin(packageName: string, args?: string[]): Promise<Plugin>;
  static register(plugin: Plugin): string[] | undefined;
}

// WARNING: Unsupported export: Text
// WARNING: Unsupported export: String
// WARNING: Unsupported export: ShortDate
// WARNING: Unsupported export: Boolean
// WARNING: Unsupported export: Float
// WARNING: Unsupported export: Int
// WARNING: Unsupported export: Hexadecimal
// WARNING: Unsupported export: Enum
// WARNING: Unsupported export: Numeric
// WARNING: Unsupported export: Point2d
// WARNING: Unsupported export: Point3d
// WARNING: Unsupported export: Point
// WARNING: Unsupported export: Value
// @public (undocumented)
module Primitives {
}

// @public
class PrimitiveTool extends InteractiveTool {
  autoLockTarget(): void;
  // (undocumented)
  exitTool(): void;
  getPrompt(): string;
  readonly iModel: IModelConnection;
  isCompatibleViewport(vp: Viewport | undefined, isSelectedViewChange: boolean): boolean;
  isValidLocation(ev: BeButtonEvent, isButtonEvent: boolean): boolean;
  onRedoPreviousStep(): Promise<boolean>;
  onReinitialize(): void;
  abstract onRestartTool(): void;
  onSelectedViewportChanged(_previous: Viewport | undefined, current: Viewport | undefined): void;
  onUndoPreviousStep(): Promise<boolean>;
  // (undocumented)
  redoPreviousStep(): Promise<boolean>;
  requireWriteableTarget(): boolean;
  run(): boolean;
  saveChanges(): Promise<void>;
  // (undocumented)
  targetIsLocked: boolean;
  // (undocumented)
  targetModelId?: string;
  // (undocumented)
  targetView?: Viewport;
  // (undocumented)
  undoPreviousStep(): Promise<boolean>;
}

// @public
interface PrimitiveValue extends BasePropertyValue {
  // (undocumented)
  displayValue?: string;
  // (undocumented)
  value?: Primitives.Value;
  // (undocumented)
  valueFormat: PropertyValueFormat.Primitive;
}

// @public
interface PropertyDescription {
  dataController?: string;
  // (undocumented)
  displayLabel: string;
  // (undocumented)
  editor?: PropertyEditorInfo;
  // (undocumented)
  enum?: EnumerationChoicesInfo;
  // (undocumented)
  name: string;
  quantityType?: QuantityType | string;
  // (undocumented)
  typename: string;
}

// @public
interface PropertyEditorInfo {
  // (undocumented)
  name?: string;
  // (undocumented)
  params?: PropertyEditorParams[];
}

// @public
enum PropertyEditorParamTypes {
  // (undocumented)
  ButtonGroupData = 0,
  // (undocumented)
  CheckBoxIcons = 1,
  // (undocumented)
  ColorData = 10,
  // (undocumented)
  Icon = 2,
  // (undocumented)
  InputEditorSize = 3,
  // (undocumented)
  JSON = 4,
  // (undocumented)
  MultilineText = 5,
  // (undocumented)
  Range = 6,
  // (undocumented)
  Slider = 7,
  // (undocumented)
  SuppressEditorLabel = 9,
  // (undocumented)
  SuppressUnitLabel = 8
}

// @public
class PropertyRecord {
  constructor(value: PropertyValue, property: PropertyDescription);
  copyWithNewValue(newValue: PropertyValue): PropertyRecord;
  // (undocumented)
  description?: string;
  // (undocumented)
  isDisabled?: boolean;
  // (undocumented)
  isMerged?: boolean;
  // (undocumented)
  isReadonly?: boolean;
  links?: LinkElementsInfo;
  // (undocumented)
  readonly property: PropertyDescription;
  // (undocumented)
  readonly value: PropertyValue;
}

// @public
enum PropertyValueFormat {
  // (undocumented)
  Array = 1,
  // (undocumented)
  Primitive = 0,
  // (undocumented)
  Struct = 2
}

// @public
class QuantityFormatter implements UnitsProvider {
  // (undocumented)
  protected _activeSystemIsImperial: boolean;
  // (undocumented)
  protected _formatSpecsByKoq: Map<string, FormatterSpec[]>;
  // (undocumented)
  protected _imperialFormatsByType: Map<QuantityType, Format>;
  // (undocumented)
  protected _imperialFormatSpecsByType: Map<QuantityType, FormatterSpec>;
  // (undocumented)
  protected _metricFormatsByType: Map<QuantityType, Format>;
  // (undocumented)
  protected _metricFormatSpecsByType: Map<QuantityType, FormatterSpec>;
  findFormatterSpecByQuantityType(type: QuantityType, imperial?: boolean): FormatterSpec | undefined;
  protected findKoqFormatterSpec(koq: string, useImperial: boolean): FormatterSpec | undefined;
  findUnit(unitLabel: string, unitFamily?: string): Promise<UnitProps>;
  findUnitByName(unitName: string): Promise<UnitProps>;
  // WARNING: The type "UnitDefinition" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  protected findUnitDefinition(name: string): UnitDefinition | undefined;
  formatQuantity(magnitude: number, formatSpec: FormatterSpec): string;
  getConversion(fromUnit: UnitProps, toUnit: UnitProps): Promise<UnitConversion>;
  // (undocumented)
  protected getFormatByQuantityType(type: QuantityType, imperial: boolean): Promise<Format>;
  getFormatterSpecByQuantityType(type: QuantityType, imperial?: boolean): Promise<FormatterSpec>;
  protected getKoqFormatterSpec(koq: string, useImperial: boolean): Promise<FormatterSpec | undefined>;
  protected getKoqFormatterSpecsAsync(koq: string, useImperial: boolean): Promise<FormatterSpec[] | undefined>;
  protected getUnitByQuantityType(type: QuantityType): Promise<UnitProps>;
  protected loadFormatSpecsForQuantityTypes(useImperial: boolean): Promise<void>;
  protected loadKoqFormatSpecs(koq: string): Promise<void>;
  // (undocumented)
  protected loadStdFormat(type: QuantityType, imperial: boolean): Promise<Format>;
  useImperialFormats: boolean;
}

// @public
enum QuantityType {
  // (undocumented)
  Angle = 2,
  // (undocumented)
  Area = 3,
  // (undocumented)
  Coordinate = 6,
  // (undocumented)
  LatLong = 5,
  // (undocumented)
  Length = 1,
  // (undocumented)
  Volume = 4
}

// @public
interface RangeEditorParams extends BasePropertyEditorParams {
  maximum?: number;
  minimum?: number;
  // (undocumented)
  type: PropertyEditorParamTypes.Range;
}

// @public
enum RelativePosition {
  // (undocumented)
  Bottom = 3,
  // (undocumented)
  BottomLeft = 6,
  // (undocumented)
  BottomRight = 7,
  // (undocumented)
  Left = 0,
  // (undocumented)
  Right = 2,
  // (undocumented)
  Top = 1,
  // (undocumented)
  TopLeft = 4,
  // (undocumented)
  TopRight = 5
}

// @public
enum RemoveMe {
  // (undocumented)
  No = 0,
  // (undocumented)
  Yes = 1
}

// @public
class RenderClassifierModel {
  constructor(type: ClassifierType);
  // (undocumented)
  readonly type: ClassifierType;
}

// @public
class RenderClipVolume implements IDisposable {
  // (undocumented)
  abstract dispose(): void;
  readonly type: ClippingType;
}

// @public
class RenderContext {
  constructor(vp: Viewport, frustum?: Frustum);
  // @internal (undocumented)
  protected _createGraphicBuilder(type: GraphicType, transform?: Transform, id?: Id64String): GraphicBuilder;
  createBranch(branch: GraphicBranch, location: Transform, clip?: RenderClipVolume, planarClassifier?: RenderPlanarClassifier): RenderGraphic;
  createSceneGraphicBuilder(transform?: Transform): GraphicBuilder;
  readonly frustum: Frustum;
  readonly frustumPlanes: FrustumPlanes;
  getPixelSizeAtPoint(inPoint?: Point3d): number;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  readonly target: RenderTarget;
  readonly viewFlags: ViewFlags;
  readonly viewport: Viewport;
}

// WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
// @internal (undocumented)
enum RenderDiagnostics {
  All = 6,
  DebugOutput = 2,
  None = 0,
  WebGL = 4
}

// @public
class RenderGraphic implements IDisposable, RenderMemory.Consumer {
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // WARNING: The type "RenderMemory.Statistics" needs to be exported by the package (e.g. added to index.ts)
  // @internal (undocumented)
  abstract collectStatistics(stats: RenderMemory.Statistics): void;
  // (undocumented)
  abstract dispose(): void;
}

// WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
// @internal
module RenderMemory {
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal
  class Buffers extends Consumers {
    constructor();
    // WARNING: The type "BufferType" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    addBuffer(type: BufferType, numBytes: number): void;
    // (undocumented)
    clear(): void;
    // WARNING: The type "Consumers" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    readonly consumers: Consumers[];
    // WARNING: The type "Consumers" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    readonly instances: Consumers;
    // WARNING: The type "Consumers" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    readonly pointClouds: Consumers;
    // WARNING: The type "Consumers" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    readonly pointStrings: Consumers;
    // WARNING: The type "Consumers" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    readonly polylineEdges: Consumers;
    // WARNING: The type "Consumers" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    readonly polylines: Consumers;
    // WARNING: The type "Consumers" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    readonly silhouetteEdges: Consumers;
    // WARNING: The type "Consumers" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    readonly surfaces: Consumers;
    // WARNING: The type "Consumers" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    readonly visibleEdges: Consumers;
  }

  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  enum BufferType {
    // (undocumented)
    COUNT = 8,
    // (undocumented)
    Instances = 7,
    // (undocumented)
    PointClouds = 6,
    // (undocumented)
    PointStrings = 5,
    // (undocumented)
    PolylineEdges = 3,
    // (undocumented)
    Polylines = 4,
    // (undocumented)
    SilhouetteEdges = 2,
    // (undocumented)
    Surfaces = 0,
    // (undocumented)
    VisibleEdges = 1
  }

  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  interface Consumer {
    // WARNING: The type "Statistics" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    collectStatistics(stats: Statistics): void;
  }

  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal
  class Consumers {
    // (undocumented)
    addConsumer(numBytes: number): void;
    // (undocumented)
    clear(): void;
    // (undocumented)
    count: number;
    // (undocumented)
    maxBytes: number;
    // (undocumented)
    totalBytes: number;
  }

  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  enum ConsumerType {
    // (undocumented)
    ClipVolumes = 4,
    // (undocumented)
    COUNT = 6,
    // (undocumented)
    FeatureOverrides = 3,
    // (undocumented)
    FeatureTables = 2,
    // (undocumented)
    PlanarClassifiers = 5,
    // (undocumented)
    Textures = 0,
    // (undocumented)
    VertexTables = 1
  }

  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  class Statistics {
    constructor();
    // WARNING: The type "BufferType" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    addBuffer(type: BufferType, numBytes: number): void;
    // (undocumented)
    addClipVolume(numBytes: number): void;
    // WARNING: The type "ConsumerType" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    addConsumer(type: ConsumerType, numBytes: number): void;
    // (undocumented)
    addFeatureOverrides(numBytes: number): void;
    // (undocumented)
    addFeatureTable(numBytes: number): void;
    // (undocumented)
    addInstances(numBytes: number): void;
    // (undocumented)
    addPlanarClassifier(numBytes: number): void;
    // (undocumented)
    addPointCloud(numBytes: number): void;
    // (undocumented)
    addPointString(numBytes: number): void;
    // (undocumented)
    addPolyline(numBytes: number): void;
    // (undocumented)
    addPolylineEdges(numBytes: number): void;
    // (undocumented)
    addSilhouetteEdges(numBytes: number): void;
    // (undocumented)
    addSurface(numBytes: number): void;
    // (undocumented)
    addTexture(numBytes: number): void;
    // (undocumented)
    addVertexTable(numBytes: number): void;
    // (undocumented)
    addVisibleEdges(numBytes: number): void;
    // WARNING: The type "Buffers" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    readonly buffers: Buffers;
    // (undocumented)
    clear(): void;
    // WARNING: The type "Consumers" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    readonly clipVolumes: Consumers;
    // WARNING: The type "Consumers" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    readonly consumers: Consumers[];
    // WARNING: The type "Consumers" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    readonly featureOverrides: Consumers;
    // WARNING: The type "Consumers" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    readonly featureTables: Consumers;
    // WARNING: The type "Consumers" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    readonly planarClassifiers: Consumers;
    // WARNING: The type "Consumers" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    readonly textures: Consumers;
    // (undocumented)
    readonly totalBytes: number;
    // WARNING: The type "Consumers" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    readonly vertexTables: Consumers;
  }

}

// @public (undocumented)
class RenderPlan {
  // (undocumented)
  readonly aaLines: AntiAliasPref;
  // (undocumented)
  readonly aaText: AntiAliasPref;
  // (undocumented)
  readonly activeVolume?: RenderClipVolume;
  // (undocumented)
  readonly analysisStyle?: AnalysisStyle;
  // (undocumented)
  analysisTexture?: RenderTexture;
  // (undocumented)
  readonly ao?: AmbientOcclusion.Settings;
  // (undocumented)
  readonly bgColor: ColorDef;
  // (undocumented)
  classificationTextures?: Map<Id64String, RenderTexture>;
  // (undocumented)
  static create(options: any, vp: Viewport): RenderPlan;
  // (undocumented)
  static createFromViewport(vp: Viewport): RenderPlan;
  // (undocumented)
  readonly fraction: number;
  // (undocumented)
  readonly frustum: Frustum;
  // (undocumented)
  readonly hiliteSettings: Hilite.Settings;
  // (undocumented)
  readonly hline?: HiddenLine.Settings;
  // (undocumented)
  readonly is3d: boolean;
  // (undocumented)
  readonly isFadeOutActive: boolean;
  // (undocumented)
  readonly lights?: SceneLights;
  // (undocumented)
  readonly monoColor: ColorDef;
  // (undocumented)
  selectTerrainFrustum(): void;
  // (undocumented)
  selectViewFrustum(): void;
  // (undocumented)
  readonly terrainFrustum: ViewFrustum | undefined;
  // (undocumented)
  readonly viewFlags: ViewFlags;
  // (undocumented)
  readonly viewFrustum: ViewFrustum;
}

// @public
class RenderPlanarClassifier implements IDisposable {
  // (undocumented)
  abstract dispose(): void;
}

// @public
class RenderSystem implements IDisposable {
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  addSpatialClassificationModel(_modelId: Id64String, _classificationModel: RenderClassifierModel, _iModel: IModelConnection): void;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal
  abstract createBatch(graphic: RenderGraphic, features: PackedFeatureTable, range: ElementAlignedBox3d): RenderGraphic;
  abstract createBranch(branch: GraphicBranch, transform: Transform, clips?: RenderClipVolume, planarClassifier?: RenderPlanarClassifier): RenderGraphic;
  abstract createGraphicBuilder(placement: Transform, type: GraphicType, viewport: Viewport, pickableId?: Id64String): GraphicBuilder;
  abstract createGraphicList(primitives: RenderGraphic[]): RenderGraphic;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // WARNING: The type "PolylineArgs" needs to be exported by the package (e.g. added to index.ts)
  // @internal (undocumented)
  createIndexedPolylines(args: PolylineArgs, instances?: InstancedGraphicParams): RenderGraphic | undefined;
  createMaterial(_params: RenderMaterial.Params, _imodel: IModelConnection): RenderMaterial | undefined;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // WARNING: The type "MeshParams" needs to be exported by the package (e.g. added to index.ts)
  // @internal (undocumented)
  createMesh(_params: MeshParams, _instances?: InstancedGraphicParams): RenderGraphic | undefined;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  abstract createOffscreenTarget(rect: ViewRect): RenderTarget;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // WARNING: The type "SpatialClassification.Properties" needs to be exported by the package (e.g. added to index.ts)
  // @internal (undocumented)
  createPlanarClassifier(_properties: SpatialClassification.Properties, _tileTree: TileTree, _classifiedModel: GeometricModelState, _sceneContext: SceneContext): RenderPlanarClassifier | undefined;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // WARNING: The type "PointCloudArgs" needs to be exported by the package (e.g. added to index.ts)
  // @internal (undocumented)
  createPointCloud(_args: PointCloudArgs, _imodel: IModelConnection): RenderGraphic | undefined;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // WARNING: The type "PointStringParams" needs to be exported by the package (e.g. added to index.ts)
  // @internal (undocumented)
  createPointString(_params: PointStringParams, _instances?: InstancedGraphicParams): RenderGraphic | undefined;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // WARNING: The type "PolylineParams" needs to be exported by the package (e.g. added to index.ts)
  // @internal (undocumented)
  createPolyline(_params: PolylineParams, _instances?: InstancedGraphicParams): RenderGraphic | undefined;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  createSheetTile(_tile: RenderTexture, _polyfaces: IndexedPolyface[], _tileColor: ColorDef): GraphicList;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  createSheetTilePolyfaces(_corners: Point3d[], _clip?: ClipVector): IndexedPolyface[];
  // WARNING: The type "SkyBox.CreateParams" needs to be exported by the package (e.g. added to index.ts)
  createSkyBox(_params: SkyBox.CreateParams): RenderGraphic | undefined;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  abstract createTarget(canvas: HTMLCanvasElement): RenderTarget;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal
  createTextureFromCubeImages(_posX: HTMLImageElement, _negX: HTMLImageElement, _posY: HTMLImageElement, _negY: HTMLImageElement, _posZ: HTMLImageElement, _negZ: HTMLImageElement, _imodel: IModelConnection, _params: RenderTexture.Params): RenderTexture | undefined;
  createTextureFromImage(_image: HTMLImageElement, _hasAlpha: boolean, _imodel: IModelConnection | undefined, _params: RenderTexture.Params): RenderTexture | undefined;
  createTextureFromImageBuffer(_image: ImageBuffer, _imodel: IModelConnection, _params: RenderTexture.Params): RenderTexture | undefined;
  createTextureFromImageSource(source: ImageSource, imodel: IModelConnection | undefined, params: RenderTexture.Params): Promise<RenderTexture | undefined>;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  createTile(tileTexture: RenderTexture, corners: Point3d[]): RenderGraphic | undefined;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // WARNING: The type "MeshArgs" needs to be exported by the package (e.g. added to index.ts)
  // @internal (undocumented)
  createTriMesh(args: MeshArgs, instances?: InstancedGraphicParams): RenderGraphic | undefined;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  abstract dispose(): void;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  enableDiagnostics(_enable: RenderDiagnostics): void;
  findMaterial(_key: string, _imodel: IModelConnection): RenderMaterial | undefined;
  findTexture(_key: string, _imodel: IModelConnection): RenderTexture | undefined;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  getClipVolume(_clipVector: ClipVector, _imodel: IModelConnection): RenderClipVolume | undefined;
  getGradientTexture(_symb: Gradient.Symb, _imodel: IModelConnection): RenderTexture | undefined;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  getSpatialClassificationModel(_classifierModelId: Id64String, _iModel: IModelConnection): RenderClassifierModel | undefined;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  readonly isValid: boolean;
  loadTexture(id: Id64String, iModel: IModelConnection): Promise<RenderTexture | undefined>;
  loadTextureImage(id: Id64String, iModel: IModelConnection): Promise<TextureImage | undefined>;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  readonly maxTextureSize: number;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  onInitialized(): void;
}

// WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
// @internal
class RenderTarget implements IDisposable {
  // (undocumented)
  animationBranches: AnimationBranchStates | undefined;
  // (undocumented)
  animationFraction: number;
  // (undocumented)
  readonly cameraFrustumNearScaleLimit: number;
  // (undocumented)
  abstract changeDecorations(decorations: Decorations): void;
  // (undocumented)
  abstract changeDynamics(dynamics?: GraphicList): void;
  // (undocumented)
  changePlanarClassifiers(_classifiers?: PlanarClassifierMap): void;
  // (undocumented)
  abstract changeRenderPlan(plan: RenderPlan): void;
  // (undocumented)
  abstract changeScene(scene: GraphicList): void;
  // (undocumented)
  abstract changeTerrain(_scene: GraphicList): void;
  // (undocumented)
  createGraphicBuilder(type: GraphicType, viewport: Viewport, placement?: Transform, pickableId?: Id64String): GraphicBuilder;
  static depthFromDisplayPriority(priority: number): number;
  // (undocumented)
  dispose(): void;
  // (undocumented)
  abstract drawFrame(sceneMilSecElapsed?: number): void;
  // (undocumented)
  static readonly frustumDepth2d: number;
  // (undocumented)
  static readonly maxDisplayPriority: number;
  // (undocumented)
  static readonly minDisplayPriority: number;
  // (undocumented)
  onResized(): void;
  // WARNING: The type "FeatureSymbology.Overrides" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  overrideFeatureSymbology(_ovr: FeatureSymbology.Overrides): void;
  // (undocumented)
  pickOverlayDecoration(_pt: XAndY): CanvasDecoration | undefined;
  // (undocumented)
  readImage(_rect: ViewRect, _targetSize: Point2d, _flipVertically: boolean): ImageBuffer | undefined;
  // WARNING: The type "Pixel.Selector" needs to be exported by the package (e.g. added to index.ts)
  // WARNING: The type "Pixel.Receiver" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  abstract readPixels(rect: ViewRect, selector: Pixel.Selector, receiver: Pixel.Receiver, excludeNonLocatable: boolean): void;
  // (undocumented)
  readonly renderSystem: RenderSystem;
  // (undocumented)
  reset(): void;
  // (undocumented)
  setFlashed(_elementId: Id64String, _intensity: number): void;
  // (undocumented)
  setHiliteSet(_hilited: Set<string>): void;
  // (undocumented)
  abstract setViewRect(_rect: ViewRect, _temporary: boolean): void;
  // (undocumented)
  abstract updateViewRect(): boolean;
  // (undocumented)
  readonly viewRect: ViewRect;
  // (undocumented)
  readonly wantInvertBlackBackground: boolean;
}

// @public
class RotateViewTool extends ViewManip {
  constructor(vp: ScreenViewport, oneShot?: boolean, isDraggingRequired?: boolean);
  // (undocumented)
  onReinitialize(): void;
  // (undocumented)
  static toolId: string;
}

// @public (undocumented)
enum RotationMode {
  // (undocumented)
  ACS = 5,
  // (undocumented)
  Context = 6,
  // (undocumented)
  Front = 2,
  // (undocumented)
  Side = 3,
  // (undocumented)
  Top = 1,
  // (undocumented)
  View = 4
}

// @public (undocumented)
class RoundOff {
  // (undocumented)
  active: boolean;
  // (undocumented)
  units: Set<number>;
}

// @public (undocumented)
class SavedState {
  // (undocumented)
  auxRotationPlane: number;
  // (undocumented)
  readonly axes: ThreeAxes;
  // (undocumented)
  contextRotMode: number;
  // (undocumented)
  fixedOrg: boolean;
  // (undocumented)
  ignoreDataButton: boolean;
  // (undocumented)
  ignoreFlags: AccuDrawFlags;
  // (undocumented)
  mode: CompassMode;
  // (undocumented)
  readonly origin: Point3d;
  // (undocumented)
  rotationMode: RotationMode;
  // (undocumented)
  state: CurrentState;
}

// WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
// @internal
class SceneContext extends RenderContext {
  constructor(vp: Viewport, frustum?: Frustum);
  // (undocumented)
  readonly backgroundGraphics: RenderGraphic[];
  // WARNING: The type "BackgroundMapState" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  backgroundMap?: BackgroundMapState;
  // (undocumented)
  getPlanarClassifier(id: Id64String): RenderPlanarClassifier | undefined;
  // (undocumented)
  getPlanarClassifierForModel(modelId: Id64String): RenderPlanarClassifier | undefined;
  // (undocumented)
  readonly graphics: RenderGraphic[];
  // (undocumented)
  hasMissingTiles: boolean;
  // (undocumented)
  insertMissingTile(tile: Tile): void;
  // (undocumented)
  readonly missingTiles: Set<Tile>;
  // (undocumented)
  modelClassifiers: Map<string, string>;
  // (undocumented)
  outputGraphic(graphic: RenderGraphic): void;
  // (undocumented)
  planarClassifiers?: PlanarClassifierMap;
  // (undocumented)
  requestMissingTiles(): void;
  // (undocumented)
  setPlanarClassifier(id: Id64String, planarClassifier: RenderPlanarClassifier): void;
  // (undocumented)
  readonly viewFrustum: ViewFrustum | undefined;
}

// @public
class ScreenViewport extends Viewport {
  // @internal
  constructor(canvas: HTMLCanvasElement, parentDiv: HTMLDivElement, target: RenderTarget);
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  addDecorations(decorations: Decorations): void;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  addNewDiv(className: string, overflowHidden: boolean, z: number): HTMLDivElement;
  readonly canvas: HTMLCanvasElement;
  changeView(view: ViewState): void;
  clearViewUndo(): void;
  static create(parentDiv: HTMLDivElement, view: ViewState): ScreenViewport;
  readonly decorationDiv: HTMLDivElement;
  doRedo(animationTime?: BeDuration): void;
  doUndo(animationTime?: BeDuration): void;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  drawLocateCursor(context: DecorateContext, pt: Point3d, aperture: number, isLocateCircleOn: boolean, hit?: HitDetail): void;
  getClientRect(): ClientRect;
  readonly isRedoPossible: boolean;
  readonly isUndoPossible: boolean;
  maxUndoSteps: number;
  openToolTip(message: HTMLElement | string, location?: XAndY, options?: ToolTipOptions): void;
  readonly parentDiv: HTMLDivElement;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  pickCanvasDecoration(pt: XAndY): import("./render/System").CanvasDecoration | undefined;
  pickNearestVisibleGeometry(pickPoint: Point3d, radius: number, allowNonLocatable?: boolean, out?: Point3d): Point3d | undefined;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal
  static removeAllChildren(el: HTMLDivElement): void;
  resetUndo(): void;
  saveViewUndo(): void;
  setCursor(cursor?: string): void;
  setEventController(controller: EventController | undefined): void;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal
  static setToParentSize(div: HTMLElement): void;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  synchWithView(saveInUndo: boolean): void;
  readonly toolTipDiv: HTMLDivElement;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  viewCmdTargetCenter: Point3d | undefined;
  readonly viewRect: ViewRect;
  readonly vpDiv: HTMLDivElement;
}

// @public
class ScrollViewTool extends ViewManip {
  constructor(vp: ScreenViewport, oneShot?: boolean, isDraggingRequired?: boolean);
  // (undocumented)
  onReinitialize(): void;
  // (undocumented)
  static toolId: string;
}

// @public
class SectionDrawingModelState extends DrawingModelState {
}

// @public
interface SelectedViewportChangedArgs {
  // (undocumented)
  current?: ScreenViewport;
  // (undocumented)
  previous?: ScreenViewport;
}

// @public
enum SelectEventType {
  // (undocumented)
  Add = 0,
  // (undocumented)
  Clear = 3,
  // (undocumented)
  Remove = 1,
  // (undocumented)
  Replace = 2
}

// @public
enum SelectionMethod {
  Box = 2,
  Line = 1,
  Pick = 0
}

// @public
enum SelectionMode {
  Add = 1,
  Remove = 2,
  Replace = 0
}

// @public
enum SelectionProcessing {
  AddElementToSelection = 0,
  InvertElementInSelection = 2,
  RemoveElementFromSelection = 1,
  ReplaceSelectionWithElement = 3
}

// @public (undocumented)
enum SelectionScope {
  Assembly = 1,
  Element = 0
}

// @public
class SelectionSet {
  constructor(iModel: IModelConnection);
  add(elem: Id64Arg, sendEvent?: boolean): boolean;
  addAndRemove(adds: Id64Arg, removes: Id64Arg): boolean;
  readonly elements: Set<string>;
  emptyAll(): void;
  has(elemId?: string): boolean;
  // (undocumented)
  iModel: IModelConnection;
  invert(elem: Id64Arg): boolean;
  readonly isActive: boolean;
  isSelected(elemId?: Id64String): boolean;
  readonly onChanged: BeEvent<(iModel: IModelConnection, evType: SelectEventType, ids?: Set<string> | undefined) => void>;
  remove(elem: Id64Arg, sendEvent?: boolean): boolean;
  replace(elem: Id64Arg): void;
  readonly size: number;
}

// @public
class SelectionTool extends PrimitiveTool {
  // (undocumented)
  protected _selectionScopeValue: ToolSettingsValue;
  applyToolSettingPropertyChange(updatedValue: ToolSettingsPropertySyncItem): boolean;
  // (undocumented)
  autoLockTarget(): void;
  // (undocumented)
  decorate(context: DecorateContext): void;
  // (undocumented)
  filterHit(hit: HitDetail, _out?: LocateResponse): Promise<LocateFilterStatus>;
  // (undocumented)
  protected getSelectionMethod(): SelectionMethod;
  // (undocumented)
  protected getSelectionMode(): SelectionMode;
  // (undocumented)
  static hidden: boolean;
  // (undocumented)
  protected initSelectTool(): void;
  // (undocumented)
  isSelectByPoints: boolean;
  // (undocumented)
  isSuspended: boolean;
  // (undocumented)
  onCleanup(): void;
  // (undocumented)
  onDataButtonUp(ev: BeButtonEvent): Promise<EventHandled>;
  // (undocumented)
  onModifierKeyTransition(_wentDown: boolean, modifier: BeModifierKeys, _event: KeyboardEvent): Promise<EventHandled>;
  // (undocumented)
  onMouseEndDrag(ev: BeButtonEvent): Promise<EventHandled>;
  // (undocumented)
  onMouseMotion(ev: BeButtonEvent): Promise<void>;
  // (undocumented)
  onMouseStartDrag(ev: BeButtonEvent): Promise<EventHandled>;
  // (undocumented)
  onPostInstall(): void;
  // (undocumented)
  onResetButtonUp(ev: BeButtonEvent): Promise<EventHandled>;
  // (undocumented)
  onRestartTool(): void;
  // (undocumented)
  onSuspend(): void;
  // (undocumented)
  onTouchCancel(ev: BeTouchEvent): Promise<void>;
  // (undocumented)
  onTouchComplete(ev: BeTouchEvent): Promise<void>;
  // (undocumented)
  onTouchMove(ev: BeTouchEvent): Promise<void>;
  // (undocumented)
  onTouchMoveStart(ev: BeTouchEvent, startEv: BeTouchEvent): Promise<EventHandled>;
  // (undocumented)
  onUnsuspend(): void;
  // (undocumented)
  readonly points: Point3d[];
  // (undocumented)
  processSelection(elementId: Id64Arg, process: SelectionProcessing): Promise<boolean>;
  // (undocumented)
  requireWriteableTarget(): boolean;
  // (undocumented)
  protected selectByPointsEnd(ev: BeButtonEvent): boolean;
  // (undocumented)
  protected selectByPointsProcess(origin: Point3d, corner: Point3d, ev: BeButtonEvent, method: SelectionMethod, overlap: boolean): void;
  // (undocumented)
  protected selectByPointsStart(ev: BeButtonEvent): boolean;
  // (undocumented)
  selectDecoration(ev: BeButtonEvent, currHit?: HitDetail): Promise<EventHandled>;
  // (undocumented)
  selectionOption: SelectOptions;
  // (undocumented)
  selectionScope: SelectionScope;
  // (undocumented)
  protected setSelectionMethod(method: SelectionMethod): void;
  // (undocumented)
  protected setSelectionMode(mode: SelectionMode): void;
  // (undocumented)
  protected showPrompt(mode: SelectionMode, method: SelectionMethod): void;
  // (undocumented)
  static startTool(): boolean;
  supplyToolSettingsProperties(): ToolSettingsPropertyRecord[] | undefined;
  // (undocumented)
  static toolId: string;
  // (undocumented)
  updateSelection(elementId: Id64Arg, process: SelectionProcessing): boolean;
  // (undocumented)
  protected useOverlapSelection(ev: BeButtonEvent): boolean;
  // (undocumented)
  protected wantEditManipulators(): boolean;
  // (undocumented)
  protected wantPickableDecorations(): boolean;
  // (undocumented)
  protected wantSelectionClearOnMiss(_ev: BeButtonEvent): boolean;
  // (undocumented)
  protected wantSelectionScopeInToolSettings(): boolean;
  // (undocumented)
  protected wantToolSettings(): boolean;
}

// @public
enum SelectOptions {
  // (undocumented)
  BoxAndReplace = 2,
  // (undocumented)
  LineAndReplace = 1,
  // (undocumented)
  PickAndAdd = 3,
  // (undocumented)
  PickAndRemove = 4,
  // (undocumented)
  PickAndReplace = 0
}

// WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
// @internal
class SheetBorder {
  addToBuilder(builder: GraphicBuilder): void;
  static create(width: number, height: number, context?: DecorateContext): SheetBorder;
  // (undocumented)
  getRange(): Range2d;
}

// @public
class SheetModelState extends GeometricModel2dState {
}

// @public
class SheetViewState extends ViewState2d {
  constructor(props: ViewDefinition2dProps, iModel: IModelConnection, categories: CategorySelectorState, displayStyle: DisplayStyle2dState, sheetProps: SheetProps, attachments: Id64Array);
  // (undocumented)
  static readonly className: string;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  computeFitRange(): Range3d;
  // (undocumented)
  static createFromProps(viewStateData: ViewStateProps, iModel: IModelConnection): ViewState | undefined;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal
  createScene(context: SceneContext): void;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  decorate(context: DecorateContext): void;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  readonly defaultExtentLimits: {
    max: number;
    min: number;
  }
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal
  load(): Promise<void>;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal
  markAttachment3dSceneIncomplete(): void;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal
  onRenderFrame(_viewport: Viewport): void;
  readonly sheetSize: Point2d;
}

// @public
class SkyBox {
}

// @public
class SkyCube extends SkyBox, implements SkyCubeProps {
  readonly back: Id64String;
  readonly bottom: Id64String;
  static create(front: Id64String, back: Id64String, top: Id64String, bottom: Id64String, right: Id64String, left: Id64String, display?: boolean): SkyCube | undefined;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal
  static fromJSON(skyboxJson: SkyBoxProps): SkyCube | undefined;
  readonly front: Id64String;
  readonly left: Id64String;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // WARNING: The type "SkyBox.CreateParams" needs to be exported by the package (e.g. added to index.ts)
  // @internal (undocumented)
  loadParams(system: RenderSystem, iModel: IModelConnection): Promise<SkyBox.CreateParams | undefined>;
  readonly right: Id64String;
  // (undocumented)
  toJSON(): SkyBoxProps;
  readonly top: Id64String;
}

// @public
class SkyGradient extends SkyBox {
  constructor(sky?: SkyBoxProps);
  readonly groundColor: ColorDef;
  readonly groundExponent: number;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // WARNING: The type "SkyBox.CreateParams" needs to be exported by the package (e.g. added to index.ts)
  // @internal (undocumented)
  loadParams(_system: RenderSystem, iModel: IModelConnection): Promise<SkyBox.CreateParams>;
  readonly nadirColor: ColorDef;
  readonly skyColor: ColorDef;
  readonly skyExponent: number;
  // (undocumented)
  toJSON(): SkyBoxProps;
  readonly twoColor: boolean;
  readonly zenithColor: ColorDef;
}

// @public
class SkySphere extends SkyBox {
  static fromJSON(json: SkyBoxProps): SkySphere | undefined;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // WARNING: The type "SkyBox.CreateParams" needs to be exported by the package (e.g. added to index.ts)
  // @internal (undocumented)
  loadParams(system: RenderSystem, iModel: IModelConnection): Promise<SkyBox.CreateParams | undefined>;
  textureId: Id64String;
  // (undocumented)
  toJSON(): SkyBoxProps;
}

// @public
interface SliderEditorParams extends BasePropertyEditorParams {
  intervals?: boolean;
  maximum: number;
  minimum: number;
  numButtons?: number;
  // (undocumented)
  type: PropertyEditorParamTypes.Slider;
  valueFactor?: number;
  vertical?: boolean;
}

// @public
class SnapDetail extends HitDetail {
  constructor(from: HitDetail, snapMode?: SnapMode, heat?: SnapHeat, snapPoint?: XYZProps);
  readonly adjustedPoint: Point3d;
  clone(): SnapDetail;
  // (undocumented)
  draw(context: DecorateContext): void;
  geomType?: HitGeomType;
  // (undocumented)
  getCurvePrimitive(singleSegment?: boolean): CurvePrimitive | undefined;
  getHitType(): HitDetailType;
  getPoint(): Point3d;
  // (undocumented)
  heat: SnapHeat;
  readonly isHot: boolean;
  readonly isPointAdjusted: boolean;
  normal?: Vector3d;
  parentGeomType?: HitParentGeomType;
  primitive?: CurvePrimitive;
  setCurvePrimitive(primitive?: CurvePrimitive, localToWorld?: Transform, geomType?: HitGeomType): void;
  setSnapPoint(point: Point3d, heat: SnapHeat): void;
  // (undocumented)
  snapMode: SnapMode;
  readonly snapPoint: Point3d;
  sprite?: Sprite;
}

// @public (undocumented)
enum SnapHeat {
  // (undocumented)
  InRange = 2,
  // (undocumented)
  None = 0,
  // (undocumented)
  NotInRange = 1
}

// @public (undocumented)
enum SnapMode {
  // (undocumented)
  Bisector = 32,
  // (undocumented)
  Center = 8,
  // (undocumented)
  Intersection = 64,
  // (undocumented)
  MidPoint = 4,
  // (undocumented)
  Nearest = 1,
  // (undocumented)
  NearestKeypoint = 2,
  // (undocumented)
  Origin = 16
}

// @public (undocumented)
enum SnapStatus {
  // (undocumented)
  Aborted = 1,
  // (undocumented)
  Disabled = 100,
  // (undocumented)
  FilteredByApp = 600,
  // (undocumented)
  FilteredByAppQuietly = 700,
  // (undocumented)
  NoElements = 2,
  // (undocumented)
  NoSnapPossible = 200,
  // (undocumented)
  NotSnappable = 300,
  // (undocumented)
  Success = 0
}

// @beta
module SpatialClassification {
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  function addModelClassifierToScene(model: GeometricModelState, context: SceneContext): void;

  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  function createClassifier(id: Id64String, iModel: IModelConnection): Promise<RenderClassifierModel | undefined>;

  // @beta
  enum Display {
    Dimmed = 2,
    ElementColor = 4,
    Hilite = 3,
    Off = 0,
    On = 1
  }

  // @beta (undocumented)
  class Flags implements FlagsProps {
    // WARNING: The type "Display" needs to be exported by the package (e.g. added to index.ts)
    // WARNING: The type "Display" needs to be exported by the package (e.g. added to index.ts)
    constructor(inside?: Display, outside?: Display);
    // WARNING: The type "Display" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    inside: Display;
    // WARNING: The type "Display" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    outside: Display;
    // WARNING: The type "Display" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    selected: Display;
    // (undocumented)
    type: number;
  }

  // @beta
  interface FlagsProps {
    // (undocumented)
    inside: SpatialClassification.Display;
    // (undocumented)
    outside: SpatialClassification.Display;
    // (undocumented)
    selected: SpatialClassification.Display;
    // (undocumented)
    type: number;
  }

  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  function getClassifierProps(model: GeometricModelState): Properties | undefined;

  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  function loadClassifiers(classifierIdArg: Id64Arg, iModel: IModelConnection): Promise<void>;

  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  function loadModelClassifiers(modelIdArg: Id64Arg, iModel: IModelConnection): Promise<void>;

  // @beta
  class Properties implements PropertiesProps {
    // WARNING: The type "PropertiesProps" needs to be exported by the package (e.g. added to index.ts)
    constructor(props: PropertiesProps);
    // (undocumented)
    expand: number;
    // WARNING: The type "Flags" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    flags: Flags;
    // (undocumented)
    isActive: boolean;
    // (undocumented)
    modelId: Id64String;
    // (undocumented)
    name: string;
  }

  // @beta
  interface PropertiesProps {
    expand: number;
    // (undocumented)
    flags: Flags;
    // (undocumented)
    isActive: boolean;
    modelId: Id64String;
    // (undocumented)
    name: string;
  }

  // @beta
  enum Type {
    // (undocumented)
    Planar = 0,
    // (undocumented)
    Volume = 1
  }

}

// @public
class SpatialModelState extends GeometricModel3dState {
}

// @public
class SpatialViewState extends ViewState3d {
  constructor(props: SpatialViewDefinitionProps, iModel: IModelConnection, arg3: CategorySelectorState, displayStyle: DisplayStyle3dState, modelSelector: ModelSelectorState);
  // (undocumented)
  addViewedModel(id: Id64String): void;
  // (undocumented)
  static readonly className: string;
  // (undocumented)
  clearViewedModels(): void;
  // (undocumented)
  computeFitRange(): AxisAlignedBox3d;
  // (undocumented)
  createAuxCoordSystem(acsName: string): AuxCoordSystemState;
  // (undocumented)
  static createFromProps(props: ViewStateProps, iModel: IModelConnection): ViewState | undefined;
  // (undocumented)
  readonly defaultExtentLimits: {
    max: number;
    min: number;
  }
  // (undocumented)
  equals(other: this): boolean;
  // (undocumented)
  equalState(other: SpatialViewState): boolean;
  // (undocumented)
  forEachModel(func: (model: GeometricModelState) => void): void;
  // (undocumented)
  forEachTileTreeModel(func: (model: TileTreeModelState) => void): void;
  // (undocumented)
  getViewedExtents(): AxisAlignedBox3d;
  // (undocumented)
  load(): Promise<void>;
  // (undocumented)
  modelSelector: ModelSelectorState;
  // (undocumented)
  removeViewedModel(id: Id64String): void;
  // (undocumented)
  toJSON(): SpatialViewDefinitionProps;
  // (undocumented)
  viewsModel(modelId: Id64String): boolean;
}

// @public
class Sprite {
  fromImageSource(src: ImageSource): void;
  fromUrl(url: string): void;
  image?: HTMLImageElement;
  readonly isLoaded: boolean;
  readonly offset: Point2d;
  readonly size: Point2d;
}

// @public
class SpriteLocation implements CanvasDecoration {
  activate(sprite: Sprite, viewport: ScreenViewport, locationWorld: XYAndZ, alpha?: number): void;
  deactivate(): void;
  decorate(context: DecorateContext): void;
  drawDecoration(ctx: CanvasRenderingContext2D): void;
  // (undocumented)
  readonly isActive: boolean;
  readonly position: Point3d;
}

// @public
class StandardView {
  static adjustToStandardRotation(matrix: Matrix3d): void;
  // (undocumented)
  static readonly back: Matrix3d;
  // (undocumented)
  static readonly bottom: Matrix3d;
  // (undocumented)
  static readonly front: Matrix3d;
  static getStandardRotation(id: StandardViewId): Matrix3d;
  // (undocumented)
  static readonly iso: Matrix3d;
  // (undocumented)
  static readonly left: Matrix3d;
  // (undocumented)
  static readonly right: Matrix3d;
  // (undocumented)
  static readonly rightIso: Matrix3d;
  // (undocumented)
  static readonly top: Matrix3d;
}

// @public
enum StandardViewId {
  // (undocumented)
  Back = 5,
  // (undocumented)
  Bottom = 1,
  // (undocumented)
  Front = 4,
  // (undocumented)
  Iso = 6,
  // (undocumented)
  Left = 2,
  NotStandard = -1,
  // (undocumented)
  Right = 3,
  // (undocumented)
  RightIso = 7,
  // (undocumented)
  Top = 0
}

// @public
class StandardViewTool extends ViewTool {
  constructor(viewport: ScreenViewport, _standardViewId: StandardViewId);
  // (undocumented)
  onPostInstall(): void;
  // (undocumented)
  static toolId: string;
}

// @public (undocumented)
enum StartOrResume {
  // (undocumented)
  Resume = 2,
  // (undocumented)
  Start = 1
}

// @public
interface StructValue extends BasePropertyValue {
  // (undocumented)
  members: {
    [name: string]: PropertyRecord;
  }
  // (undocumented)
  valueFormat: PropertyValueFormat.Struct;
}

// WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
// @internal (undocumented)
class SubCategoriesRequest {
}

// @public
interface SuppressLabelEditorParams extends BasePropertyEditorParams {
  suppressLabelPlaceholder?: boolean;
  // (undocumented)
  type: PropertyEditorParamTypes.SuppressEditorLabel;
}

// @public
interface SuppressUnitLabelEditorParams extends BasePropertyEditorParams {
  // (undocumented)
  type: PropertyEditorParamTypes.SuppressUnitLabel;
}

// @public (undocumented)
class SuspendedToolState {
  constructor();
  // (undocumented)
  stop(): void;
}

// WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
// @internal
class SyncFlags {
  // (undocumented)
  initFrom(other: SyncFlags): void;
  // (undocumented)
  invalidateAnimationFraction(): void;
  // (undocumented)
  invalidateController(): void;
  // (undocumented)
  invalidateDecorations(): void;
  // (undocumented)
  invalidateRedrawPending(): void;
  // (undocumented)
  invalidateRenderPlan(): void;
  // (undocumented)
  invalidateRotatePoint(): void;
  // (undocumented)
  invalidateScene(): void;
  // (undocumented)
  readonly isRedrawPending: boolean;
  // (undocumented)
  readonly isValidAnimationFraction: boolean;
  // (undocumented)
  readonly isValidController: boolean;
  // (undocumented)
  readonly isValidDecorations: boolean;
  // (undocumented)
  readonly isValidRenderPlan: boolean;
  // (undocumented)
  readonly isValidRotatePoint: boolean;
  // (undocumented)
  readonly isValidScene: boolean;
  // (undocumented)
  setRedrawPending(): void;
  // (undocumented)
  setValidAnimationFraction(): void;
  // (undocumented)
  setValidController(): void;
  // (undocumented)
  setValidDecorations(): void;
  // (undocumented)
  setValidRenderPlan(): void;
  // (undocumented)
  setValidRotatePoint(): void;
  // (undocumented)
  setValidScene(): void;
}

// WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
// @internal (undocumented)
class Target extends RenderTarget {
  protected constructor(rect?: ViewRect);
  // (undocumented)
  protected abstract _assignDC(): boolean;
  // (undocumented)
  protected abstract _beginPaint(): void;
  // (undocumented)
  protected _dcAssigned: boolean;
  // (undocumented)
  protected _decorations?: Decorations;
  // (undocumented)
  protected abstract _endPaint(): void;
  // WARNING: The type "FrameBuffer" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  protected _fbo?: FrameBuffer;
  // WARNING: The type "Batch" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  addBatch(batch: Batch): void;
  // (undocumented)
  readonly ambientLight: Float32Array;
  // (undocumented)
  ambientOcclusionSettings: AmbientOcclusion.Settings;
  // (undocumented)
  analysisStyle?: AnalysisStyle;
  // (undocumented)
  analysisTexture?: RenderTexture;
  // (undocumented)
  animationBranches: AnimationBranchStates | undefined;
  // WARNING: The type "BatchState" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  readonly batchState: BatchState;
  // WARNING: The type "FloatRgba" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  readonly bgColor: FloatRgba;
  // WARNING: The type "BranchStack" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  readonly branchStack: BranchStack;
  // (undocumented)
  readonly cameraFrustumNearScaleLimit: number;
  // (undocumented)
  changeDecorations(decs: Decorations): void;
  // (undocumented)
  changeDynamics(dynamics?: GraphicList): void;
  // (undocumented)
  changeFrustum(newFrustum: Frustum, newFraction: number, is3d: boolean): void;
  // (undocumented)
  changePlanarClassifiers(planarClassifiers?: PlanarClassifierMap): void;
  // (undocumented)
  changeRenderPlan(plan: RenderPlan): void;
  // (undocumented)
  changeScene(scene: GraphicList): void;
  // (undocumented)
  changeTerrain(terrain: GraphicList): void;
  // WARNING: The type "ClipDef" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  readonly clipDef: ClipDef;
  // WARNING: The type "TextureHandle" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  clipMask: TextureHandle | undefined;
  // (undocumented)
  readonly clips: Clips;
  // WARNING: The type "SceneCompositor" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  readonly compositor: SceneCompositor;
  // (undocumented)
  readonly currentBatchId: number;
  // WARNING: The type "FeatureSymbology.Overrides" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  readonly currentFeatureSymbologyOverrides: FeatureSymbology.Overrides;
  // WARNING: The type "FeatureOverrides" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  currentOverrides: FeatureOverrides | undefined;
  // WARNING: The type "ShaderFlags" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  readonly currentShaderFlags: ShaderFlags;
  // (undocumented)
  readonly currentTransform: Transform;
  // (undocumented)
  readonly currentViewFlags: ViewFlags;
  // (undocumented)
  protected debugPaint(): void;
  // WARNING: The type "BranchState" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  readonly decorationState: BranchState;
  // (undocumented)
  dispose(): void;
  // (undocumented)
  drawFrame(sceneMilSecElapsed?: number): void;
  // (undocumented)
  readonly drawNonLocatable: boolean;
  // (undocumented)
  protected drawOverlayDecorations(): void;
  // (undocumented)
  drawPlanarClassifiers(): void;
  // (undocumented)
  readonly dynamics: GraphicList | undefined;
  // WARNING: The type "ColorInfo" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  readonly edgeColor: ColorInfo;
  // (undocumented)
  readonly flashedElemId: Id64String;
  // (undocumented)
  readonly flashedUpdateTime: BeTimePoint;
  // (undocumented)
  readonly flashIntensity: number;
  // (undocumented)
  readonly frustumUniforms: FrustumUniforms;
  // (undocumented)
  readonly fStop: number;
  // WARNING: The type "ShaderProgramParams" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  getEdgeLineCode(params: ShaderProgramParams, baseCode: number): number;
  // WARNING: The type "RenderPass" needs to be exported by the package (e.g. added to index.ts)
  // WARNING: The type "EdgeOverrides" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  getEdgeOverrides(pass: RenderPass): EdgeOverrides | undefined;
  // WARNING: The type "ShaderProgramParams" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  getEdgeWeight(params: ShaderProgramParams, baseWeight: number): number;
  // WARNING: The type "Branch" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  getWorldDecorations(decs: GraphicList): Branch;
  // (undocumented)
  readonly hasClipMask: boolean;
  // (undocumented)
  readonly hasClipVolume: boolean;
  // WARNING: The type "EdgeOverrides" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  readonly hiddenEdgeOverrides: EdgeOverrides | undefined;
  // (undocumented)
  readonly hilite: Id64.Uint32Set;
  // WARNING: The type "FloatRgba" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  hiliteColor: FloatRgba;
  // (undocumented)
  hiliteSettings: Hilite.Settings;
  // (undocumented)
  readonly hiliteUpdateTime: BeTimePoint;
  // (undocumented)
  readonly is2d: boolean;
  // (undocumented)
  readonly is3d: boolean;
  // (undocumented)
  readonly isEdgeColorOverridden: boolean;
  // (undocumented)
  readonly isEdgeWeightOverridden: boolean;
  // (undocumented)
  isFadeOutActive: boolean;
  // (undocumented)
  readonly isReadPixelsInProgress: boolean;
  // WARNING: The type "FloatRgba" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  readonly monoColor: FloatRgba;
  // (undocumented)
  readonly nearPlaneCenter: Point3d;
  // WARNING: The type "Batch" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  onBatchDisposed(batch: Batch): void;
  // WARNING: The type "FeatureSymbology.Overrides" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  overrideFeatureSymbology(ovr: FeatureSymbology.Overrides): void;
  // (undocumented)
  readonly overridesUpdateTime: BeTimePoint;
  // (undocumented)
  performanceMetrics?: PerformanceMetrics;
  // (undocumented)
  plan?: RenderPlan;
  // (undocumented)
  readonly planarClassifiers: PlanarClassifiers;
  // (undocumented)
  readonly planFraction: number;
  // (undocumented)
  readonly planFrustum: Frustum;
  // (undocumented)
  popActiveVolume(): void;
  // (undocumented)
  popBatch(): void;
  // (undocumented)
  popBranch(): void;
  // (undocumented)
  readonly projectionMatrix: Matrix4d;
  // (undocumented)
  pushActiveVolume(): void;
  // WARNING: The type "Batch" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  pushBatch(batch: Batch): void;
  // WARNING: The type "ShaderProgramExecutor" needs to be exported by the package (e.g. added to index.ts)
  // WARNING: The type "Branch" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  pushBranch(exec: ShaderProgramExecutor, branch: Branch): void;
  // WARNING: The type "BranchState" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  pushState(state: BranchState): void;
  // (undocumented)
  readImage(wantRectIn: ViewRect, targetSizeIn: Point2d, flipVertically: boolean): ImageBuffer | undefined;
  // (undocumented)
  protected readImagePixels(out: Uint8Array, x: number, y: number, w: number, h: number): boolean;
  // WARNING: The type "Pixel.Selector" needs to be exported by the package (e.g. added to index.ts)
  // WARNING: The type "Pixel.Receiver" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  readPixels(rect: ViewRect, selector: Pixel.Selector, receiver: Pixel.Receiver, excludeNonLocatable: boolean): void;
  // (undocumented)
  recordPerformanceMetric(operation: string): void;
  // (undocumented)
  readonly renderRect: ViewRect;
  // (undocumented)
  readonly renderSystem: RenderSystem;
  // (undocumented)
  reset(): void;
  // (undocumented)
  readonly scene: GraphicList;
  // (undocumented)
  setFlashed(id: Id64String, intensity: number): void;
  // (undocumented)
  setHiliteSet(hilite: Set<string>): void;
  // WARNING: The type "ShaderLights" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  readonly shaderLights: ShaderLights | undefined;
  // WARNING: The type "Techniques" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  readonly techniques: Techniques;
  // (undocumented)
  readonly transparencyThreshold: number;
  // (undocumented)
  readonly viewMatrix: Transform;
  // WARNING: The type "EdgeOverrides" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  readonly visibleEdgeOverrides: EdgeOverrides | undefined;
  // (undocumented)
  readonly wantAmbientOcclusion: boolean;
  // (undocumented)
  readonly wantInvertBlackBackground: boolean;
}

// @public (undocumented)
class TentativeOrAccuSnap {
  // (undocumented)
  static getCurrentPoint(): Point3d;
  // (undocumented)
  static getCurrentSnap(checkIsHot?: boolean): SnapDetail | undefined;
  // (undocumented)
  static getCurrentView(): ScreenViewport | undefined;
  // (undocumented)
  static readonly isHot: boolean;
}

// @public (undocumented)
class TentativePoint {
  // (undocumented)
  clear(doErase: boolean): void;
  // (undocumented)
  currSnap?: SnapDetail;
  // (undocumented)
  decorate(context: DecorateContext): void;
  getCurrSnap(): SnapDetail | undefined;
  // (undocumented)
  getHitAndList(holder: HitListHolder): SnapDetail | undefined;
  // (undocumented)
  getPoint(): Point3d;
  // (undocumented)
  isActive: boolean;
  readonly isSnapped: boolean;
  // (undocumented)
  onButtonEvent(ev: BeButtonEvent): void;
  // (undocumented)
  onInitialized(): void;
  // (undocumented)
  process(ev: BeButtonEvent): Promise<void>;
  // (undocumented)
  removeTentative(): void;
  // (undocumented)
  setCurrSnap(newSnap?: SnapDetail): void;
  // (undocumented)
  setHitList(list?: HitList<HitDetail>): void;
  // (undocumented)
  setPoint(point: Point3d): void;
  // (undocumented)
  showTentative(): void;
  // (undocumented)
  tpHits?: HitList<HitDetail>;
  // (undocumented)
  viewport?: ScreenViewport;
}

// @public
interface TextureImage {
  format: ImageSourceFormat | undefined;
  image: HTMLImageElement | undefined;
}

// @public (undocumented)
class ThreeAxes {
  // (undocumented)
  clone(): ThreeAxes;
  // (undocumented)
  static createFromMatrix3d(rMatrix: Matrix3d, result?: ThreeAxes): ThreeAxes;
  // (undocumented)
  equals(other: ThreeAxes): boolean;
  // (undocumented)
  fromMatrix3d(rMatrix: Matrix3d): void;
  // (undocumented)
  setFrom(other: ThreeAxes): void;
  // (undocumented)
  toMatrix3d(out?: Matrix3d): Matrix3d;
  // (undocumented)
  readonly x: Vector3d;
  // (undocumented)
  readonly y: Vector3d;
  // (undocumented)
  readonly z: Vector3d;
}

// WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
// @internal (undocumented)
class Tile {
}

// @alpha (undocumented)
class TileAdmin {
}

// WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
// @internal
class TileLoader {
  // (undocumented)
  protected readonly _batchType: BatchType;
  // (undocumented)
  protected readonly _loadEdges: boolean;
  // (undocumented)
  adjustContentIdSizeMultiplier(contentId: string, _sizeMultipler: number): string;
  compareTilePriorities(lhs: Tile, rhs: Tile): number;
  // (undocumented)
  abstract getChildrenProps(parent: Tile): Promise<TileProps[]>;
  // WARNING: The type "TileRequest.ResponseData" needs to be exported by the package (e.g. added to index.ts)
  // WARNING: The type "Tile.Content" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  loadTileContent(tile: Tile, data: TileRequest.ResponseData, isCanceled?: () => boolean): Promise<Tile.Content>;
  // WARNING: The type "TileIO.StreamBuffer" needs to be exported by the package (e.g. added to index.ts)
  // WARNING: The type "Tile.Content" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  loadTileContentFromStream(tile: Tile, streamBuffer: TileIO.StreamBuffer, isCanceled?: () => boolean): Promise<Tile.Content>;
  // (undocumented)
  readonly maxDepth: number;
  // (undocumented)
  readonly parentsAndChildrenExclusive: boolean;
  // WARNING: The type "Tile.LoadPriority" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  readonly priority: Tile.LoadPriority;
  // WARNING: The type "Tile.DrawArgs" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  processSelectedTiles(selected: Tile[], _args: Tile.DrawArgs): Tile[];
  // WARNING: The type "TileRequest.Response" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  abstract requestTileContent(tile: Tile): Promise<TileRequest.Response>;
  // WARNING: The type "Tile.Params" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  abstract tileRequiresLoading(params: Tile.Params): boolean;
  // (undocumented)
  readonly viewFlagOverrides: ViewFlag.Overrides;
}

// WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
// @internal
class TileTree {
}

// @beta
interface TileTreeModelState {
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  readonly loadStatus: TileTree.LoadStatus;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // WARNING: The type "TileTree.LoadStatus" needs to be exported by the package (e.g. added to index.ts)
  // @internal (undocumented)
  loadTileTree(batchType: BatchType, edgesRequired: boolean, animationId?: Id64String, classifierExpansion?: number): TileTree.LoadStatus;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  readonly tileTree: TileTree | undefined;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  readonly treeModelId: Id64String;
}

// WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
// @internal (undocumented)
class TileTreeState {
  constructor(_iModel: IModelConnection, _is3d: boolean, _modelId: Id64String);
  // (undocumented)
  classifierExpansion: number;
  // (undocumented)
  clearTileTree(): void;
  // (undocumented)
  edgesOmitted: boolean;
  // (undocumented)
  readonly iModel: IModelConnection;
  // WARNING: The type "TileTree.LoadStatus" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  loadStatus: TileTree.LoadStatus;
  // (undocumented)
  setTileTree(props: TileTreeProps, loader: TileLoader): void;
  // (undocumented)
  tileTree?: TileTree;
}

// @public
class Tool {
  constructor(..._args: any[]);
  static readonly description: string;
  static readonly flyover: string;
  static hidden: boolean;
  static readonly keyin: string;
  static namespace: I18NNamespace;
  static register(namespace?: I18NNamespace): void;
  run(..._arg: any[]): boolean;
  static toolId: string;
}

// @public
class ToolAdmin {
  acsContextLock: boolean;
  acsPlaneSnapLock: boolean;
  readonly activeTool: InteractiveTool | undefined;
  readonly activeToolChanged: BeEvent<(tool: Tool, start: StartOrResume) => void>;
  addEvent(ev: Event, vp?: ScreenViewport): void;
  // (undocumented)
  adjustPoint(pointActive: Point3d, vp: ScreenViewport, projectToACS?: boolean, applyLocks?: boolean): void;
  // (undocumented)
  adjustPointToACS(pointActive: Point3d, vp: Viewport, perpendicular: boolean): void;
  // (undocumented)
  adjustPointToGrid(pointActive: Point3d, vp: Viewport): void;
  // (undocumented)
  adjustSnapPoint(perpendicular?: boolean): void;
  assemblyLock: boolean;
  // (undocumented)
  beginDynamics(): void;
  // (undocumented)
  callOnCleanup(): void;
  convertTouchEndToButtonUp(ev: BeTouchEvent, button?: BeButton): Promise<void>;
  convertTouchMoveStartToButtonDownAndMotion(startEv: BeTouchEvent, ev: BeTouchEvent, button?: BeButton): Promise<void>;
  convertTouchMoveToMotion(ev: BeTouchEvent): Promise<void>;
  convertTouchStartToButtonDown(ev: BeTouchEvent, button?: BeButton): Promise<void>;
  convertTouchTapToButtonDownAndUp(ev: BeTouchEvent, button?: BeButton): Promise<void>;
  // (undocumented)
  readonly currentInputState: CurrentInputState;
  readonly currentTool: InteractiveTool;
  readonly cursorView: ScreenViewport | undefined;
  // (undocumented)
  decorate(context: DecorateContext): void;
  defaultToolArgs: any[] | undefined;
  defaultToolId: string;
  doRedoOperation(): Promise<boolean>;
  doUndoOperation(): Promise<boolean>;
  // (undocumented)
  endDynamics(): void;
  // (undocumented)
  exitInputCollector(): void;
  // (undocumented)
  exitViewTool(): void;
  // (undocumented)
  fillEventFromCursorLocation(ev: BeButtonEvent): void;
  // (undocumented)
  fillEventFromLastDataButton(ev: BeButtonEvent): void;
  protected filterViewport(vp: Viewport): boolean;
  // (undocumented)
  getDecorationGeometry(hit: HitDetail): GeometryStreamProps | undefined;
  getToolTip(hit: HitDetail): Promise<HTMLElement | string>;
  gridLock: boolean;
  readonly idleTool: IdleTool;
  // (undocumented)
  readonly isLocateCircleOn: boolean;
  readonly manipulatorToolEvent: BeEvent<(tool: Tool, event: ManipulatorToolEvent) => void>;
  // (undocumented)
  markupView?: ScreenViewport;
  // (undocumented)
  onInitialized(): void;
  // (undocumented)
  onInstallTool(tool: InteractiveTool): boolean;
  // (undocumented)
  onMouseLeave(vp: ScreenViewport): Promise<void>;
  // (undocumented)
  onPostInstallTool(tool: InteractiveTool): void;
  // (undocumented)
  onSelectedViewportChanged(previous: ScreenViewport | undefined, current: ScreenViewport | undefined): void;
  // (undocumented)
  onShutDown(): void;
  // (undocumented)
  readonly primitiveTool: PrimitiveTool | undefined;
  processWheelEvent(ev: BeWheelEvent, doUpdate: boolean): Promise<EventHandled>;
  // (undocumented)
  sendButtonEvent(ev: BeButtonEvent): Promise<any>;
  // (undocumented)
  sendEndDragEvent(ev: BeButtonEvent): Promise<any>;
  // (undocumented)
  setAdjustedDataPoint(ev: BeButtonEvent): void;
  // (undocumented)
  setCursor(cursor: string | undefined): void;
  // (undocumented)
  setIncompatibleViewportCursor(restore: boolean): void;
  // (undocumented)
  setInputCollector(newTool?: InputCollector): void;
  // (undocumented)
  setLocateCircleOn(locateOn: boolean): void;
  // (undocumented)
  setLocateCursor(enableLocate: boolean): void;
  // (undocumented)
  setPrimitiveTool(newTool?: PrimitiveTool): void;
  // (undocumented)
  setViewTool(newTool?: ViewTool): void;
  startDefaultTool(): void;
  // (undocumented)
  startEventLoop(): void;
  // (undocumented)
  startInputCollector(newTool: InputCollector): void;
  // (undocumented)
  startPrimitiveTool(newTool?: PrimitiveTool): void;
  // (undocumented)
  startViewTool(newTool: ViewTool): void;
  syncToolSettingsProperties(toolId: string, syncProperties: ToolSettingsPropertySyncItem[]): void;
  // (undocumented)
  testDecorationHit(id: string): boolean;
  // (undocumented)
  toolSettingsChangeHandler: ((toolId: string, syncProperties: ToolSettingsPropertySyncItem[]) => void) | undefined;
  // (undocumented)
  readonly toolState: ToolState;
  // (undocumented)
  updateDynamics(ev?: BeButtonEvent, useLastData?: boolean, adjustPoint?: boolean): void;
  // (undocumented)
  readonly viewTool: ViewTool | undefined;
}

// @public
class ToolRegistry {
  create(toolId: string, ...args: any[]): Tool | undefined;
  executeExactMatch(keyin: string, ...args: any[]): boolean;
  find(toolId: string): ToolType | undefined;
  findExactMatch(keyin: string): ToolType | undefined;
  findPartialMatches(keyin: string): FuzzySearchResults<ToolType>;
  getToolList(): ToolList;
  register(toolClass: ToolType, namespace?: I18NNamespace): void;
  registerModule(moduleObj: any, namespace?: I18NNamespace): void;
  run(toolId: string, ...args: any[]): boolean;
  // (undocumented)
  readonly tools: Map<string, typeof Tool>;
  unRegister(toolId: string): void;
}

// @public
class ToolSettings {
  static animationTime: BeDuration;
  static doubleClickTimeout: BeDuration;
  static doubleClickToleranceInches: number;
  static doubleTapTimeout: BeDuration;
  static noMotionTimeout: BeDuration;
  static preserveWorldUp: boolean;
  static startDragDelay: BeDuration;
  static startDragDistanceInches: number;
  static touchMoveDelay: BeDuration;
  static touchMoveDistanceInches: number;
  static viewToolPickRadiusInches: number;
  static walkCameraAngle: Angle;
  static walkEnforceZUp: boolean;
  static walkVelocity: number;
  static wheelLineFactor: number;
  static wheelPageFactor: number;
  static wheelZoomBumpDistance: number;
  static wheelZoomRatio: number;
}

// @public
class ToolSettingsPropertyRecord extends PropertyRecord {
  constructor(value: PropertyValue, property: PropertyDescription, editorPosition: EditorPosition, isReadonly?: boolean);
  // (undocumented)
  static clone(record: ToolSettingsPropertyRecord, newValue?: ToolSettingsValue): ToolSettingsPropertyRecord;
  // (undocumented)
  editorPosition: EditorPosition;
}

// @public
class ToolSettingsPropertySyncItem {
  constructor(value: ToolSettingsValue, propertyName: string, isDisabled?: boolean);
  isDisabled?: boolean;
  // (undocumented)
  propertyName: string;
  // (undocumented)
  value: ToolSettingsValue;
}

// WARNING: valueFormat has incomplete type information
// @public
class ToolSettingsValue implements PrimitiveValue {
  constructor(value?: number | string | boolean | Date, displayValue?: string);
  // (undocumented)
  clone(): ToolSettingsValue;
  // (undocumented)
  displayValue?: string;
  // (undocumented)
  readonly hasDisplayValue: boolean;
  // (undocumented)
  readonly isNullValue: boolean;
  // (undocumented)
  update(newValue: ToolSettingsValue): boolean;
  // (undocumented)
  value?: number | string | boolean | Date;
}

// @public (undocumented)
class ToolState {
  // (undocumented)
  clone(): ToolState;
  // (undocumented)
  coordLockOvr: CoordinateLockOverrides;
  // (undocumented)
  locateCircleOn: boolean;
  // (undocumented)
  setFrom(other: ToolState): void;
}

// @public
interface ToolTipOptions {
  // (undocumented)
  duration?: BeDuration;
  // (undocumented)
  placement?: string;
}

// @public
class TouchCursor implements CanvasDecoration {
  protected constructor(vp: ScreenViewport);
  // (undocumented)
  protected _fillColor: string;
  // (undocumented)
  protected _inTouchTap: boolean;
  // (undocumented)
  protected _isDragging: boolean;
  // (undocumented)
  protected _offsetPosition: Point3d;
  // (undocumented)
  protected _outlineColor: string;
  // (undocumented)
  protected _size: number;
  // (undocumented)
  protected _yOffset: number;
  // (undocumented)
  static createFromTouchTap(ev: BeTouchEvent): TouchCursor | undefined;
  // (undocumented)
  doTouchEnd(ev: BeTouchEvent): void;
  // (undocumented)
  doTouchMove(ev: BeTouchEvent): boolean;
  // (undocumented)
  doTouchMoveStart(ev: BeTouchEvent, startEv: BeTouchEvent): boolean;
  // (undocumented)
  doTouchStart(ev: BeTouchEvent): void;
  // (undocumented)
  doTouchTap(ev: BeTouchEvent): Promise<boolean>;
  // (undocumented)
  drawDecoration(ctx: CanvasRenderingContext2D): void;
  // (undocumented)
  protected getFillColor(isSelected: boolean): string;
  // (undocumented)
  isButtonHandled(ev: BeButtonEvent): boolean;
  // (undocumented)
  protected isSelected(pt: XAndY): boolean;
  // (undocumented)
  position: Point3d;
  // (undocumented)
  protected setPosition(vp: Viewport, worldLocation: Point3d): boolean;
}

// @public
class TwoWayViewportSync {
  connect(view1: Viewport, view2: Viewport): void;
  disconnect(): void;
}

// @public
class Unit implements UnitProps {
  constructor(name: string, label: string, unitFamily: string);
  // (undocumented)
  isValid: boolean;
  // (undocumented)
  label: string;
  // (undocumented)
  name: string;
  // (undocumented)
  unitFamily: string;
}

// @public
enum UsesDragSelect {
  Box = 0,
  Line = 1,
  None = 2
}

// @public
enum UsesFence {
  Check = 0,
  None = 2,
  Required = 1
}

// @public
enum UsesSelection {
  Check = 0,
  None = 2,
  Required = 1
}

// @public
interface ViewChangeOptions {
  animateFrustumChange?: boolean;
  animationTime?: BeDuration;
  marginPercent?: MarginPercent;
  saveInUndo?: boolean;
}

// WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
// @internal
class ViewFrustum {
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal
  protected adjustAspectRatio(origin: Point3d, delta: Vector3d): void;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  static createFromViewport(vp: Viewport, view?: ViewState): ViewFrustum | undefined;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  static createFromViewportAndPlane(vp: Viewport, plane: Plane3dByOriginAndUnitNormal): ViewFrustum | undefined;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  fromView(from: XYZ, to?: XYZ): void;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  frustFraction: number;
  getFrustum(sys?: CoordSystem, adjustedBox?: boolean, box?: Frustum): Frustum;
  // (undocumented)
  getPixelSizeAtPoint(inPoint?: Point3d): number;
  // (undocumented)
  getViewCorners(): Range3d;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  readonly invalidFrustum: boolean;
  static nearScale24: number;
  npcToView(pt: Point3d, out?: Point3d): Point3d;
  npcToViewArray(pts: Point3d[]): void;
  npcToWorld(pt: XYAndZ, out?: Point3d): Point3d;
  npcToWorldArray(pts: Point3d[]): void;
  readonly rotation: Matrix3d;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  toView(from: XYZ, to?: XYZ): void;
  view: ViewState;
  view4dToWorld(input: Point4d, out?: Point3d): Point3d;
  view4dToWorldArray(viewPts: Point4d[], worldPts: Point3d[]): void;
  readonly viewDelta: Vector3d;
  readonly viewDeltaUnexpanded: Vector3d;
  readonly viewOrigin: Point3d;
  readonly viewOriginUnexpanded: Point3d;
  viewToNpc(pt: Point3d, out?: Point3d): Point3d;
  viewToNpcArray(pts: Point3d[]): void;
  viewToWorld(input: XYAndZ, out?: Point3d): Point3d;
  viewToWorldArray(pts: Point3d[]): void;
  worldToNpc(pt: XYAndZ, out?: Point3d): Point3d;
  worldToNpcArray(pts: Point3d[]): void;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  readonly worldToNpcMap: Map4d;
  worldToView(input: XYAndZ, out?: Point3d): Point3d;
  worldToView4d(input: XYAndZ, out?: Point4d): Point4d;
  worldToView4dArray(worldPts: Point3d[], viewPts: Point4d[]): void;
  worldToViewArray(pts: Point3d[]): void;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  readonly worldToViewMap: Map4d;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  readonly zClipAdjusted: boolean;
}

// @public (undocumented)
class ViewHandleArray {
  constructor(viewTool: ViewManip);
  // (undocumented)
  add(handle: ViewingToolHandle): void;
  // (undocumented)
  readonly count: number;
  // (undocumented)
  drawHandles(context: DecorateContext): void;
  // (undocumented)
  empty(): void;
  // (undocumented)
  focus: number;
  // (undocumented)
  focusDrag: boolean;
  // (undocumented)
  readonly focusHandle: ViewingToolHandle | undefined;
  // (undocumented)
  focusHitHandle(): void;
  // (undocumented)
  getByIndex(index: number): ViewingToolHandle | undefined;
  // (undocumented)
  handles: ViewingToolHandle[];
  hasHandle(handleType: ViewHandleType): boolean;
  // (undocumented)
  readonly hitHandle: ViewingToolHandle | undefined;
  // (undocumented)
  hitHandleIndex: number;
  // (undocumented)
  motion(ev: BeButtonEvent): void;
  // (undocumented)
  onReinitialize(): void;
  // (undocumented)
  setFocus(index: number): void;
  // (undocumented)
  testHit(ptScreen: Point3d, forced?: ViewHandleType): boolean;
  // (undocumented)
  viewport?: Viewport;
  // (undocumented)
  viewTool: ViewManip;
}

// @public (undocumented)
enum ViewHandleType {
  // (undocumented)
  Fly = 64,
  // (undocumented)
  Look = 128,
  // (undocumented)
  None = 0,
  // (undocumented)
  Pan = 4,
  // (undocumented)
  Rotate = 1,
  // (undocumented)
  Scroll = 8,
  // (undocumented)
  TargetCenter = 2,
  // (undocumented)
  Walk = 32,
  // (undocumented)
  Zoom = 16
}

// @public (undocumented)
enum ViewHandleWeight {
  // (undocumented)
  Bold = 3,
  // (undocumented)
  FatDot = 8,
  // (undocumented)
  Normal = 2,
  // (undocumented)
  Thin = 1,
  // (undocumented)
  VeryBold = 4
}

// @public (undocumented)
class ViewingToolHandle {
  constructor(viewTool: ViewManip);
  // (undocumented)
  checkOneShot(): boolean;
  // (undocumented)
  abstract doManipulation(ev: BeButtonEvent, inDynamics: boolean): boolean;
  // (undocumented)
  drawHandle(_context: DecorateContext, _hasFocus: boolean): void;
  // (undocumented)
  abstract firstPoint(ev: BeButtonEvent): boolean;
  // (undocumented)
  focusIn(): void;
  // (undocumented)
  focusOut(): void;
  // (undocumented)
  getHandleCursor(): string;
  // (undocumented)
  readonly handleType: ViewHandleType;
  // (undocumented)
  motion(_ev: BeButtonEvent): boolean;
  // (undocumented)
  noMotion(_ev: BeButtonEvent): boolean;
  // (undocumented)
  onReinitialize(): void;
  // (undocumented)
  abstract testHandleForHit(ptScreen: Point3d, out: {
          distance: number;
          priority: ViewManipPriority;
      }): boolean;
  // (undocumented)
  viewTool: ViewManip;
}

// @public
class ViewManager {
  addDecorator(decorator: Decorator): () => void;
  addViewport(newVp: ScreenViewport): BentleyStatus;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  beginDynamicsMode(): void;
  clearSelectedView(): void;
  // (undocumented)
  readonly crossHairCursor: string;
  // (undocumented)
  cursor: string;
  // (undocumented)
  readonly decorators: Decorator[];
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  readonly doesHostHaveFocus: boolean;
  dropDecorator(decorator: Decorator): void;
  dropViewport(vp: ScreenViewport, disposeOfViewport?: boolean): BentleyStatus;
  // (undocumented)
  readonly dynamicsCursor: string;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  endDynamicsMode(): void;
  forEachViewport(func: (vp: ScreenViewport) => void): void;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal
  getDecorationGeometry(hit: HitDetail): GeometryStreamProps | undefined;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal
  getDecorationToolTip(hit: HitDetail): Promise<HTMLElement | string>;
  getFirstOpenView(): ScreenViewport | undefined;
  // (undocumented)
  readonly grabbingCursor: string;
  // (undocumented)
  readonly grabCursor: string;
  // (undocumented)
  inDynamicsMode: boolean;
  invalidateDecorationsAllViews(): void;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  invalidateScenes(): void;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  invalidateViewportScenes(): void;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  notifySelectedViewportChanged(previous: ScreenViewport | undefined, current: ScreenViewport | undefined): void;
  readonly onBeginRender: BeEvent<() => void>;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal
  onDecorationButtonEvent(hit: HitDetail, ev: BeButtonEvent): Promise<EventHandled>;
  readonly onFinishRender: BeEvent<() => void>;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  onInitialized(): void;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  onNewTilesReady(): void;
  readonly onSelectedViewportChanged: BeUiEvent<SelectedViewportChangedArgs>;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  onSelectionSetChanged(_iModel: IModelConnection): void;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  onShutDown(): void;
  readonly onViewClose: BeUiEvent<ScreenViewport>;
  readonly onViewOpen: BeUiEvent<ScreenViewport>;
  readonly onViewResume: BeUiEvent<ScreenViewport>;
  readonly onViewSuspend: BeUiEvent<ScreenViewport>;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal
  renderLoop(): void;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  readonly sceneInvalidated: boolean;
  readonly selectedView: ScreenViewport | undefined;
  setSelectedView(vp: ScreenViewport | undefined): BentleyStatus;
  setViewCursor(cursor?: string): void;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  validateViewportScenes(): void;
}

// @public
class ViewManip extends ViewTool {
  constructor(viewport: ScreenViewport | undefined, handleMask: number, oneShot: boolean, isDraggingRequired?: boolean);
  // (undocumented)
  protected _forcedHandle: ViewHandleType;
  // (undocumented)
  protected static _useViewAlignedVolume: boolean;
  // (undocumented)
  changeViewport(vp?: ScreenViewport): void;
  // (undocumented)
  decorate(context: DecorateContext): void;
  // (undocumented)
  enforceZUp(pivotPoint: Point3d): boolean;
  // (undocumented)
  static fitView(viewport: ScreenViewport, doAnimate: boolean, marginPercent?: MarginPercent): void;
  // (undocumented)
  frustumValid: boolean;
  // (undocumented)
  static getFocusPlaneNpc(vp: Viewport): number;
  // (undocumented)
  handleMask: number;
  // (undocumented)
  inHandleModify: boolean;
  // (undocumented)
  isDragging: boolean;
  // (undocumented)
  isDraggingRequired: boolean;
  isPointVisible(testPt: Point3d): boolean;
  // (undocumented)
  readonly isZUp: boolean;
  // (undocumented)
  lensAngleMatches(angle: Angle, tolerance: number): boolean;
  // (undocumented)
  nPts: number;
  // (undocumented)
  onCleanup(): void;
  // (undocumented)
  onDataButtonDown(ev: BeButtonEvent): Promise<EventHandled>;
  // (undocumented)
  onDataButtonUp(_ev: BeButtonEvent): Promise<EventHandled>;
  // (undocumented)
  oneShot: boolean;
  // (undocumented)
  onMouseEndDrag(ev: BeButtonEvent): Promise<EventHandled>;
  // (undocumented)
  onMouseMotion(ev: BeButtonEvent): Promise<void>;
  // (undocumented)
  onMouseMotionStopped(ev: BeButtonEvent): Promise<void>;
  // (undocumented)
  onMouseNoMotion(ev: BeButtonEvent): Promise<void>;
  // (undocumented)
  onMouseStartDrag(ev: BeButtonEvent): Promise<EventHandled>;
  // (undocumented)
  onMouseWheel(inputEv: BeWheelEvent): Promise<EventHandled>;
  // (undocumented)
  onPostInstall(): void;
  // (undocumented)
  onReinitialize(): void;
  // (undocumented)
  onTouchCancel(ev: BeTouchEvent): Promise<void>;
  // (undocumented)
  onTouchComplete(ev: BeTouchEvent): Promise<void>;
  // (undocumented)
  onTouchMove(ev: BeTouchEvent): Promise<void>;
  // (undocumented)
  onTouchMoveStart(ev: BeTouchEvent, startEv: BeTouchEvent): Promise<EventHandled>;
  // (undocumented)
  onTouchTap(ev: BeTouchEvent): Promise<EventHandled>;
  // (undocumented)
  processFirstPoint(ev: BeButtonEvent): boolean;
  // (undocumented)
  processPoint(ev: BeButtonEvent, inDynamics: boolean): boolean;
  // (undocumented)
  setCameraLensAngle(lensAngle: Angle, retainEyePoint: boolean): ViewStatus;
  setTargetCenterWorld(pt: Point3d, lockTarget: boolean, saveTarget: boolean): void;
  // (undocumented)
  startHandleDrag(ev: BeButtonEvent, forcedHandle?: ViewHandleType): Promise<EventHandled>;
  // (undocumented)
  stoppedOverHandle: boolean;
  // (undocumented)
  targetCenterLocked: boolean;
  // (undocumented)
  targetCenterValid: boolean;
  // (undocumented)
  readonly targetCenterWorld: Point3d;
  // (undocumented)
  updateTargetCenter(): void;
  // (undocumented)
  viewHandles: ViewHandleArray;
  // (undocumented)
  static zoomToAlwaysDrawnExclusive(viewport: ScreenViewport, doAnimate: boolean, marginPercent?: MarginPercent): Promise<boolean>;
}

// @public (undocumented)
enum ViewManipPriority {
  // (undocumented)
  High = 1000,
  // (undocumented)
  Low = 1,
  // (undocumented)
  Medium = 100,
  // (undocumented)
  Normal = 10
}

// @public
class Viewport implements IDisposable {
  // @internal
  protected constructor(target: RenderTarget);
  // @internal (undocumented)
  protected readonly _viewRange: ViewRect;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  addDecorations(_decorations: Decorations): void;
  readonly alwaysDrawn: Id64Set | undefined;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  readonly analysisStyle: AnalysisStyle | undefined;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  animate(): void;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  animateFrustumChange(start: Frustum, end: Frustum, animationTime?: BeDuration): void;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  animationFraction: number;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  applyViewState(val: ViewState, animationTime?: BeDuration): void;
  // (undocumented)
  readonly auxCoordSystem: AuxCoordSystemState;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  readonly backgroundMapPlane: Plane3dByOriginAndUnitNormal | undefined;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  changeDynamics(dynamics: GraphicList | undefined): void;
  changeView(view: ViewState): void;
  clearAlwaysDrawn(): void;
  clearNeverDrawn(): void;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  computeViewRange(): Range3d;
  continuousRendering: boolean;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  createSceneContext(): SceneContext;
  // WARNING: The type "Tile.DebugBoundingBoxes" needs to be exported by the package (e.g. added to index.ts)
  debugBoundingBoxes: Tile.DebugBoundingBoxes;
  determineVisibleDepthRange(rect?: ViewRect, result?: DepthRangeNpc): DepthRangeNpc | undefined;
  // (undocumented)
  dispose(): void;
  featureOverrideProvider: FeatureOverrideProvider | undefined;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal
  flashDuration: number;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal
  flashIntensity: number;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal
  flashUpdateTime?: BeTimePoint;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal
  freezeScene: boolean;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  fromView(from: XYZ, to?: XYZ): void;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  readonly frustFraction: number;
  // (undocumented)
  getAuxCoordOrigin(result?: Point3d): Point3d;
  // (undocumented)
  getAuxCoordRotation(result?: Matrix3d): Matrix3d;
  getContrastToBackgroundColor(): ColorDef;
  getFrustum(sys?: CoordSystem, adjustedBox?: boolean, box?: Frustum): Frustum;
  // WARNING: The type "Pixel.Buffer" needs to be exported by the package (e.g. added to index.ts)
  getPixelDataNpcPoint(pixels: Pixel.Buffer, x: number, y: number, out?: Point3d): Point3d | undefined;
  // WARNING: The type "Pixel.Buffer" needs to be exported by the package (e.g. added to index.ts)
  getPixelDataWorldPoint(pixels: Pixel.Buffer, x: number, y: number, out?: Point3d): Point3d | undefined;
  getPixelSizeAtPoint(point?: Point3d): number;
  getWorldFrustum(box?: Frustum): Frustum;
  hilite: Hilite.Settings;
  readonly iModel: IModelConnection;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  invalidateDecorations(): void;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  invalidateRenderPlan(): void;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  invalidateScene(): void;
  readonly isAlwaysDrawnExclusive: boolean;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  readonly isAspectRatioLocked: boolean;
  readonly isCameraOn: boolean;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  readonly isContextRotationRequired: boolean;
  isFadeOutActive: boolean;
  readonly isGridOn: boolean;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  readonly isPointAdjustmentRequired: boolean;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  readonly isSnapAdjustmentRequired: boolean;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal
  lastFlashedElem?: string;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal
  static nearScale24: number;
  readonly neverDrawn: Id64Set | undefined;
  npcToView(pt: Point3d, out?: Point3d): Point3d;
  npcToViewArray(pts: Point3d[]): void;
  npcToWorld(pt: XYAndZ, out?: Point3d): Point3d;
  npcToWorldArray(pts: Point3d[]): void;
  numReadyTiles: number;
  readonly numRequestedTiles: number;
  numSelectedTiles: number;
  readonly onAlwaysDrawnChanged: BeEvent<(vp: Viewport) => void>;
  readonly onNeverDrawnChanged: BeEvent<(vp: Viewport) => void>;
  readonly onRender: BeEvent<(vp: Viewport) => void>;
  readonly onViewChanged: BeEvent<(vp: Viewport) => void>;
  pixelsFromInches(inches: number): number;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  readonly pixelsPerInch: number;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  pointToGrid(point: Point3d): void;
  readImage(rect?: ViewRect, targetSize?: Point2d, flipVertically?: boolean): ImageBuffer | undefined;
  // WARNING: The type "Pixel.Selector" needs to be exported by the package (e.g. added to index.ts)
  // WARNING: The type "Pixel.Receiver" needs to be exported by the package (e.g. added to index.ts)
  readPixels(rect: ViewRect, selector: Pixel.Selector, receiver: Pixel.Receiver, excludeNonLocatable?: boolean): void;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  removeAnimator(): void;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  renderFrame(): boolean;
  readonly rotation: Matrix3d;
  scroll(screenDist: Point2d, options?: ViewChangeOptions): void;
  setAlwaysDrawn(ids: Id64Set, exclusive?: boolean): void;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal
  setFlashed(id: string | undefined, duration: number): void;
  setNeverDrawn(ids: Id64Set): void;
  setStandardRotation(id: StandardViewId): void;
  setupFromView(): ViewStatus;
  setupViewFromFrustum(inFrustum: Frustum): boolean;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  readonly sync: SyncFlags;
  synchWithView(_saveInUndo: boolean): void;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  readonly target: RenderTarget;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  toView(from: XYZ, to?: XYZ): void;
  turnCameraOn(lensAngle?: Angle): ViewStatus;
  static undoDelay: BeDuration;
  readonly view: ViewState;
  view4dToWorld(input: Point4d, out?: Point3d): Point3d;
  view4dToWorldArray(viewPts: Point4d[], worldPts: Point3d[]): void;
  readonly viewDelta: Vector3d;
  readonly viewFlags: ViewFlags;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  readonly viewFrustum: ViewFrustum;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal
  readonly viewportId: number;
  readonly viewRect: ViewRect;
  viewToNpc(pt: Point3d, out?: Point3d): Point3d;
  viewToNpcArray(pts: Point3d[]): void;
  viewToWorld(input: XYAndZ, out?: Point3d): Point3d;
  viewToWorldArray(pts: Point3d[]): void;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  readonly wantAntiAliasLines: AntiAliasPref;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  readonly wantAntiAliasText: AntiAliasPref;
  worldToNpc(pt: XYAndZ, out?: Point3d): Point3d;
  worldToNpcArray(pts: Point3d[]): void;
  worldToView(input: XYAndZ, out?: Point3d): Point3d;
  worldToView4d(input: XYAndZ, out?: Point4d): Point4d;
  worldToView4dArray(worldPts: Point3d[], viewPts: Point4d[]): void;
  worldToViewArray(pts: Point3d[]): void;
  readonly worldToViewMap: Map4d;
  zoom(newCenter: Point3d | undefined, factor: number, options?: ViewChangeOptions): void;
  zoomToElementProps(elementProps: ElementProps[], options?: ViewChangeOptions & ZoomToOptions): void;
  zoomToElements(ids: Id64Arg, options?: ViewChangeOptions & ZoomToOptions): Promise<void>;
  zoomToPlacementProps(placementProps: PlacementProps[], options?: ViewChangeOptions & ZoomToOptions): void;
  zoomToVolume(volume: LowAndHighXYZ | LowAndHighXY, options?: ViewChangeOptions): void;
}

// @public
interface ViewportAnimator {
  animate(viewport: Viewport): RemoveMe;
  onInterrupted(viewport: Viewport): void;
}

// @public
class ViewRect {
  constructor(left?: number, top?: number, right?: number, bottom?: number);
  readonly area: number;
  readonly aspect: number;
  bottom: number;
  clone(result?: ViewRect): ViewRect;
  computeOverlap(other: ViewRect, out?: ViewRect): ViewRect | undefined;
  containsPoint(point: XAndY): boolean;
  equals(other: ViewRect): boolean;
  // (undocumented)
  extend(other: ViewRect): void;
  height: number;
  init(left: number, top: number, right: number, bottom: number): void;
  initFromPoints(topLeft: XAndY, bottomRight: XAndY): void;
  initFromRange(input: LowAndHighXY): void;
  inset(deltaX: number, deltaY: number): void;
  insetByPercent(percent: number): void;
  insetUniform(offset: number): void;
  isContained(other: ViewRect): boolean;
  readonly isNull: boolean;
  readonly isValid: boolean;
  left: number;
  overlaps(other: ViewRect): boolean;
  right: number;
  scaleAboutCenter(xScale: number, yScale: number): void;
  setFrom(other: ViewRect): void;
  top: number;
  width: number;
}

// @public
class ViewRedoTool extends ViewTool {
  // (undocumented)
  onPostInstall(): void;
  // (undocumented)
  static toolId: string;
}

// @public
class ViewState extends ElementState {
  // @internal
  protected constructor(props: ViewDefinitionProps, iModel: IModelConnection, categorySelector: CategorySelectorState, displayStyle: DisplayStyleState);
  // (undocumented)
  protected _featureOverridesDirty: boolean;
  // (undocumented)
  protected _selectionSetDirty: boolean;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  protected adjustAspectRatio(windowAspect: number): void;
  abstract allow3dManipulations(): boolean;
  readonly analysisStyle: AnalysisStyle | undefined;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  readonly areAllTileTreesLoaded: boolean;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  readonly areFeatureOverridesDirty: boolean;
  readonly auxiliaryCoordinateSystem: AuxCoordSystemState;
  readonly backgroundColor: ColorDef;
  calculateFrustum(result?: Frustum): Frustum | undefined;
  // (undocumented)
  categorySelector: CategorySelectorState;
  changeCategoryDisplay(categories: Id64Arg, display: boolean, enableAllSubCategories?: boolean): void;
  // (undocumented)
  static readonly className: string;
  abstract computeFitRange(): Range3d;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  computeWorldToNpc: {
    frustFraction: number;
    map: Map4d | undefined;
  }
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  abstract createAuxCoordSystem(acsName: string): AuxCoordSystemState;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  createClassification(context: SceneContext): void;
  static createFromProps(_props: ViewStateProps, _iModel: IModelConnection): ViewState | undefined;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  createScene(context: SceneContext): void;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  createTerrain(context: SceneContext): void;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal
  decorate(context: DecorateContext): void;
  readonly defaultExtentLimits: ExtentLimits;
  // (undocumented)
  description?: string;
  // (undocumented)
  displayStyle: DisplayStyleState;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  drawGrid(context: DecorateContext): void;
  dropSubCategoryOverride(id: Id64String): void;
  equals(other: this): boolean;
  equalState(other: ViewState): boolean;
  extentLimits: ExtentLimits;
  abstract forEachModel(func: (model: GeometricModelState) => void): void;
  forEachTileTreeModel(func: (model: TileTreeModelState) => void): void;
  getAspectRatio(): number;
  getAspectRatioSkew(): number;
  getAuxiliaryCoordinateSystemId(): Id64String;
  getCenter(result?: Point3d): Point3d;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal
  getDetail(name: string): any;
  // (undocumented)
  getDetails(): any;
  abstract getExtents(): Vector3d;
  getGridOrientation(): GridOrientationType;
  getGridSettings(vp: Viewport, origin: Point3d, rMatrix: Matrix3d, orientation: GridOrientationType): void;
  // (undocumented)
  getGridSpacing(): XAndY;
  // (undocumented)
  getGridsPerRef(): number;
  abstract getOrigin(): Point3d;
  abstract getRotation(): Matrix3d;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  static getStandardViewMatrix(id: StandardViewId): Matrix3d;
  getSubCategoryAppearance(id: Id64String): SubCategoryAppearance;
  getSubCategoryOverride(id: Id64String): SubCategoryOverride | undefined;
  getTargetPoint(result?: Point3d): Point3d;
  getViewClip(): ClipVector | undefined;
  abstract getViewedExtents(): AxisAlignedBox3d;
  getXVector(result?: Vector3d): Vector3d;
  getYVector(result?: Vector3d): Vector3d;
  getZVector(result?: Vector3d): Vector3d;
  // (undocumented)
  is3d(): this is ViewState3d;
  // (undocumented)
  isPrivate?: boolean;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  readonly isSelectionSetDirty: boolean;
  // (undocumented)
  isSpatialView(): this is SpatialViewState;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  isSubCategoryVisible(id: Id64String): boolean;
  load(): Promise<void>;
  lookAtViewAlignedVolume(volume: Range3d, aspect?: number, margin?: MarginPercent): void;
  lookAtVolume(volume: LowAndHighXYZ | LowAndHighXY, aspect?: number, margin?: MarginPercent): void;
  readonly name: string;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal
  abstract onRenderFrame(_viewport: Viewport): void;
  overrideSubCategory(id: Id64String, ovr: SubCategoryOverride): void;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal
  peekDetail(name: string): any;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal
  removeDetail(name: string): void;
  resetExtentLimits(): void;
  // WARNING: The type "RenderScheduleState.Script" needs to be exported by the package (e.g. added to index.ts)
  readonly scheduleScript: RenderScheduleState.Script | undefined;
  // (undocumented)
  scheduleTime: number;
  setAspectRatioSkew(val: number): void;
  setAuxiliaryCoordinateSystem(acs?: AuxCoordSystemState): void;
  setCategorySelector(categories: CategorySelectorState): void;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal
  setDetail(name: string, value: any): void;
  // (undocumented)
  setDisplayStyle(style: DisplayStyleState): void;
  abstract setExtents(viewDelta: Vector3d): void;
  setFeatureOverridesDirty(dirty?: boolean): void;
  setGridSettings(orientation: GridOrientationType, spacing: Point2d, gridsPerRef: number): void;
  abstract setOrigin(viewOrg: Point3d): void;
  abstract setRotation(viewRot: Matrix3d): void;
  setRotationAboutPoint(rotation: Matrix3d, point?: Point3d): void;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  setSelectionSetDirty(dirty?: boolean): void;
  setStandardRotation(id: StandardViewId): void;
  setupFromFrustum(inFrustum: Frustum): ViewStatus;
  setViewClip(clip?: ClipVector): void;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  showFrustumErrorMessage(status: ViewStatus): void;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal
  readonly subCategories: ViewSubCategories;
  // (undocumented)
  toJSON(): ViewDefinitionProps;
  undoTime?: BeTimePoint;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  validateViewDelta(delta: Vector3d, messageNeeded?: boolean): ViewStatus;
  viewFlags: ViewFlags;
  viewsCategory(id: Id64String): boolean;
  abstract viewsModel(modelId: Id64String): boolean;
}

// @public
class ViewState2d extends ViewState {
  constructor(props: ViewDefinition2dProps, iModel: IModelConnection, categories: CategorySelectorState, displayStyle: DisplayStyle2dState);
  // (undocumented)
  allow3dManipulations(): boolean;
  // (undocumented)
  readonly angle: Angle;
  // (undocumented)
  readonly baseModelId: Id64String;
  // (undocumented)
  static readonly className: string;
  // (undocumented)
  computeFitRange(): Range3d;
  // (undocumented)
  createAuxCoordSystem(acsName: string): AuxCoordSystemState;
  // (undocumented)
  readonly delta: Point2d;
  // (undocumented)
  equalState(other: ViewState2d): boolean;
  // (undocumented)
  forEachModel(func: (model: GeometricModelState) => void): void;
  // (undocumented)
  getExtents(): Vector3d;
  // (undocumented)
  getOrigin(): Point3d;
  // (undocumented)
  getRotation(): Matrix3d;
  // (undocumented)
  getViewedExtents(): AxisAlignedBox3d;
  getViewedModel(): GeometricModel2dState | undefined;
  // (undocumented)
  load(): Promise<void>;
  // (undocumented)
  onRenderFrame(_viewport: Viewport): void;
  // (undocumented)
  readonly origin: Point2d;
  // (undocumented)
  setExtents(delta: Vector3d): void;
  // (undocumented)
  setOrigin(origin: Point3d): void;
  // (undocumented)
  setRotation(rot: Matrix3d): void;
  // (undocumented)
  toJSON(): ViewDefinition2dProps;
  // (undocumented)
  viewsModel(modelId: Id64String): boolean;
}

// @public
class ViewState3d extends ViewState {
  constructor(props: ViewDefinition3dProps, iModel: IModelConnection, categories: CategorySelectorState, displayStyle: DisplayStyle3dState);
  protected _cameraOn: boolean;
  // (undocumented)
  allow3dManipulations(): boolean;
  calcLensAngle(): Angle;
  // (undocumented)
  protected static calculateMaxDepth(delta: Vector3d, zVec: Vector3d): number;
  readonly camera: Camera;
  centerEyePoint(backDistance?: number): void;
  centerFocusDistance(): void;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  static readonly className: string;
  // (undocumented)
  createAuxCoordSystem(acsName: string): AuxCoordSystemState;
  // (undocumented)
  decorate(context: DecorateContext): void;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  protected drawGroundPlane(context: DecorateContext): void;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  protected drawSkyBox(context: DecorateContext): void;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  protected enableCamera(): void;
  // (undocumented)
  equalState(other: ViewState3d): boolean;
  readonly extents: Vector3d;
  forceMinFrontDist: number;
  getBackDistance(): number;
  // (undocumented)
  getDisplayStyle3d(): DisplayStyle3dState;
  // (undocumented)
  getExtents(): Vector3d;
  getEyePoint(): Point3d;
  getFocusDistance(): number;
  getFrontDistance(): number;
  getGroundElevation(): number;
  getGroundExtents(vp?: Viewport): AxisAlignedBox3d;
  getLensAngle(): Angle;
  // (undocumented)
  getOrigin(): Point3d;
  // (undocumented)
  getRotation(): Matrix3d;
  getTargetPoint(result?: Point3d): Point3d;
  // (undocumented)
  readonly isCameraOn: boolean;
  readonly isCameraValid: boolean;
  // (undocumented)
  isEyePointAbove(elevation: number): boolean;
  lookAt(eyePoint: XYAndZ, targetPoint: XYAndZ, upVector: Vector3d, newExtents?: XAndY, frontDistance?: number, backDistance?: number): ViewStatus;
  lookAtUsingLensAngle(eyePoint: Point3d, targetPoint: Point3d, upVector: Vector3d, fov: Angle, frontDistance?: number, backDistance?: number): ViewStatus;
  // (undocumented)
  minimumFrontDistance(): number;
  moveCameraLocal(distance: Vector3d): ViewStatus;
  moveCameraWorld(distance: Vector3d): ViewStatus;
  // (undocumented)
  onRenderFrame(_viewport: Viewport): void;
  readonly origin: Point3d;
  rotateCameraLocal(angle: Angle, axis: Vector3d, aboutPt?: Point3d): ViewStatus;
  rotateCameraWorld(angle: Angle, axis: Vector3d, aboutPt?: Point3d): ViewStatus;
  readonly rotation: Matrix3d;
  // (undocumented)
  setExtents(extents: XYAndZ): void;
  setEyePoint(pt: XYAndZ): void;
  setFocusDistance(dist: number): void;
  setLensAngle(angle: Angle): void;
  // (undocumented)
  setOrigin(origin: XYAndZ): void;
  // (undocumented)
  setRotation(rot: Matrix3d): void;
  // (undocumented)
  setupFromFrustum(frustum: Frustum): ViewStatus;
  // (undocumented)
  supportsCamera(): boolean;
  // (undocumented)
  toJSON(): ViewDefinition3dProps;
  turnCameraOff(): void;
  verifyFocusPlane(): void;
}

// @public
enum ViewStatus {
  // (undocumented)
  AlreadyAttached = 2,
  // (undocumented)
  DrawFailure = 4,
  // (undocumented)
  InvalidLens = 14,
  // (undocumented)
  InvalidTargetPoint = 13,
  // (undocumented)
  InvalidUpVector = 12,
  // (undocumented)
  InvalidViewport = 15,
  // (undocumented)
  InvalidWindow = 7,
  // (undocumented)
  MaxDisplayDepth = 11,
  // (undocumented)
  MaxWindow = 9,
  // (undocumented)
  MaxZoom = 10,
  // (undocumented)
  MinWindow = 8,
  // (undocumented)
  ModelNotFound = 6,
  // (undocumented)
  NotAttached = 3,
  // (undocumented)
  NotResized = 5,
  // (undocumented)
  Success = 0,
  // (undocumented)
  ViewNotInitialized = 1
}

// WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
// @internal
class ViewSubCategories {
  getSubCategories(categoryId: string): Id64Set | undefined;
  getSubCategoryAppearance(subCategoryId: Id64String): SubCategoryAppearance | undefined;
  load(categoryIds: Set<string>, iModel: IModelConnection): Promise<void>;
  update(addedCategoryIds: Set<string>, iModel: IModelConnection): Promise<void>;
}

// @public
class ViewToggleCameraTool extends ViewTool {
  // (undocumented)
  onInstall(): boolean;
  // (undocumented)
  onPostInstall(): void;
  // (undocumented)
  static toolId: string;
}

// @public
class ViewTool extends InteractiveTool {
  constructor(viewport?: ScreenViewport | undefined);
  // (undocumented)
  beginDynamicUpdate(): void;
  // (undocumented)
  endDynamicUpdate(): void;
  exitTool(): void;
  // (undocumented)
  inDynamicUpdate: boolean;
  // (undocumented)
  onResetButtonUp(_ev: BeButtonEvent): Promise<EventHandled>;
  // (undocumented)
  run(): boolean;
  // (undocumented)
  static showPrompt(prompt: string): void;
  // (undocumented)
  viewport?: ScreenViewport | undefined;
}

// @public
class ViewUndoTool extends ViewTool {
  // (undocumented)
  onPostInstall(): void;
  // (undocumented)
  static toolId: string;
}

// @public
class WalkViewTool extends ViewManip {
  constructor(vp: ScreenViewport, oneShot?: boolean, isDraggingRequired?: boolean);
  // (undocumented)
  onReinitialize(): void;
  // (undocumented)
  static toolId: string;
}

// @public
class WheelEventProcessor {
  // (undocumented)
  static process(ev: BeWheelEvent, doUpdate: boolean): Promise<void>;
}

// @public
class WindowAreaTool extends ViewTool {
  // (undocumented)
  decorate(context: DecorateContext): void;
  // (undocumented)
  onDataButtonDown(ev: BeButtonEvent): Promise<EventHandled>;
  // (undocumented)
  onMouseMotion(ev: BeButtonEvent): Promise<void>;
  // (undocumented)
  onPostInstall(): void;
  // (undocumented)
  onReinitialize(): void;
  // (undocumented)
  onResetButtonUp(ev: BeButtonEvent): Promise<EventHandled>;
  // (undocumented)
  onTouchCancel(ev: BeTouchEvent): Promise<void>;
  // (undocumented)
  onTouchComplete(ev: BeTouchEvent): Promise<void>;
  // (undocumented)
  onTouchMove(ev: BeTouchEvent): Promise<void>;
  // (undocumented)
  onTouchMoveStart(ev: BeTouchEvent, startEv: BeTouchEvent): Promise<EventHandled>;
  // (undocumented)
  onTouchTap(ev: BeTouchEvent): Promise<EventHandled>;
  // (undocumented)
  static toolId: string;
}

// @public
interface ZoomToOptions {
  placementRelativeId?: StandardViewId;
  standardViewId?: StandardViewId;
  viewRotation?: Matrix3d;
}

// @public
class ZoomViewTool extends ViewManip {
  constructor(vp: ScreenViewport, oneShot?: boolean, isDraggingRequired?: boolean);
  // (undocumented)
  onReinitialize(): void;
  // (undocumented)
  static toolId: string;
}

// WARNING: Unsupported export: ToolType
// WARNING: Unsupported export: ToolList
// WARNING: Unsupported export: MarkerImage
// WARNING: Unsupported export: MarkerFillStyle
// WARNING: Unsupported export: MarkerTextAlign
// WARNING: Unsupported export: MarkerTextBaseline
// WARNING: Unsupported export: PlanarClassifierMap
// WARNING: Unsupported export: GraphicList
// WARNING: Unsupported export: CanvasDecorationList
// WARNING: Unsupported export: AnimationBranchStates
// WARNING: Unsupported export: PropertyEditorParams
// WARNING: Unsupported export: PropertyValue
// (No @packagedocumentation comment for this package)
