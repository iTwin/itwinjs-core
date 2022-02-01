const globalSymbol = Symbol.for("itwin.core.frontend.globals");
const ext = globalThis[globalSymbol].getExtensionApi("import.meta.url");

// export extension stuff
export const { registerTool } = ext.api;

// BEGIN GENERATED CODE
export const {
// @itwin/core-frontend:
	ContextRotationId,
	ACSType,
	ACSDisplayOptions,
	CoordSystem,
	LocateAction,
	LocateFilterStatus,
	SnapStatus,
	FlashMode,
	FrontendLoggerCategory,
	SnapMode,
	SnapHeat,
	HitSource,
	HitGeomType,
	HitParentGeomType,
	HitPriority,
	HitDetailType,
	OutputMessageType,
	OutputMessagePriority,
	OutputMessageAlert,
	ActivityMessageEndReason,
	MessageBoxType,
	MessageBoxIconType,
	MessageBoxValue,
	GraphicType,
	TextureTransparency,
	UniformType,
	VaryingType,
	SelectionSetEventType,
	StandardViewId,
	TileLoadStatus,
	TileVisibility,
	TileLoadPriority,
	TileBoundingBoxes,
	TileTreeLoadStatus,
	TileGraphicType,
	ClipEventType,
	SelectionMethod,
	SelectionMode,
	SelectionProcessing,
	BeButton,
	CoordinateLockOverrides,
	InputSource,
	CoordSource,
	BeModifierKeys,
	EventHandled,
	ParseAndRunResult,
	KeyinParseError,
	StartOrResume,
	ManipulatorToolEvent,
	ToolAssistanceImage,
	ToolAssistanceInputMethod,
	DepthPointSource,
	ViewUndoEvent,
	ViewStatus,
	AccuDrawHintBuilder, // REAL 
	BingLocationProvider, // REAL 
	LocateResponse, // REAL 
	EmphasizeElements, // REAL 
	ExtensionHost, // REAL 
	FrustumAnimator, // REAL 
	GlobeAnimator, // REAL 
	canvasToResizedCanvasWithBars, // REAL 
	imageBufferToCanvas, // REAL 
	canvasToImageBuffer, // REAL 
	getImageSourceMimeType, // REAL 
	getImageSourceFormatForMimeType, // REAL 
	imageElementFromImageSource, // REAL 
	imageElementFromUrl, // REAL 
	extractImageSourceDimensions, // REAL 
	imageBufferToPngDataUrl, // REAL 
	imageBufferToBase64EncodedPng, // REAL 
	getCompressedJpegFromCanvas, // REAL 
	MarginPercent, // REAL 
	Marker, // REAL 
	Cluster, // REAL 
	NotifyMessageDetails, // REAL 
	FeatureSymbology, // REAL 
	GraphicBranch, // REAL 
	Pixel, // REAL 
	readElementGraphics, // REAL 
	BingElevationProvider, // REAL 
	EditManipulator, // REAL 
	PrimitiveTool, // REAL 
	BeButtonEvent, // REAL 
	Tool, // REAL 
	InteractiveTool, // REAL 
	InputCollector, // REAL 
	ToolAssistance, // REAL 
	ViewTool, // REAL 
	queryTerrainElevationOffset, // REAL 
	ViewRect, // REAL 
// @itwin/core-common:
	BackgroundMapType,
	GlobeMode,
	BriefcaseIdValue,
	SyncMode,
	TypeOfChange,
	ChangesetType,
	BisCodeSpec,
	ColorByName,
	CommonLoggerCategory,
	QueryRowFormat,
	MonochromeMode,
	ECSqlValueType,
	ChangeOpCode,
	ChangedValueState,
	ECSqlSystemProperty,
	SectionType,
	Rank,
	FeatureOverrideType,
	BatchType,
	FontType,
	Npc,
	GeoCoordStatus,
	ElementGeometryOpcode,
	GeometryStreamFlags,
	FillDisplay,
	BackgroundFill,
	GeometryClass,
	GeometrySummaryVerbosity,
	FillFlags,
	HSVConstants,
	ImageBufferFormat,
	ImageSourceFormat,
	LinePixels,
	MassPropertiesOperation,
	TextureMapUnits,
	PlanarClipMaskMode,
	PlanarClipMaskPriority,
	SkyBoxImageType,
	SpatialClassifierInsideDisplay,
	SpatialClassifierOutsideDisplay,
	TerrainHeightOriginMode,
	ThematicGradientMode,
	ThematicGradientColorScheme,
	ThematicDisplayMode,
	TxnAction,
	GridOrientationType,
	RenderMode,
	ColorDef, // REAL 
} = ext.exports;
// END GENERATED CODE