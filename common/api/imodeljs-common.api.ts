// @beta
module AmbientOcclusion {
  interface Props {
    readonly bias?: number;
    readonly blurDelta?: number;
    readonly blurSigma?: number;
    // (undocumented)
    readonly blurTexelStepSize?: number;
    readonly intensity?: number;
    readonly texelStepSize?: number;
    readonly zLengthCap?: number;
  }

  class Settings implements Props {
    // (undocumented)
    readonly bias?: number;
    // (undocumented)
    readonly blurDelta?: number;
    // (undocumented)
    readonly blurSigma?: number;
    // (undocumented)
    readonly blurTexelStepSize?: number;
    // WARNING: The type "Settings" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    static defaults: Settings;
    // WARNING: The type "Props" needs to be exported by the package (e.g. added to index.ts)
    // WARNING: The type "Settings" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    static fromJSON(json?: Props): Settings;
    // (undocumented)
    readonly intensity?: number;
    // (undocumented)
    readonly texelStepSize?: number;
    // WARNING: The type "Props" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    toJSON(): Props;
    // (undocumented)
    readonly zLengthCap?: number;
  }

}

// @alpha (undocumented)
class AnalysisStyle implements AnalysisStyleProps {
  // (undocumented)
  clone(out?: AnalysisStyle): AnalysisStyle;
  // (undocumented)
  copyFrom(source: AnalysisStyle): void;
  // (undocumented)
  displacementChannelName?: string;
  // (undocumented)
  displacementScale?: number;
  // (undocumented)
  static fromJSON(json?: AnalysisStyleProps): AnalysisStyle;
  // (undocumented)
  inputName?: string;
  // (undocumented)
  inputRange?: Range1d;
  // (undocumented)
  normalChannelName?: string;
  // (undocumented)
  scalarChannelName?: string;
  // (undocumented)
  scalarRange?: Range1d;
  // WARNING: The type "Gradient.ThematicSettings" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  scalarThematicSettings?: Gradient.ThematicSettings;
  // (undocumented)
  scalarThematicTexture?: RenderTexture;
}

// @alpha
interface AnalysisStyleProps {
  // (undocumented)
  displacementChannelName?: string;
  // (undocumented)
  displacementScale?: number;
  // (undocumented)
  inputName?: string;
  // (undocumented)
  inputRange?: Range1d;
  // (undocumented)
  normalChannelName?: string;
  // (undocumented)
  scalarChannelName?: string;
  // (undocumented)
  scalarRange?: Range1d;
  // (undocumented)
  scalarThematicSettings?: Gradient.ThematicSettingsProps;
}

// @public (undocumented)
enum AntiAliasPref {
  // (undocumented)
  Detect = 0,
  // (undocumented)
  Off = 2,
  // (undocumented)
  On = 1
}

// @public
interface AreaFillProps {
  backgroundFill?: BackgroundFill;
  color?: ColorDefProps;
  display: FillDisplay;
  gradient?: Gradient.SymbProps;
  transparency?: number;
}

// @public (undocumented)
module AreaPattern {
  // (undocumented)
  class HatchDefLine implements HatchDefLineProps {
    // WARNING: The type "HatchDefLineProps" needs to be exported by the package (e.g. added to index.ts)
    constructor(json: HatchDefLineProps);
    // (undocumented)
    angle?: Angle;
    // (undocumented)
    dashes?: number[];
    // (undocumented)
    offset?: Point2d;
    // (undocumented)
    through?: Point2d;
  }

  interface HatchDefLineProps {
    angle?: AngleProps;
    dashes?: number[];
    offset?: XYProps;
    through?: XYProps;
  }

  class Params implements ParamsProps {
    // (undocumented)
    angle1?: Angle;
    // (undocumented)
    angle2?: Angle;
    // (undocumented)
    applyTransform(transform: Transform): boolean;
    // WARNING: The type "Params" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    clone(): Params;
    // (undocumented)
    color?: ColorDef;
    // WARNING: The type "HatchDefLine" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    defLines?: HatchDefLine[];
    // WARNING: The type "Params" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    equals(other: Params): boolean;
    // WARNING: The type "ParamsProps" needs to be exported by the package (e.g. added to index.ts)
    // WARNING: The type "Params" needs to be exported by the package (e.g. added to index.ts)
    static fromJSON(json?: ParamsProps): Params;
    // (undocumented)
    static getTransformPatternScale(transform: Transform): number;
    // (undocumented)
    invisibleBoundary?: boolean;
    // (undocumented)
    origin?: Point3d;
    // (undocumented)
    rotation?: YawPitchRollAngles;
    // (undocumented)
    scale?: number;
    // (undocumented)
    snappable?: boolean;
    // (undocumented)
    space1?: number;
    // (undocumented)
    space2?: number;
    // (undocumented)
    symbolId?: Id64String;
    // (undocumented)
    static transformPatternSpace(transform: Transform, oldSpace: number, patRot: Matrix3d, angle?: Angle): number;
    // (undocumented)
    weight?: number;
  }

  interface ParamsProps {
    angle1?: AngleProps;
    angle2?: AngleProps;
    color?: ColorDefProps;
    defLines?: HatchDefLineProps[];
    invisibleBoundary?: boolean;
    origin?: XYZProps;
    rotation?: YawPitchRollProps;
    scale?: number;
    snappable?: boolean;
    space1?: number;
    space2?: number;
    symbolId?: Id64String;
    weight?: number;
  }

}

// @beta
enum AuthStatus {
  // (undocumented)
  AUTHSTATUS_BASE = 131072,
  // (undocumented)
  Error = 131072,
  // (undocumented)
  Success = 0
}

// @public
interface AuxCoordSystem2dProps extends AuxCoordSystemProps {
  angle?: AngleProps;
  origin?: XYProps;
}

// @public
interface AuxCoordSystem3dProps extends AuxCoordSystemProps {
  origin?: XYZProps;
  pitch?: AngleProps;
  // (undocumented)
  roll?: AngleProps;
  // (undocumented)
  yaw?: AngleProps;
}

// @public (undocumented)
interface AuxCoordSystemProps extends ElementProps {
  // (undocumented)
  description?: string;
  // (undocumented)
  type?: number;
}

// @public
enum BackgroundFill {
  None = 0,
  Outline = 2,
  Solid = 1
}

// @public
interface BackgroundMapProps {
  // (undocumented)
  groundBias?: number;
  // (undocumented)
  providerData?: {
    mapType?: BackgroundMapType;
  }
  providerName?: string;
}

// @public
enum BackgroundMapType {
  // (undocumented)
  Aerial = 2,
  // (undocumented)
  Hybrid = 3,
  // (undocumented)
  Street = 1
}

// @beta
enum BatchType {
  Classifier = 1,
  Primary = 0
}

// @public
class BentleyCloudRpcConfiguration extends RpcConfiguration {
  applicationAuthorizationKey: string;
  applicationVersionKey: string;
  // WARNING: The type "BentleyCloudRpcProtocol" needs to be exported by the package (e.g. added to index.ts)
  readonly protocol: BentleyCloudRpcProtocol;
}

// @public
class BentleyCloudRpcManager extends RpcManager {
  static initializeClient(params: BentleyCloudRpcParams, interfaces: RpcInterfaceDefinition[]): BentleyCloudRpcConfiguration;
  static initializeImpl(params: BentleyCloudRpcParams, interfaces: RpcInterfaceDefinition[]): BentleyCloudRpcConfiguration;
}

// @public
interface BentleyCloudRpcParams {
  info: OpenAPIInfo;
  pendingRequestListener?: RpcRequestEventHandler;
  protocol?: typeof BentleyCloudRpcProtocol;
  uriPrefix?: string;
}

// @public
class BentleyError extends Error {
  constructor(errorNumber: number | IModelStatus | DbResult | BentleyStatus | BriefcaseStatus | RepositoryStatus | ChangeSetStatus | HttpStatus | WSStatus | IModelHubStatus, message?: string, log?: LogFunction, category?: string, getMetaData?: GetMetaDataFunction);
  protected _initName(): string;
  // (undocumented)
  errorNumber: number;
  // (undocumented)
  getMetaData(): any;
  // (undocumented)
  readonly hasMetaData: boolean;
}

// @public
enum BentleyStatus {
  // (undocumented)
  ERROR = 32768,
  // (undocumented)
  SUCCESS = 0
}

// @public
enum BisCodeSpec {
  // (undocumented)
  annotationFrameStyle = "bis:AnnotationFrameStyle",
  // (undocumented)
  annotationLeaderStyle = "bis:AnnotationLeaderStyle",
  // (undocumented)
  annotationTextStyle = "bis:AnnotationTextStyle",
  // (undocumented)
  auxCoordSystem2d = "bis:AuxCoordSystem2d",
  // (undocumented)
  auxCoordSystem3d = "bis:AuxCoordSystem3d",
  // (undocumented)
  auxCoordSystemSpatial = "bis:AuxCoordSystemSpatial",
  // (undocumented)
  categorySelector = "bis:CategorySelector",
  // (undocumented)
  colorBook = "bis:ColorBook",
  // (undocumented)
  displayStyle = "bis:DisplayStyle",
  // (undocumented)
  drawing = "bis:Drawing",
  // (undocumented)
  drawingCategory = "bis:DrawingCategory",
  // (undocumented)
  geometryPart = "bis:GeometryPart",
  // (undocumented)
  graphicalType2d = "bis:GraphicalType2d",
  // (undocumented)
  informationPartitionElement = "bis:InformationPartitionElement",
  // (undocumented)
  lineStyle = "bis:LineStyle",
  // (undocumented)
  linkElement = "bis:LinkElement",
  // (undocumented)
  modelSelector = "bis:ModelSelector",
  // (undocumented)
  nullCodeSpec = "bis:NullCodeSpec",
  // (undocumented)
  physicalMaterial = "bis:PhysicalMaterial",
  // (undocumented)
  physicalType = "bis:PhysicalType",
  // (undocumented)
  renderMaterial = "bis:RenderMaterial",
  // (undocumented)
  sheet = "bis:Sheet",
  // (undocumented)
  spatialCategory = "bis:SpatialCategory",
  // (undocumented)
  spatialLocationType = "bis:SpatialLocationType",
  // (undocumented)
  subCategory = "bis:SubCategory",
  // (undocumented)
  subject = "bis:Subject",
  // (undocumented)
  templateRecipe2d = "bis:TemplateRecipe2d",
  // (undocumented)
  templateRecipe3d = "bis:TemplateRecipe3d",
  // (undocumented)
  textAnnotationSeed = "bis:TextAnnotationSeed",
  // (undocumented)
  texture = "bis:Texture",
  // (undocumented)
  viewDefinition = "bis:ViewDefinition"
}

// @public
class BoundingSphere {
  constructor(center?: Point3d, radius?: number);
  // (undocumented)
  center: Point3d;
  // (undocumented)
  init(center: Point3d, radius: number): void;
  // (undocumented)
  radius: number;
  // (undocumented)
  transformBy(transform: Transform, result: BoundingSphere): BoundingSphere;
}

// @beta (undocumented)
module BRepEntity {
  interface DataProps {
    data?: string;
    faceSymbology?: FaceSymbologyProps[];
    transform?: TransformProps;
    type?: Type;
  }

  interface FaceSymbologyProps {
    color?: ColorDefProps;
    materialId?: Id64String;
    transparency?: number;
  }

  enum Type {
    Sheet = 1,
    Solid = 0,
    Wire = 2
  }

}

// @beta
enum BriefcaseStatus {
  // (undocumented)
  CannotAcquire = 131072,
  // (undocumented)
  CannotApplyChanges = 131078,
  // (undocumented)
  CannotCopy = 131075,
  // (undocumented)
  CannotDelete = 131076,
  // (undocumented)
  CannotDownload = 131073,
  // (undocumented)
  CannotUpload = 131074,
  // (undocumented)
  VersionNotFound = 131077
}

// @public (undocumented)
interface CalloutProps extends GeometricElement2dProps {
  // (undocumented)
  drawingModel?: RelatedElementProps;
}

// @public
class Camera implements CameraProps {
  constructor(props?: CameraProps);
  // (undocumented)
  clone(): Camera;
  // (undocumented)
  copyFrom(rhs: Camera): void;
  // (undocumented)
  equals(other: Camera): boolean;
  // (undocumented)
  readonly eye: Point3d;
  // (undocumented)
  focusDist: number;
  // (undocumented)
  getEyePoint(): Point3d;
  // (undocumented)
  getFocusDistance(): number;
  // (undocumented)
  getLensAngle(): Angle;
  // (undocumented)
  invalidateFocus(): void;
  // (undocumented)
  readonly isFocusValid: boolean;
  // (undocumented)
  readonly isLensValid: boolean;
  // (undocumented)
  readonly isValid: boolean;
  // (undocumented)
  static isValidLensAngle(val: Angle): boolean;
  // (undocumented)
  readonly lens: Angle;
  // (undocumented)
  setEyePoint(pt: XYAndZ): void;
  // (undocumented)
  setFocusDistance(dist: number): void;
  // (undocumented)
  setLensAngle(angle: Angle): void;
  // (undocumented)
  validateLens(): void;
  // (undocumented)
  static validateLensAngle(val: Angle): void;
}

// @public
interface CameraProps {
  // (undocumented)
  eye: XYZProps;
  // (undocumented)
  focusDist: number;
  // (undocumented)
  lens: AngleProps;
}

// @public
class Cartographic implements LatLongAndHeight {
  constructor(longitude?: number, latitude?: number, height?: number);
  clone(result?: Cartographic): Cartographic;
  equals(right: LatLongAndHeight): boolean;
  equalsEpsilon(right: LatLongAndHeight, epsilon: number): boolean;
  static fromAngles(longitude: Angle, latitude: Angle, height: number, result?: Cartographic): Cartographic;
  static fromDegrees(longitude: number, latitude: number, height: number, result?: Cartographic): Cartographic;
  static fromEcef(cartesian: Point3d, result?: Cartographic): Cartographic | undefined;
  static fromRadians(longitude: number, latitude: number, height?: number, result?: Cartographic): Cartographic;
  // (undocumented)
  height: number;
  // (undocumented)
  latitude: number;
  // (undocumented)
  longitude: number;
  toEcef(result?: Point3d): Point3d;
  toString(): string;
}

// @public
class CartographicRange {
  constructor(spatialRange: Range3d, spatialToEcef: Transform);
  getLongitudeLatitudeBoundingBox(): Range2d;
  // (undocumented)
  intersectsRange(other: CartographicRange): boolean;
}

// @public
interface CategoryProps extends ElementProps {
  // (undocumented)
  description?: string;
  // (undocumented)
  rank?: Rank;
}

// @public
interface CategorySelectorProps extends DefinitionElementProps {
  // (undocumented)
  categories: Id64Array;
}

// @beta (undocumented)
interface ChangedElements {
  // (undocumented)
  classIds: Id64String[];
  // (undocumented)
  elements: Id64String[];
  // (undocumented)
  opcodes: number[];
}

// @public
enum ChangedValueState {
  // (undocumented)
  AfterInsert = 1,
  // (undocumented)
  AfterUpdate = 3,
  // (undocumented)
  BeforeDelete = 4,
  // (undocumented)
  BeforeUpdate = 2
}

// @public
enum ChangeOpCode {
  // (undocumented)
  Delete = 4,
  // (undocumented)
  Insert = 1,
  // (undocumented)
  Update = 2
}

// @beta
enum ChangeSetStatus {
  ApplyError = 90113,
  CannotMergeIntoMaster = 90136,
  CannotMergeIntoReadonly = 90135,
  CannotMergeIntoReversed = 90137,
  // (undocumented)
  CHANGESET_ERROR_BASE = 90112,
  ChangeTrackingNotEnabled = 90114,
  CorruptedChangeStream = 90115,
  CouldNotOpenDgnDb = 90131,
  FileNotFound = 90116,
  FileWriteError = 90117,
  HasLocalChanges = 90118,
  HasUncommittedChanges = 90119,
  InDynamicTransaction = 90122,
  InvalidId = 90120,
  InvalidVersion = 90121,
  IsCreatingChangeSet = 90123,
  IsNotCreatingChangeSet = 90124,
  MergePropagationError = 90125,
  MergeSchemaChangesOnOpen = 90132,
  NothingToMerge = 90126,
  NoTransactions = 90127,
  ParentMismatch = 90128,
  ProcessSchemaChangesOnOpen = 90134,
  ReverseOrReinstateSchemaChangesOnOpen = 90133,
  SQLiteError = 90129,
  // (undocumented)
  Success = 0,
  WrongDgnDb = 90130
}

// @public
class Code implements CodeProps {
  constructor(val: CodeProps);
  static createEmpty(): Code;
  // (undocumented)
  equals(other: Code): boolean;
  // (undocumented)
  static fromJSON(json?: any): Code;
  // (undocumented)
  getValue(): string;
  scope: string;
  spec: Id64String;
  value?: string;
}

// @public
interface CodeProps {
  // (undocumented)
  scope: CodeScopeProps;
  // (undocumented)
  spec: Id64String;
  // (undocumented)
  value?: string;
}

// @public
module CodeScopeSpec {
  // @public
  enum ScopeRequirement {
    ElementId = 1,
    FederationGuid = 2
  }

  // @public
  enum Type {
    Model = 2,
    ParentElement = 3,
    RelatedElement = 4,
    Repository = 1
  }

}

