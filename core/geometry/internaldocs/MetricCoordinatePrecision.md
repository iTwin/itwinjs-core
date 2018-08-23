# Metric Coordinates and IEEE 64 Bit FLoating Point Precision

## Coordinates stored in an element

* Within an element, geometry should have it coordinates within to some "local" coordinate frame.
  * These local coordinates are typically less than 1 KM, i.e. 999 M or less.
  * This local range concept matches the Parasolid design cube.
  * The Geomlibs constant `DoubleOps::SmallMetricDistance () = 1.0e-6` is the granularity for local coordinate values, assuming that the leading 8 significant digits are valid.

## Coordinates when placed in Earth Centric Geographic Coordinates

* The circumference of the earth is approximately 40,000,070 M.

|   | Local Coordinates | ECGC Coordinates |
|---------------|-------------------|--------------|
| Large coordinate | 1000 M | 40,000,070 M |
| 8 significant digit layout | XXX.xxxXX_ | XXxxxXXX._xx_ |
| magnitude of "_" digit | 1.0e-6 | 0.1 |

## Bit counting

* 10 bits represent a decimal values of 1024.  Hence "3 digits of decimal values" require 10 bits.
* The "left of decimal" part of an ECGC coordinate 40,075,000 hence requires:
 * 6 bits for the leading "40"
 * 10 bits for each for the XXX and YYY parts of 40XXXYYY
 * A total of 26 bits strictly for the "full meter" integer parts.
 * If coordinates "along the equator" are _signed_ from Greenwich the negative-to-positive limits are -20XXXXYYY to +20XXXYYY, assuming no longitude is outside -180 to +180.
 * Extending longitudes to the east-west wandering of the international date line allows longitudes up to 10 degrees in either direction.  Hence actual metric positions on equator might be considered limited to about 21,150,694.
 * this range fits in 25 (rather than 26) bits

 ## Where in the world ... meters from Greenwich ...

| Location | Longitude | ECGC Coordinates |
|---------------|-------------------|--------------|
|	Attu AK	|	-190	|	-21,150,694	|
|	Hawaii	|	-160	|	-17,811,111	|
|	AK/CA border	|	-140	|	-15,584,722	|
|	San Francisco	|	-125	|	-13,914,931	|
|	Maine	|	-65	|	-7,235,764	|
|	London	|	0	|	0	|
|	Paris	|	5	|	556,597	|
|	Berlin	|	10	|	1,113,194	|
|	Warsaw	|	22	|	2,449,028	|
|	Lithuania	|	25	|	2,782,986	|
|	Moscow	|	37	|	4,118,819	|
|	Baghdad	|	40	|	4,452,778	|
|	Islamabad	|	75	|	8,348,958	|
|	Delhi	|	80	|	8,905,556	|
|	Beijing	|	120	|	13,358,333	|
|	Shanghai	|	120	|	13,358,333	|
|	perth	|	115	|	12,801,736	|
|	Tokyo	|	140	|	15,584,722	|
|	Sydney	|	150	|	16,697,917	|
|	Wellington	|	175	|	19,480,903	|

