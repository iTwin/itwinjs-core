---
publish: false
---
# NextVersion

<!-- prettier-ignore -->
- [NextVersion](#nextversion)
  - [Backend](#backend)
    - [Vertical CRS discovery](#vertical-crs-discovery)

## Backend

### Vertical CRS discovery

The new beta [getAvailableVerticalCoordinateReferenceSystems]($backend) function returns an array of available vertical coordinate reference systems. Results can be filtered by geographic point or extent and by unit name. Unlike the similar [getAvailableCoordinateReferenceSystems]($backend) function, this function is not `async`.