// @public
class CodeSpec {
  // WARNING: The type "CodeScopeSpec.Type" needs to be exported by the package (e.g. added to index.ts)
  // WARNING: The type "CodeScopeSpec.ScopeRequirement" needs to be exported by the package (e.g. added to index.ts)
  constructor(iModel: IModel, id: Id64String, name: string, specScopeType: CodeScopeSpec.Type, scopeReq?: CodeScopeSpec.ScopeRequirement, properties?: any);
  id: Id64String;
  iModel: IModel;
  // (undocumented)
  readonly isValid: boolean;
  // (undocumented)
  name: string;
  // (undocumented)
  properties: any;
  // WARNING: The type "CodeScopeSpec.ScopeRequirement" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  scopeReq: CodeScopeSpec.ScopeRequirement;
  // WARNING: The type "CodeScopeSpec.Type" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  specScopeType: CodeScopeSpec.Type;
}

// @public
enum ColorByName {
  // (undocumented)
  aliceBlue = 16775408,
  // (undocumented)
  amber = 49151,
  // (undocumented)
  antiqueWhite = 14150650,
  // (undocumented)
  aqua = 16776960,
  // (undocumented)
  aquamarine = 13959039,
  // (undocumented)
  azure = 16777200,
  // (undocumented)
  beige = 14480885,
  // (undocumented)
  bisque = 12903679,
  // (undocumented)
  black = 0,
  // (undocumented)
  blanchedAlmond = 13495295,
  // (undocumented)
  blue = 16711680,
  // (undocumented)
  blueViolet = 14822282,
  // (undocumented)
  brown = 2763429,
  // (undocumented)
  burlyWood = 8894686,
  // (undocumented)
  cadetBlue = 10526303,
  // (undocumented)
  chartreuse = 65407,
  // (undocumented)
  chocolate = 1993170,
  // (undocumented)
  coral = 5275647,
  // (undocumented)
  cornflowerBlue = 15570276,
  // (undocumented)
  cornSilk = 14481663,
  // (undocumented)
  crimson = 3937500,
  // (undocumented)
  cyan = 16776960,
  // (undocumented)
  darkBlue = 9109504,
  // (undocumented)
  darkBrown = 2179941,
  // (undocumented)
  darkCyan = 9145088,
  // (undocumented)
  darkGoldenrod = 755384,
  // (undocumented)
  darkGray = 11119017,
  // (undocumented)
  darkGreen = 25600,
  // (undocumented)
  darkGrey = 11119017,
  // (undocumented)
  darkKhaki = 7059389,
  // (undocumented)
  darkMagenta = 9109643,
  // (undocumented)
  darkOliveGreen = 3107669,
  // (undocumented)
  darkOrange = 36095,
  // (undocumented)
  darkOrchid = 13382297,
  // (undocumented)
  darkRed = 139,
  // (undocumented)
  darkSalmon = 8034025,
  // (undocumented)
  darkSeagreen = 9419919,
  // (undocumented)
  darkSlateBlue = 9125192,
  // (undocumented)
  darkSlateGray = 5197615,
  // (undocumented)
  darkSlateGrey = 5197615,
  // (undocumented)
  darkTurquoise = 13749760,
  // (undocumented)
  darkViolet = 13828244,
  // (undocumented)
  deepPink = 9639167,
  // (undocumented)
  deepSkyBlue = 16760576,
  // (undocumented)
  dimGray = 6908265,
  // (undocumented)
  dimGrey = 6908265,
  // (undocumented)
  dodgerBlue = 16748574,
  // (undocumented)
  fireBrick = 2237106,
  // (undocumented)
  floralWhite = 15792895,
  // (undocumented)
  forestGreen = 2263842,
  // (undocumented)
  fuchsia = 16711935,
  // (undocumented)
  gainsboro = 14474460,
  // (undocumented)
  ghostWhite = 16775416,
  // (undocumented)
  gold = 55295,
  // (undocumented)
  goldenrod = 2139610,
  // (undocumented)
  gray = 8421504,
  // (undocumented)
  green = 32768,
  // (undocumented)
  greenYellow = 3145645,
  // (undocumented)
  grey = 8421504,
  // (undocumented)
  honeydew = 15794160,
  // (undocumented)
  hotPink = 11823615,
  // (undocumented)
  indianRed = 6053069,
  // (undocumented)
  indigo = 8519755,
  // (undocumented)
  ivory = 15794175,
  // (undocumented)
  khaki = 9234160,
  // (undocumented)
  lavender = 16443110,
  // (undocumented)
  lavenderBlush = 16118015,
  // (undocumented)
  lawnGreen = 64636,
  // (undocumented)
  lemonChiffon = 13499135,
  // (undocumented)
  lightBlue = 15128749,
  // (undocumented)
  lightCoral = 8421616,
  // (undocumented)
  lightCyan = 16777184,
  // (undocumented)
  lightGoldenrodYellow = 13826810,
  // (undocumented)
  lightGray = 13882323,
  // (undocumented)
  lightGreen = 9498256,
  // (undocumented)
  lightGrey = 13882323,
  // (undocumented)
  lightPink = 12695295,
  // (undocumented)
  lightSalmon = 8036607,
  // (undocumented)
  lightSeagreen = 11186720,
  // (undocumented)
  lightSkyBlue = 16436871,
  // (undocumented)
  lightSlateGray = 10061943,
  // (undocumented)
  lightSlateGrey = 10061943,
  // (undocumented)
  lightSteelBlue = 14599344,
  // (undocumented)
  lightyellow = 14745599,
  // (undocumented)
  lime = 65280,
  // (undocumented)
  limeGreen = 3329330,
  // (undocumented)
  linen = 15134970,
  // (undocumented)
  magenta = 16711935,
  // (undocumented)
  maroon = 128,
  // (undocumented)
  mediumAquamarine = 11193702,
  // (undocumented)
  mediumBlue = 13434880,
  // (undocumented)
  mediumOrchid = 13850042,
  // (undocumented)
  mediumPurple = 14381203,
  // (undocumented)
  mediumSeaGreen = 7451452,
  // (undocumented)
  mediumSlateBlue = 15624315,
  // (undocumented)
  mediumSpringGreen = 10156544,
  // (undocumented)
  mediumTurquoise = 13422920,
  // (undocumented)
  mediumVioletRed = 8721863,
  // (undocumented)
  midnightBlue = 7346457,
  // (undocumented)
  mintCream = 16449525,
  // (undocumented)
  mistyRose = 14804223,
  // (undocumented)
  moccasin = 11920639,
  // (undocumented)
  navajoWhite = 11394815,
  // (undocumented)
  navy = 8388608,
  // (undocumented)
  oldLace = 15136253,
  // (undocumented)
  olive = 32896,
  // (undocumented)
  oliveDrab = 2330219,
  // (undocumented)
  orange = 42495,
  // (undocumented)
  orangeRed = 17919,
  // (undocumented)
  orchid = 14053594,
  // (undocumented)
  paleGoldenrod = 11200750,
  // (undocumented)
  paleGreen = 10025880,
  // (undocumented)
  paleTurquoise = 15658671,
  // (undocumented)
  paleVioletRed = 9662683,
  // (undocumented)
  papayaWhip = 14020607,
  // (undocumented)
  peachPuff = 12180223,
  // (undocumented)
  peru = 4163021,
  // (undocumented)
  pink = 13353215,
  // (undocumented)
  plum = 14524637,
  // (undocumented)
  powderBlue = 15130800,
  // (undocumented)
  purple = 8388736,
  // (undocumented)
  rebeccaPurple = 10040166,
  // (undocumented)
  red = 255,
  // (undocumented)
  rosyBrown = 9408444,
  // (undocumented)
  royalBlue = 14772545,
  // (undocumented)
  saddleBrown = 1262987,
  // (undocumented)
  salmon = 7504122,
  // (undocumented)
  sandyBrown = 6333684,
  // (undocumented)
  seaGreen = 5737262,
  // (undocumented)
  seaShell = 15660543,
  // (undocumented)
  sienna = 2970272,
  // (undocumented)
  silver = 12632256,
  // (undocumented)
  skyBlue = 15453831,
  // (undocumented)
  slateBlue = 13458026,
  // (undocumented)
  slateGray = 9470064,
  // (undocumented)
  slateGrey = 9470064,
  // (undocumented)
  snow = 16448255,
  // (undocumented)
  springGreen = 8388352,
  // (undocumented)
  steelBlue = 11829830,
  // (undocumented)
  tan = 9221330,
  // (undocumented)
  teal = 8421376,
  // (undocumented)
  thistle = 14204888,
  // (undocumented)
  tomato = 4678655,
  // (undocumented)
  turquoise = 13688896,
  // (undocumented)
  violet = 15631086,
  // (undocumented)
  wheat = 11788021,
  // (undocumented)
  white = 16777215,
  // (undocumented)
  whiteSmoke = 16119285,
  // (undocumented)
  yellow = 65535,
  // (undocumented)
  yellowGreen = 3329434
}

// @public
class ColorDef {
  constructor(val?: string | ColorDefProps);
  adjustForContrast(other: ColorDef, alpha?: number): ColorDef;
  static readonly black: ColorDef;
  static readonly blue: ColorDef;
  clone(): ColorDef;
  readonly colors: {
    b: number;
    g: number;
    r: number;
    t: number;
  }
  equals(other: ColorDef): boolean;
  static from(red: number, green: number, blue: number, transparency?: number, result?: ColorDef): ColorDef;
  static fromHSL(h: number, s: number, l: number, out?: ColorDef): ColorDef;
  static fromHSV(hsv: HSVColor, out?: ColorDef): ColorDef;
  static fromJSON(json?: any): ColorDef;
  getAbgr(): number;
  getAlpha(): number;
  getRgb(): number;
  static readonly green: ColorDef;
  invert(): ColorDef;
  readonly isOpaque: boolean;
  lerp(color2: ColorDef, weight: number, result?: ColorDef): ColorDef;
  readonly name: string | undefined;
  static readonly red: ColorDef;
  static rgb2bgr(val: number): number;
  setAlpha(alpha: number): void;
  setFrom(other: ColorDef): void;
  setTransparency(transparency: number): void;
  tbgr: number;
  toHexString(): string;
  toHSL(opt?: HSLColor): HSLColor;
  toHSV(out?: HSVColor): HSVColor;
  toJSON(): ColorDefProps;
  toRgbString(): string;
  static readonly white: ColorDef;
}

// @public (undocumented)
class ColorIndex {
  constructor();
  // (undocumented)
  readonly hasAlpha: boolean;
  // (undocumented)
  initNonUniform(colors: Uint32Array, indices: number[], hasAlpha: boolean): void;
  // (undocumented)
  initUniform(color: ColorDef | number): void;
  // (undocumented)
  readonly isUniform: boolean;
  // (undocumented)
  readonly nonUniform: NonUniformColor | undefined;
  // (undocumented)
  readonly numColors: number;
  // (undocumented)
  reset(): void;
  // (undocumented)
  readonly uniform: ColorDef | undefined;
}

// @public
interface ContextRealityModelProps {
  // (undocumented)
  description?: string;
  // (undocumented)
  name?: string;
  // (undocumented)
  tilesetUrl: string;
}

// @public
interface CreateIModelProps extends IModelProps {
  client?: string;
  guid?: GuidString;
  thumbnail?: ThumbnailProps;
}

// @beta
interface CustomAttribute {
  ecclass: string;
  properties: {
    [propName: string]: any;
  }
}

// @public
enum DbResult {
  BE_SQLITE_ABORT = 4,
  // (undocumented)
  BE_SQLITE_ABORT_ROLLBACK = 516,
  BE_SQLITE_AUTH = 23,
  BE_SQLITE_BUSY = 5,
  // (undocumented)
  BE_SQLITE_BUSY_RECOVERY = 261,
  BE_SQLITE_CANTOPEN = 14,
  // (undocumented)
  BE_SQLITE_CANTOPEN_FULLPATH = 782,
  // (undocumented)
  BE_SQLITE_CANTOPEN_ISDIR = 526,
  // (undocumented)
  BE_SQLITE_CANTOPEN_NOTEMPDIR = 270,
  BE_SQLITE_CONSTRAINT_BASE = 19,
  // (undocumented)
  BE_SQLITE_CONSTRAINT_CHECK = 275,
  // (undocumented)
  BE_SQLITE_CONSTRAINT_COMMITHOOK = 531,
  // (undocumented)
  BE_SQLITE_CONSTRAINT_FOREIGNKEY = 787,
  // (undocumented)
  BE_SQLITE_CONSTRAINT_FUNCTION = 1043,
  // (undocumented)
  BE_SQLITE_CONSTRAINT_NOTNULL = 1299,
  // (undocumented)
  BE_SQLITE_CONSTRAINT_PRIMARYKEY = 1555,
  // (undocumented)
  BE_SQLITE_CONSTRAINT_TRIGGER = 1811,
  // (undocumented)
  BE_SQLITE_CONSTRAINT_UNIQUE = 2067,
  // (undocumented)
  BE_SQLITE_CONSTRAINT_VTAB = 2323,
  BE_SQLITE_CORRUPT = 11,
  // (undocumented)
  BE_SQLITE_CORRUPT_VTAB = 267,
  BE_SQLITE_DONE = 101,
  BE_SQLITE_EMPTY = 16,
  BE_SQLITE_ERROR = 1,
  BE_SQLITE_ERROR_AlreadyOpen = 33554442,
  BE_SQLITE_ERROR_BadDbProfile = 100663306,
  BE_SQLITE_ERROR_ChangeTrackError = 218103818,
  BE_SQLITE_ERROR_CouldNotAcquireLocksOrCodes = 352321546,
  BE_SQLITE_ERROR_FileExists = 16777226,
  BE_SQLITE_ERROR_FileNotFound = 67108874,
  BE_SQLITE_ERROR_InvalidChangeSetVersion = 234881034,
  BE_SQLITE_ERROR_InvalidProfileVersion = 117440522,
  BE_SQLITE_ERROR_NoPropertyTable = 50331658,
  BE_SQLITE_ERROR_NoTxnActive = 83886090,
  BE_SQLITE_ERROR_ProfileTooNew = 201326602,
  BE_SQLITE_ERROR_ProfileTooNewForReadWrite = 184549386,
  BE_SQLITE_ERROR_ProfileTooOld = 167772170,
  BE_SQLITE_ERROR_ProfileTooOldForReadWrite = 150994954,
  BE_SQLITE_ERROR_ProfileUpgradeFailed = 134217738,
  BE_SQLITE_ERROR_SchemaImportFailed = 335544330,
  BE_SQLITE_ERROR_SchemaLockFailed = 301989898,
  BE_SQLITE_ERROR_SchemaTooNew = 268435466,
  BE_SQLITE_ERROR_SchemaTooOld = 285212682,
  BE_SQLITE_ERROR_SchemaUpgradeFailed = 318767114,
  BE_SQLITE_ERROR_SchemaUpgradeRequired = 251658250,
  BE_SQLITE_FORMAT = 24,
  BE_SQLITE_FULL = 13,
  BE_SQLITE_INTERNAL = 2,
  BE_SQLITE_INTERRUPT = 9,
  BE_SQLITE_IOERR = 10,
  // (undocumented)
  BE_SQLITE_IOERR_ACCESS = 3338,
  // (undocumented)
  BE_SQLITE_IOERR_BLOCKED = 2826,
  // (undocumented)
  BE_SQLITE_IOERR_CHECKRESERVEDLOCK = 3594,
  // (undocumented)
  BE_SQLITE_IOERR_CLOSE = 4106,
  // (undocumented)
  BE_SQLITE_IOERR_DELETE = 2570,
  // (undocumented)
  BE_SQLITE_IOERR_DELETE_NOENT = 5898,
  // (undocumented)
  BE_SQLITE_IOERR_DIR_CLOSE = 4362,
  // (undocumented)
  BE_SQLITE_IOERR_DIR_FSYNC = 1290,
  // (undocumented)
  BE_SQLITE_IOERR_FSTAT = 1802,
  // (undocumented)
  BE_SQLITE_IOERR_FSYNC = 1034,
  // (undocumented)
  BE_SQLITE_IOERR_LOCK = 3850,
  // (undocumented)
  BE_SQLITE_IOERR_NOMEM = 3082,
  // (undocumented)
  BE_SQLITE_IOERR_RDLOCK = 2314,
  // (undocumented)
  BE_SQLITE_IOERR_READ = 266,
  // (undocumented)
  BE_SQLITE_IOERR_SEEK = 5642,
  // (undocumented)
  BE_SQLITE_IOERR_SHMLOCK = 5130,
  // (undocumented)
  BE_SQLITE_IOERR_SHMMAP = 5386,
  // (undocumented)
  BE_SQLITE_IOERR_SHMOPEN = 4618,
  // (undocumented)
  BE_SQLITE_IOERR_SHMSIZE = 4874,
  // (undocumented)
  BE_SQLITE_IOERR_SHORT_READ = 522,
  // (undocumented)
  BE_SQLITE_IOERR_TRUNCATE = 1546,
  // (undocumented)
  BE_SQLITE_IOERR_UNLOCK = 2058,
  // (undocumented)
  BE_SQLITE_IOERR_WRITE = 778,
  BE_SQLITE_LOCKED = 6,
  // (undocumented)
  BE_SQLITE_LOCKED_SHAREDCACHE = 262,
  BE_SQLITE_MISMATCH = 20,
  BE_SQLITE_MISUSE = 21,
  BE_SQLITE_NOLFS = 22,
  BE_SQLITE_NOMEM = 7,
  BE_SQLITE_NOTADB = 26,
  BE_SQLITE_NOTFOUND = 12,
  // (undocumented)
  BE_SQLITE_OK = 0,
  BE_SQLITE_PERM = 3,
  BE_SQLITE_PROTOCOL = 15,
  BE_SQLITE_RANGE = 25,
  BE_SQLITE_READONLY = 8,
  // (undocumented)
  BE_SQLITE_READONLY_CANTLOCK = 520,
  // (undocumented)
  BE_SQLITE_READONLY_RECOVERY = 264,
  // (undocumented)
  BE_SQLITE_READONLY_ROLLBACK = 776,
  BE_SQLITE_ROW = 100,
  BE_SQLITE_SCHEMA = 17,
  BE_SQLITE_TOOBIG = 18
}

