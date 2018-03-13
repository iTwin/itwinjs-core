| C++                           | Typescript                                                                                          |
|-------------------------------|------------
| AngleInDegrees                | Angle
| BentleyStatus                 | no typescript equivalent class used
| CurveVector                   | path + loop
| DgnCategoryId                 | Id64
| DgnDb                         | IModel (if in common), IModelDb (if in backend), or IModelConnection (if in frontend)
| DgnGeometryPart               | GeometryPart (this is not totally implemented, but does exist)
| DgnGeometryPartId             | Id64
| DgnModel                      | ModelProps
| DgnSubCategoryId              | Id64
| DPoint3d                      | Point3d
| Ellipse                       | arc + loop
| GeometricPrimitive            | GeometricPrimitive
| GeometryBuilder               | GeometryStreamBuilder
| GeometryBuilder::CoordSystem  | GeomCoordSystem
| GeometryParams                | GeometryParams
| GeometryStream                | GeometryStream
| GeometryStreamEntryId         | GeometryStreamEntryId
| GeometryStreamIO::OpCode      | OpCode
| GeometryStreamIO::Writer      | OpCodeWriter
| IBRepEntity                   | no class currently exists in TS for this, but GeometryType has a BRepEntity as a type
| ICurvePrimitive               | CurvePrimitive
| IGeometry                     | GeometryQuery
| ISolidPrimitive               | SolidPrimitive
| MSBsplineSurface              | BSplineSurface3d
| Placement2d                   | Placement2d
| Placement3d                   | Placement3d
| PolyfaceHeader                | IndexedPolyface
| PolyfaceQuery                 | Polyface
| TextAnnotation                | TextAnnotation2d or TextAnnotation3d
| TextString                    | TextString
| Transform                     | Transform
| YawPitchRollAngles            | YawPitchRollAngles