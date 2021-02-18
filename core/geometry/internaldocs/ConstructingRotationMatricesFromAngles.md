
# Constructing Rotation Matrices from Angles

The most common use of a A 3x3 matrix (Matrix3d class in the library) is to represent a pure rotation without scaling or mirroring.

A thorough discussion is of pure rotations is found at

* https://en.wikipedia.org/wiki/Rotation_matrix
 Interpreting a 9-member rotation _matrix_ as 3 _angles_ is complicated.  The _order_ in which rotations are applied about various directions affects the result.   Once an order is picked, the computations are fussy but clear.

Formal discussion of this is found in

* https://en.wikipedia.org/wiki/Euler_angles
* https://en.wikipedia.org/wiki/Rotation_formalisms_in_three_dimensions

## In iTwin.js, the preferred "angle to matrix" construction is the YawPitchRollAngles class

The YawPitchRollAngles class implements the "ship" or "airplane" view of rotations.  The coordinate system is:

* The forward direction is along the positive X axis
* "Up" is the positive Z axis.
* By the right hand rule, the positive Y axis ("Z cross X") is to the left.

Rotations are then defined as:

* Turning the head to the left(X axis towards Y) is a positive "Yaw" -- i.e. a positive rotation around the Z axis.
* Tipping the head towards the right shoulder (Y axis towards Z) is a positive "Roll" -- i.e. a positive rotation around the X axis
* Raising the ship bow (or plane nose) (X axis towards Z) is a positive "Pitch" -- i.e. a _negative_ rotation around the Y axis.

The fact that the "raising the bow" comes out as a _negative_ rotation is unfortunate clash between the right and rule and the instint to call "bow up" positive.

In the YawPitchRoll physical sequence, the order of three rotations is "Roll first, then pitch, then yaw".

* First ... Roll the geometry around the forward global X
* Second ... Pitch around the (negated) global Y
* Third .. Yaw around the global Z

That is, the left-to-right order _within the name YawPitchRoll_ matches the order that the matrices are multiplied, and the physical manipulations are right-to-left.

Equationally, with points and vectors treated as _columns_, a vector is transformed by this expression:

* `newVector = RollMatrix * PitchMatrix * YawMatrix * oldVector`

where

* `YawMatrix` = rotate around X with positive yaw angle
* `PitchMatrix` = rotate around Y with negated pitch angle
* `RollMatrix` = rotate around Z with positive roll angle.

## Counting degrees of freedom

When the "no scale or mirror" conditions apply, the 9 numeric values in the 3x3 matrix are restricted so that there are effectively only 3 independent degrees of freedom.    Unfortunately, you cannot usefully designate any 3 randomly chosen row and column positions among the 9 as the the ones you wish to specify.

In various applications, it is common to specify the 3 as angles of rotation around x, y and z axes.  But this is very tricky, because the order of application affects the values.    Rotation by (say) 10 degrees around X then 20 degrees around Y then 30 degrees around Z produces a different end result than rotation by 30 around Z then 20 around Y and 10 around X.

If you settle on a particular order of application, both directions of conversion between angles and matrices become clear.  But three angle values not accompanied by clear order of application are ambiguous.

## Rows and columns

For even more confusion, some software packages treat points and vectors as "row" data and other software packages treat them as "column" data.   This affects matrix construction -- the matrix required for some effect on row data is the _transpose_ of the matrix required for the same effect on column data.

## In iTwin.js, points and vectors are viewed as _columns_

## In iTwin.js, you can work with (a) other rotation orders and (b) "vectors as rows" via OrderedRotationAngles class.
