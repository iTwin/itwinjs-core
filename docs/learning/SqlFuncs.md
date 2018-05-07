# ECSQL Built-in Geometry Functions

iModel define types and built-in functions that you can use in SQL statements.

Types: [iModel_placement](#iModel_placement), [iModel_angles](#iModel_angles), [iModel_bbox](#iModel_bbox), [iModel_point](#iModel_point)


Functions:
* [iModel_angles](#iModel_angles)
* [iModel_angles_maxdiff](#iModel_angles_maxdiff)
* [iModel_angles_value](#iModel_angles_value)
* [iModel_bbox](#iModel_bbox)
* [iModel_bbox_areaxy](#iModel_bbox_areaxy)
* [iModel_bbox_contains](#iModel_bbox_contains)
* [iModel_bbox_depth](#iModel_bbox_depth)
* [iModel_bbox_height](#iModel_bbox_height)
* [iModel_bbox_overlaps](#iModel_bbox_overlaps)
* [iModel_bbox_union](#iModel_bbox_union)
* [iModel_bbox_value](#iModel_bbox_value)
* [iModel_bbox_volume](#iModel_bbox_volume)
* [iModel_bbox_width](#iModel_bbox_width)
* [iModel_placement_aabb](#iModel_placement_aabb)
* [iModel_placement_angles](#iModel_placement_angles)
* [iModel_placement_eabb](#iModel_placement_eabb)
* [iModel_placement_origin](#iModel_placement_origin)
* [iModel_point_distance](#iModel_point_distance)
* [iModel_point_min_distance_to_bbox](#iModel_point_min_distance_to_bbox)
* [iModel_point_value](#iModel_point_value)
* [iModel_spatial_overlap_aabb](#iModel_spatial_overlap_aabb)

# Types

A point in the iModel's Cartesian coordinate system. All coordinates are in meters. If the point represents a location in a 2D model, then the z-coordinate will be zero.
@see [iModel_point_value](#iModel_point_value), [iModel_point_distance](#iModel_point_distance), [iModel_point_min_distance_to_bbox](#iModel_point_min_distance_to_bbox)
## iModel_point
```
struct iModel_point
{
double x;   //!< The x-coordinate
double y;   //!< The y-coordinate
double z;   //!< The z-coordinate
};

```

An object that contains Yaw, Pitch, and Roll angles in degrees. If this object represents a rotation in a 2D model, then the pitch and roll members will be zero.
@see [iModel_angles_value](#iModel_angles_value), [iModel_angles_maxdiff](#iModel_angles_maxdiff)
## iModel_angles
```
struct iModel_angles
{
double yaw;  //!< The Yaw angle in degrees
double pitch;//!< The Yaw angle in degrees
double roll; //!< The Yaw angle in degrees
};

```

An object that defines a range.
If the box represents a range in a 3-D model, then the box will have 8 corners and will have width(X), depth(Y), and height(Z).
If the box represents a range in a 2-D model, then the box will still have 8 corners but the z-coordinates will be all be zero, and the height will be zero.
All coordinates are in meters.
@see [iModel_bbox_value](#iModel_bbox_value), [iModel_bbox_width](#iModel_bbox_width), [iModel_bbox_height](#iModel_bbox_height), [iModel_bbox_depth](#iModel_bbox_depth), [iModel_bbox_volume](#iModel_bbox_volume), [iModel_bbox_areaxy](#iModel_bbox_areaxy), [iModel_bbox_overlaps](#iModel_bbox_overlaps), [iModel_bbox_contains](#iModel_bbox_contains), [iModel_bbox_union](#iModel_bbox_union), [iModel_point_min_distance_to_bbox](#iModel_point_min_distance_to_bbox)
## iModel_bbox
```
struct iModel_bbox
{
double XLow;  //!< The low X coordinate of the bounding box
double YLow;  //!< The low Y coordinate of the bounding box
double Zlow;  //!< The low Z coordinate of the bounding box
double XHigh; //!< The high X coordinate of the bounding box
double YHigh; //!< The high Y coordinate of the bounding box
double ZHigh; //!< The high Z coordinate of the bounding box
};

```

An object that contains an origin and rotation angles, plus a bounding box.
You can obtain an element's placement by selecting the placement column of the ElementGeom table.
@see [iModel_placement_origin](#iModel_placement_origin), [iModel_placement_angles](#iModel_placement_angles), [iModel_placement_eabb](#iModel_placement_eabb), [iModel_placement_aabb](#iModel_placement_aabb)
## iModel_placement
```
struct iModel_placement
{
iModel_point origin;   //!< Origin
iModel_angles angles;  //!< Angles
iModel_bbox bbox;      //!< Element-aligned bounding box
};
```

# iModel_placement_aabb
Get the axis-aligned bounding box from a placement

```
iModel_placement_aabb(placement)
```


|Parameter|Type|Description
|---|---|---
|placement|[iModel_placement](#iModel_placement)|iModel_placement object to query
Returns the bounding box

# iModel_placement_eabb
Get the element-aligned bounding box from a placement

```
iModel_placement_eabb(placement)
```


|Parameter|Type|Description
|---|---|---
|placement|[iModel_placement](#iModel_placement)|iModel_placement object to query
Returns the bounding box

# iModel_placement_origin
Get the placement origin

```
iModel_placement_origin(placement)
```


|Parameter|Type|Description
|---|---|---
|placement|[iModel_placement](#iModel_placement)|iModel_placement object to query
Returns the origin in world coordinates

# iModel_placement_angles
Get the placement angles

```
iModel_placement_angles(placement)
```


|Parameter|Type|Description
|---|---|---
|placement|[iModel_placement](#iModel_placement)|iModel_placement object to query
Returns the placement angles

# iModel_angles
Construct a iModel_angles from 3 values

```
iModel_angles(yaw,pitch,roll)
```


|Parameter|Type|Description
|---|---|---
|yaw|double|Yaw angle in degrees
|pitch|double|Pitch angle in degrees
|roll|double|Roll angle in degrees

Returns a iModel_angles object

# iModel_angles_value
Get a member of a iModel_angles object

```
iModel_angles_value(angles,member)
```


|Parameter|Type|Description
|---|---|---
|angles|[iModel_angles](#iModel_angles)|iModel_angles object to query
|member|int|index of the member to get: Yaw=0, Pitch=1, Roll=2

Returns the selected angle (in degrees); or an error if member is out of range or if \a angles is not a iModel_angles object

# iModel_angles_maxdiff
Return the maximum absolute difference among the angles in degrees.

```
iModel_angles_maxdiff(angle1,angle2)
```


|Parameter|Type|Description
|---|---|---
|angle1|[iModel_angles](#iModel_angles)|iModel_angles object
|angle2|[iModel_angles](#iModel_angles)|iModel_angles object

Returns the maximum absolute difference among the angles in degrees.

# iModel_bbox
Create a bounding box from 6 values
All coordinates are in meters.

```
iModel_bbox(XLow,YLow,Zlow,XHigh,YHigh,ZHigh)
```


|Parameter|Type|Description
|---|---|---
|XLow|double|low X coordinate of the bounding box
|YLow|double|low Y coordinate of the bounding box
|Zlow|double|low Z coordinate of the bounding box
|XHigh|double|high X coordinate of the bounding box
|YHigh|double|high Y coordinate of the bounding box
|ZHigh|double|high Z coordinate of the bounding box

Returns a iModel_bbox object

# iModel_bbox_width
Compute the "width" of a bounding box

```
iModel_bbox_width(bb)
```


|Parameter|Type|Description
|---|---|---
|bb|[iModel_bbox](#iModel_bbox)|bounding box
Returns the difference between the high and low X coordinates of the box, in meters.
@see [iModel_bbox_areaxy](#iModel_bbox_areaxy)

# iModel_bbox_height
Compute the "height" of a bounding box

```
iModel_bbox_height(bb)
```


|Parameter|Type|Description
|---|---|---
|bb|[iModel_bbox](#iModel_bbox)|bounding box
Returns the difference between the high and low Z coordinates of the box, in meters.

# iModel_bbox_depth
Compute the "depth" of a bounding box

```
iModel_bbox_depth(bb)
```


|Parameter|Type|Description
|---|---|---
|bb|[iModel_bbox](#iModel_bbox)|bounding box
Returns the difference between the high and low Y coordinates of the box, in meters.
@see [iModel_bbox_areaxy](#iModel_bbox_areaxy)

# iModel_bbox_volume
Compute the volume of the bounding box

```
iModel_bbox_volume(bb)
```


|Parameter|Type|Description
|---|---|---
|bb|[iModel_bbox](#iModel_bbox)|bounding box
Returns Its volume in cubic meters
@see [iModel_bbox_areaxy](#iModel_bbox_areaxy)

# iModel_bbox_areaxy
Compute the depth times the width of a bounding box

```
iModel_bbox_areaxy(bb)
```


|Parameter|Type|Description
|---|---|---
|bb|[iModel_bbox](#iModel_bbox)|bounding box
Returns the depth of \a bb times its width; or, an error if the input object is not a iModel_bbox
@see [iModel_bbox_volume](#iModel_bbox_volume)
@see [iModel_bbox_depth](#iModel_bbox_depth), [iModel_bbox_width](#iModel_bbox_width)

# iModel_bbox_overlaps
Determine if the areas enclosed by two 3-D bounding boxes overlap

```
iModel_bbox_overlaps(bb1,bb2)
```


|Parameter|Type|Description
|---|---|---
|bb1|[iModel_bbox](#iModel_bbox)|first bounding box
|bb2|[iModel_bbox](#iModel_bbox)|second bounding box

Returns 1 if the boxes overlap or 0 if not.
@see [iModel_bbox_contains](#iModel_bbox_contains)

# iModel_bbox_contains
Determine of the first bounding box contains the second bounding box

```
iModel_bbox_contains(bb_outer,bb_inner)
```


|Parameter|Type|Description
|---|---|---
|bb_outer|[iModel_bbox](#iModel_bbox)|containing bounding box
|bb_inner|[iModel_bbox](#iModel_bbox)|contained bounding box

Returns 1 if bb_outer contains bb_inner or 0 if not.
@see [iModel_bbox_overlaps](#iModel_bbox_overlaps)

# iModel_bbox_value
Get a member of a iModel_bbox object

```
iModel_bbox_value(bb,member)
```


|Parameter|Type|Description
|---|---|---
|bb|[iModel_bbox](#iModel_bbox)|bounding box
|member|int|index of the member to get: XLow=0, YLow=1, Zlow=2, XHigh=3, YHigh=4, ZHigh=5

Returns the requested member of the bounding box; or an error if member is out of range or bb is not a iModel_bbox object.

# iModel_bbox_union
\em Aggregate function that computes the union of a series of bounding boxes

```
iModel_bbox_union(X1)
```

Returns a bounding box that contains the aggregated range.

# iModel_point_distance
Compute the distance between two iModel_Points, in meters.

```
iModel_point_distance(point1,point2)
```


|Parameter|Type|Description
|---|---|---
|point1|[iModel_point](#iModel_point)|point
|point2|[iModel_point](#iModel_point)|second point

Returns the distance between the two points; or an error if either input is not a iModel_point object

# iModel_point_min_distance_to_bbox
Compute the minimum distance from a point to a bounding box, in meters.

```
iModel_point_min_distance_to_bbox(point,bbox)
```


|Parameter|Type|Description
|---|---|---
|point|[iModel_point](#iModel_point)|point
|bbox|[iModel_bbox](#iModel_bbox)|bounding box

Returns the distance from \a point to the closest point on \a bbox; or an error if either input is of the wrong type.

# iModel_point_value
Get a member of a iModel_Point object.

```
iModel_point_value(point,member)
```


|Parameter|Type|Description
|---|---|---
|point|[iModel_point](#iModel_point)|point to query
|member|int|index of the coordinate to get: X=0, Y=1, Z=2

Returns a coordindate of the point in meters; or an error if \a member is out of range or \a point is not a point object

# iModel_spatial_overlap_aabb
An rtree MATCH function that only accepts objects from the spatial index whose range overlap an aabb (axis-aligned bounding box).
