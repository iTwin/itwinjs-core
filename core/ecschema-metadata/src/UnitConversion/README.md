<!-- prettier-ignore-start -->

# Getting the multiplier

## Case 1a: Converting square feet to base units (m) = (12 * 25.4 * .001) ^ 2
Since it is recursive, it may be beneficial to read this from bottom-up (mm -> ft)
- 1 sq foot = (12 * 25.4 * .001) ^ 2
- 1 foot = 12 inches
- 1 inch = 25.4 mm
- 1 mm = .001 m
Recursive bc need to see what units like 1 foot resolves to before raising to current exponent
Same process converting from base units(m) to square feet; will divide by multiplier and subtract the offset in the end instead. Want to get the same multiplier and offset in the meantime.

## Case 1b: Converting gallons to base units (m) = 231 * ((25.4 * .001) ^ 3)
- 1 gallon = 231 cubic inches
- 1 cubic inch = (25.4 * .001) ^ 3
- 1 inch = 25.4 mm
- 1 mm = .001 m
Same process converting from base units(m) to gallons.

## Steps to get the multiplier
1. Recursively find the units defining this unit. Aggregate the multipliers there.
2. Multiply aggregated by numerator and divide by denominator
3. Raise it to the current exponent

# Getting the offset

## Case 2a: Converting Fahrenheit to base units (k)
- 1 Fahrenheit = (F - 32) * (5/9)  -> to get Celsius
- 1 Celsius = C + 273.15 -> to get Kelvin

Multiplier should be 5/9 and offset should be (-32 * 5 / 9) + 273.15

## Case 2b: Converting AT_Gauge to base units (PA)
- AT_GAUGE = AT_GAUGE + 1.0332 -> to get AT
- AT = KGF / CM (2) = 98066.5 PA
- KGF = STD_G * KG = 9.80665 KG*M / S(2)
- CM (2) = (.01 M) ^ 2 = .0001 M ^ 2
- KG / (M * S) = PA

Multiplier should be 98066.5 and offset should be 101325 (1.0332 * 98066.5)

## Steps to get the offset going fromUnit -> baseUnit
1. Recursively find the units defining this unit. Aggregate the offset and multipliers.
2. Multiply the current offset by numerator and divide by denominator
3. Then add current offset to aggregate offset
4. If there is an offset, multiply offset by aggregate multiplier

## Case 2b: Converting base units (k) to Fahrenheit
Not actually doing this in the algo, but need to replicate the effects of traversing (baseUnit -> toUnit)
- 1 Kelvin = K - 273.15 -> to get Celsius
- 1 Celsius = C * 9/5 + 32 -> to get Fahrenheit

The multiplier should be 9/5 and offset should be (-273.15 * 9/5) + 32

How it actually traverses is (toUnit -> baseUnit) but will recursively give us the values from baseUnit -> toUnit
The direction (+/-) will be handled as it'll divide the multiplier then subtract the offset.
The magnitude needs to be handled however, so step 2 below accounts for that.

## Steps to get the offset going baseUnit -> toUnit
1. Recursively find the units defining this unit. Aggregate the offset and multipliers.
2. Multiply the aggregate offset by denominator and divide by numerator (want to flip numerator and denominator here to keep magnitude equivalent as above)
3. If there is an offset, divide offset by aggregate multiplier
4. Then add current offset to aggregate offset

<!-- prettier-ignore-end -->
