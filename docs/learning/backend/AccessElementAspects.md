# Accessing ElementAspects

An [ElementAspect]($backend) is an in-memory representation of a [BIS ElementAspect](../../bis/guide/fundamentals/elementaspect-fundamentals.md).

There can be `[0..1]` instances of [ElementUniqueAspect]($backend) per ElementAspect class per Element instance.

There can be `[0..N]` instances of [ElementMultiAspect]($backend) per ElementAspect class per Element instance.

``` ts
[[include:Elements.getAspects]]
```
