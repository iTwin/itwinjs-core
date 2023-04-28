# imodeljs native versus typescript geometry types

## Typescript directory geometry/src/geometry3d

| Concept                                | Native                               | Native Remarks                                        | Typescript                         | Typescript Remarks                                                 |
| -------------------------------------- | ------------------------------------ | ----------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------ |
| Point                                  | DPoint3d <br> DPoint2d               |                                                       | Point3d <br> Point2d               | Point, vector share `XYZ` base calss                               |
| Vector                                 | DVec3d <br> DVec2d                   | "Vector derives from Point" <br> for legacy C reasons | Vector3d <Vector2d>                |                                                                    |
| 3x3 matrix                             | RotMatrix                            | 3x3 indexed [i][j]                                    | Matrix3d                           | 3x3 packed as coffs[] in row-major order <br> inverse coffs cached |
| Affine transform                       | Transform                            | 3x3 indexed [i][j]                                    | Transform                          | `origin` and `matrix` are separate members.                        |
| Range                                  | DRange3d <br> DRange2d <br> DRange1d |                                                       | Range3d <br> Range2d <br> Range1d> |                                                                    |
| Ray                                    | DRay3d                               |                                                       | Ray3d                              |                                                                    |
| Plane by origin and normal             | DPlane3d                             |                                                       | Plane3dByOriginAndUnitNormal       | unit normal enforced by create methods                             |
| Plane by origin and 2 vectors in plane | DPoint3dDVec3dDVec3d                 |                                                       | Plane3dByOriginAndVectors          |                                                                    |

## Typescript directory geometry/src/curve

### CurvePrimitive

A curve primitive is a curve parameterized with fraction 0 at start, fraction 1 at end.

| Concept                   | Native                                                 | Native Remarks | Typescript                  | Typescript Remarks |
| ------------------------- | ------------------------------------------------------ | -------------- | --------------------------- | ------------------ |
| virtual primitive         | ICurvePrimitive                                        |                | CurvePrimitive              |                    |
| Line segment              | CURVE_PRIMITIVE_TYPE_Line <br> DSegment3d              |                | LineSegment3d               |                    |
| Linestring                | CURVE_PRIMITIVE_TYPE_LineString <br> bvector<DPoint3d> |                | LineString3d                |                    |
| elliptic arc              | CURVE_PRIMITIVE_TYPE_Arc <br> DEllipse3d               |                | Arc3d                       |                    |
| bspline curve             | CURVE_PRIMITIVE_TYPE_BsplineCurve <br> MSBSplineCurve  | BSplineCurve   |                             |
| bezier curve              | (Note 1)                                               |                | BezierCurve                 |                    |
| curve with distance index | (Note 2)                                               |                | CurveChainWithDistanceIndex |                    |

- Note 1: In native code, hide a bezier curve as a bspline curve with control point count equal to order.
- Note 2: In native code, a CurveVectorWithDistanceIndex has queries for "distance along multi-primitive curve" but is not a first-class curve primitive.

### CurveCollection

| Concept                  | Native                                       | Native Remarks                                          | Typescript      | Typescript Remarks                   |
| ------------------------ | -------------------------------------------- | ------------------------------------------------------- | --------------- | ------------------------------------ |
| virtual collection       | CurveVector                                  | "boundary type" code distinguishes subtypes             | CurveCollection | Derived classes distinguish subtypes |
| open path                | BOUNDARY_TYPE_Open                           |                                                         | Path            |                                      |
| closed path              | BOUNDARY_TYPE_Outer <br> BOUNDARY_TYPE_Inner | Never trust Outer vs Inner labels                       | Loop            |                                      |
| multi-loop parity region | BOUNDARY_TYPE_ParityRegion                   | DgnPlatform expects first child \_Outer, others \_Inner | ParityRegion    | All children must be `Loop`          |
| multiple regions         | BOUNDARY_TYPE_UnionRegion                    |                                                         | UnionRegion     |                                      |
| unstructured             | BOUNDARY_TYPE_None                           |                                                         | BagOfCurves     |                                      |
