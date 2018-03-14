| C++                           | Typescript                                                                                          |
|-------------------------------|-----------------------------------------------------------------------------------------------------|
| AngleInDegrees                | Angle                                                                                               |
| AsThickenedLine               | AsThickenedLine                                                                                     |
| BentleyStatus                 | no typescript equivalent class used                                                                 |
| ClipVector                    | ClipVector                                                                                          |
| ColorDef                      | ColorDef                                                                                            |
| CurveVector                   | path + loop                                                                                         |
| DEllipse3d                    | Arc3d                                                                                               |
| DgnCategoryId                 | Id64                                                                                                |
| DgnDb                         | IModel (if in common), IModelDb (if in backend), or IModelConnection (if in frontend)               |
| DgnGeometryPart               | GeometryPart (this is not totally implemented, but does exist)                                      |
| DgnGeometryPartId             | Id64                                                                                                |
| DgnModel                      | ModelProps                                                                                          |
| DgnOleDraw                    | no class currently exists in TS for this ???                                                        |
| DgnSubCategoryId              | Id64                                                                                                |
| DPoint2d                      | Point2d                                                                                             |
| DPoint3d                      | Point3d                                                                                             |
| DRange2d                      | Range2d                                                                                             |
| DRange3d                      | Range3d                                                                                             |
| DSegment3d                    | ???                                                                                                 |
| DVec3d                        | Vector3d                                                                                            |
| Ellipse                       | arc + loop                                                                                          |
| GeometricPrimitive            | GeometricPrimitive                                                                                  |
| GeometryBuilder               | GeometryStreamBuilder                                                                               |
| GeometryBuilder::CoordSystem  | GeomCoordSystem                                                                                     |
| GeometryParams                | GeometryParams                                                                                      |
| GeometryStream                | GeometryStream                                                                                      |
| GeometryStreamEntryId         | GeometryStreamEntryId                                                                               |
| GeometryStreamIO::OpCode      | OpCode                                                                                              |
| GeometryStreamIO::Writer      | OpCodeWriter                                                                                        |
| Graphic                       | Graphic                                                                                             |
| GraphicBuilder                | GraphicBuilder                                                                                      |
| GraphicBuilder::CreateParams  | GraphicBuilderCreateParams                                                                          |
| GraphicBuilder::TileCorners   | GraphicBuilderTileCorners                                                                           |
| GraphicParams                 | GraphicParams                                                                                       |
| GraphicType                   | GraphicType                                                                                         |
| IBRepEntity                   | no class currently exists in TS for this, but GeometryType has a BRepEntity as a type               |
| ICurvePrimitive               | CurvePrimitive                                                                                      |
| IFacetOptions                 | no class currently exists in TS for this ???                                                        |
| IGeometry                     | GeometryQuery                                                                                       |
| ISolidPrimitive               | SolidPrimitive                                                                                      |
| LinePixels                    | LinePixels                                                                                          |
| LineStyleSymb                 | ???                                                                                                 |
| MSBsplineCurve                | BSplineCurve3d                                                                                      |
| MSBsplineSurface              | BSplineSurface3d                                                                                    |
| PatternParams                 | PatternParams                                                                                       |
| Placement2d                   | Placement2d                                                                                         |
| Placement3d                   | Placement3d                                                                                         |
| PolyfaceHeader                | IndexedPolyface                                                                                     |
| PolyfaceQuery                 | Polyface                                                                                            |
| TextAnnotation                | TextAnnotation2d or TextAnnotation3d                                                                |
| TextString                    | TextString                                                                                          |
| Transform                     | Transform                                                                                           |
| YawPitchRollAngles            | YawPitchRollAngles                                                                                  |