// @beta
class DecorationGeometryProps {
  constructor(id: Id64String, geometryStream: GeometryStreamProps);
  // (undocumented)
  readonly geometryStream: GeometryStreamProps;
  // (undocumented)
  readonly id: Id64String;
}

// @public
interface DefinitionElementProps extends ElementProps {
  // (undocumented)
  isPrivate?: boolean;
}

// @beta
interface DisplayStyle3dProps extends DisplayStyleProps {
  jsonProperties?: {
    styles?: DisplayStyle3dSettingsProps;
  }
}

// @beta
class DisplayStyle3dSettings extends DisplayStyleSettings {
  constructor(jsonProperties: {
          styles?: DisplayStyle3dSettingsProps;
      });
  // WARNING: The type "AmbientOcclusion.Settings" needs to be exported by the package (e.g. added to index.ts)
  ambientOcclusionSettings: AmbientOcclusion.Settings;
  // (undocumented)
  environment: EnvironmentProps;
  // WARNING: The type "HiddenLine.Settings" needs to be exported by the package (e.g. added to index.ts)
  hiddenLineSettings: HiddenLine.Settings;
  // (undocumented)
  toJSON(): DisplayStyle3dSettingsProps;
}

// @beta
interface DisplayStyle3dSettingsProps extends DisplayStyleSettingsProps {
  ao?: AmbientOcclusion.Props;
  environment?: EnvironmentProps;
  hline?: HiddenLine.SettingsProps;
}

// @beta
interface DisplayStyleProps extends DefinitionElementProps {
  jsonProperties?: {
    styles?: DisplayStyleSettingsProps;
  }
}

// @beta
class DisplayStyleSettings {
  constructor(jsonProperties: {
          styles?: DisplayStyleSettingsProps;
      });
  // (undocumented)
  protected readonly _json: DisplayStyleSettingsProps;
  backgroundColor: ColorDef;
  // (undocumented)
  backgroundMap: BackgroundMapProps | undefined;
  dropSubCategoryOverride(id: Id64String): void;
  getSubCategoryOverride(id: Id64String): SubCategoryOverride | undefined;
  readonly hasSubCategoryOverride: boolean;
  monochromeColor: ColorDef;
  overrideSubCategory(id: Id64String, ovr: SubCategoryOverride): void;
  // (undocumented)
  toJSON(): DisplayStyleSettingsProps;
  viewFlags: ViewFlags;
}

// @beta
interface DisplayStyleSettingsProps {
  analysisStyle?: AnalysisStyleProps;
  backgroundColor?: ColorDefProps;
  backgroundMap?: BackgroundMapProps;
  ContextRealityModels?: ContextRealityModelProps[];
  monochromeColor?: ColorDefProps;
  scheduleScript?: RenderSchedule.ElementTimelineProps[];
  subCategoryOvr?: DisplayStyleSubCategoryProps[];
  // (undocumented)
  viewflags?: ViewFlagProps;
}

// @public
interface DisplayStyleSubCategoryProps extends SubCategoryAppearance.Props {
  subCategory?: Id64String;
}

// @public
class EcefLocation implements EcefLocationProps {
  constructor(props: EcefLocationProps);
  static createFromCartographicOrigin(origin: Cartographic): EcefLocation;
  getTransform(): Transform;
  readonly orientation: YawPitchRollAngles;
  readonly origin: Point3d;
}

// @public
interface EcefLocationProps {
  orientation: YawPitchRollProps;
  origin: XYZProps;
}

// @public
class ECJsNames {
  static systemPropertyToJsName(systemPropertyType: ECSqlSystemProperty): string;
  static toJsName(propName: string, isSystemProperty?: boolean): string;
}

// @public
enum ECSqlSystemProperty {
  // (undocumented)
  ECClassId = 1,
  // (undocumented)
  ECInstanceId = 0,
  // (undocumented)
  NavigationId = 6,
  // (undocumented)
  NavigationRelClassId = 7,
  // (undocumented)
  PointX = 8,
  // (undocumented)
  PointY = 9,
  // (undocumented)
  PointZ = 10,
  // (undocumented)
  SourceECClassId = 3,
  // (undocumented)
  SourceECInstanceId = 2,
  // (undocumented)
  TargetECClassId = 5,
  // (undocumented)
  TargetECInstanceId = 4
}

// @public
enum ECSqlValueType {
  // (undocumented)
  Blob = 1,
  // (undocumented)
  Boolean = 2,
  // (undocumented)
  DateTime = 3,
  // (undocumented)
  Double = 4,
  // (undocumented)
  Geometry = 5,
  // (undocumented)
  Guid = 16,
  // (undocumented)
  Id = 6,
  // (undocumented)
  Int = 7,
  // (undocumented)
  Int64 = 8,
  // (undocumented)
  Navigation = 12,
  // (undocumented)
  Point2d = 9,
  // (undocumented)
  Point3d = 10,
  // (undocumented)
  PrimitiveArray = 14,
  // (undocumented)
  String = 11,
  // (undocumented)
  Struct = 13,
  // (undocumented)
  StructArray = 15
}

// @public (undocumented)
class EdgeArgs {
  // (undocumented)
  clear(): void;
  // (undocumented)
  edges?: MeshEdge[];
  // (undocumented)
  init(meshEdges?: MeshEdges): boolean;
  // (undocumented)
  readonly isValid: boolean;
  // (undocumented)
  readonly numEdges: number;
}

// @public
class ElectronRpcConfiguration extends RpcConfiguration {
  // (undocumented)
  static readonly isElectron: boolean;
  // WARNING: The type "ElectronRpcProtocol" needs to be exported by the package (e.g. added to index.ts)
  protocol: ElectronRpcProtocol;
}

// @public
class ElectronRpcManager extends RpcManager {
  static initializeClient(params: ElectronRpcParams, interfaces: RpcInterfaceDefinition[]): ElectronRpcConfiguration;
  static initializeImpl(params: ElectronRpcParams, interfaces: RpcInterfaceDefinition[]): ElectronRpcConfiguration;
}

// @public
interface ElectronRpcParams {
  // (undocumented)
  protocol?: typeof ElectronRpcProtocol;
}

// @public
interface ElementAspectProps extends EntityProps {
  // (undocumented)
  element: RelatedElementProps;
}

// @public
interface ElementLoadProps {
  // (undocumented)
  code?: CodeProps;
  // (undocumented)
  federationGuid?: GuidString;
  // (undocumented)
  id?: Id64String;
  wantBRepData?: boolean;
  wantGeometry?: boolean;
}

// @public
interface ElementProps extends EntityProps {
  code: CodeProps;
  federationGuid?: GuidString;
  jsonProperties?: any;
  model: Id64String;
  parent?: RelatedElementProps;
  userLabel?: string;
}

// @beta
class EntityMetaData implements EntityMetaDataProps {
  constructor(jsonObj: EntityMetaDataProps);
  readonly baseClasses: string[];
  readonly customAttributes?: CustomAttribute[];
  // (undocumented)
  readonly description?: string;
  // (undocumented)
  readonly displayLabel?: string;
  readonly ecclass: string;
  // (undocumented)
  readonly modifier?: string;
  readonly properties: {
    [propName: string]: PropertyMetaData;
  }
}

// @beta (undocumented)
interface EntityMetaDataProps {
  baseClasses: string[];
  customAttributes?: CustomAttribute[];
  // (undocumented)
  description?: string;
  // (undocumented)
  displayLabel?: string;
  // (undocumented)
  ecclass: string;
  // (undocumented)
  modifier?: string;
  properties: {
    [propName: string]: PropertyMetaData;
  }
}

// @public
interface EntityProps {
  // (undocumented)
  [propName: string]: any;
  classFullName: string;
  id?: Id64String;
}

// @alpha
interface EntityQueryParams {
  from?: string;
  limit?: number;
  offset?: number;
  only?: boolean;
  orderBy?: string;
  where?: string;
}

// @public
interface EnvironmentProps {
  // (undocumented)
  ground?: GroundPlaneProps;
  // (undocumented)
  sky?: SkyBoxProps;
}

// @beta
class Feature {
  constructor(elementId?: Id64String, subCategoryId?: Id64String, geometryClass?: GeometryClass);
  // (undocumented)
  compare(rhs: Feature): number;
  // (undocumented)
  readonly elementId: string;
  // (undocumented)
  equals(other: Feature): boolean;
  // (undocumented)
  readonly geometryClass: GeometryClass;
  // (undocumented)
  readonly isDefined: boolean;
  // (undocumented)
  readonly isUndefined: boolean;
  // (undocumented)
  readonly subCategoryId: string;
}

// @public
class FeatureGates {
  addMonitor(feature: string, monitor: (val: GateValue) => void): () => void;
  check(feature: string, defaultVal?: GateValue): GateValue;
  readonly gates: Map<string, GateValue>;
  onChanged: BeEvent<(feature: string, val: GateValue) => void>;
  setGate(feature: string, val: GateValue): void;
}

// @public (undocumented)
class FeatureIndex {
  constructor();
  // (undocumented)
  featureID: number;
  // (undocumented)
  featureIDs?: Uint32Array;
  // (undocumented)
  readonly isEmpty: boolean;
  // (undocumented)
  readonly isUniform: boolean;
  // (undocumented)
  reset(): void;
  // (undocumented)
  type: FeatureIndexType;
}

// @public (undocumented)
enum FeatureIndexType {
  // (undocumented)
  Empty = 0,
  // (undocumented)
  NonUniform = 2,
  // (undocumented)
  Uniform = 1
}

// @beta
class FeatureTable extends IndexMap<Feature> {
  constructor(maxFeatures: number, modelId?: Id64String, type?: BatchType);
  // (undocumented)
  readonly anyDefined: boolean;
  findFeature(index: number): Feature | undefined;
  // (undocumented)
  getArray(): Array<IndexedValue<Feature>>;
  // (undocumented)
  insertWithIndex(feature: Feature, index: number): void;
  readonly isClassifier: boolean;
  readonly isUniform: boolean;
  readonly maxFeatures: number;
  // (undocumented)
  readonly modelId: Id64String;
  // (undocumented)
  readonly type: BatchType;
  readonly uniform: Feature | undefined;
}

// @public (undocumented)
interface FilePropertyProps {
  // (undocumented)
  id?: number | string;
  // (undocumented)
  name: string;
  // (undocumented)
  namespace: string;
  // (undocumented)
  subId?: number | string;
}

// @public
enum FillDisplay {
  Always = 2,
  Blanking = 3,
  ByView = 1,
  Never = 0
}

// @public
enum FillFlags {
  Always = 2,
  Background = 8,
  Behind = 4,
  Blanking = 6,
  ByView = 1,
  // (undocumented)
  None = 0
}

// @public
class FontMap {
  constructor(props: FontMapProps);
  // (undocumented)
  readonly fonts: Map<number, FontProps>;
  getFont(arg: string | number): FontProps | undefined;
  // (undocumented)
  toJSON(): FontMapProps;
}

// @public
interface FontMapProps {
  // (undocumented)
  fonts: FontProps[];
}

// @public
interface FontProps {
  // (undocumented)
  id: number;
  // (undocumented)
  name: string;
  // (undocumented)
  type: FontType;
}

// @public
enum FontType {
  // (undocumented)
  Rsc = 2,
  // (undocumented)
  Shx = 3,
  // (undocumented)
  TrueType = 1
}

// @public (undocumented)
interface FormDataCommon {
  // (undocumented)
  append(name: string, value: string | Blob | Buffer, fileName?: string): void;
}

// @public
class Frustum {
  constructor();
  clone(result?: Frustum): Frustum;
  distance(corner1: number, corner2: number): number;
  equals(rhs: Frustum): boolean;
  fixPointOrder(): void;
  static fromRange(range: LowAndHighXYZ | LowAndHighXY, out?: Frustum): Frustum;
  getCenter(): Point3d;
  getCorner(i: number): Point3d;
  getFraction(): number;
  getRangePlanes(clipFront: boolean, clipBack: boolean, expandPlaneDistance: number): ConvexClipPlaneSet;
  readonly hasMirror: boolean;
  initFromRange(range: LowAndHighXYZ | LowAndHighXY): void;
  initNpc(): this;
  invalidate(): void;
  isSame(other: Frustum): boolean;
  multiply(trans: Transform): void;
  readonly points: Point3d[];
  scaleAboutCenter(scale: number): void;
  setFrom(other: Frustum): void;
  toMap4d(): Map4d | undefined;
  toRange(range?: Range3d): Range3d;
  transformBy(trans: Transform, result?: Frustum): Frustum;
  translate(offset: Vector3d): void;
}

// @public (undocumented)
class FrustumPlanes {
}

// @public (undocumented)
interface FunctionalElementProps extends ElementProps {
  // (undocumented)
  typeDefinition?: RelatedElementProps;
}

// @beta
interface GeoCoordinatesRequestProps {
  // (undocumented)
  iModelCoords: XYZProps[];
  // (undocumented)
  targetDatum: string;
}

// @beta
interface GeoCoordinatesResponseProps {
  // (undocumented)
  fromCache: number;
  // (undocumented)
  geoCoords: PointWithStatus[];
}

// @public (undocumented)
enum GeoCoordStatus {
  // (undocumented)
  CSMapError = 4096,
  // (undocumented)
  NoDatumConverter = 25,
  // (undocumented)
  NoGCSDefined = 100,
  // (undocumented)
  OutOfMathematicalDomain = 2,
  // (undocumented)
  OutOfUsefulRange = 1,
  // (undocumented)
  Pending = -41556,
  // (undocumented)
  Success = 0,
  // (undocumented)
  VerticalDatumConvertError = 26
}

// @public
interface GeometricElement2dProps extends GeometricElementProps {
  // (undocumented)
  placement?: Placement2dProps;
  // (undocumented)
  typeDefinition?: RelatedElementProps;
}

// @public
interface GeometricElement3dProps extends GeometricElementProps {
  // (undocumented)
  placement?: Placement3dProps;
  // (undocumented)
  typeDefinition?: RelatedElementProps;
}

// @public
interface GeometricElementProps extends ElementProps {
  category: Id64String;
  // (undocumented)
  geom?: GeometryStreamProps;
}

// @public
interface GeometricModel2dProps extends ModelProps {
  // (undocumented)
  globalOrigin?: XYProps;
}

// @public
interface GeometryAppearanceProps {
  color?: ColorDefProps;
  displayPriority?: number;
  geometryClass?: GeometryClass;
  style?: Id64String;
  subCategory?: Id64String;
  transparency?: number;
  weight?: number;
}

// @alpha
enum GeometryClass {
  Construction = 1,
  Dimension = 2,
  Pattern = 3,
  Primary = 0
}

// @public
class GeometryParams {
  constructor(categoryId: Id64String, subCategoryId?: string);
  backgroundFill?: BackgroundFill;
  // (undocumented)
  categoryId: Id64String;
  // (undocumented)
  clone(): GeometryParams;
  elmPriority?: number;
  elmTransparency?: number;
  fillColor?: ColorDef;
  fillDisplay?: FillDisplay;
  fillTransparency?: number;
  geometryClass?: GeometryClass;
  // WARNING: The type "Gradient.Symb" needs to be exported by the package (e.g. added to index.ts)
  gradient?: Gradient.Symb;
  isEquivalent(other: GeometryParams): boolean;
  lineColor?: ColorDef;
  materialId?: Id64String;
  // WARNING: The type "AreaPattern.Params" needs to be exported by the package (e.g. added to index.ts)
  pattern?: AreaPattern.Params;
  resetAppearance(): void;
  setCategoryId(categoryId: Id64String, clearAppearanceOverrides?: boolean): void;
  setSubCategoryId(subCategoryId: Id64String, clearAppearanceOverrides?: boolean): void;
  // WARNING: The type "LineStyle.Info" needs to be exported by the package (e.g. added to index.ts)
  styleInfo?: LineStyle.Info;
  // (undocumented)
  subCategoryId: string;
  weight?: number;
}

// @public
interface GeometryPartInstanceProps {
  origin?: XYZProps;
  part: Id64String;
  rotation?: YawPitchRollProps;
  scale?: number;
}

// @public
interface GeometryPartProps extends ElementProps {
  // (undocumented)
  bbox?: LowAndHighXYZ;
  // (undocumented)
  geom?: GeometryStreamProps;
}

// @public
class GeometryStreamBuilder {
  // WARNING: The type "BRepEntity.DataProps" needs to be exported by the package (e.g. added to index.ts)
  appendBRepData(brep: BRepEntity.DataProps): boolean;
  appendGeometry(geometry: GeometryQuery): boolean;
  appendGeometryParamsChange(geomParams: GeometryParams): boolean;
  appendGeometryPart2d(partId: Id64String, instanceOrigin?: Point2d, instanceRotation?: Angle, instanceScale?: number): boolean;
  appendGeometryPart3d(partId: Id64String, instanceOrigin?: Point3d, instanceRotation?: YawPitchRollAngles, instanceScale?: number): boolean;
  appendGeometryRanges(): void;
  appendSubCategoryChange(subCategoryId: Id64String): boolean;
  appendTextString(textString: TextString): boolean;
  readonly geometryStream: GeometryStreamProps;
  setLocalToWorld(localToWorld?: Transform): void;
  setLocalToWorld2d(origin: Point2d, angle?: Angle): void;
  setLocalToWorld3d(origin: Point3d, angles?: YawPitchRollAngles): void;
}

