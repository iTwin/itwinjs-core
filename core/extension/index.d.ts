/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

// manually curated section

// these types are needed for ExtensionHost
import type {
	ToolAdmin,
	NotificationManager,
	ViewManager,
	ElementLocateManager,
	AccuSnap,
	RenderSystem
} from "@itwin/core-frontend";
// ExtensionHost must always be in the API
export declare class ExtensionHost {
	public static get toolAdmin(): ToolAdmin;
  public static get notifications(): NotificationManager;
  public static get viewManager(): ViewManager;
  public static get locateManager(): ElementLocateManager;
  public static get accuSnap(): AccuSnap;
  public static get renderSystem(): RenderSystem;
}

// BEGIN GENERATED CODE
export {
	ACSDisplayOptions,
	ACSType,
	AccuDrawHintBuilder,
	AccuSnap,
	ActivityMessageDetails,
	ActivityMessageEndReason,
	AuxCoordSystem2dState,
	AuxCoordSystem3dState,
	AuxCoordSystemSpatialState,
	AuxCoordSystemState,
	BeButton,
	BeButtonEvent,
	BeButtonState,
	BeModifierKeys,
	BeTouchEvent,
	BeWheelEvent,
	BingElevationProvider,
	BingLocationProvider,
	CategorySelectorState,
	ChangeFlags,
	ClipEventType,
	Cluster,
	ContextRealityModelState,
	ContextRotationId,
	CoordSource,
	CoordSystem,
	CoordinateLockOverrides,
	DecorateContext,
	Decorations,
	DisclosedTileTreeSet,
	DisplayStyle2dState,
	DisplayStyle3dState,
	DisplayStyleState,
	DrawingModelState,
	DrawingViewState,
	EditManipulator,
	ElementLocateManager,
	ElementPicker,
	ElementState,
	EmphasizeElements,
	EntityState,
	EventController,
	EventHandled,
	FeatureSymbology,
	FlashMode,
	FlashSettings,
	FrontendLoggerCategory,
	FrustumAnimator,
	GeometricModel2dState,
	GeometricModel3dState,
	GeometricModelState,
	GlobeAnimator,
	GraphicAssembler,
	GraphicBranch,
	GraphicBuilder,
	GraphicType,
	HiliteSet,
	HitDetail,
	HitDetailType,
	HitGeomType,
	HitList,
	HitParentGeomType,
	HitPriority,
	HitSource,
	IModelConnection,
	IconSprites,
	InputCollector,
	InputSource,
	InteractiveTool,
	IntersectDetail,
	KeyinParseError,
	LocateAction,
	LocateFilterStatus,
	LocateOptions,
	LocateResponse,
	ManipulatorToolEvent,
	MarginPercent,
	Marker,
	MarkerSet,
	MessageBoxIconType,
	MessageBoxType,
	MessageBoxValue,
	ModelSelectorState,
	ModelState,
	NotificationHandler,
	NotificationManager,
	NotifyMessageDetails,
	OffScreenViewport,
	OrthographicViewState,
	OutputMessageAlert,
	OutputMessagePriority,
	OutputMessageType,
	ParseAndRunResult,
	ParticleCollectionBuilder,
	PerModelCategoryVisibility,
	PhysicalModelState,
	Pixel,
	PrimitiveTool,
	RenderClipVolume,
	RenderContext,
	RenderGraphic,
	RenderGraphicOwner,
	RenderSystem,
	Scene,
	ScreenViewport,
	SectionDrawingModelState,
	SelectionMethod,
	SelectionMode,
	SelectionProcessing,
	SelectionSet,
	SelectionSetEventType,
	SheetModelState,
	SheetViewState,
	SnapDetail,
	SnapHeat,
	SnapMode,
	SnapStatus,
	SpatialLocationModelState,
	SpatialModelState,
	SpatialViewState,
	Sprite,
	SpriteLocation,
	StandardViewId,
	StartOrResume,
	TentativePoint,
	Tile,
	TileAdmin,
	TileBoundingBoxes,
	TileDrawArgs,
	TileGraphicType,
	TileLoadPriority,
	TileLoadStatus,
	TileRequest,
	TileRequestChannel,
	TileRequestChannelStatistics,
	TileRequestChannels,
	TileTree,
	TileTreeLoadStatus,
	TileTreeReference,
	TileUsageMarker,
	TileVisibility,
	Tiles,
	Tool,
	ToolAdmin,
	ToolAssistance,
	ToolAssistanceImage,
	ToolAssistanceInputMethod,
	ToolSettings,
	TwoWayViewportFrustumSync,
	TwoWayViewportSync,
	UniformType,
	VaryingType,
	ViewClipClearTool,
	ViewClipDecoration,
	ViewClipDecorationProvider,
	ViewClipTool,
	ViewCreator2d,
	ViewCreator3d,
	ViewManager,
	ViewManip,
	ViewPose,
	ViewPose2d,
	ViewPose3d,
	ViewRect,
	ViewState,
	ViewState2d,
	ViewState3d,
	ViewStatus,
	ViewTool,
	ViewingSpace,
	Viewport,
	canvasToImageBuffer,
	canvasToResizedCanvasWithBars,
	connectViewportFrusta,
	connectViewportViews,
	connectViewports,
	extractImageSourceDimensions,
	getCompressedJpegFromCanvas,
	getImageSourceFormatForMimeType,
	getImageSourceMimeType,
	imageBufferToBase64EncodedPng,
	imageBufferToCanvas,
	imageBufferToPngDataUrl,
	imageElementFromImageSource,
	imageElementFromUrl,
	queryTerrainElevationOffset,
	readElementGraphics,
	readGltfGraphics,
	synchronizeViewportFrusta,
	synchronizeViewportViews
} from "@itwin/core-frontend";

