# ECSQL Built-in Geometry Functions

ECSQL statements can use builtin functions to query and analyze element geometry.
These functions can be used in SELECT and WHERE clauses. The functions
that return primitive types can be in expressions with other values.

## Types

The geometry builtin functions work with custom data types, such as bounding boxes,
points, angles, and placements, allowing you to work with the structured data
that appears in the spatial index and in element geometry.

These custom data types are described here in a conceptual way. You do not
work directly with them. Instead, in ECSQL, you use builtin functions to
create, analyze, and extract or compute primitive values from them.
If you return a structured data type value from an ECSQL statement, it will have the
type of ArrayBuffer in script.
You will normally have to convert a returned ArrayBuffer to the appropriate geometry
type before you can work with it in script. See, for example, [Range3d.fromArrayBuffer]($geometry).

### iModel_point

A point in the iModel's Cartesian coordinate system. All coordinates are in meters. If the point represents a location in a 2D model, then the z-coordinate will be zero.
@see [iModel_point_value](#imodel_point_value), [iModel_point_distance](#imodel_point_distance), [iModel_point_min_distance_to_bbox](#imodel_point_min_distance_to_bbox)

```C++
struct iModel_point
{
double x;   // The x-coordinate
double y;   // The y-coordinate
double z;   // The z-coordinate
};
```

### iModel_angles

An object that contains Yaw, Pitch, and Roll angles in degrees. If this object represents a rotation in a 2D model, then the pitch and roll members will be zero.
@see [iModel_angles_value](#imodel_angles_value), [iModel_angles_maxdiff](#imodel_angles_maxdiff)

```C++
struct iModel_angles
{
double yaw;  // The Yaw angle in degrees
double pitch;// The Yaw angle in degrees
double roll; // The Yaw angle in degrees
};
```

### iModel_bbox

An object that defines a range.
If the box represents a range in a 3-D model, then the box will have 8 corners and will have width(X), depth(Y), and height(Z).
If the box represents a range in a 2-D model, then the box will still have 8 corners but the z-coordinates will be all be zero, and the height will be zero.
All coordinates are in meters.
@see [iModel_bbox_value](#imodel_bbox_value), [iModel_bbox_width](#imodel_bbox_width), [iModel_bbox_height](#imodel_bbox_height), [iModel_bbox_depth](#imodel_bbox_depth), [iModel_bbox_volume](#imodel_bbox_volume), [iModel_bbox_areaxy](#imodel_bbox_areaxy), [iModel_bbox_overlaps](#imodel_bbox_overlaps), [iModel_bbox_contains](#imodel_bbox_contains), [iModel_bbox_union](#imodel_bbox_union), [iModel_point_min_distance_to_bbox](#imodel_point_min_distance_to_bbox)

```C++
struct iModel_bbox
{
double XLow;  // The low X coordinate of the bounding box
double YLow;  // The low Y coordinate of the bounding box
double Zlow;  // The low Z coordinate of the bounding box
double XHigh; // The high X coordinate of the bounding box
double YHigh; // The high Y coordinate of the bounding box
double ZHigh; // The high Z coordinate of the bounding box
};
```

### iModel_placement

An object that contains an origin and rotation angles, plus a bounding box.
You can obtain an element's placement by selecting the placement properties of Geometric Elements.
|Class|Properties|
|-----|----------|
|[GeometricElement2d](../bis/domains/biscore.ecschema/#geometricelement2d)| Origin, BBoxLow, BBoxHigh, Rotation|
|[GeometricElement3d](../bis/domains/biscore.ecschema/#geometricelement3d)| Origin, BBoxLow, BBOxHigh, Yaw, Pitch, Roll|

@see [iModel_placement_origin](#imodel_placement_origin), [iModel_placement_angles](#imodel_placement_angles), [iModel_placement_eabb](#imodel_placement_eabb), [iModel_placement_aabb](#imodel_placement_aabb)

```C++
struct iModel_placement
{
iModel_point origin;   // Origin
iModel_angles angles;  // Angles
iModel_bbox bbox;      // Element-aligned bounding box
};
```

## Functions

The builtin geometry functions include functions to extract geometric information
from elements, as well as functions to create, analyze, and extract or compute primitive values from
the custom structured data types.

Most of the builtin functions just perform a function and return a result.

### Aggregate

Some of the builtin geometry functions are *aggregate* functions. They accumulate results,
reducing all of the values passed to them by the statement to a single resultant value.
Also see [SQLite Aggregate Functions](https://sqlite.org/lang_aggfunc.html).

### iModel_placement_aabb

```sql
iModel_placement_aabb(placement)
```

Get the axis-aligned bounding box from a placement

|Parameter|Type|Description
|---|---|---
|placement|[iModel_placement](#imodel_placement)|iModel_placement object to query

|Return Type|Description
|---|---
|[iModel_bbox](#imodel_bbox)| the bounding box

### iModel_placement_eabb

```sql
iModel_placement_eabb(placement)
```

Get the element-aligned bounding box from a placement

|Parameter|Type|Description
|---|---|---
|placement|[iModel_placement](#imodel_placement)|iModel_placement object to query

|Return Type|Description
|---|---
|[iModel_bbox](#imodel_bbox)| the bounding box

### iModel_placement_origin

```sql
iModel_placement_origin(placement)
```

Get the placement origin

|Parameter|Type|Description
|---|---|---
|placement|[iModel_placement](#imodel_placement)|iModel_placement object to query

|Return Type|Description
|---|---
|[iModel_point](#imodel_point)| the origin in world coordinates

### iModel_placement_angles

```sql
iModel_placement_angles(placement)
```

Get the placement angles

|Parameter|Type|Description
|---|---|---
|placement|[iModel_placement](#imodel_placement)|iModel_placement object to query

|Return Type|Description
|---|---
|[iModel_angles](#imodel_angles)| the placement angles

### iModel_angles

```sql
iModel_angles(yaw,pitch,roll)
```

Construct a iModel_angles from 3 values

|Parameter|Type|Description
|---|---|---
|yaw|double|Yaw angle in degrees
|pitch|double|Pitch angle in degrees
|roll|double|Roll angle in degrees

|Return Type|Description
|---|---
|[iModel_angles](#imodel_angles)| a iModel_angles object

*Example:*

``` ts
[[include:EcsqlGeometryFunctions.iModel_bbox_union]]
```

### iModel_angles_value

```sql
iModel_angles_value(angles,member)
```

Get a member of a iModel_angles object

|Parameter|Type|Description
|---|---|---
|angles|[iModel_angles](#imodel_angles)|iModel_angles object to query
|member|int|index of the member to get: Yaw=0, Pitch=1, Roll=2

|Return Type|Description
|---|---
|double| the selected angle (in degrees); or an error if member is out of range or if  angles is not a iModel_angles object

### iModel_angles_maxdiff

```sql
iModel_angles_maxdiff(angle1,angle2)
```

Return the maximum absolute difference among the angles in degrees.

|Parameter|Type|Description
|---|---|---
|angle1|[iModel_angles](#imodel_angles)|iModel_angles object
|angle2|[iModel_angles](#imodel_angles)|iModel_angles object

|Return Type|Description
|---|---
|double| the maximum absolute difference among the angles in degrees.

### iModel_bbox

```sql
iModel_bbox(XLow,YLow,Zlow,XHigh,YHigh,ZHigh)
```

Create a bounding box from 6 valuesAll coordinates are in meters.

|Parameter|Type|Description
|---|---|---
|XLow|double|low X coordinate of the bounding box
|YLow|double|low Y coordinate of the bounding box
|Zlow|double|low Z coordinate of the bounding box
|XHigh|double|high X coordinate of the bounding box
|YHigh|double|high Y coordinate of the bounding box
|ZHigh|double|high Z coordinate of the bounding box

|Return Type|Description
|---|---
|[iModel_bbox](#imodel_bbox)| a iModel_bbox object

*Example:*

``` ts
[[include:EcsqlGeometryFunctions.iModel_bbox_union]]
```

### iModel_bbox_width

```sql
iModel_bbox_width(bb)
```

Compute the "width" of a bounding box

|Parameter|Type|Description
|---|---|---
|bb|[iModel_bbox](#imodel_bbox)|bounding box

|Return Type|Description
|---|---
|double| the difference between the high and low X coordinates of the box, in meters.
@see  [iModel_bbox_areaxy](#imodel_bbox_areaxy)

### iModel_bbox_height

```sql
iModel_bbox_height(bb)
```

Compute the "height" of a bounding box

|Parameter|Type|Description
|---|---|---
|bb|[iModel_bbox](#imodel_bbox)|bounding box

|Return Type|Description
|---|---
|double| the difference between the high and low Z coordinates of the box, in meters.

### iModel_bbox_depth

```sql
iModel_bbox_depth(bb)
```

Compute the "depth" of a bounding box

|Parameter|Type|Description
|---|---|---
|bb|[iModel_bbox](#imodel_bbox)|bounding box

|Return Type|Description
|---|---
|double| the difference between the high and low Y coordinates of the box, in meters.
@see  [iModel_bbox_areaxy](#imodel_bbox_areaxy)

### iModel_bbox_volume

```sql
iModel_bbox_volume(bb)
```

Compute the volume of the bounding box

|Parameter|Type|Description
|---|---|---
|bb|[iModel_bbox](#imodel_bbox)|bounding box

|Return Type|Description
|---|---
|double| Its volume in cubic meters
@see  [iModel_bbox_areaxy](#imodel_bbox_areaxy)

### iModel_bbox_areaxy

```sql
iModel_bbox_areaxy(bb)
```

Compute the depth times the width of a bounding box

|Parameter|Type|Description
|---|---|---
|bb|[iModel_bbox](#imodel_bbox)|bounding box

|Return Type|Description
|---|---
|double| the depth of  bb times its width; or, an error if the input object is not a iModel_bbox
@see  [iModel_bbox_volume](#imodel_bbox_volume),  [iModel_bbox_depth](#imodel_bbox_depth), [iModel_bbox_width](#imodel_bbox_width)

*Example:*

``` ts
[[include:EcsqlGeometryFunctions.iModel_bbox_areaxy]]
```

### iModel_bbox_overlaps

```sql
iModel_bbox_overlaps(bb1,bb2)
```

Determine if the areas enclosed by two 3-D bounding boxes overlap

|Parameter|Type|Description
|---|---|---
|bb1|[iModel_bbox](#imodel_bbox)|first bounding box
|bb2|[iModel_bbox](#imodel_bbox)|second bounding box

|Return Type|Description
|---|---
|int| 1 if the boxes overlap or 0 if not.
@see  [iModel_bbox_contains](#imodel_bbox_contains)

### iModel_bbox_contains

```sql
iModel_bbox_contains(bb_outer,bb_inner)
```

Determine of the first bounding box contains the second bounding box

|Parameter|Type|Description
|---|---|---
|bb_outer|[iModel_bbox](#imodel_bbox)|containing bounding box
|bb_inner|[iModel_bbox](#imodel_bbox)|contained bounding box

|Return Type|Description
|---|---
|int| 1 if bb_outer contains bb_inner or 0 if not.
@see  [iModel_bbox_overlaps](#imodel_bbox_overlaps)

### iModel_bbox_value

```sql
iModel_bbox_value(bb,member)
```

Get a member of a iModel_bbox object

|Parameter|Type|Description
|---|---|---
|bb|[iModel_bbox](#imodel_bbox)|bounding box
|member|int|index of the member to get: XLow=0, YLow=1, Zlow=2, XHigh=3, YHigh=4, ZHigh=5

|Return Type|Description
|---|---
|double| the requested member of the bounding box; or an error if member is out of range or bb is not a iModel_bbox object.

### iModel_bbox_union

```sql
iModel_bbox_union(X1)
```

 [Aggregate](#aggregate) function that computes the union of a series of bounding boxes

|Parameter|Type|Description
|---|---|---
|X1|[iModel_bbox](#imodel_bbox)

|Return Type|Description
|---|---
|[iModel_bbox](#imodel_bbox)| a bounding box that contains the aggregated range.

*Example:*

``` ts
[[include:EcsqlGeometryFunctions.iModel_bbox_union]]
```

### iModel_point_distance

```sql
iModel_point_distance(point1,point2)
```

Compute the distance between two iModel_Points, in meters.

|Parameter|Type|Description
|---|---|---
|point1|[iModel_point](#imodel_point)|point
|point2|[iModel_point](#imodel_point)|second point

|Return Type|Description
|---|---
|double| the distance between the two points; or an error if either input is not a iModel_point object

### iModel_point_min_distance_to_bbox

```sql
iModel_point_min_distance_to_bbox(point,bbox)
```

Compute the minimum distance from a point to a bounding box, in meters.

|Parameter|Type|Description
|---|---|---
|point|[iModel_point](#imodel_point)|point
|bbox|[iModel_bbox](#imodel_bbox)|bounding box

|Return Type|Description
|---|---
|double| the distance from  point to the closest point on  bbox; or an error if either input is of the wrong type.

### iModel_point_value

```sql
iModel_point_value(point,member)
```

Get a member of a iModel_Point object.

|Parameter|Type|Description
|---|---|---
|point|[iModel_point](#imodel_point)|point to query
|member|int|index of the coordinate to get: X=0, Y=1, Z=2

|Return Type|Description
|---|---
|double| a coordinate of the point in meters; or an error if  member is out of range or  point is not a point object

### iModel_spatial_overlap_aabb

```sql
iModel_spatial_overlap_aabb(X1)
```

An rtree MATCH function that only accepts objects from the spatial index whose range overlap an aabb (axis-aligned bounding box).

|Parameter|Type|Description
|---|---|---
|X1|[iModel_bbox](#imodel_bbox)

*Example:*

``` ts
[[include:ECSqlStatement.spatialQuery]]
```
