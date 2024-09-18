---
publish: false
---
# NextVersion

Table of contents:

- [Quantity](#quantity)

## Quantity

- Add support for 'Ratio' format type (e.g. "1:2")
  - Example: Formatting a Ratio
  - Assuming that a `UnitsProvider` has been registered and initialized, here's how to format a ratio:
```ts
const ratioFormatProps: FormatProps = {
    type: "Ratio",
    ratioType: "OneToN",  // Formats the ratio in "1:N" form
    composite: {
        includeZero: true,
        units: [
            { name: "Units.HORIZONTAL_PER_VERTICAL" },
        ],
    },
};

const ratioFormat = new Format("Ratio");
ratioFormat.fromJSON(unitsProvider, ratioFormatProps).catch(() => {});
```

- Add support for unit inversion during unit conversion