export type {
	Animator,
	BatchOptions,
	BeButtonEventProps,
	BeTouchEventProps,
	BeWheelEventProps,
	CanvasDecoration,
	CanvasDecorationList,
	ComputeChordToleranceArgs,
	CreateTextureArgs,
	CreateTextureFromSourceArgs,
	CustomGraphicBuilderOptions,
	Decorator,
	ExtentLimits,
	FeatureOverrideProvider,
	FlashSettingsOptions,
	FrontendSecurityOptions,
	FuzzySearchResult,
	GlobalAlignmentOptions,
	GlobalLocation,
	GlobalLocationArea,
	GpuMemoryLimit,
	GpuMemoryLimits,
	GraphicArc,
	GraphicArc2d,
	GraphicBranchOptions,
	GraphicBuilderOptions,
	GraphicLineString,
	GraphicLineString2d,
	GraphicList,
	GraphicLoop,
	GraphicPath,
	GraphicPointString,
	GraphicPointString2d,
	GraphicPolyface,
	GraphicPrimitive,
	GraphicPrimitive2d,
	GraphicShape,
	GraphicShape2d,
	GraphicSolidPrimitive,
	HitListHolder,
	IModelIdArg,
	MarginOptions,
	MarkerFillStyle,
	MarkerImage,
	MarkerTextAlign,
	MarkerTextBaseline,
	OnViewExtentsError,
	OsmBuildingDisplayOptions,
	PaddingPercent,
	ParseKeyinError,
	ParseKeyinResult,
	ParsedKeyin,
	ParticleCollectionBuilder,
	ParticleCollectionBuilderParams,
	ParticleProps,
	PickableGraphicOptions,
	ReadGltfGraphicsArgs,
	ReadPixelsArgs,
	ScreenSpaceEffectBuilder,
	ScreenSpaceEffectBuilderParams,
	ScreenSpaceEffectContext,
	ScreenSpaceEffectSource,
	SelectAddEvent,
	SelectRemoveEvent,
	SelectReplaceEvent,
	SelectedViewportChangedArgs,
	SelectionSetEvent,
	SynchronizeViewports,
	TextureCacheKey,
	TextureCacheOwnership,
	TextureImage,
	TextureImageSource,
	TextureOwnership,
	TileContent,
	TileDrawArgParams,
	TileParams,
	TileTreeDiscloser,
	TileTreeOwner,
	TileTreeParams,
	TileTreeSupplier,
	TiledGraphicsProvider,
	ToolAssistanceInputKey,
	ToolAssistanceInstruction,
	ToolAssistanceInstructions,
	ToolAssistanceKeyboardInfo,
	ToolAssistancePromptKey,
	ToolAssistanceSection,
	ToolList,
	ToolTipOptions,
	ToolType,
	TxnEntityChange,
	TxnEntityChangeIterable,
	TxnEntityChangeType,
	TxnEntityChanges,
	TxnEntityChangesFilterOptions,
	TxnEntityMetadata,
	TxnEntityMetadataCriterion,
	Uniform,
	UniformArrayParams,
	UniformContext,
	UniformParams,
	ViewAnimationOptions,
	ViewChangeOptions,
	ViewClipEventHandler,
	ViewCreator2dOptions,
	ViewCreator3dOptions,
	ViewportGraphicBuilderOptions
} from "@itwin/core-frontend";

