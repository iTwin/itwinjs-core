---
publish: false
---
# NextVersion

Table of contents:
- [Geometry](#geometry)
  - [Convex check using dihedral angles](#convex-check-using-dihedral-angles)

## Geometry

### Convex check using dihedral angles

`PolyfaceQuery.dihedralAngleSummary` old behavior was to return `1` if the mesh was planar (i.e., all dihedral angles between facet normals were zero). Therefore, `PolyfaceQuery.isConvexByDihedralAngleCount` old behavior was to return `true` for planar meshes (i.e., the check would say a planar mesh is convex which is not correct).

We changed the behavior so now `PolyfaceQuery.dihedralAngleSummary` returns `0` for planar meshes and therefore, `PolyfaceQuery.isConvexByDihedralAngleCount` returns `false`.

Please note that `PolyfaceQuery.dihedralAngleSummary` old behavior was to return `0` if
- mesh had mixed dihedral angles.
- mesh had edge(s) with more than 2 adjacent facets.
- `ignoreBoundaries = false` and mesh had edge(s) with 1 adjacent facet (boundary edges).

The new behavior returns `-2` for such cases.