// @public
interface GeometryStreamEntryProps extends GeomJson.GeometryProps {
  // (undocumented)
  appearance?: GeometryAppearanceProps;
  // (undocumented)
  brep?: BRepEntity.DataProps;
  // (undocumented)
  fill?: AreaFillProps;
  // (undocumented)
  geomPart?: GeometryPartInstanceProps;
  // (undocumented)
  material?: MaterialProps;
  // (undocumented)
  pattern?: AreaPattern.ParamsProps;
  // (undocumented)
  styleMod?: LineStyle.ModifierProps;
  // (undocumented)
  subRange?: LowAndHighXYZ;
  // (undocumented)
  textString?: TextStringProps;
}

// @public
class GeometryStreamIterator implements IterableIterator<GeometryStreamIteratorEntry> {
  // WARNING: The name "__@iterator" contains unsupported characters; API names should use only letters, numbers, and underscores
  // (undocumented)
  [Symbol.iterator](): IterableIterator<GeometryStreamIteratorEntry>;
  constructor(geometryStream: GeometryStreamProps, category?: Id64String);
  entry: GeometryStreamIteratorEntry;
  static fromGeometricElement2d(element: GeometricElement2dProps): GeometryStreamIterator;
  static fromGeometricElement3d(element: GeometricElement3dProps): GeometryStreamIterator;
  static fromGeometryPart(geomPart: GeometryPartProps, geomParams?: GeometryParams, partTransform?: Transform): GeometryStreamIterator;
  geometryStream: GeometryStreamProps;
  next(): IteratorResult<GeometryStreamIteratorEntry>;
  partToWorld(): Transform | undefined;
  setLocalToWorld(localToWorld?: Transform): void;
  setLocalToWorld2d(origin: Point2d, angle?: Angle): void;
  setLocalToWorld3d(origin: Point3d, angles?: YawPitchRollAngles): void;
}

// @public
class GeometryStreamIteratorEntry {
  constructor(category?: Id64String);
  // WARNING: The type "BRepEntity.DataProps" needs to be exported by the package (e.g. added to index.ts)
  brep?: BRepEntity.DataProps;
  geometryQuery?: GeometryQuery;
  geomParams: GeometryParams;
  localRange?: Range3d;
  localToWorld?: Transform;
  partId?: Id64String;
  partToLocal?: Transform;
  textString?: TextString;
}

// @beta (undocumented)
module Gradient {
  enum Flags {
    Invert = 1,
    // (undocumented)
    None = 0,
    Outline = 2
  }

  class KeyColor implements KeyColorProps {
    // WARNING: The type "KeyColorProps" needs to be exported by the package (e.g. added to index.ts)
    constructor(json: KeyColorProps);
    // (undocumented)
    color: ColorDef;
    // (undocumented)
    value: number;
  }

  interface KeyColorProps {
    color: ColorDefProps;
    value: number;
  }

  enum Mode {
    // (undocumented)
    Curved = 2,
    // (undocumented)
    Cylindrical = 3,
    // (undocumented)
    Hemispherical = 5,
    // (undocumented)
    Linear = 1,
    // (undocumented)
    None = 0,
    // (undocumented)
    Spherical = 4,
    // (undocumented)
    Thematic = 6
  }

  class Symb implements SymbProps {
    // (undocumented)
    angle?: Angle;
    // WARNING: The type "Symb" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    clone(): Symb;
    // WARNING: The type "Symb" needs to be exported by the package (e.g. added to index.ts)
    compare(other: Symb): number;
    // WARNING: The type "Gradient.Symb" needs to be exported by the package (e.g. added to index.ts)
    // WARNING: The type "Gradient.Symb" needs to be exported by the package (e.g. added to index.ts)
    static compareSymb(lhs: Gradient.Symb, rhs: Gradient.Symb): number;
    // WARNING: The type "ThematicSettings" needs to be exported by the package (e.g. added to index.ts)
    // WARNING: The type "Symb" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    static createThematic(settings: ThematicSettings): Symb;
    // WARNING: The type "Symb" needs to be exported by the package (e.g. added to index.ts)
    equals(other: Symb): boolean;
    // WARNING: The type "Flags" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    flags: Flags;
    // WARNING: The type "SymbProps" needs to be exported by the package (e.g. added to index.ts)
    // WARNING: The type "Symb" needs to be exported by the package (e.g. added to index.ts)
    static fromJSON(json?: SymbProps): Symb;
    getImage(width: number, height: number): ImageBuffer;
    // (undocumented)
    readonly hasTranslucency: boolean;
    readonly isOutlined: boolean;
    // WARNING: The type "KeyColor" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    keys: KeyColor[];
    // WARNING: The type "Mode" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    mode: Mode;
    // (undocumented)
    shift: number;
    // WARNING: The type "ThematicSettings" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    thematicSettings?: ThematicSettings;
    // (undocumented)
    tint?: number;
  }

  interface SymbProps {
    angle?: AngleProps;
    flags?: Flags;
    keys: KeyColorProps[];
    mode: Mode;
    shift?: number;
    thematicSettings?: ThematicSettingsProps;
    tint?: number;
  }

  // (undocumented)
  enum ThematicColorScheme {
    // (undocumented)
    BlueRed = 0,
    // (undocumented)
    Custom = 5,
    // (undocumented)
    Monochrome = 2,
    // (undocumented)
    RedBlue = 1,
    // (undocumented)
    SeaMountain = 4,
    // (undocumented)
    Topographic = 3
  }

  // (undocumented)
  enum ThematicMode {
    // (undocumented)
    IsoLines = 3,
    // (undocumented)
    Smooth = 0,
    // (undocumented)
    Stepped = 1,
    // (undocumented)
    SteppedWithDelimiter = 2
  }

  class ThematicSettings implements ThematicSettingsProps {
    // WARNING: The type "ThematicSettings" needs to be exported by the package (e.g. added to index.ts)
    // WARNING: The type "ThematicSettings" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    clone(out?: ThematicSettings): ThematicSettings;
    // (undocumented)
    colorScheme: number;
    // (undocumented)
    static readonly contentMax: number;
    // (undocumented)
    static readonly contentRange: number;
    // WARNING: The type "ThematicSettingsProps" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    copyFrom(other: ThematicSettingsProps): void;
    // WARNING: The type "ThematicSettings" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    static defaults: ThematicSettings;
    // WARNING: The type "ThematicSettingsProps" needs to be exported by the package (e.g. added to index.ts)
    // WARNING: The type "ThematicSettings" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    static fromJSON(json: ThematicSettingsProps): ThematicSettings;
    // (undocumented)
    static readonly margin: number;
    // (undocumented)
    marginColor: ColorDef;
    // WARNING: The type "ThematicMode" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    mode: ThematicMode;
    // (undocumented)
    range: Range1d;
    // (undocumented)
    rangeHigh: number;
    // (undocumented)
    rangeLow: number;
    // (undocumented)
    stepCount: number;
  }

  // (undocumented)
  interface ThematicSettingsProps {
    // (undocumented)
    colorScheme: number;
    // (undocumented)
    marginColor: ColorDefProps;
    // (undocumented)
    mode: ThematicMode;
    // (undocumented)
    rangeHigh: number;
    // (undocumented)
    rangeLow: number;
    // (undocumented)
    stepCount: number;
  }

}

// @beta
class GraphicParams {
  // (undocumented)
  readonly fillColor: ColorDef;
  // (undocumented)
  fillFlags: FillFlags;
  // (undocumented)
  static fromBlankingFill(fillColor: ColorDef): GraphicParams;
  // (undocumented)
  static fromSymbology(lineColor: ColorDef, fillColor: ColorDef, lineWidth: number, linePixels?: LinePixels): GraphicParams;
  // WARNING: The type "Gradient.Symb" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  gradient?: Gradient.Symb;
  // (undocumented)
  readonly lineColor: ColorDef;
  // (undocumented)
  linePixels: LinePixels;
  // (undocumented)
  lineTexture?: RenderTexture;
  // (undocumented)
  material?: RenderMaterial;
  // (undocumented)
  rasterWidth: number;
  setFillColor(fillColor: ColorDef): void;
  // (undocumented)
  setFillTransparency(transparency: number): void;
  setLineColor(lineColor: ColorDef): void;
  setLinePixels(code: LinePixels): void;
  // (undocumented)
  setLineTransparency(transparency: number): void;
  // (undocumented)
  trueWidthEnd: number;
  // (undocumented)
  trueWidthStart: number;
}

// @public
class GroundPlane implements GroundPlaneProps {
  constructor(ground?: GroundPlaneProps);
  aboveColor: ColorDef;
  belowColor: ColorDef;
  display: boolean;
  elevation: number;
  // WARNING: The type "Gradient.Symb" needs to be exported by the package (e.g. added to index.ts)
  getGroundPlaneGradient(aboveGround: boolean): Gradient.Symb;
  // (undocumented)
  toJSON(): GroundPlaneProps;
}

// @public
interface GroundPlaneProps {
  aboveColor?: ColorDefProps;
  belowColor?: ColorDefProps;
  display?: boolean;
  elevation?: number;
}

// @beta
module HiddenLine {
  class Settings {
    // WARNING: The type "Settings" needs to be exported by the package (e.g. added to index.ts)
    static defaults: Settings;
    // WARNING: The type "SettingsProps" needs to be exported by the package (e.g. added to index.ts)
    // WARNING: The type "Settings" needs to be exported by the package (e.g. added to index.ts)
    static fromJSON(json?: SettingsProps): Settings;
    // WARNING: The type "Style" needs to be exported by the package (e.g. added to index.ts)
    readonly hidden: Style;
    // WARNING: The type "SettingsProps" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    toJSON(): SettingsProps;
    readonly transparencyThreshold: number;
    // (undocumented)
    readonly transThreshold: number;
    // WARNING: The type "Style" needs to be exported by the package (e.g. added to index.ts)
    readonly visible: Style;
  }

  interface SettingsProps {
    readonly hidden?: StyleProps;
    readonly transThreshold?: number;
    readonly visible?: StyleProps;
  }

  class Style implements StyleProps {
    readonly color?: ColorDef;
    // WARNING: The type "Style" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    static defaults: Style;
    // WARNING: The type "Style" needs to be exported by the package (e.g. added to index.ts)
    equals(other: Style): boolean;
    // WARNING: The type "StyleProps" needs to be exported by the package (e.g. added to index.ts)
    // WARNING: The type "Style" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    static fromJSON(json?: StyleProps): Style;
    // WARNING: The type "Style" needs to be exported by the package (e.g. added to index.ts)
    overrideColor(color: ColorDef): Style;
    // (undocumented)
    readonly ovrColor: boolean;
    readonly pattern?: LinePixels;
    // WARNING: The type "StyleProps" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    toJSON(): StyleProps;
    readonly width?: number;
  }

  interface StyleProps {
    readonly color?: ColorDefProps;
    readonly ovrColor?: boolean;
    readonly pattern?: LinePixels;
    readonly width?: number;
  }

}

// @public
module Hilite {
  class Settings {
    // WARNING: The type "Silhouette" needs to be exported by the package (e.g. added to index.ts)
    constructor(color?: ColorDef, visibleRatio?: number, hiddenRatio?: number, silhouette?: Silhouette);
    readonly color: ColorDef;
    readonly hiddenRatio: number;
    // WARNING: The type "Silhouette" needs to be exported by the package (e.g. added to index.ts)
    silhouette: Silhouette;
    readonly visibleRatio: number;
  }

  enum Silhouette {
    None = 0,
    Thick = 2,
    Thin = 1
  }

}

// @public
class HSLColor {
  // (undocumented)
  clone(): HSLColor;
  // (undocumented)
  static fromColorDef(val: ColorDef, out?: HSLColor): HSLColor;
  // (undocumented)
  h: number;
  // (undocumented)
  l: number;
  // (undocumented)
  s: number;
  // (undocumented)
  toColorDef(out?: ColorDef): ColorDef;
}

// @public
class HSVColor {
  // (undocumented)
  adjustColor(darkenColor: boolean, delta: number): void;
  // (undocumented)
  clone(): HSVColor;
  // (undocumented)
  static fromColorDef(val: ColorDef, out?: HSVColor): HSVColor;
  // (undocumented)
  h: number;
  // (undocumented)
  s: number;
  // (undocumented)
  toColorDef(out?: ColorDef): ColorDef;
  // (undocumented)
  v: number;
}

// @public
interface HttpServerRequest extends Readable {
  // (undocumented)
  body: string | Buffer;
  // (undocumented)
  connection: any;
  // (undocumented)
  destroy(error?: Error): void;
  // (undocumented)
  header: (field: string) => string | undefined;
  // (undocumented)
  headers: {
    [header: string]: string | string[] | undefined;
  }
  // (undocumented)
  httpVersion: string;
  // (undocumented)
  httpVersionMajor: number;
  // (undocumented)
  httpVersionMinor: number;
  // (undocumented)
  method: string;
  // (undocumented)
  path: string;
  // (undocumented)
  rawHeaders: string[];
  // (undocumented)
  rawTrailers: string[];
  // (undocumented)
  setTimeout(msecs: number, callback: () => void): this;
  // (undocumented)
  socket: any;
  // (undocumented)
  statusCode?: number;
  // (undocumented)
  statusMessage?: string;
  // (undocumented)
  trailers: {
    [key: string]: string | undefined;
  }
  // (undocumented)
  url?: string;
}

// @public
interface HttpServerResponse extends Writable {
  // (undocumented)
  send(body?: any): HttpServerResponse;
  // (undocumented)
  set(field: string, value: string): void;
  // (undocumented)
  status(code: number): HttpServerResponse;
}

// @public
class ImageBuffer {
  protected constructor(data: Uint8Array, format: ImageBufferFormat, width: number);
  // (undocumented)
  protected static computeHeight(data: Uint8Array, format: ImageBufferFormat, width: number): number;
  static create(data: Uint8Array, format: ImageBufferFormat, width: number): ImageBuffer | undefined;
  readonly data: Uint8Array;
  readonly format: ImageBufferFormat;
  static getNumBytesPerPixel(format: ImageBufferFormat): number;
  readonly height: number;
  // (undocumented)
  protected static isValidData(data: Uint8Array, format: ImageBufferFormat, width: number): boolean;
  readonly numBytesPerPixel: number;
  readonly width: number;
}

// @public
enum ImageBufferFormat {
  Alpha = 5,
  Rgb = 2,
  Rgba = 0
}

// @public (undocumented)
module ImageLight {
  // (undocumented)
  class Solar {
    constructor(direction?: Vector3d, color?: ColorDef, intensity?: number);
    // (undocumented)
    color: ColorDef;
    // (undocumented)
    direction: Vector3d;
    // (undocumented)
    intensity: number;
  }

}

// @public
class ImageSource {
  constructor(data: Uint8Array, format: ImageSourceFormat);
  readonly data: Uint8Array;
  readonly format: ImageSourceFormat;
}

// @public
enum ImageSourceFormat {
  Jpeg = 0,
  Png = 2
}

// @public
class IModel implements IModelProps {
  protected constructor(iModelToken: IModelToken);
  // (undocumented)
  protected _token: IModelToken;
  cartographicToSpatialFromEcef(cartographic: Cartographic, result?: Point3d): Point3d;
  static readonly dictionaryId: Id64String;
  readonly ecefLocation: EcefLocation | undefined;
  ecefToSpatial(ecef: XYAndZ, result?: Point3d): Point3d;
  static getDefaultSubCategoryId(categoryId: Id64String): Id64String;
  getEcefTransform(): Transform;
  readonly globalOrigin: Point3d;
  readonly iModelToken: IModelToken;
  // (undocumented)
  protected initialize(name: string, props: IModelProps): void;
  readonly isGeoLocated: boolean;
  name: string;
  projectExtents: AxisAlignedBox3d;
  static readonly repositoryModelId: Id64String;
  rootSubject: RootSubjectProps;
  static readonly rootSubjectId: Id64String;
  setEcefLocation(ecef: EcefLocationProps): void;
  spatialToCartographicFromEcef(spatial: XYAndZ, result?: Cartographic): Cartographic;
  spatialToEcef(spatial: XYAndZ, result?: Point3d): Point3d;
  // (undocumented)
  toJSON(): IModelProps;
}

// @beta
interface IModelCoordinatesRequestProps {
  // (undocumented)
  geoCoords: XYZProps[];
  // (undocumented)
  sourceDatum: string;
}

// @beta (undocumented)
interface IModelCoordinatesResponseProps {
  // (undocumented)
  fromCache: number;
  // (undocumented)
  iModelCoords: PointWithStatus[];
}

// @public
class IModelError extends BentleyError {
  constructor(errorNumber: number | IModelStatus | DbResult | BentleyStatus | BriefcaseStatus | RepositoryStatus | ChangeSetStatus | RpcInterfaceStatus | AuthStatus, message: string, log?: LogFunction, category?: string, getMetaData?: GetMetaDataFunction);
}

// @public
class IModelNotFoundResponse extends RpcNotFoundResponse {
}

// @public
interface IModelProps {
  ecefLocation?: EcefLocationProps;
  globalOrigin?: XYZProps;
  projectExtents?: Range3dProps;
  rootSubject: RootSubjectProps;
}

