---
ignore: true
---
# NextVersion

## Breaking API changes

* The union type [Matrix3dProps]($geometry-core) inadvertently included [Matrix3d]($geometry-core). "Props" types are wire formats and so must be pure JavaScript primitives. To fix compilation errors where you are using `Matrix3d` where a `Matrix3dProps` is expected, simply call [Matrix3d.toJSON]($geometry-core) on your Matrix3d object. Also, since [TransformProps]($geometry-core) includes Matrix3dProps, you may need to call [Transform.toJSON]($geometry-core) on your Transform objects some places too.

* The type of [Texture.data]($backend) has been corrected from `string` to `Uint8Array` to match the type in the BIS schema. If you get compilation errors, simply remove calls to `Buffer.from(texture.data, "base64")` for read, and `texture.data.toString("base64")` if you create texture objects.

* The class [ToolUiManager]($ui-framework) has been renamed to [ToolSettingsManager]. 

## Updated version of Electron

Updated version of electron used from 8.2.1 to 10.1.3. Note that Electron is specified as a peer dependency in the iModel.js stack - so it's recommended but not mandatory that applications migrate to this electron version.
