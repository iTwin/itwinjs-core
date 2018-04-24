# Units

TODO: *THIS CHAPTER HAS NOT YET BEEN REVIEWED*

## Introduction

BIS and iModels well defined system of units.

## Storage Units are SI Base Units (and derivatives)

Storage units for all EC properties are *consistent*. All floating point property values (including geometry) are stored in either:
 - SI Base Units or
 - Derivatives of SI Base Units (without prefixes).

SI base units are: m, kg, s, A, K, mol, cd. More information is available at https://en.wikipedia.org/wiki/SI_base_unit .

Derived SI Units include: Hz, rad, sr N, Pa, J, W, C, V, F, (Omega), S, Wb, T H, C, lm, lx, Bq, Gy, Sv, kat. More information on SI Derived units is available at https://en.wikipedia.org/wiki/SI_derived_unit .

 One of the nice things about consistent units is the ability to perform consistent math without thinking about units:
 
 `Mass = Density * Volume; // no unit conversions necessary`

 Using SI units also has the benefit of being an international standard.

 ### Not all Metric Units are SI Units!

It is important to remember that not all metric units satisfy the units requirements. Units such as kilometer, millimeter, kilowatt and millivolt are neither SI Base Units nor are derived from SI Base Units (without prefix). 

 ### Angle Units

 Angle units in iModels are radians, as that is the base SI unit for angles (and similarly the units for solid angles are steradians). This causes a bit of awkwardness as "90" is a much, more recognizable value  than "1.5707963267948966192313216916398" (note that storage units are never presented to the user, however).
 
  We need to use radians as our consistent angle unit, or we can no longer perform consistent math. Also, some derived units are derived from angle units. For example:

`  (luminous flux in lumens) = (luminous intensity in candela) * (solid angle in steradian)`

 `  (energy in Joules) = (torque in N-m) * (rotation in radians)`

### SI Exception for Roll, Pitch and Yaw
 For historic reasons, Roll, Pitch and Yaw (in GeometricElement3d and ViewDefinition3d, AuxCoordinateSystem3d) are handled specially. They are defined in degrees and declared as unitless in the EC schema.

Similarly, these properties are defined in degrees and declared as unitless in the EC schema:
 - Angle in AuxCoordSystem2d
 - Rotation in GeometricElement2d
 - LensAngle in ViewDefinition3d
 - RotationAngle in ViewDefinition2d

 ### SI Storage does not Apply to Names and Text
 The SI storage requirement only applies to double and geometry properties; it does not apply to text properties. "90-Degree Elbow" is an acceptable text value.


## Presentation Units

xxxxxxxx

## Standard AEC Units
xxxxxxxx

## Presentation Rules

xxxxxxxxxxx