// @public
class IModelReadRpcInterface extends RpcInterface {
  // (undocumented)
  cancelSnap(_iModelToken: IModelToken, _sessionId: string): Promise<void>;
  // (undocumented)
  close(_accessToken: AccessToken, _iModelToken: IModelToken): Promise<boolean>;
  // (undocumented)
  getAllCodeSpecs(_iModelToken: IModelToken): Promise<any[]>;
  // (undocumented)
  getClassHierarchy(_iModelToken: IModelToken, _startClassName: string): Promise<string[]>;
  static getClient(): IModelReadRpcInterface;
  // (undocumented)
  getDefaultViewId(_iModelToken: IModelToken): Promise<Id64String>;
  // (undocumented)
  getElementProps(_iModelToken: IModelToken, _elementIds: Id64Set): Promise<ElementProps[]>;
  // (undocumented)
  getGeoCoordinatesFromIModelCoordinates(_iModelToken: IModelToken, _props: string): Promise<GeoCoordinatesResponseProps>;
  // (undocumented)
  getIModelCoordinatesFromGeoCoordinates(_iModelToken: IModelToken, _props: string): Promise<IModelCoordinatesResponseProps>;
  // (undocumented)
  getModelProps(_iModelToken: IModelToken, _modelIds: Id64Set): Promise<ModelProps[]>;
  // (undocumented)
  getToolTipMessage(_iModelToken: IModelToken, _elementId: string): Promise<string[]>;
  // (undocumented)
  getViewStateData(_iModelToken: IModelToken, _viewDefinitionId: string): Promise<ViewStateProps>;
  // (undocumented)
  getViewThumbnail(_iModelToken: IModelToken, _viewId: string): Promise<Uint8Array>;
  // (undocumented)
  openForRead(_accessToken: AccessToken, _iModelToken: IModelToken): Promise<IModel>;
  // (undocumented)
  queryElementProps(_iModelToken: IModelToken, _params: EntityQueryParams): Promise<ElementProps[]>;
  // (undocumented)
  queryEntityIds(_iModelToken: IModelToken, _params: EntityQueryParams): Promise<Id64Set>;
  // (undocumented)
  queryModelProps(_iModelToken: IModelToken, _params: EntityQueryParams): Promise<ModelProps[]>;
  // (undocumented)
  queryModelRanges(_iModelToken: IModelToken, _modelIds: Id64Set): Promise<Range3dProps[]>;
  // (undocumented)
  queryPage(_iModelToken: IModelToken, _ecsql: string, _bindings?: any[] | object, _options?: PageOptions): Promise<any[]>;
  // (undocumented)
  queryRowCount(_iModelToken: IModelToken, _ecsql: string, _bindings?: any[] | object): Promise<number>;
  // (undocumented)
  readFontJson(_iModelToken: IModelToken): Promise<any>;
  // (undocumented)
  requestSnap(_iModelToken: IModelToken, _sessionId: string, _props: SnapRequestProps): Promise<SnapResponseProps>;
  static types: () => (typeof Point3d | typeof Vector3d | typeof Point2d | typeof IModelToken | typeof Code | typeof IModelNotFoundResponse | typeof AccessToken | typeof Vector2d)[];
  static version: string;
}

// @public
enum IModelStatus {
  // (undocumented)
  AlreadyLoaded = 65537,
  // (undocumented)
  AlreadyOpen = 65538,
  // (undocumented)
  BadArg = 65539,
  // (undocumented)
  BadElement = 65540,
  // (undocumented)
  BadModel = 65541,
  // (undocumented)
  BadRequest = 65542,
  // (undocumented)
  BadSchema = 65543,
  // (undocumented)
  CannotUndo = 65544,
  // (undocumented)
  CodeNotReserved = 65545,
  // (undocumented)
  ConstraintNotUnique = 65601,
  // (undocumented)
  DeletionProhibited = 65546,
  // (undocumented)
  DuplicateCode = 65547,
  // (undocumented)
  DuplicateName = 65548,
  // (undocumented)
  ElementBlockedChange = 65549,
  // (undocumented)
  FileAlreadyExists = 65550,
  // (undocumented)
  FileNotFound = 65551,
  // (undocumented)
  FileNotLoaded = 65552,
  // (undocumented)
  ForeignKeyConstraint = 65553,
  // (undocumented)
  IdExists = 65554,
  // (undocumented)
  IMODEL_ERROR_BASE = 65536,
  // (undocumented)
  InDynamicTransaction = 65555,
  // (undocumented)
  InvalidCategory = 65556,
  // (undocumented)
  InvalidCode = 65557,
  // (undocumented)
  InvalidCodeSpec = 65558,
  // (undocumented)
  InvalidId = 65559,
  // (undocumented)
  InvalidName = 65560,
  // (undocumented)
  InvalidParent = 65561,
  // (undocumented)
  InvalidProfileVersion = 65562,
  // (undocumented)
  IsCreatingChangeSet = 65563,
  // (undocumented)
  LockNotHeld = 65564,
  // (undocumented)
  Mismatch2d3d = 65565,
  // (undocumented)
  MismatchGcs = 65566,
  // (undocumented)
  MissingDomain = 65567,
  // (undocumented)
  MissingHandler = 65568,
  // (undocumented)
  MissingId = 65569,
  // (undocumented)
  NoGeoLocation = 65602,
  // (undocumented)
  NoGeometry = 65570,
  // (undocumented)
  NoMultiTxnOperation = 65571,
  // (undocumented)
  NotDgnMarkupProject = 65572,
  // (undocumented)
  NotEnabled = 65573,
  // (undocumented)
  NotFound = 65574,
  // (undocumented)
  NothingToRedo = 65578,
  // (undocumented)
  NothingToUndo = 65579,
  // (undocumented)
  NotOpen = 65575,
  // (undocumented)
  NotOpenForWrite = 65576,
  // (undocumented)
  NotSameUnitBase = 65577,
  // (undocumented)
  ParentBlockedChange = 65580,
  // (undocumented)
  ReadError = 65581,
  // (undocumented)
  ReadOnly = 65582,
  // (undocumented)
  ReadOnlyDomain = 65583,
  // (undocumented)
  RepositoryManagerError = 65584,
  // (undocumented)
  SQLiteError = 65585,
  // (undocumented)
  Success = 0,
  // (undocumented)
  TransactionActive = 65586,
  // (undocumented)
  UnitsMissing = 65587,
  // (undocumented)
  UnknownFormat = 65588,
  // (undocumented)
  UpgradeFailed = 65589,
  // (undocumented)
  ValidationFailed = 65590,
  // (undocumented)
  VersionTooNew = 65591,
  // (undocumented)
  VersionTooOld = 65592,
  // (undocumented)
  ViewNotFound = 65593,
  // (undocumented)
  WriteError = 65594,
  // (undocumented)
  WrongClass = 65595,
  // (undocumented)
  WrongDomain = 65597,
  // (undocumented)
  WrongElement = 65598,
  // (undocumented)
  WrongHandler = 65599,
  // (undocumented)
  WrongIModel = 65596,
  // (undocumented)
  WrongModel = 65600
}

// @public (undocumented)
class IModelTileRpcInterface extends RpcInterface {
  // (undocumented)
  static getClient(): IModelTileRpcInterface;
  // (undocumented)
  getTileContent(_iModelToken: IModelToken, _treeId: string, _contentId: string): Promise<Uint8Array>;
  // (undocumented)
  getTileTreeProps(_iModelToken: IModelToken, _id: string): Promise<TileTreeProps>;
  // (undocumented)
  requestTileContent(_iModelToken: IModelToken, _treeId: string, _contentId: string): Promise<Uint8Array>;
  // (undocumented)
  requestTileTreeProps(_iModelToken: IModelToken, _id: string): Promise<TileTreeProps>;
  // (undocumented)
  static types: () => (typeof IModelToken)[];
  static version: string;
}

// @public
class IModelToken {
  constructor(
      key?: string | undefined, 
      contextId?: string | undefined, 
      iModelId?: string | undefined, 
      changeSetId?: string | undefined, 
      openMode?: OpenMode | undefined);
  changeSetId?: string | undefined;
  readonly contextId?: string | undefined;
  readonly iModelId?: string | undefined;
  readonly key?: string | undefined;
  openMode?: OpenMode | undefined;
}

// @public
class IModelVersion {
  static asOfChangeSet(changeSetId: string): IModelVersion;
  evaluateChangeSet(alctx: ActivityLoggingContext, accessToken: AccessToken, iModelId: string, imodelClient: IModelClient): Promise<string>;
  static first(): IModelVersion;
  static fromJson(jsonObj: any): IModelVersion;
  getAsOfChangeSet(): string | undefined;
  getName(): string | undefined;
  readonly isFirst: boolean;
  readonly isLatest: boolean;
  static latest(): IModelVersion;
  static named(versionName: string): IModelVersion;
}

// @alpha
class IModelWriteRpcInterface extends RpcInterface {
  static getClient(): IModelWriteRpcInterface;
  // (undocumented)
  openForWrite(_accessToken: AccessToken, _iModelToken: IModelToken): Promise<IModel>;
  // (undocumented)
  saveChanges(_iModelToken: IModelToken, _description?: string): Promise<void>;
  // (undocumented)
  saveThumbnail(_iModelToken: IModelToken, _val: Uint8Array): Promise<void>;
  static types: () => (typeof Point3d | typeof Range3d | typeof IModelToken | typeof IModelNotFoundResponse | typeof AccessToken)[];
  // (undocumented)
  updateProjectExtents(_iModelToken: IModelToken, _newExtents: AxisAlignedBox3d): Promise<void>;
  static version: string;
}

// @public
interface InformationPartitionElementProps extends DefinitionElementProps {
  // (undocumented)
  description?: string;
}

// @public
export function isPowerOfTwo(num: number): boolean;

// @public (undocumented)
export function isValidImageSourceFormat(format: ImageSourceFormat): boolean;

// @public (undocumented)
interface LatAndLong {
  // (undocumented)
  latitude: number;
  // (undocumented)
  longitude: number;
}

// @public (undocumented)
interface LatLongAndHeight extends LatAndLong {
  // (undocumented)
  height: number;
}

// @public
class Light {
  constructor(opts?: LightProps);
  // (undocumented)
  bulbs: number;
  // (undocumented)
  color: ColorDef;
  // (undocumented)
  color2?: ColorDef;
  // (undocumented)
  intensity: number;
  // (undocumented)
  intensity2?: number;
  // (undocumented)
  readonly isValid: boolean;
  // (undocumented)
  readonly isVisible: boolean;
  // (undocumented)
  kelvin: number;
  // (undocumented)
  lightType: LightType;
  // (undocumented)
  lumens: number;
  // (undocumented)
  shadows: number;
}

// @beta
interface LightLocationProps extends GeometricElement3dProps {
  // (undocumented)
  enabled?: boolean;
}

// @public
interface LightProps {
  // (undocumented)
  bulbs?: number;
  // (undocumented)
  color?: ColorDefProps;
  // (undocumented)
  color2?: ColorDefProps;
  // (undocumented)
  intensity?: number;
  // (undocumented)
  intensity2?: number;
  // (undocumented)
  kelvin?: number;
  // (undocumented)
  lightType?: LightType;
  // (undocumented)
  lumens?: number;
  // (undocumented)
  shadows?: number;
}

// @public
enum LightType {
  // (undocumented)
  Ambient = 2,
  // (undocumented)
  Area = 7,
  // (undocumented)
  Distant = 8,
  // (undocumented)
  Flash = 3,
  // (undocumented)
  Invalid = 0,
  // (undocumented)
  Point = 5,
  // (undocumented)
  Portrait = 4,
  // (undocumented)
  SkyOpening = 9,
  // (undocumented)
  Solar = 1,
  // (undocumented)
  Spot = 6
}

// @public
enum LinePixels {
  // (undocumented)
  Code0 = 0,
  // (undocumented)
  Code1 = 2155905152,
  // (undocumented)
  Code2 = 4177066232,
  // (undocumented)
  Code3 = 4292935648,
  // (undocumented)
  Code4 = 4262526480,
  // (undocumented)
  Code5 = 3772834016,
  // (undocumented)
  Code6 = 4169726088,
  // (undocumented)
  Code7 = 4279828248,
  // (undocumented)
  HiddenLine = 3435973836,
  // (undocumented)
  Invalid = -1,
  // (undocumented)
  Invisible = 1,
  // (undocumented)
  Solid = 0
}

// @public (undocumented)
module LineStyle {
  class Info {
    // WARNING: The type "Modifier" needs to be exported by the package (e.g. added to index.ts)
    constructor(styleId: Id64String, styleMod?: Modifier);
    // WARNING: The type "Info" needs to be exported by the package (e.g. added to index.ts)
    clone(): Info;
    // WARNING: The type "Info" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    equals(other: Info): boolean;
    // (undocumented)
    styleId: Id64String;
    // WARNING: The type "Modifier" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    styleMod?: Modifier;
  }

  class Modifier implements ModifierProps {
    // WARNING: The type "ModifierProps" needs to be exported by the package (e.g. added to index.ts)
    constructor(props: ModifierProps);
    // (undocumented)
    applyTransform(transform: Transform): boolean;
    // (undocumented)
    centerPhase?: boolean;
    // WARNING: The type "Modifier" needs to be exported by the package (e.g. added to index.ts)
    clone(): Modifier;
    // (undocumented)
    dashScale?: number;
    // (undocumented)
    distPhase?: number;
    // (undocumented)
    endWidth?: number;
    // WARNING: The type "Modifier" needs to be exported by the package (e.g. added to index.ts)
    equals(other: Modifier): boolean;
    // (undocumented)
    fractPhase?: number;
    // (undocumented)
    gapScale?: number;
    // (undocumented)
    normal?: Vector3d;
    // (undocumented)
    physicalWidth?: boolean;
    // (undocumented)
    rotation?: YawPitchRollAngles;
    // (undocumented)
    scale?: number;
    // (undocumented)
    segmentMode?: boolean;
    // (undocumented)
    startWidth?: number;
  }

  interface ModifierProps {
    centerPhase?: boolean;
    dashScale?: number;
    distPhase?: number;
    endWidth?: number;
    fractPhase?: number;
    gapScale?: number;
    normal?: XYZProps;
    physicalWidth?: boolean;
    rotation?: YawPitchRollProps;
    scale?: number;
    segmentMode?: boolean;
    startWidth?: number;
  }

}

// @beta
interface LineStyleProps extends ElementProps {
  // (undocumented)
  data: string;
  // (undocumented)
  description?: string;
}

// @public (undocumented)
module MarshalingBinaryMarker {
  // (undocumented)
  function createDefault(): MarshalingBinaryMarker;

}

// @public
interface MaterialProps {
  materialId?: Id64String;
  // (undocumented)
  origin?: XYZProps;
  // (undocumented)
  rotation?: YawPitchRollProps;
  // (undocumented)
  size?: XYZProps;
}

// @public (undocumented)
class MeshEdge {
  constructor(index0?: number, index1?: number);
  // (undocumented)
  indices: number[];
}

// @public (undocumented)
class MeshEdges {
  constructor();
  // (undocumented)
  polylines: MeshPolylineList;
  // (undocumented)
  silhouette: MeshEdge[];
  // (undocumented)
  silhouetteNormals: OctEncodedNormalPair[];
  // (undocumented)
  visible: MeshEdge[];
}

// @public (undocumented)
class MeshPolyline {
  constructor(indices?: number[]);
  // (undocumented)
  addIndex(index: number): void;
  // (undocumented)
  clear(): void;
  // (undocumented)
  readonly indices: number[];
}

// @public (undocumented)
class MeshPolylineList extends Array<MeshPolyline> {
  constructor(...args: MeshPolyline[]);
}

// @public
class MobileRpcConfiguration extends RpcConfiguration {
  static readonly isIOSFrontend: any;
  static readonly isMobileBackend: boolean;
  static readonly isMobileFrontend: boolean;
  static readonly platform: RpcMobilePlatform;
  // WARNING: The type "MobileRpcProtocol" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  protocol: MobileRpcProtocol;
}

// @public
class MobileRpcManager {
  static initializeClient(interfaces: RpcInterfaceDefinition[]): MobileRpcConfiguration;
  static initializeImpl(interfaces: RpcInterfaceDefinition[]): MobileRpcConfiguration;
}

// @public
interface ModelProps extends EntityProps {
  // (undocumented)
  isPrivate?: boolean;
  // (undocumented)
  isTemplate?: boolean;
  // (undocumented)
  jsonProperties?: any;
  // (undocumented)
  modeledElement: RelatedElementProps;
  // (undocumented)
  name?: string;
  // (undocumented)
  parentModel?: Id64String;
}

// @alpha
interface ModelQueryParams extends EntityQueryParams {
  // (undocumented)
  wantPrivate?: boolean;
  // (undocumented)
  wantTemplate?: boolean;
}

// @public
interface ModelSelectorProps extends DefinitionElementProps {
  // (undocumented)
  models: Id64Array;
}

// @public
interface NavigationBindingValue {
  id: Id64String;
  relClassName?: string;
  relClassTableSpace?: string;
}

// @public
interface NavigationValue {
  id: Id64String;
  relClassName?: string;
}

// @public
export function nextHighestPowerOfTwo(num: number): number;

// @public (undocumented)
class NonUniformColor {
  constructor(colors: Uint32Array, indices: number[], hasAlpha: boolean);
  // (undocumented)
  readonly colors: Uint32Array;
  // (undocumented)
  readonly indices: Uint16Array;
  // (undocumented)
  readonly isOpaque: boolean;
}

// @public
enum Npc {
  _000 = 0,
  _001 = 4,
  _010 = 2,
  _011 = 6,
  _100 = 1,
  _101 = 5,
  _110 = 3,
  _111 = 7,
  CORNER_COUNT = 8,
  // (undocumented)
  LeftBottomFront = 4,
  // (undocumented)
  LeftBottomRear = 0,
  // (undocumented)
  LeftTopFront = 6,
  // (undocumented)
  LeftTopRear = 2,
  // (undocumented)
  RightBottomFront = 5,
  // (undocumented)
  RightBottomRear = 1,
  // (undocumented)
  RightTopFront = 7,
  // (undocumented)
  RightTopRear = 3
}

