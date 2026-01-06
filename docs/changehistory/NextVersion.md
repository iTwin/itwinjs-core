---
publish: false
---
# NextVersion

## Quantity Formatting

### Ratio Format Enhancements

Ratio formats now support automatic scale factor conversion when using 2-unit composite formats. This enables proper display of architectural scales (e.g., `1/4"=1'`) and metric scales (e.g., `1:100`) with automatic unit conversion.

**How it works:**

- When a Ratio format has exactly 2 units in its `composite.units` array, the system automatically computes scale factor conversion
- The first unit represents the numerator, the second represents the denominator
- Both units must have matching phenomena (e.g., both LENGTH)
- Scale factor is computed dynamically from the denominator→numerator conversion
- Supports both decimal and fractional display modes


For detailed examples and documentation, see the [Quantity Formatting documentation](../learning/quantity/index.md).
