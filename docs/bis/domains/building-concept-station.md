# Schema : Building Concept Station (alias)

## Design considerations

## Naming considerations

## Classes

## Relationships

## Code

Name|Value
--|--
CodeValue|NULL
CodeScope|CodeScopeSpec::Repository
CodeSpec|bis:NullCodeSpec

## Pending work

## iModel Bridges using ClassificationSystems

Bridges that do not store `SpatialComposition` relationships natively, may compute and maintain those in their bridge. In the long run it is not sure if the tradeoff of storing and maintaining the persistance of relationships outweighs the performance loss of computing them each time. However a future domain handler API may elect to compute them (as bim software grows more mature).

## Domain Standardization of SpatialCategories