// @public (undocumented)
class OctEncodedNormal {
  constructor(val: number);
  // (undocumented)
  decode(): Vector3d | undefined;
  // (undocumented)
  static fromVector(val: XYAndZ): OctEncodedNormal;
  // (undocumented)
  readonly value: number;
}

// @public (undocumented)
class OctEncodedNormalPair {
  constructor(first: OctEncodedNormal, second: OctEncodedNormal);
  // (undocumented)
  first: OctEncodedNormal;
  // (undocumented)
  second: OctEncodedNormal;
}

// @public (undocumented)
interface PageableECSql {
  query(ecsql: string, bindings?: any[] | object, options?: PageOptions): AsyncIterableIterator<any>;
  queryPage(ecsql: string, bindings?: any[] | object, options?: PageOptions): Promise<any[]>;
  queryRowCount(ecsql: string, bindings?: any[] | object): Promise<number>;
}

// @public
interface PageOptions {
  retries?: number;
  size?: number;
  start?: number;
}

// @public
class Placement2d implements Placement2dProps {
  constructor(origin: Point2d, angle: Angle, bbox: ElementAlignedBox2d);
  // (undocumented)
  angle: Angle;
  // (undocumented)
  bbox: ElementAlignedBox2d;
  calculateRange(): AxisAlignedBox3d;
  static fromJSON(json?: Placement2dProps): Placement2d;
  getWorldCorners(out?: Frustum): Frustum;
  readonly isValid: boolean;
  // (undocumented)
  origin: Point2d;
  readonly rotation: Matrix3d;
  setFrom(other: Placement2d): void;
  readonly transform: Transform;
}

// @public
interface Placement2dProps {
  // (undocumented)
  angle: AngleProps;
  // (undocumented)
  bbox?: LowAndHighXY;
  // (undocumented)
  origin: XYProps;
}

// @public
class Placement3d implements Placement3dProps {
  constructor(origin: Point3d, angles: YawPitchRollAngles, bbox: ElementAlignedBox3d);
  // (undocumented)
  angles: YawPitchRollAngles;
  // (undocumented)
  bbox: ElementAlignedBox3d;
  calculateRange(): AxisAlignedBox3d;
  static fromJSON(json?: Placement3dProps): Placement3d;
  getWorldCorners(out?: Frustum): Frustum;
  readonly isValid: boolean;
  // (undocumented)
  origin: Point3d;
  readonly rotation: Matrix3d;
  setFrom(other: Placement3d): void;
  readonly transform: Transform;
}

// @public
interface Placement3dProps {
  // (undocumented)
  angles: YawPitchRollProps;
  // (undocumented)
  bbox?: LowAndHighXYZ;
  // (undocumented)
  origin: XYZProps;
}

// @beta
interface PointWithStatus {
  // (undocumented)
  p: XYZProps;
  // (undocumented)
  s: GeoCoordStatus;
}

// @public (undocumented)
class PolylineData {
  constructor(vertIndices?: number[], numIndices?: number);
  // (undocumented)
  init(polyline: MeshPolyline): boolean;
  // (undocumented)
  readonly isValid: boolean;
  // (undocumented)
  numIndices: number;
  // (undocumented)
  reset(): void;
  // (undocumented)
  vertIndices: number[];
}

// @public (undocumented)
class PolylineEdgeArgs {
  constructor(lines?: PolylineData[]);
  // (undocumented)
  clear(): void;
  // (undocumented)
  init(lines?: PolylineData[]): boolean;
  // (undocumented)
  readonly isValid: boolean;
  // (undocumented)
  lines?: PolylineData[];
  // (undocumented)
  readonly numLines: number;
}

// @public
class PolylineFlags {
  constructor(is2d?: boolean, isPlanar?: boolean, isDisjoint?: boolean, type?: PolylineTypeFlags);
  // (undocumented)
  clone(): PolylineFlags;
  // (undocumented)
  equals(other: PolylineFlags): boolean;
  // (undocumented)
  initDefaults(): void;
  // (undocumented)
  is2d: boolean;
  // (undocumented)
  readonly isAnyEdge: boolean;
  // (undocumented)
  isDisjoint: boolean;
  // (undocumented)
  readonly isNormalEdge: boolean;
  // (undocumented)
  readonly isOutlineEdge: boolean;
  // (undocumented)
  isPlanar: boolean;
  pack(): number;
  // (undocumented)
  setIsNormalEdge(): void;
  // (undocumented)
  setIsOutlineEdge(): void;
  // (undocumented)
  type: PolylineTypeFlags;
  static unpack(value: number): PolylineFlags;
}

// @public (undocumented)
enum PolylineTypeFlags {
  // (undocumented)
  Edge = 1,
  // (undocumented)
  Normal = 0,
  // (undocumented)
  Outline = 2
}

// @beta
enum PrimitiveTypeCode {
  // (undocumented)
  Binary = 257,
  // (undocumented)
  Boolean = 513,
  // (undocumented)
  DateTime = 769,
  // (undocumented)
  Double = 1025,
  // (undocumented)
  Integer = 1281,
  // (undocumented)
  Long = 1537,
  // (undocumented)
  Point2d = 1793,
  // (undocumented)
  Point3d = 2049,
  // (undocumented)
  String = 2305,
  // (undocumented)
  Uninitialized = 0
}

// @beta
class PropertyMetaData implements PropertyMetaDataProps {
  constructor(jsonObj: PropertyMetaDataProps);
  createProperty(jsonObj: any): any;
  // (undocumented)
  customAttributes?: CustomAttribute[];
  // (undocumented)
  description?: string;
  // (undocumented)
  direction?: string;
  // (undocumented)
  displayLabel?: string;
  // (undocumented)
  extendedType?: string;
  // (undocumented)
  isCustomHandled?: boolean;
  // (undocumented)
  isCustomHandledOrphan?: boolean;
  // (undocumented)
  kindOfQuantity?: string;
  // (undocumented)
  maximumLength?: number;
  // (undocumented)
  maximumValue?: any;
  // (undocumented)
  maxOccurs?: number;
  // (undocumented)
  minimumLength?: number;
  // (undocumented)
  minimumValue?: any;
  // (undocumented)
  minOccurs?: number;
  // (undocumented)
  primitiveType?: PrimitiveTypeCode;
  // (undocumented)
  readOnly?: boolean;
  // (undocumented)
  relationshipClass?: string;
  // (undocumented)
  structName?: string;
}

// @beta (undocumented)
interface PropertyMetaDataProps {
  // (undocumented)
  customAttributes?: CustomAttribute[];
  // (undocumented)
  description?: string;
  // (undocumented)
  direction?: string;
  // (undocumented)
  displayLabel?: string;
  // (undocumented)
  extendedType?: string;
  // (undocumented)
  isCustomHandled?: boolean;
  // (undocumented)
  isCustomHandledOrphan?: boolean;
  // (undocumented)
  kindOfQuantity?: string;
  // (undocumented)
  maximumLength?: number;
  // (undocumented)
  maximumValue?: any;
  // (undocumented)
  maxOccurs?: number;
  // (undocumented)
  minimumLength?: number;
  // (undocumented)
  minimumValue?: any;
  // (undocumented)
  minOccurs?: number;
  // (undocumented)
  primitiveType?: number;
  // (undocumented)
  readOnly?: boolean;
  // (undocumented)
  relationshipClass?: string;
  // (undocumented)
  structName?: string;
}

// @public
class QParams2d {
  // (undocumented)
  clone(out?: QParams2d): QParams2d;
  // (undocumented)
  copyFrom(src: QParams2d): void;
  static fromNormalizedRange(): QParams2d;
  static fromRange(range: Range2d, out?: QParams2d): QParams2d;
  static fromZeroToOne(): QParams2d;
  // (undocumented)
  readonly origin: Point2d;
  // (undocumented)
  readonly scale: Point2d;
  setFromRange(range: Range2d): void;
}

// @public
class QParams3d {
  // (undocumented)
  clone(out?: QParams3d): QParams3d;
  // (undocumented)
  copyFrom(src: QParams3d): void;
  static fromNormalizedRange(): QParams3d;
  static fromOriginAndScale(origin: Point3d, scale: Point3d, out?: QParams3d): QParams3d;
  static fromRange(range: Range3d, out?: QParams3d): QParams3d;
  static fromZeroToOne(): QParams3d;
  // (undocumented)
  readonly origin: Point3d;
  // (undocumented)
  readonly scale: Point3d;
  setFromOriginAndScale(origin: Point3d, scale: Point3d): void;
  setFromRange(range: Range3d): void;
}

// @public
class QPoint2d {
  constructor();
  // (undocumented)
  clone(out?: QPoint2d): QPoint2d;
  // (undocumented)
  copyFrom(src: QPoint2d): void;
  static create(pos: Point2d, params: QParams2d): QPoint2d;
  static fromScalars(x: number, y: number): QPoint2d;
  init(pos: Point2d, params: QParams2d): void;
  setFromScalars(x: number, y: number): void;
  unquantize(params: QParams2d, out?: Point2d): Point2d;
  // (undocumented)
  x: number;
  // (undocumented)
  y: number;
}

// @public
class QPoint2dList {
  constructor(params: QParams2d);
  add(pt: Point2d): void;
  clear(): void;
  static fromPoints(points: Point2d[], out?: QPoint2dList): QPoint2dList;
  readonly length: number;
  // (undocumented)
  readonly params: QParams2d;
  push(qpt: QPoint2d): void;
  requantize(params: QParams2d): void;
  reset(params: QParams2d): void;
  toTypedArray(): Uint16Array;
  unquantize(index: number, out?: Point2d): Point2d;
}

// @public
class QPoint3d {
  // (undocumented)
  clone(out?: QPoint3d): QPoint3d;
  // (undocumented)
  compare(rhs: QPoint3d): number;
  // (undocumented)
  copyFrom(src: QPoint3d): void;
  static create(pos: Point3d, params: QParams3d): QPoint3d;
  // (undocumented)
  equals(other: QPoint3d): boolean;
  static fromScalars(x: number, y: number, z: number, out?: QPoint3d): QPoint3d;
  init(pos: Point3d, params: QParams3d): void;
  setFromScalars(x: number, y: number, z: number): void;
  unquantize(params: QParams3d, out?: Point3d): Point3d;
  // (undocumented)
  x: number;
  // (undocumented)
  y: number;
  // (undocumented)
  z: number;
}

// @public
class QPoint3dList {
  // WARNING: The name "__@iterator" contains unsupported characters; API names should use only letters, numbers, and underscores
  // (undocumented)
  __@iterator: {
    next: () => IteratorResult<QPoint3d>;
  }
  constructor(paramsIn?: QParams3d);
  add(pt: Point3d): void;
  clear(): void;
  // (undocumented)
  static createFrom(points: Point3d[], params: QParams3d): QPoint3dList;
  static fromPoints(points: Point3d[], out?: QPoint3dList): QPoint3dList;
  readonly length: number;
  // (undocumented)
  readonly list: QPoint3d[];
  // (undocumented)
  readonly params: QParams3d;
  push(qpt: QPoint3d): void;
  requantize(params: QParams3d): void;
  reset(params: QParams3d): void;
  toTypedArray(): Uint16Array;
  unquantize(index: number, out?: Point3d): Point3d;
}

// @public
module Quantization {
  // (undocumented)
  function computeScale(extent: number): number;

  // (undocumented)
  function isInRange(qpos: number): boolean;

  // (undocumented)
  function isQuantizable(pos: number, origin: number, scale: number): boolean;

  // (undocumented)
  function isQuantized(qpos: number): boolean;

  // (undocumented)
  function quantize(pos: number, origin: number, scale: number): number;

  // (undocumented)
  function unquantize(qpos: number, origin: number, scale: number): number;

}

// @public
enum Rank {
  Application = 2,
  Domain = 1,
  System = 0,
  User = 3
}

// @public (undocumented)
interface ReadableFormData extends Readable {
  // (undocumented)
  getHeaders: {
    [key: string]: any;
  }
}

// @public
class RelatedElement implements RelatedElementProps {
  constructor(props: RelatedElementProps);
  // (undocumented)
  static fromJSON(json?: RelatedElementProps): RelatedElement | undefined;
  readonly id: Id64String;
  static idFromJson(json: any): Id64String;
  readonly relClassName?: string;
}

// @public
interface RelatedElementProps {
  id: Id64String;
  relClassName?: string;
}

// @beta
class RenderMaterial {
}

// @beta
interface RenderMaterialProps extends DefinitionElementProps {
  description?: string;
  // (undocumented)
  jsonProperties?: {
    materialAssets?: {
      renderMaterial?: {
        color?: RgbFactorProps;
        diffuse?: number;
        finish?: number;
        HasBaseColor?: boolean;
        HasDiffuse?: boolean;
        HasFinish?: boolean;
        HasReflect?: boolean;
        HasReflectColor?: boolean;
        HasSpecular?: boolean;
        HasSpecularColor?: boolean;
        HasTransmit?: boolean;
        Map?: {
          Pattern?: TextureMapProps;
        }
        reflect?: number;
        reflect_color?: RgbFactorProps;
        specular?: number;
        specular_color?: RgbFactorProps;
        transmit?: number;
      }
    }
  }
  paletteName: string;
}

// @public
enum RenderMode {
  HiddenLine = 3,
  SmoothShade = 6,
  SolidFill = 4,
  Wireframe = 0
}

// @beta
module RenderSchedule {
  // (undocumented)
  interface ColorEntryProps extends TimelineEntryProps {
    // (undocumented)
    value: {
      blue: number;
      green: number;
      red: number;
    }
  }

  // (undocumented)
  interface CuttingPlaneEntryProps extends TimelineEntryProps {
    // (undocumented)
    value: CuttingPlaneProps;
  }

  // (undocumented)
  interface CuttingPlaneProps {
    // (undocumented)
    direction: number[];
    // (undocumented)
    hidden?: boolean;
    // (undocumented)
    position: number[];
    // (undocumented)
    visible?: boolean;
  }

  // (undocumented)
  interface ElementTimelineProps {
    // (undocumented)
    batchId: number;
    // (undocumented)
    colorTimeline?: ColorEntryProps[];
    // (undocumented)
    cuttingPlaneTimeline?: CuttingPlaneEntryProps[];
    // (undocumented)
    elementIds: Id64String[];
    // (undocumented)
    transformTimeline?: TransformEntryProps[];
    // (undocumented)
    visibilityTimeline?: VisibilityEntryProps[];
  }

  // (undocumented)
  interface ModelTimelineProps {
    // (undocumented)
    elementTimelines: ElementTimelineProps[];
    // (undocumented)
    modelId: Id64String;
  }

  // (undocumented)
  interface TimelineEntryProps {
    // (undocumented)
    interpolation: number;
    // (undocumented)
    time: number;
  }

  // (undocumented)
  interface TransformEntryProps extends TimelineEntryProps {
    // (undocumented)
    value: TransformProps;
  }

  // (undocumented)
  interface TransformProps {
    // (undocumented)
    orientation: number[];
    // (undocumented)
    pivot: number[];
    // (undocumented)
    position: number[];
    // (undocumented)
    transform: number[][];
  }

  // (undocumented)
  interface VisibilityEntryProps extends TimelineEntryProps {
    // (undocumented)
    value: number;
  }

}

// @beta
class RenderTexture {
}

// @beta
enum RepositoryStatus {
  CannotCreateChangeSet = 86023,
  ChangeSetRequired = 86025,
  CodeNotReserved = 86027,
  CodeUnavailable = 86026,
  CodeUsed = 86028,
  InvalidRequest = 86024,
  InvalidResponse = 86020,
  LockAlreadyHeld = 86018,
  LockNotHeld = 86029,
  LockUsed = 86022,
  PendingTransactions = 86021,
  RepositoryIsLocked = 86030,
  ServerUnavailable = 86017,
  // (undocumented)
  Success = 0,
  SyncError = 86019
}

// @public
class RgbColor {
  constructor(r: number, g: number, b: number);
  // (undocumented)
  readonly b: number;
  // (undocumented)
  equals(other: RgbColor): boolean;
  static fromColorDef(colorDef: ColorDef): RgbColor;
  // (undocumented)
  readonly g: number;
  // (undocumented)
  readonly r: number;
}

// @alpha
interface RootSubjectProps {
  description?: string;
  name: string;
}

// @public
class RpcConfiguration {
  applicationAuthorizationKey: string;
  applicationAuthorizationValue: string;
  applicationVersionKey: string;
  static applicationVersionValue: string;
  static assign<T extends RpcInterface>(definition: RpcInterfaceDefinition<T>, supplier: RpcConfigurationSupplier): void;
  readonly controlChannel: RpcControlChannel;
  static developmentMode: boolean;
  static initializeInterfaces(configuration: RpcConfiguration): void;
  readonly interfaces: () => RpcInterfaceDefinition[];
  static obtain<T extends RpcConfiguration>(configurationConstructor: {
          new (): T;
      }): T;
  // (undocumented)
  onRpcClientInitialized(definition: RpcInterfaceDefinition, client: RpcInterface): void;
  // (undocumented)
  onRpcClientTerminated(definition: RpcInterfaceDefinition, client: RpcInterface): void;
  // (undocumented)
  onRpcImplInitialized(definition: RpcInterfaceDefinition, impl: RpcInterface): void;
  // (undocumented)
  onRpcImplTerminated(definition: RpcInterfaceDefinition, impl: RpcInterface): void;
  pendingOperationRetryInterval: number;
  readonly protocol: RpcProtocol;
  static strictMode: boolean;
  // (undocumented)
  static supply(definition: RpcInterface): RpcConfiguration;
}