export {
	BackgroundFill,
	BackgroundMapType,
	BatchType,
	BisCodeSpec,
	BriefcaseIdValue,
	ChangeOpCode,
	ChangedValueState,
	ChangesetType,
	ClipIntersectionStyle,
	ColorByName,
	ColorDef,
	CommonLoggerCategory,
	ECSqlSystemProperty,
	ECSqlValueType,
	ElementGeometryOpcode,
	FeatureOverrideType,
	FillDisplay,
	FillFlags,
	FontType,
	FrustumPlanes,
	GeoCoordStatus,
	GeometryClass,
	GeometryStreamFlags,
	GeometrySummaryVerbosity,
	GlobeMode,
	GridOrientationType,
	HSVConstants,
	ImageBufferFormat,
	ImageSourceFormat,
	LinePixels,
	MassPropertiesOperation,
	MonochromeMode,
	Npc,
	PlanarClipMaskMode,
	PlanarClipMaskPriority,
	QParams2d,
	QParams3d,
	QPoint2d,
	QPoint2dBuffer,
	QPoint2dBufferBuilder,
	QPoint2dList,
	QPoint3d,
	QPoint3dBuffer,
	QPoint3dBufferBuilder,
	QPoint3dList,
	Quantization,
	QueryRowFormat,
	Rank,
	RenderMode,
	SectionType,
	SkyBoxImageType,
	SpatialClassifierInsideDisplay,
	SpatialClassifierOutsideDisplay,
	SyncMode,
	TerrainHeightOriginMode,
	TextureMapUnits,
	ThematicDisplayMode,
	ThematicGradientColorScheme,
	ThematicGradientMode,
	ThematicGradientTransparencyMode,
	TxnAction,
	TypeOfChange
} from "@itwin/core-common";

