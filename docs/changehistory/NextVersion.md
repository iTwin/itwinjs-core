---
publish: false
---
# NextVersion

## Ambient Occlusion Improvements

The ambient occlusion effect has undergone some quality improvements.

Changes:

- The shadows cast by ambient occlusion will decrease in size the more distant the geometry is.
- The maximum distance for applying ambient occlusion now defaults to 10,000 meters instead of 100 meters.
- The effect will now fade as it approaches the maximum distance.

Old effect, as shown below:

![AO effect is the same strength in the near distance and far distance](./assets/AOOldDistance.png)

New effect, shown below:

![AO effect fades in the distance; shadows decrease in size](./assets/AONewDistance.png)

For more details, see the new descriptions of the `texelStepSize` and `maxDistance` properties of [AmbientOcclusion.Props]($common).

## IModelSchemaLoader replaced with SchemaLoader

Replaced IModelSchemaLoader with generic SchemaLoader class and function to get schemas from an iModel.  This allows us to remove the ecschema-metadata dependency in core-backend.

```typescript
// Old
import { IModelSchemaLoader } from "@itwin/core-backend";
const loader = new IModelSchemaLoader(iModel);
const schema = loader.getSchema("BisCore");

// New
import { getSchemaJsonFromIModel } from "@itwin/core-backend";
import { SchemaLoader } from "@itwin/ecschema-metadata";
const loader = new SchemaLoader(getSchemaJsonFromIModel);
const schema = loader.getSchema("BisCore");
```

The new SchemaLoader can be constructed with any function that returns schema json when passed a schema name or undefined if the schema cannot be found