// @public
enum RpcContentType {
  // (undocumented)
  Binary = 2,
  // (undocumented)
  Multipart = 3,
  // (undocumented)
  Text = 1,
  // (undocumented)
  Unknown = 0
}

// @public
class RpcControlChannel {
  // (undocumented)
  static channels: RpcControlChannel[];
  // (undocumented)
  describeEndpoints(): Promise<RpcInterfaceEndpoints[]>;
  // (undocumented)
  handleUnknownOperation(invocation: RpcInvocation, _error: any): boolean;
  // (undocumented)
  initialize(): void;
  // (undocumented)
  static obtain(configuration: RpcConfiguration): RpcControlChannel;
}

// @public
class RpcControlResponse {
}

// @public (undocumented)
class RpcDefaultConfiguration extends RpcConfiguration {
  // (undocumented)
  applicationAuthorizationKey: string;
  // (undocumented)
  applicationAuthorizationValue: string;
  // (undocumented)
  interfaces: () => never[];
  // (undocumented)
  protocol: RpcProtocol;
}

// @public (undocumented)
class RpcDirectProtocol extends RpcProtocol {
  // (undocumented)
  readonly requestType: typeof RpcDirectRequest;
}

// @public (undocumented)
class RpcDirectRequest extends RpcRequest {
  // (undocumented)
  fulfillment: RpcRequestFulfillment | undefined;
  // (undocumented)
  headers: Map<string, string>;
  // (undocumented)
  protected load(): Promise<import("./RpcMarshaling").RpcSerializedValue>;
  // (undocumented)
  protected send(): Promise<number>;
  // (undocumented)
  protected setHeader(name: string, value: string): void;
}

// @public
enum RpcEndpoint {
  // (undocumented)
  Backend = 1,
  // (undocumented)
  Frontend = 0
}

// @public
class RpcInterface {
  readonly configuration: RpcConfiguration;
  // (undocumented)
  configurationSupplier: RpcConfigurationSupplier | undefined;
  forward<T = any>(parameters: IArguments): Promise<T>;
  static isVersionCompatible(backend: string, frontend: string): boolean;
}

// @public (undocumented)
interface RpcInterfaceDefinition<T extends RpcInterface = RpcInterface> {
  // (undocumented)
  name: string;
  // (undocumented)
  prototype: T;
  // (undocumented)
  types: () => Function[];
  // (undocumented)
  version: string;
}

// @public
interface RpcInterfaceEndpoints {
  // (undocumented)
  compatible: boolean;
  // (undocumented)
  interfaceName: string;
  // (undocumented)
  interfaceVersion: string;
  // (undocumented)
  operationNames: string[];
}

// @beta
enum RpcInterfaceStatus {
  IncompatibleVersion = 135168,
  // (undocumented)
  RPC_INTERFACE_ERROR_BASE = 135168,
  // (undocumented)
  Success = 0
}

// @public
class RpcInvocation {
  constructor(protocol: RpcProtocol, request: SerializedRpcRequest);
  static current(rpcImpl: RpcInterface): RpcInvocation;
  readonly elapsed: number;
  readonly fulfillment: Promise<RpcRequestFulfillment>;
  readonly operation: RpcOperation;
  readonly protocol: RpcProtocol;
  readonly request: SerializedRpcRequest;
  readonly result: Promise<any>;
  readonly status: RpcRequestStatus;
}

// @public
class RpcManager {
  static describeAvailableEndpoints(): Promise<RpcInterfaceEndpoints[]>;
  static getClientForInterface<T extends RpcInterface>(definition: RpcInterfaceDefinition<T>): T;
  static initializeInterface<T extends RpcInterface>(definition: RpcInterfaceDefinition<T>): void;
  static registerImpl<TDefinition extends RpcInterface, TImplementation extends TDefinition>(definition: RpcInterfaceDefinition<TDefinition>, implementation: RpcInterfaceImplementation<TImplementation>): void;
  static supplyImplInstance<TDefinition extends RpcInterface, TImplementation extends TDefinition>(definition: RpcInterfaceDefinition<TDefinition>, instance: TImplementation): void;
  static terminateInterface<T extends RpcInterface>(definition: RpcInterfaceDefinition<T>): void;
  static unregisterImpl<TDefinition extends RpcInterface>(definition: RpcInterfaceDefinition<TDefinition>): void;
}

// @public (undocumented)
class RpcMarshaling {
  static deserialize(_operation: RpcOperation, protocol: RpcProtocol | undefined, value: RpcSerializedValue): any;
  static serialize(operation: RpcOperation | string, protocol: RpcProtocol | undefined, value: any): RpcSerializedValue;
}

// @public
enum RpcMarshalingDirective {
  // (undocumented)
  Binary = "__binary__",
  // (undocumented)
  Error = "__error__",
  // (undocumented)
  ErrorMessage = "__error_message__",
  // (undocumented)
  ErrorName = "__error_name__",
  // (undocumented)
  ErrorStack = "__error_stack__",
  // (undocumented)
  JSON = "__JSON__",
  // (undocumented)
  Map = "__map__",
  // (undocumented)
  Name = "__name__",
  // (undocumented)
  Set = "__set__",
  // (undocumented)
  Undefined = "__undefined__",
  // (undocumented)
  Unregistered = "__unregistered__"
}

// @public
enum RpcMobilePlatform {
  // (undocumented)
  Android = 2,
  // (undocumented)
  iOS = 3,
  // (undocumented)
  Unknown = 0,
  // (undocumented)
  Window = 1
}

// @public
class RpcMultipart {
  static createForm(value: RpcSerializedValue): FormData;
  static createStream(_value: RpcSerializedValue): ReadableFormData;
  static parseRequest(_req: HttpServerRequest): Promise<RpcSerializedValue>;
  // (undocumented)
  static writeValueToForm(form: FormDataCommon, value: RpcSerializedValue): void;
}

// @public
class RpcNotFoundResponse extends RpcControlResponse {
}

// @public (undocumented)
class RpcOperation {
}

// @public
class RpcOperationPolicy {
  allowResponseCaching: RpcResponseCachingCallback_T;
  invocationCallback: RpcInvocationCallback_T;
  requestCallback: RpcRequestCallback_T;
  requestId: RpcRequestIdSupplier_T;
  retryInterval: RpcRequestInitialRetryIntervalSupplier_T;
  sentCallback: RpcRequestCallback_T;
  token: RpcRequestTokenSupplier_T;
}

// @public
interface RpcOperationsProfile {
  // (undocumented)
  readonly lastRequest: number;
  // (undocumented)
  readonly lastResponse: number;
}

// @public
class RpcPendingQueue {
  // (undocumented)
  static initialize(): void;
  // (undocumented)
  static instance: RpcPendingQueue;
}

// @public
class RpcPendingResponse extends RpcControlResponse {
  constructor(message?: string);
  message: string;
}

// @public
class RpcProtocol {
  constructor(configuration: RpcConfiguration);
  readonly authorizationHeaderName: string;
  readonly configuration: RpcConfiguration;
  static readonly events: BeEvent<RpcProtocolEventHandler>;
  fulfill(request: SerializedRpcRequest): Promise<RpcRequestFulfillment>;
  getCode(status: RpcRequestStatus): number;
  getOperationFromPath(path: string): SerializedRpcOperation;
  getStatus(code: number): RpcRequestStatus;
  readonly invocationType: typeof RpcInvocation;
  // (undocumented)
  onRpcClientInitialized(_definition: RpcInterfaceDefinition, _client: RpcInterface): void;
  // (undocumented)
  onRpcClientTerminated(_definition: RpcInterfaceDefinition, _client: RpcInterface): void;
  // (undocumented)
  onRpcImplInitialized(_definition: RpcInterfaceDefinition, _impl: RpcInterface): void;
  // (undocumented)
  onRpcImplTerminated(_definition: RpcInterfaceDefinition, _impl: RpcInterface): void;
  requestIdHeaderName: string;
  readonly requestType: typeof RpcRequest;
  serialize(request: RpcRequest): SerializedRpcRequest;
  supplyPathForOperation(operation: RpcOperation, _request: RpcRequest | undefined): string;
  transferChunkThreshold: number;
  readonly versionHeaderName: string;
}

// @public
enum RpcProtocolEvent {
  // (undocumented)
  BackendErrorOccurred = 11,
  // (undocumented)
  BackendErrorReceived = 5,
  // (undocumented)
  BackendReportedNotFound = 10,
  // (undocumented)
  BackendReportedPending = 9,
  // (undocumented)
  BackendResponseCreated = 8,
  // (undocumented)
  ConnectionAborted = 6,
  // (undocumented)
  ConnectionErrorReceived = 3,
  // (undocumented)
  RequestCreated = 0,
  // (undocumented)
  RequestReceived = 7,
  // (undocumented)
  ResponseLoaded = 1,
  // (undocumented)
  ResponseLoading = 2,
  // (undocumented)
  UnknownErrorReceived = 4
}

// @public (undocumented)
class RpcRegistry {
  // (undocumented)
  definitionClasses: Map<string, RpcInterfaceDefinition>;
  // (undocumented)
  describeAvailableEndpoints(): Promise<RpcInterfaceEndpoints[]>;
  // (undocumented)
  getClientForInterface<T extends RpcInterface>(definition: RpcInterfaceDefinition<T>): T;
  // (undocumented)
  getImplForInterface<T extends RpcInterface>(definition: RpcInterfaceDefinition<T>): T;
  // (undocumented)
  id: () => number;
  // (undocumented)
  implementationClasses: Map<string, RpcInterfaceImplementation>;
  // (undocumented)
  implementations: Map<string, RpcInterface>;
  // (undocumented)
  initializeRpcInterface<T extends RpcInterface>(definition: RpcInterfaceDefinition<T>): void;
  // (undocumented)
  static readonly instance: RpcRegistry;
  // (undocumented)
  isRpcInterfaceInitialized<T extends RpcInterface>(definition: RpcInterfaceDefinition<T>): boolean;
  // (undocumented)
  lookupImpl<T extends RpcInterface>(interfaceName: string): T;
  // (undocumented)
  lookupInterfaceDefinition(name: string): RpcInterfaceDefinition;
  // (undocumented)
  proxies: Map<string, RpcInterface>;
  // (undocumented)
  registerImpl<TDefinition extends RpcInterface, TImplementation extends TDefinition>(definition: RpcInterfaceDefinition<TDefinition>, implementation: RpcInterfaceImplementation<TImplementation>): void;
  // (undocumented)
  suppliedImplementations: Map<string, RpcInterface>;
  // (undocumented)
  supplyImplInstance<TDefinition extends RpcInterface, TImplementation extends TDefinition>(definition: RpcInterfaceDefinition<TDefinition>, instance: TImplementation): void;
  // (undocumented)
  terminateRpcInterface<T extends RpcInterface>(definition: RpcInterfaceDefinition<T>): void;
  // (undocumented)
  types: Map<string, Function>;
  // (undocumented)
  unregisterImpl<TDefinition extends RpcInterface>(definition: RpcInterfaceDefinition<TDefinition>): void;
}

// @public
class RpcRequest<TResponse = any> {
  constructor(client: RpcInterface, operation: string, parameters: any[]);
  static readonly aggregateLoad: RpcOperationsProfile;
  readonly client: RpcInterface;
  readonly connecting: boolean;
  static current(context: RpcInterface): RpcRequest;
  // (undocumented)
  dispose(): void;
  readonly elapsed: number;
  static readonly events: BeEvent<RpcRequestEventHandler>;
  readonly extendedStatus: string;
  findParameterOfType<T>(requestConstructor: {
          new (...args: any[]): T;
      }): T | undefined;
  // (undocumented)
  protected handleUnknownResponse(code: number): void;
  readonly id: string;
  readonly lastSubmitted: number;
  readonly lastUpdated: number;
  protected abstract load(): Promise<RpcSerializedValue>;
  method: string;
  static readonly notFoundHandlers: BeEvent<RpcRequestNotFoundHandler>;
  readonly operation: RpcOperation;
  parameters: any[];
  path: string;
  readonly pending: boolean;
  readonly protocol: RpcProtocol;
  // (undocumented)
  protected reject(reason: any): void;
  readonly response: Promise<TResponse>;
  retryInterval: number;
  protected abstract send(): Promise<number>;
  protected abstract setHeader(name: string, value: string): void;
  protected setLastUpdatedTime(): void;
  readonly status: RpcRequestStatus;
  // (undocumented)
  submit(): Promise<void>;
}

// @public
enum RpcRequestEvent {
  // (undocumented)
  PendingUpdateReceived = 1,
  // (undocumented)
  StatusChanged = 0
}

// @public (undocumented)
interface RpcRequestFulfillment {
}

// @public
enum RpcRequestStatus {
  // (undocumented)
  Created = 1,
  // (undocumented)
  Disposed = 6,
  // (undocumented)
  NotFound = 7,
  // (undocumented)
  Pending = 3,
  // (undocumented)
  Rejected = 5,
  // (undocumented)
  Resolved = 4,
  // (undocumented)
  Submitted = 2,
  // (undocumented)
  Unknown = 0
}

// @public
enum RpcResponseCacheControl {
  // (undocumented)
  Immutable = 1,
  // (undocumented)
  None = 0
}

// @public (undocumented)
interface RpcSerializedValue {
}

// @public (undocumented)
class SceneLights {
  // WARNING: The type "ImageLight.Solar" needs to be exported by the package (e.g. added to index.ts)
  constructor(imageBased: {
          environmentalMap: RenderTexture;
          diffuseImage: RenderTexture;
          solar: ImageLight.Solar;
      }, fstop?: number);
  // (undocumented)
  addLight(light: Light): void;
  // (undocumented)
  fstop: number;
  // WARNING: The type "ImageLight.Solar" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  imageBased: {
    diffuseImage: RenderTexture;
    environmentalMap: RenderTexture;
    solar: ImageLight.Solar;
  }
  // (undocumented)
  readonly isEmpty: boolean;
}

// @public
interface SerializedRpcOperation {
  // (undocumented)
  encodedRequest?: string;
  // (undocumented)
  interfaceDefinition: string;
  // (undocumented)
  interfaceVersion: string;
  // (undocumented)
  operationName: string;
}

// @public
interface SerializedRpcRequest {
  // (undocumented)
  authorization: string;
  // (undocumented)
  caching: RpcResponseCacheControl;
  // (undocumented)
  id: string;
  // (undocumented)
  method: string;
  // (undocumented)
  operation: SerializedRpcOperation;
  // (undocumented)
  parameters: RpcSerializedValue;
  // (undocumented)
  path: string;
  // (undocumented)
  version: string;
}

// @public (undocumented)
class ServerError extends IModelError {
  constructor(errorNumber: number, message: string, log?: LogFunction);
}

// @public (undocumented)
class ServerTimeoutError extends ServerError {
  constructor(errorNumber: number, message: string, log?: LogFunction);
}

// @beta
interface SheetBorderTemplateProps extends ElementProps {
  // (undocumented)
  height?: number;
  // (undocumented)
  width?: number;
}

// @beta
interface SheetProps extends ElementProps {
  // (undocumented)
  attachments?: Id64String[];
  // (undocumented)
  height?: number;
  // (undocumented)
  scale?: number;
  // (undocumented)
  sheetTemplate?: Id64String;
  // (undocumented)
  width?: number;
}

// @beta
interface SheetTemplateProps extends ElementProps {
  // (undocumented)
  border?: Id64String;
  // (undocumented)
  height?: number;
  // (undocumented)
  width?: number;
}

// @public (undocumented)
class SilhouetteEdgeArgs extends EdgeArgs {
  // (undocumented)
  clear(): void;
  // (undocumented)
  init(meshEdges?: MeshEdges): boolean;
  // (undocumented)
  normals?: OctEncodedNormalPair[];
}

// @public
interface SkyBoxImageProps {
  texture?: Id64String;
  textures?: SkyCubeProps;
  type?: SkyBoxImageType;
}

// @public
enum SkyBoxImageType {
  Cube = 2,
  Cylindrical = 3,
  // (undocumented)
  None = 0,
  Spherical = 1
}

// @public
interface SkyBoxProps {
  display?: boolean;
  groundColor?: ColorDefProps;
  groundExponent?: number;
  image?: SkyBoxImageProps;
  nadirColor?: ColorDefProps;
  skyColor?: ColorDefProps;
  skyExponent?: number;
  twoColor?: boolean;
  zenithColor?: ColorDefProps;
}

// @public
interface SkyCubeProps {
  back?: Id64String;
  bottom?: Id64String;
  front?: Id64String;
  left?: Id64String;
  right?: Id64String;
  top?: Id64String;
}

// @beta
interface SnapRequestProps {
  // (undocumented)
  closePoint: XYZProps;
  // (undocumented)
  decorationGeometry?: DecorationGeometryProps[];
  // (undocumented)
  geometryClass?: GeometryClass;
  // (undocumented)
  id: Id64String;
  // (undocumented)
  intersectCandidates?: Id64Array;
  // (undocumented)
  snapAperture?: number;
  // (undocumented)
  snapDivisor?: number;
  // (undocumented)
  snapModes?: number[];
  // (undocumented)
  subCategoryId?: Id64String;
  // (undocumented)
  testPoint: XYZProps;
  // (undocumented)
  viewFlags?: any;
  // (undocumented)
  worldToView: Matrix4dProps;
}

// @beta
interface SnapResponseProps {
  // (undocumented)
  curve?: any;
  // (undocumented)
  geomType?: number;
  // (undocumented)
  heat?: number;
  // (undocumented)
  hitPoint?: XYZProps;
  // (undocumented)
  intersectCurve?: any;
  // (undocumented)
  intersectId?: string;
  // (undocumented)
  normal?: XYZProps;
  // (undocumented)
  parentGeomType?: number;
  // (undocumented)
  snapMode?: number;
  // (undocumented)
  snapPoint?: XYZProps;
  // (undocumented)
  status: number;
}