export type {
	AdditionalTransformProps,
	AffineTransformProps,
	AmbientLightProps,
	AnalysisStyleDisplacementProps,
	AnalysisStyleProps,
	AnalysisStyleThematicProps,
	AppearanceOverrideProps,
	AreaFillProps,
	AuxCoordSystem2dProps,
	AuxCoordSystem3dProps,
	AuxCoordSystemProps,
	AxisAlignedBox3d,
	AxisAlignedBox3dProps,
	BRepPrimitive,
	BackgroundMapProps,
	BackgroundMapProviderName,
	Base64EncodedString,
	BaseReaderOptions,
	BriefcaseId,
	CalloutProps,
	CameraProps,
	Carto2DDegreesProps,
	CartographicProps,
	CategoryProps,
	CategorySelectorProps,
	ChangedElements,
	ChangedEntities,
	ChangesetId,
	ChangesetIdWithIndex,
	ChangesetIndex,
	ChangesetIndexAndId,
	ChangesetIndexOrId,
	ChangesetRange,
	ChannelRootAspectProps,
	ClipIntersectionStyleProps,
	ClipStyleCreateArgs,
	ClipStyleProps,
	CodeProps,
	CodeScopeProps,
	ColorDefProps,
	ContextRealityModelProps,
	ContextRealityModelsContainer,
	CutStyleProps,
	DanishSystem34Region,
	DefinitionElementProps,
	DeletedElementGeometryChange,
	DeprecatedBackgroundMapProps,
	DisplayStyle3dProps,
	DisplayStyle3dSettingsProps,
	DisplayStyleLoadProps,
	DisplayStyleModelAppearanceProps,
	DisplayStyleOverridesOptions,
	DisplayStylePlanarClipMaskProps,
	DisplayStyleProps,
	DisplayStyleSettingsOptions,
	DisplayStyleSettingsProps,
	DisplayStyleSubCategoryProps,
	DrawingProps,
	DynamicGraphicsRequest2dProps,
	DynamicGraphicsRequest3dProps,
	DynamicGraphicsRequestProps,
	EasingFunction,
	EcefLocationProps,
	ElementAlignedBox2d,
	ElementAlignedBox3d,
	ElementAspectProps,
	ElementGeometryChange,
	ElementGeometryDataEntry,
	ElementGraphicsRequestProps,
	ElementIdsAndRangesProps,
	ElementLoadOptions,
	ElementLoadProps,
	ElementProps,
	EmphasizeElementsProps,
	EntityIdAndClassId,
	EntityIdAndClassIdIterable,
	EntityProps,
	EntityQueryParams,
	EnvironmentProps,
	ExtantElementGeometryChange,
	ExternalSourceAspectProps,
	FeatureAppearanceProps,
	FeatureAppearanceProvider,
	FeatureAppearanceSource,
	FilePropertyProps,
	FlatBufferGeometryStream,
	FontId,
	FontMapProps,
	FresnelSettingsProps,
	FunctionalElementProps,
	GeocentricTransformProps,
	GeodeticDatumProps,
	GeodeticEllipsoidProps,
	GeodeticTransformMethod,
	GeodeticTransformProps,
	GeographicCRSProps,
	GeometricElement2dProps,
	GeometricElement3dProps,
	GeometricElementProps,
	GeometricModel2dProps,
	GeometricModel3dProps,
	GeometricModelProps,
	GeometryAppearanceProps,
	GeometryContainmentRequestProps,
	GeometryContainmentResponseProps,
	GeometryPartInstanceProps,
	GeometryPartProps,
	GeometryPrimitive,
	GeometryStreamEntryProps,
	GeometryStreamHeaderProps,
	GeometryStreamIteratorEntry,
	GeometryStreamPrimitive,
	GeometryStreamProps,
	GeometrySummaryOptions,
	GeometrySummaryRequestProps,
	GraphicsRequestProps,
	GridFileDefinitionProps,
	GridFileDirection,
	GridFileFormat,
	GridFileTransformProps,
	GroundPlaneProps,
	Helmert2DWithZOffsetProps,
	HemisphereEnum,
	HemisphereLightsProps,
	HorizontalCRSExtentProps,
	HorizontalCRSProps,
	ImageGraphicCornersProps,
	ImageGraphicProps,
	ImagePrimitive,
	InformationPartitionElementProps,
	InterpolationFunction,
	JsonGeometryStream,
	LightSettingsProps,
	LineStyleProps,
	LocalAlignedBox3d,
	LocalBriefcaseProps,
	Localization,
	MassPropertiesRequestProps,
	MassPropertiesResponseProps,
	MaterialProps,
	ModelClipGroupProps,
	ModelGeometryChanges,
	ModelGeometryChangesProps,
	ModelIdAndGeometryGuid,
	ModelLoadProps,
	ModelProps,
	ModelQueryParams,
	ModelSelectorProps,
	NavigationBindingValue,
	NavigationValue,
	PartReference,
	PersistentBackgroundMapProps,
	PersistentGraphicsRequestProps,
	PhysicalElementProps,
	PhysicalTypeProps,
	Placement,
	Placement2dProps,
	Placement3dProps,
	PlacementProps,
	PlanProjectionSettingsProps,
	PlanarClipMaskProps,
	Point2dProps,
	PositionalVectorTransformProps,
	ProjectionMethod,
	ProjectionProps,
	QPoint2dBuffer,
	QPoint3dBuffer,
	QueryLimit,
	QueryOptions,
	QueryQuota,
	RelatedElementProps,
	RelationshipProps,
	RemoveFunction,
	RenderMaterialAssetProps,
	RenderMaterialProps,
	RenderTimelineLoadProps,
	RenderTimelineProps,
	RepositoryLinkProps,
	RequestNewBriefcaseProps,
	RgbColorProps,
	RgbFactorProps,
	RootSubjectProps,
	RpcActivity,
	SectionDrawingLocationProps,
	SectionDrawingProps,
	SectionDrawingViewProps,
	SessionProps,
	SheetProps,
	SkyBoxImageProps,
	SkyBoxProps,
	SkyCubeProps,
	SolarLightProps,
	SolarShadowSettingsProps,
	SourceAndTarget,
	SpatialClassifierFlagsProps,
	SpatialClassifierProps,
	SpatialClassifiersContainer,
	SpatialViewDefinitionProps,
	SubCategoryProps,
	SubjectProps,
	TerrainProps,
	TextAnnotation2dProps,
	TextAnnotation3dProps,
	TextStringPrimitive,
	TextStringProps,
	TextureData,
	TextureLoadProps,
	TextureMapProps,
	TextureProps,
	ThematicDisplayProps,
	ThematicDisplaySensorProps,
	ThematicDisplaySensorSettingsProps,
	ThematicGradientSettingsProps,
	ThumbnailFormatProps,
	ThumbnailProps,
	TileVersionInfo,
	TweenCallback,
	TypeDefinitionElementProps,
	UnitType,
	UpdateCallback,
	UrlLinkProps,
	VerticalCRSProps,
	ViewAttachmentLabelProps,
	ViewAttachmentProps,
	ViewDefinition2dProps,
	ViewDefinition3dProps,
	ViewDefinitionProps,
	ViewDetails3dProps,
	ViewDetailsProps,
	ViewFlagOverrides,
	ViewFlagProps,
	ViewFlagsProperties,
	ViewQueryParams,
	ViewStateLoadProps,
	ViewStateProps,
	WhiteOnWhiteReversalProps,
	XyzRotationProps
} from "@itwin/core-common";

// END GENERATED CODE
