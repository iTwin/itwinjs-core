# Tile Tree Structure

Most 3d tile formats are statically generated along with a complete description of their structure. iModel tiles are different - they are dynamically generated to an arbitrary level of detail, resulting in a tile tree of theoretically infinite depth. Therefore, the structure of the tree is not known in advance but must be "discovered" during the process of generating the tiles.

## Basic structure

Each tile tree corresponds to a single [GeometricModel]($backend) in the iModel. The basic structure is an oct-tree (or quad-tree, for 2d models). Given a parent tile, one of two refinement strategies can be applied to obtain its direct descendants:
- Subdivision: the tile volume is split along its longest axis, then each sub-volume along its longest axis, and (for 3d models), each of those 4 sub-volumes along their longest axes.
- Magnification: the tile volume remains the same, but the level of detail is doubled.

Magnification is useful for reducing depth complexity, but must be employed carefully to avoid artifacts due to quantization error.

## Volume

The volume of the root tile is based on the extents of the model. For spatial models, the iModel's "project extents" - roughly, the union of the extents of **all** spatial models 8 are also taken into account. The volume of the root tile for a spatial model has the same shape as that of the model's volume, but scaled to the diameter of the project extents. This ensures that, given two models - one roughly the size of the project extents, and one considerably smaller - if the view is fit to contain both models then the tiles will have comparable levels of detail.

## Generating the structure

Metadata embedded in each tile's content is used by the frontend to determine the structure of the sub-tree immediately below it.

A tile always requires refinement if any decimated or curved geometry is present in its content, or any geometry was omitted based on pixel size. Otherwise, it requires refinement only if its chord tolerance is sufficiently large to introduce quantization error. If refinement is required, 2d tiles are always sub-divided, while 3d tiles choose a refinement strategy based on the chord tolerance and the total number of elements intersecting the tile's volume.

The tile header records which of the tile's sub-volumes were determined to be empty during tile generation. This allows the frontend to avoid requesting content for child tiles for which no content exists.

The [TileAdmin]($frontend) can be configured with a minimum level of detail for spatial models. For example, when viewing a large factory it is generally not necessary to render each nut and bolt down to millimeter scale. If the tile's chord tolerance is below the configured threshold, it will not be further refined.


