# Screen-space effects

Screen-space effects allow an application to manipulate the image produced by a [Viewport]($frontend). Using a [ScreenSpaceEffectBuilder]($frontend), the application supplies snippets of shader code that take the image as input and output a new image. This simple process can produce a wide variety of effects, and those effects can be chained such that the image output by one effect becomes the input to the next effect.

[This sample](https://www.itwinjs.org/sample-showcase/?group=Viewer+Features&sample=screen-space-effects-sample&imodel=Villa) demonstrates lens distortion, vignette, and saturation effects.
