# iTwin.js Tile Generator Overview

The tile generator is the backend component of the [iTwin.js display system](./overview.md) responsible for producing tiles from the geometry of elements within an iModel for display by the [frontend renderer](./frontend-overview.md).

The tile generator produces tiles in [iMdl format](./TileFormat.md) by the geometry of elements intersecting the tile's volume.md). Each tile, once generated, [may be cached](./TileCache.md) for subsequent reuse. The metadata embedded in the tiles enables the [renderer](./frontend-overview.md) to gradually establish the [structure of the tile tree](./TileTreeStructure.md).