// @public
interface SpatialViewDefinitionProps extends ViewDefinition3dProps {
  // (undocumented)
  modelSelectorId: Id64String;
}

// @public
class Spot extends Light {
  constructor(opts?: SpotProps);
  // (undocumented)
  inner: Angle;
  // (undocumented)
  outer: Angle;
}

// @public
interface SpotProps extends LightProps {
  // (undocumented)
  inner?: AngleProps;
  // (undocumented)
  outer?: AngleProps;
}

// @alpha
class StandaloneIModelRpcInterface extends RpcInterface {
  // (undocumented)
  closeStandalone(_iModelToken: IModelToken): Promise<boolean>;
  static getClient(): StandaloneIModelRpcInterface;
  // (undocumented)
  openStandalone(_fileName: string, _openMode: OpenMode): Promise<IModel>;
  static types: () => (typeof IModelToken)[];
  static version: string;
}

// @public (undocumented)
class SubCategoryAppearance {
}

// @public
class SubCategoryOverride {
  readonly anyOverridden: boolean;
  readonly color?: ColorDef;
  static defaults: SubCategoryOverride;
  // WARNING: The type "SubCategoryAppearance.Props" needs to be exported by the package (e.g. added to index.ts)
  static fromJSON(json?: SubCategoryAppearance.Props): SubCategoryOverride;
  readonly invisible?: boolean;
  readonly material?: Id64String;
  override(appearance: SubCategoryAppearance): SubCategoryAppearance;
  readonly priority?: number;
  readonly style?: Id64String;
  // WARNING: The type "SubCategoryAppearance.Props" needs to be exported by the package (e.g. added to index.ts)
  toJSON(): SubCategoryAppearance.Props;
  readonly transparency?: number;
  readonly weight?: number;
}

// @public
interface SubCategoryProps extends ElementProps {
  // (undocumented)
  appearance?: SubCategoryAppearance.Props;
  // (undocumented)
  description?: string;
}

// @public
interface SubjectProps extends ElementProps {
  // (undocumented)
  description?: string;
}

// @public
class TestRpcManager {
  // (undocumented)
  static initialize(interfaces: RpcInterfaceDefinition[]): void;
}

// @public
class TextString {
  constructor(props: TextStringProps);
  bold?: boolean;
  font: number;
  // (undocumented)
  height: number;
  italic?: boolean;
  readonly origin: Point3d;
  readonly rotation: YawPitchRollAngles;
  text: string;
  // (undocumented)
  toJSON(): TextStringProps;
  // (undocumented)
  transformInPlace(transform: Transform): boolean;
  underline?: boolean;
  // (undocumented)
  readonly width: number;
  // (undocumented)
  widthFactor?: number;
}

// @public
interface TextStringProps {
  bold?: boolean;
  font: number;
  // (undocumented)
  height: number;
  italic?: boolean;
  origin?: XYZProps;
  rotation?: YawPitchRollProps;
  text: string;
  underline?: boolean;
  // (undocumented)
  widthFactor?: number;
}

// @beta (undocumented)
enum TextureFlags {
  // (undocumented)
  None = 0
}

// @beta (undocumented)
class TextureMapping {
}

// @beta
interface TextureMapProps {
  pattern_angle?: number;
  pattern_flip?: boolean;
  pattern_mapping?: TextureMapping.Mode;
  pattern_offset?: DPoint2dProps;
  pattern_scale?: DPoint2dProps;
  pattern_scalemode?: TextureMapUnits;
  pattern_u_flip?: boolean;
  pattern_weight?: number;
  TextureId: Id64String;
}

// @beta (undocumented)
enum TextureMapUnits {
  // (undocumented)
  Feet = 5,
  // (undocumented)
  Inches = 6,
  // (undocumented)
  Meters = 3,
  // (undocumented)
  Millimeters = 4,
  // (undocumented)
  Relative = 0
}

// @beta
interface TextureProps extends DefinitionElementProps {
  data: string;
  description?: string;
  flags: TextureFlags;
  format: ImageSourceFormat;
  height: number;
  width: number;
}

// @alpha
interface ThumbnailFormatProps {
  format: "jpeg" | "png";
  height: number;
  width: number;
}

// @alpha
interface ThumbnailProps extends ThumbnailFormatProps {
  // (undocumented)
  image: Uint8Array;
}

// @public (undocumented)
interface TileProps {
  contentId: string;
  contentRange?: Range3dProps;
  isLeaf?: boolean;
  maximumSize: number;
  range: Range3dProps;
  sizeMultiplier?: number;
  transformToRoot?: TransformProps;
}

// WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
// @internal (undocumented)
interface TileTreeProps {
  formatVersion?: number;
  id: string;
  isTerrain?: boolean;
  location: TransformProps;
  maxTilesToSkip?: number;
  rootTile: TileProps;
  yAxisUp?: boolean;
}

// @public
class TypeDefinition extends RelatedElement {
}

// @public
interface TypeDefinitionElementProps extends DefinitionElementProps {
  // (undocumented)
  recipe?: RelatedElementProps;
}

// @public (undocumented)
interface ViewAttachmentLabelProps extends GeometricElement2dProps {
  // (undocumented)
  viewAttachment?: RelatedElementProps;
}

// @public
interface ViewAttachmentProps extends GeometricElement2dProps {
  // (undocumented)
  view: RelatedElementProps;
}

// @public
interface ViewDefinition2dProps extends ViewDefinitionProps {
  // (undocumented)
  angle: AngleProps;
  // (undocumented)
  baseModelId: Id64String;
  // (undocumented)
  delta: XYProps;
  // (undocumented)
  origin: XYProps;
}

// @public
interface ViewDefinition3dProps extends ViewDefinitionProps {
  angles?: YawPitchRollProps;
  camera: CameraProps;
  cameraOn: boolean;
  extents: XYZProps;
  origin: XYZProps;
}

// @public
interface ViewDefinitionProps extends DefinitionElementProps {
  // (undocumented)
  categorySelectorId: Id64String;
  // (undocumented)
  description?: string;
  // (undocumented)
  displayStyleId: Id64String;
}

// @public (undocumented)
module ViewFlag {
  class Overrides {
    constructor(flags?: ViewFlags);
    // (undocumented)
    anyOverridden(): boolean;
    apply(base: ViewFlags): ViewFlags;
    // (undocumented)
    clear(): void;
    // WARNING: The type "Overrides" needs to be exported by the package (e.g. added to index.ts)
    // WARNING: The type "Overrides" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    clone(out?: Overrides): Overrides;
    // WARNING: The type "Overrides" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    copyFrom(other: Overrides): void;
    // WARNING: The type "PresenceFlag" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    isPresent(flag: PresenceFlag): boolean;
    // (undocumented)
    overrideAll(flags?: ViewFlags): void;
    // (undocumented)
    setEdgeMask(val: number): void;
    // (undocumented)
    setIgnoreGeometryMap(val: boolean): void;
    // (undocumented)
    setMonochrome(val: boolean): void;
    // WARNING: The type "PresenceFlag" needs to be exported by the package (e.g. added to index.ts)
    // (undocumented)
    setPresent(flag: PresenceFlag): void;
    // (undocumented)
    setRenderMode(val: RenderMode): void;
    // (undocumented)
    setShowBackgroundMap(val: boolean): void;
    // (undocumented)
    setShowCameraLights(val: boolean): void;
    // (undocumented)
    setShowClipVolume(val: boolean): void;
    // (undocumented)
    setShowConstructions(val: boolean): void;
    // (undocumented)
    setShowDimensions(val: boolean): void;
    // (undocumented)
    setShowFill(val: boolean): void;
    // (undocumented)
    setShowHiddenEdges(val: boolean): void;
    // (undocumented)
    setShowMaterials(val: boolean): void;
    // (undocumented)
    setShowPatterns(val: boolean): void;
    // (undocumented)
    setShowShadows(val: boolean): void;
    // (undocumented)
    setShowSolarLight(val: boolean): void;
    // (undocumented)
    setShowSourceLights(val: boolean): void;
    // (undocumented)
    setShowStyles(val: boolean): void;
    // (undocumented)
    setShowTextures(val: boolean): void;
    // (undocumented)
    setShowTransparency(val: boolean): void;
    // (undocumented)
    setShowVisibleEdges(val: boolean): void;
    // (undocumented)
    setShowWeights(val: boolean): void;
    // (undocumented)
    setUseHlineMaterialColors(val: boolean): void;
  }

  // (undocumented)
  enum PresenceFlag {
    // (undocumented)
    kBackgroundMap = 23,
    // (undocumented)
    kCameraLights = 14,
    // (undocumented)
    kClipVolume = 17,
    // (undocumented)
    kConstructions = 18,
    // (undocumented)
    kContinuousRendering = 7,
    // (undocumented)
    kDimensions = 2,
    // (undocumented)
    kEdgeMask = 22,
    // (undocumented)
    kFill = 8,
    // (undocumented)
    kGeometryMap = 20,
    // (undocumented)
    kHiddenEdges = 12,
    // (undocumented)
    kHlineMaterialColors = 21,
    // (undocumented)
    kMaterials = 10,
    // (undocumented)
    kMonochrome = 19,
    // (undocumented)
    kPatterns = 3,
    // (undocumented)
    kRenderMode = 0,
    // (undocumented)
    kShadows = 16,
    // (undocumented)
    kSolarLight = 15,
    // (undocumented)
    kSourceLights = 13,
    // (undocumented)
    kStyles = 5,
    // (undocumented)
    kText = 1,
    // (undocumented)
    kTextures = 9,
    // (undocumented)
    kTransparency = 6,
    // (undocumented)
    kVisibleEdges = 11,
    // (undocumented)
    kWeights = 4
  }

}

// @public
interface ViewFlagProps {
  acs?: boolean;
  ambientOcclusion?: boolean;
  backgroundMap?: boolean;
  clipVol?: boolean;
  contRend?: boolean;
  // (undocumented)
  edgeMask?: number;
  grid?: boolean;
  hidEdges?: boolean;
  hlMatColors?: boolean;
  monochrome?: boolean;
  noCameraLights?: boolean;
  noConstruct?: boolean;
  noDim?: boolean;
  noFill?: boolean;
  noMaterial?: boolean;
  noPattern?: boolean;
  noSolarLight?: boolean;
  noSourceLights?: boolean;
  noStyle?: boolean;
  noTexture?: boolean;
  noTransp?: boolean;
  noWeight?: boolean;
  renderMode?: number;
  shadows?: boolean;
  visEdges?: boolean;
}

// @public
class ViewFlags {
  acsTriad: boolean;
  ambientOcclusion: boolean;
  backgroundMap: boolean;
  cameraLights: boolean;
  clipVolume: boolean;
  // (undocumented)
  clone(out?: ViewFlags): ViewFlags;
  constructions: boolean;
  continuousRendering: boolean;
  // (undocumented)
  static createFrom(other?: ViewFlags, out?: ViewFlags): ViewFlags;
  dimensions: boolean;
  edgeMask: number;
  // (undocumented)
  edgesRequired(): boolean;
  // (undocumented)
  equals(other: ViewFlags): boolean;
  fill: boolean;
  // (undocumented)
  static fromJSON(json?: ViewFlagProps): ViewFlags;
  grid: boolean;
  hiddenEdges: boolean;
  // (undocumented)
  hiddenEdgesVisible(): boolean;
  hLineMaterialColors: boolean;
  materials: boolean;
  monochrome: boolean;
  noGeometryMap: boolean;
  patterns: boolean;
  renderMode: RenderMode;
  shadows: boolean;
  solarLight: boolean;
  sourceLights: boolean;
  styles: boolean;
  textures: boolean;
  // (undocumented)
  toJSON(): ViewFlagProps;
  transparency: boolean;
  visibleEdges: boolean;
  weights: boolean;
}

// @alpha
interface ViewQueryParams extends EntityQueryParams {
  // (undocumented)
  wantPrivate?: boolean;
}

// @public
interface ViewStateProps {
  // (undocumented)
  categorySelectorProps: CategorySelectorProps;
  // (undocumented)
  displayStyleProps: DisplayStyleProps;
  // (undocumented)
  modelSelectorProps?: ModelSelectorProps;
  // (undocumented)
  sheetAttachments?: Id64Array;
  // (undocumented)
  sheetProps?: SheetProps;
  // (undocumented)
  viewDefinitionProps: ViewDefinitionProps;
}

// @public
class WebAppRpcProtocol extends RpcProtocol {
  constructor(configuration: RpcConfiguration);
  static computeContentType(httpType: string | null | undefined): RpcContentType;
  getCode(status: RpcRequestStatus): number;
  getStatus(code: number): RpcRequestStatus;
  handleOpenApiDescriptionRequest(_req: HttpServerRequest, res: HttpServerResponse): void;
  handleOperationGetRequest(req: HttpServerRequest, res: HttpServerResponse): Promise<void>;
  handleOperationPostRequest(req: HttpServerRequest, res: HttpServerResponse): Promise<void>;
  // WARNING: The type "OpenAPIInfo" needs to be exported by the package (e.g. added to index.ts)
  info: OpenAPIInfo;
  isTimeout(code: number): boolean;
  // WARNING: The type "RpcOpenAPIDescription" needs to be exported by the package (e.g. added to index.ts)
  readonly openAPIDescription: RpcOpenAPIDescription;
  pathPrefix: string;
  readonly requestType: typeof WebAppRpcRequest;
  // WARNING: The type "OpenAPIParameter" needs to be exported by the package (e.g. added to index.ts)
  abstract supplyPathParametersForOperation(_operation: RpcOperation): OpenAPIParameter[];
}

// @public
class WebAppRpcRequest extends RpcRequest {
  constructor(client: RpcInterface, operation: string, parameters: any[]);
  protected static computeTransportType(value: RpcSerializedValue, source: any): RpcContentType;
  // (undocumented)
  protected handleUnknownResponse(code: number): void;
  // (undocumented)
  protected load(): Promise<RpcSerializedValue>;
  static maxUrlComponentSize: number;
  metadata: {
    message: string;
    status: number;
  }
  method: HttpMethod_T;
  static parseRequest(protocol: WebAppRpcProtocol, req: HttpServerRequest): Promise<SerializedRpcRequest>;
  readonly protocol: WebAppRpcProtocol;
  protected send(): Promise<number>;
  static sendResponse(_protocol: WebAppRpcProtocol, request: SerializedRpcRequest, fulfillment: RpcRequestFulfillment, res: HttpServerResponse): void;
  protected setHeader(name: string, value: string): void;
}

// @public
class WipRpcInterface extends RpcInterface {
  // (undocumented)
  attachChangeCache(_iModelToken: IModelToken): Promise<void>;
  // (undocumented)
  detachChangeCache(_iModelToken: IModelToken): Promise<void>;
  // (undocumented)
  getChangedElements(_iModelToken: IModelToken, _startChangesetId: string, _endChangesetId: string): Promise<ChangedElements | undefined>;
  static getClient(): WipRpcInterface;
  // (undocumented)
  isChangeCacheAttached(_iModelToken: IModelToken): Promise<boolean>;
  // (undocumented)
  isChangesetProcessed(_iModelToken: IModelToken, _changesetId: string): Promise<boolean>;
  // (undocumented)
  placeholder(_iModelToken: IModelToken): Promise<string>;
  static types: () => (typeof IModelToken)[];
  static version: string;
}

// WARNING: Unsupported export: CodeScopeProps
// WARNING: Unsupported export: ColorDefProps
// WARNING: Unsupported export: PlacementProps
// WARNING: Unsupported export: PropertyCallback
// WARNING: Unsupported export: GateValue
// WARNING: Unsupported export: NpcCorners
// WARNING: Unsupported export: NpcCenter
// WARNING: Unsupported export: RpcInterfaceImplementation
// WARNING: Unsupported export: GetMetaDataFunction
// WARNING: Unsupported export: LogFunction
// WARNING: Unsupported export: RgbFactorProps
// WARNING: Unsupported export: DPoint2dProps
// WARNING: Unsupported export: kPagingDefaultOptions
// WARNING: Unsupported export: GeometryStreamProps
// WARNING: Unsupported export: AxisAlignedBox3d
// WARNING: Unsupported export: ElementAlignedBox3d
// WARNING: Unsupported export: ElementAlignedBox2d
// WARNING: Unsupported export: LocalAlignedBox3d
// WARNING: Unsupported export: WEB_RPC_CONSTANTS
// WARNING: Unsupported export: RpcConfigurationSupplier
// WARNING: Unsupported export: RpcInvocationCallback_T
// WARNING: Unsupported export: RpcProtocolEventHandler
// WARNING: Unsupported export: REGISTRY
// WARNING: Unsupported export: OPERATION
// WARNING: Unsupported export: POLICY
// WARNING: Unsupported export: INSTANCE
// WARNING: Unsupported export: CURRENT_REQUEST
// WARNING: Unsupported export: CURRENT_INVOCATION
// WARNING: Unsupported export: builtins
// WARNING: Unsupported export: RpcRequestTokenSupplier_T
// WARNING: Unsupported export: RpcRequestIdSupplier_T
// WARNING: Unsupported export: RpcRequestInitialRetryIntervalSupplier_T
// WARNING: Unsupported export: RpcRequestCallback_T
// WARNING: Unsupported export: RpcResponseCachingCallback_T
// WARNING: Unsupported export: RpcRequestEventHandler
// WARNING: Unsupported export: RpcRequestNotFoundHandler
// WARNING: Unsupported export: initializeRpcRequest
// WARNING: Unsupported export: HttpMethod_T
// (No @packagedocumentation comment for this package)
