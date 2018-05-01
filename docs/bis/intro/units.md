# Physical Units in BIS

BIS and iModels always use a well defined system of physical units.

## Physical Units must be *SI Base Units* or *SI Derived Units*

All physical property values (including geometry) in a BIS schema must be either:

- [SI Base Units](https://en.wikipedia.org/wiki/SI_base_unit) (m, kg, s, A, K, mol, cd)
- [SI Derived Units](https://en.wikipedia.org/wiki/SI_derived_unit) without prefixes (Hz, rad, sr N, Pa, J, W, C, V, F, (Omega), S, Wb, T H, C, lm, lx, Bq, Gy, Sv, kat)

It is therefore possible to perform mathematical operations on physical values without considering units:

```ts
Mass = Density * Volume; // no unit conversions necessary
````

> Note: in iModels, all coordinate data is stored in meters.

> Units with prefixes, such as kilometer, millimeter, kilowatt and millivolt are not allowed.

## Angle Units

Angle units are *radians*, as that is the *SI Derived Unit* for angles. Similarly the units for solid angles are *steradians*.
> This may seem awkward, as "90" is a more recognizable value than "1.5707963267948966192313216916398" However, note that storage units are not directly presented to users.

Radians are used to permit consistent mathematical computations.

For example:

```ts
(luminous flux in lumens) = (luminous intensity in candela) * (solid angle in steradian)

(energy in Joules) = (torque in N-m) * (rotation in radians)
```

## Exception for Roll, Pitch and Yaw

`Roll`, `Pitch` and `Yaw` (in `GeometricElement3d` and `ViewDefinition3d`, `AuxCoordinateSystem3d`) are handled specially. They are defined in *degrees* and declared as unitless in the EC schema.

Similarly, these properties are defined in degrees and declared as unitless in the EC schema:

- `Angle` in AuxCoordSystem2d
- `Rotation` in GeometricElement2d
- `LensAngle` in ViewDefinition3d
- `RotationAngle` in ViewDefinition2d

## SI Units do not Apply to Names and Text

The SI units requirement only applies to numeric physical and geometry properties; it does not apply to text properties. "90-Degree Elbow" is an acceptable text value.

<!-- TODO
## Presentation Units

## Standard AEC Units

## Presentation Rules
-->
