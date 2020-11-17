---
ignore: true
---
# NextVersion

## Breaking API changes

* The union type [Matrix3dProps]($geometry-core) inadvertently included [Matrix3d]($geometry-core). "Props" types are wire formats and so must be pure JavaScript primitives. To fix compilation errors where you are using `Matrix3d` where a `Matrix3dProps` is expected, simply call [Matrix3d.toJSON]($geometry-core) on your Matrix3d object. Also, since [TransformProps]($geometry-core) includes Matrix3dProps, you may need to call [Transform.toJSON]($geometry-core) on your Transform objects some places too.

* The type of [Texture.data]($backend) has been corrected from `string` to `Uint8Array` to match the type in the BIS schema. If you get compilation errors, simply remove calls to `Buffer.from(texture.data, "base64")` for read, and `texture.data.toString("base64")` if you create texture objects.
