---
ignore: true
---

# Mapping of C++ types to TypeScript types

|Native Name |Native Path |TS Name |TS Path | Notes |
|------------|------------|--------|--------|-------|
| AngleInDegrees |Geom/Angle.h |Angle| @bentley/geometry-core
| AsThickenedLine|DgnPlatform/Render.h|AsThickenedLine|./source/common/Render.ts| enum
| BackgroundFill| DgnPlatform/Render.h |BackgroundFill|./source/common/Render.ts| enum
| BentleyStatus | Bentley/Bentley.h |BentleyStatus | @bentley/bentleyjs-core | enum
| ClipVector| DgnPlatform/ClipVector.h|ClipVector |@bentley/geometry-core| |
| ColorDef| DgnPlatform/Render.h|ColorDef|./source/common/ColorDef.ts |
| ColorIndex::NonUniform | DgnPlatform/Render.h | ColorIndexNonUniform | ./source/frontend/render/webgl/FeatureIndex.ts | |
| ColorIndex| DgnPlatform/Render.h | ColorIndex | ./source/frontend/render/webgl/FeatureIndex.ts | |
| ColorTable | DgnPlatform/RenderPrimitives.h | ColorMap | ./source/frontend/render/primitives/ColorMap.ts | |
| ColorTable::Map | DgnPlatform/RenderPrimitives.h | ColorMap | ./source/frontend/render/primitives/ColorMap.ts | not distinct struct anymore, merged into ColorMap |
| CurveVector | Geom/CurveVector.h | N/A | | path |
| DecorationList | DgnPlatform/Render.h | N/A | | enum |
| DEllipse3d | Geom/dellipse3d.h | N/A | | Arc3d + loop |
| Device | DgnPlatform/Render.h | N/A | | |
| Device::PixelsPerInch | DgnPlatform/Render.h | N/A
| DgnCategoryId | DgnPlatform/DgnCategory.h | Id64 | @bentley/bentleyjs-core | |
| DgnDb | DgnPlatform/DgnDb.h | IModel | ./source/common/IModel.ts | common |
| DgnDb | DgnPlatform/DgnDb.h | IModelConnection | ./source/frontend/IModelConnection.ts | frontend |
| DgnDb | DgnPlatform/DgnDb.h | IModelDb | ./source/backend/IModelDb.ts | backend |
| DgnElementId | DgnPlatform/DgnPlatformNET/DgnPlatformNet.cpp | Id64 | @bentley/bentleyjs-core | there are no subclasses for Id types
| DgnGeometryClass | DgnPlatform/Render.h | GeometryClass | ./source/common/Render.ts | enum |
| DgnGeometryPart | DgnPlatform/GeomPart.h | GeometryPart | ./source/backend/ElementGeometry.ts | should there be frontend equivalent? |
| DgnGeometryPartId | DgnPlatform/GeomPart.h | Id64 | @bentley/bentleyjs-core | |
| DgnModel | DgnPlatform/DgnModel.ts | ModelProps | ./source/common/ModelProps | |
| DgnOleDraw | DgnPlatform/Render.ts | N/A | | |
| DgnSubCategoryId | DgnPlatform/DgnCategory.h | Id64 | @bentley/bentleyjs-core | |
| DisplayParams | DgnPlatform/RenderPrimitives.h | N/A | | |
| DisplayParams::Type | DgnPlatform/RenderPrimitives.h | DisplayParamsType | N/A | enum |
| DisplayParamsCache | DgnPlatform/RenderPrimitives.h | N/A | | |
| DisplayParamsCache::Comparator | DgnPlatform/RenderPrimitives.h | N/A | | |
| DisplayParamsCache::Set | DgnPlatform/RenderPrimitives.h | N/A | | |
| DPoint2d | Geom/GeomApi.r.h | Point2d | @bentley/geometry-core
| DPoint3d | Geom/GeomApi.r.h | Point3d | @bentley/geometry-core
| DRange2d | Geom/GeomApi.r.h | Range2d | @bentley/geometry-core
| DRange3d | Geom/GeomApi.r.h | Range3d | @bentley/geometry-core
| DSegment3d | Geom/dsegment3d.h | LineSegment3d | @bentley/geometry-core
| DVec3d | Geom/dvec3d.h | Vector3d | @bentley/geometry-core
| EdgeArgs | DgnPlatform/Render.h | N/A | | |
| Feature | DgnPlatform/Render.h | Feature | ./source/common/Render.h | |
| FeatureIndex | DgnPlatform/Render.h | FeatureIndex | ./source/frontend/render/webgl/FeatureIndex.ts | |
| FeatureIndex::Type | DgnPlatform/Render.h | FeatureIndexType | ./source/frontend/render/webgl/FeatureIndex.ts | enum |
| FeatureSymbologyOverrides | DgnPlatform/Render.h | FeatureSymbology.Overrides | ./source/frontend/render/FeatureSymbology.ts | |
| FeatureSymbologyOverrides::Appearance | DgnPlatform/Render.h | FeatureSymbology.Appearance | ./source/frontend/render/FeatureSymbology.ts | |
| FeatureSymbologyOverrides::Appearance::Flags | DgnPlatform/Render.h | FeatureSymbology.AppearanceFlags | ./source/frontend/render/FeatureSymbology.ts | |
| FeatureTable | DgnPlatform/Render.h | FeatureTable | ./source/common/Render.h | |
| FillDisplay | DgnPlatform/Render.h | FillDisplay | ./source/common/Render.ts | enum |
| FillFlags | DgnPlatform/Render.h | N/A | | enum |
| FrustumPlanes | DgnPlatform/Render.h | N/A | | |
| GeometricPrimitive | DgnPlatform/ElementGeometry.h | GeometricPrimitive | ./source/common/geometry/Primitives.ts | |
| Geometry | DgnPlatform/RenderPrimitives.h | Geometry | @bentley/geometry-core | |
| Geometry | DgnPlatform/RenderPrimitives.h | N/A | | |
| GeometryAccumulator | DgnPlatform/RenderPrimitives.h | N/A | | |
| GeometryBuilder | DgnPlatform/ElementGeometry.h | GeometryStreamBuilder | ./source/common/geometry/GeometryStream.ts | |
| GeometryBuilder::CoordSystem | DgnPlatform/ElementGeometry.h | GeomCoordSystem | ./source/common/geometry/GeometryStream.ts | |
| GeometryCollection | DgnPlatform/RenderPrimitives.h | N/A | | |
| GeometryList | DgnPlatform/RenderPrimitives.h | N/A | | |
| GeometryListBuilder | DgnPlatform/RenderPrimitives.h | N/A | | |
| GeometryOptions | DgnPlatform/RenderPrimitives.h | GeometryOptions | ./source/frontend/render/primitives/Primitives.ts | |
| GeometryOptions::GenerateEdges | DgnPlatform/RenderPrimitives.h | GenerateEdges | ./source/frontend/render/primitives/Primitives.ts | enum |
| GeometryOptions::PreserveOrder | DgnPlatform/RenderPrimitives.h | PreserveOrder | ./source/frontend/render/primitives/Primitives.ts | enum |
| GeometryOptions::SurfacesOnly | DgnPlatform/RenderPrimitives.h | SurfacesOnly | ./source/frontend/render/primitives/Primitives.ts | enum |
| GeometryParams | DgnPlatform/Render.h | GeometryParams | ./source/common/Render.ts | |
| GeometryParams::AppearanceOverrides | DgnPlatform/Render.h | AppearanceOverrides | ./source/common/Render.ts | |
| GeometryStream | DgnPlatform/DgnElement.h | GeometryStream | @bentley/imodeljs-common | |
| GeometryStreamEntryId | DgnPlatform/DgnPlatform.h | GeometryStreamEntryId | @bentley/imodeljs-common | |
| GeometryStreamIO::OpCode | DgnPlatform/ElementGeometry.h | OpCode | ./source/common/geometry/GeometryStream.ts | enum |
| GeometryStreamIO::Writer | DgnPlatform/ElementGeometry.h | OpCodeWriter | ./source/common/geometry/GeometryStream.ts | |
| GeomPart | DgnPlatform/RenderPrimitives.h | N/A | | |
| GradientSymb | DgnPlatform/Render.h | N/A | | |
| GradientSymb::Flags | DgnPlatform/Render.h | N/A | | enum |
| GradientSymb::Mode | DgnPlatform/Render.h | N/A | | enum |
| Graphic | DgnPlatform/Render.h | Graphic | ./source/frontend/render/Graphic.ts | |
| GraphicBranch | DgnPlatform/Render.h | N/A | | |
| GraphicBuilder | DgnPlatform/Render.h | GraphicBuilder | ./source/frontend/render/GraphicBuilder.ts | looks unfinished and should it be abstract? |
| GraphicBuilder::AsThickenedLine | DgnPlatform/Render.h | AsThickenedLine | ./source/common/Render.ts | |
| GraphicBuilder::CreateParams | DgnPlatform/Render.h | GraphicBuilderCreateParams | ./source/frontend/render/GraphicBuilder.ts | |
| GraphicBuilder::TileCorners | DgnPlatform/Render.h | GraphicBuilderTileCorners | ./source/frontend/render/GraphicBuilder.ts | |
| GraphicList | DgnPlatform/Render.h | GraphicList | ./source/frontend/render/Graphic.ts | list |
| GraphicParams | DgnPlatform/Render.h | GraphicParams | ./source/common/Render.ts | |
| GraphicType | DgnPlatform/Render.h | GraphicType | ./source/frontend/render/GraphicBuilder.ts | enum |
| HDRImage | DgnPlatform/Render.h | N/A | | |
| HDRImage::Encoding | DgnPlatform/Render.h | N/A | | enum |
| HiddenLineParams | DgnPlatform/Render.h | HiddenLine.Params | ./source/common/Render.ts | |
| HiddenLineParams::Style | DgnPlatform/Render.h | HiddenLine.Style | ./source/common/Render.ts | |
| HiliteSettings | DgnPlatform/Render.h | Hilite.Settings | ./source/common/Render.ts | |
| HiliteSettings::Defaults | DgnPlatform/Render.h | N/A | | unexported consts of Hilite namespace in common/Render |
| HiliteSettings::Silhouette | DgnPlatform/Render.h | Hilite.Silhouette | ./source/common/Render.ts | enum |
| IBRepEntity | DgnPlatform/SolidKernal.h | N/A | | |
| ICurvePrimitive | Geom/CurvePrimitive.h | CurvePrimitive | @bentley/geometry-core | |
| IFacetOptions | Geom/FacetOptions.h | StrokeOptions | @bentley/geometry-core | |
| IGeometry | Geom/GeomApi.h | GeometryQuery | @bentley/geometry-core | |
| Image | DgnPlatform/Render.h | Image | ./source/common/Image.ts
| Image::BottomUp | DgnPlatform/Render.h | BottomUp |./source/common/Image.ts | enum |
| Image::Format | DgnPlatform/Render.h | ImageBufferFormat | ./source/common/Image.ts |enum
| ImageLight | DgnPlatform/Render.h | N/A | | |
| ImageLight::Mapping | DgnPlatform/Render.h | N/A | | enum |
| ImageSource | DgnPlatform/Render.h | N/A | | |
| ImageSource::Format|DgnPlatform/Render.h|ImageSourceFormat|./source/common/Image.ts|enum
| IndexedPolylineArgs | DgnPlatform/Render.h | IndexedPolylineArgs | core/common/src/Render.ts | |
| IndexedPolylineArgs::Polyline | DgnPlatform/Render.h | N/A | | |
| IPixelDataBuffer | DgnPlatform/Render.h | N/A | | enum |
| ISolidPrimitive | Geom/SolidPrimitive.h | SolidPrimitive | @bentley/geometry-core | |
| Light | DgnPlatform/Render.h | Light | ./source/common/Lighting.ts | |
| LineCap | DgnPlatform/Render.h | N/A | | enum |
| LineJoin | DgnPlatform/Render.h | N/A | | enum |
| LinePixels | DgnPlatform/Render.h | LinePixels | ./source/common/Render.ts | enum |
| LineStyleInfo | DgnPlatform/Render.h | LineStyleInfo | ./source/common/geometry/LineStyle.ts | |
| LineStyleParams | DgnPlatform/Render.h | LineStyleParams | ./source/common/geometry/LineStyle.ts | |
| LineStyleSymb | DgnPlatform/Render.h | LineStyleSymb | ./source/common/geometry/LineStyle.ts | |
| Material | DgnPlatform/Render.h | N/A | | |
| Material::CreateParams | DgnPlatform/Render.h | N/A | | |
| Material::CreateParams::MatColor | DgnPlatform/Render.h | N/A | | |
| Material::Defaults | DgnPlatform/Render.h | N/A | | |
| Mesh | DgnPlatform/RenderPrimitives.h | N/A | | |
| Mesh::Features | DgnPlatform/RenderPrimitives.h | N/A | | |
| Mesh::PrimitiveType | DgnPlatform/RenderPrimitives.h | N/A | | enum |
| MeshArgs | DgnPlatform/RenderPrimitives.h | N/A | | |
| MeshBuilder | DgnPlatform/RenderPrimitives.h | N/A | | |
| MeshBuilder::Polyface | DgnPlatform/RenderPrimitives.h | N/A | | |
| MeshBuilderMap | DgnPlatform/RenderPrimitives.h | N/A | | |
| MeshBuilderMap::Key | DgnPlatform/RenderPrimitives.h | N/A | | |
| MeshEdge | DgnPlatform/Render.h | N/A | | |
| MeshEdge::Flags | DgnPlatform/Render.h | N/A | | enum |
| MeshEdgeCreationOptions | DgnPlatform/Render.h | N/A | | |
| MeshEdgeCreationOptions::Options | DgnPlatform/Render.h | N/A | | enum |
| MeshEdges | DgnPlatform/Render.h | N/A | | |
| MeshGraphicArgs | DgnPlatform/RenderPrimitives.h | N/A | | |
| MeshList | DgnPlatform/RenderPrimitives.h | N/A | | |
| MeshPolyline | DgnPlatform/Render.h | N/A | | |
| MSBsplineCurve | Geom/MBSplineCurve.h | BSplineCurve3d | @bentley/geometry-core | |
| MSBsplineSurface | Geom/MBSplineSurface.h | BSplineSurface3d | @bentley/geometry-core | |
| NonSceneTask | DgnPlatform/Render.h | N/A | | |
| NormalMode | DgnPlatform/RenderPrimitives.h | NormalMode | ./source/frontend/render/primitives/Primitives.ts | enum |
| OctEncodedNormal | DgnPlatform/Render.h | OctEncodedNormal | ./source/frontend/render/OctEncodedNormal.ts | |
| OctEncodedNormalList | DgnPlatform/Render.h | OctEncodedNormalList | ./source/frontend/render/OctEncodedNormal.ts | list |
| OvrGraphicParams | DgnPlatform/Render.h | N/A | | |
| OvrGraphicParams::Flags | DgnPlatform/Render.h | N/A | | enum |
| PatternParams | DgnPlatform/AreaPattern.h | PatternParams | ./source/common/geometry/AreaPattern.ts | |
| PixelData | DgnPlatform/Render.h | N/A | | |
| PixelData::GeometryType | DgnPlatform/Render.h | N/A | | enum |
| PixelData::Planarity | DgnPlatform/Render.h | N/A | | enum |
| PixelData::Selector | DgnPlatform/Render.h | N/A | | enum |
| Placement2d | DgnPlatform/DgnElement.h | Placement2d | ./source/common/geometry/Primitives.ts | |
| Placement3d | DgnPlatform/DgnElement.h | Placement3d | ./source/common/geometry/Primitives.ts | |
| Plan | DgnPlatform/Render.h | N/A | | |
| Plan::AntiAliasPref | DgnPlatform/Render.h | N/A | | enum |
| PointCloudArgs | DgnPlatform/Render.h | N/A | | |
| Polyface | DgnPlatform/RenderPrimitives.h | N/A | | |
| PolyfaceHeader | Geom/Polyface.h | IndexedPolyface | @bentley/geometry-core | |
| PolyfaceQuery | Geom/Polyface.h | Polyface | @bentley/geometry-core | |
| PolylineArgs | DgnPlatform/RenderPrimitives.h | N/A | | |
| PolylineEdgeArgs | DgnPlatform/Render.h | N/A | | |
| PrimitiveBuilder | DgnPlatform/RenderPrimitives.h | N/A | | |
| QPoint1d | DgnPlatform/Render.h | QPoint1d | ./source/frontend/render/QPoint.ts | |
| QPoint1d::Params | DgnPlatform/Render.h | QParams1d | ./source/frontend/render/QPoint.ts | |
| QPoint1dList | DgnPlatform/Render.h | QPoint1dList | ./source/frontend/render/QPoint.ts | list |
| QPoint2d | DgnPlatform/Render.h | QPoint2d | ./source/frontend/render/QPoint.ts | |
| QPoint2d::Params | DgnPlatform/Render.h | QParams2d | ./source/frontend/render/QPoint.ts | |
| QPoint2dList | DgnPlatform/Render.h | QPoint2dList | ./source/frontend/render/QPoint.ts | list |
| QPoint3d | DgnPlatform/Render.h | QPoint3d | ./source/frontend/render/QPoint.ts | |
| QPoint3d::Params | DgnPlatform/Render.h | QParams3d | ./source/frontend/render/QPoint.ts | |
| QPoint3dList | DgnPlatform/Render.h | QPoint3dList | ./source/frontend/render/QPoint.ts | list |
| QPointList | DgnPlatform/Render.h | QPointList | ./source/frontend/render/QPoint.ts | list |
| Quantization | DgnPlatform/Render.h | Quantizer | ./source/frontend/render/QPoint.ts | |
| Queue | DgnPlatform/Render.h | N/A | | |
| RenderMode | DgnPlatform/Render.h | RenderMode | ./source/common/Render.ts | enum |
| ResourceKey | DgnPlatform/Render.h | N/A | | |
| SceneLights | DgnPlatform/Render.h | N/A | | |
| SceneTask | DgnPlatform/Render.h | N/A | | |
| SilhouetteEdgeArgs | DgnPlatform/Render.h | N/A | | |
| Strokes | DgnPlatform/RenderPrimitives.h | N/A | | |
| Strokes | DgnPlatform/RenderPrimitives.h | N/A | | |
| Strokes::PointList | DgnPlatform/RenderPrimitives.h | StrokesPointList | ./source/frontend/render/primitives/Strokes.ts | |
| Strokes::PointLists | DgnPlatform/RenderPrimitives.h | StrokesPointLists | ./source/frontend/render/primitives/Strokes.ts | |
| System | DgnPlatform/Render.h | N/A | | |
| Target | DgnPlatform/Render.h | N/A | | enum |
| Task | DgnPlatform/Render.h | N/A | | |
| Task::Operation | DgnPlatform/Render.h | N/A | | enum |
| Task::Outcome | DgnPlatform/Render.h | N/A | | enum |
| Task::Priority | DgnPlatform/Render.h | N/A | | enum |
| TextAnnotation | DgnPlatform/Annotations/TextAnnotation.h | N/A | | not the same as TextAnnotation2d or TextAnnotation3d |
| TextString | DgnPlatform/TextString.h | TextString | ./source/common/geometry/TextString.ts | |
| Texture | DgnPlatform/Render.h | N/A | | |
| Texture::CreateParams | DgnPlatform/Render.h | N/A | | |
| TextureMapping | DgnPlatform/Render.h | N/A | | |
| TextureMapping::Mode | DgnPlatform/Render.h | N/A | | enum |
| TextureMapping::Params | DgnPlatform/Render.h | N/A | | |
| TextureMapping::Trans2x3 | DgnPlatform/Render.h | N/A | | |
| TileSizeAdjuster | DgnPlatform/Render.h | N/A | | |
| ToleranceRatio | DgnPlatform/RenderPrimitives.h | ToleranceRatio | ./source/frontend/render/primitives/Primitives.ts | enum |
| Transform | Geom/transform.h | Transform | @bentley/geometry-core | |
| Triangle | DgnPlatform/RenderPrimitives.h | N/A | | |
| TriangleKey | DgnPlatform/RenderPrimitives.h | N/A | | |
| TriangleList | DgnPlatform/RenderPrimitives.h | N/A | | |
| TriMeshArgs | DgnPlatform/Render.h | N/A | | |
| TriMeshArgs::Edges | DgnPlatform/Render.h | N/A | | |
| VertexKey | DgnPlatform/RenderPrimitives.h | N/A | | |
| VertexKey::NormalAndPosition | DgnPlatform/RenderPrimitives.h | VertexKeyNormalAndPosition | ./source/frontend/render/primitives/VertexKey.ts | |
| ViewFlagOverrides::PresenceFlag | DgnPlatform/Render.h | ViewFlag.PresenceFlag | ./source/common/Render.ts | enum |
| ViewFlags | DgnPlatform/Render.h | ViewFlags | ./source/common/Render.ts | |
| ViewFlagsOverrides | DgnPlatform/Render.h | ViewFlag.Overrides | ./source/common/Render.ts | |
| ViewletPosition | DgnPlatform/Render.h | N/A | | |
| Window | DgnPlatform/Render.h | N/A | | |
| Window::Rectangle | DgnPlatform/Render.h | N/A | | |