# Edge Display

In many CAD-oriented workflows, visualization of the edges of a surface can be as important as visualization of the surface itself. The [iTwin.js renderer](./index.md) supports displaying edges in wireframe mode (no surfaces) or along with their surfaces. When both surfaces and edges are displayed, special rendering techniques are employed to ensure that edges always draw in front of their corresponding surface, to prevent the z-fighting that would otherwise occur.

## Render modes

iTwin.js supports four built-in [RenderMode]($common)s that - among other things - affect how edges and surfaces are displayed.

- Wireframe: Only edges are drawn.
- Smooth shaded: Surfaces are drawn with materials and lighting. Edges can optionally be displayed as well.
- Solid fill: Surfaces are drawn without materials or lighting, using the underlying element colors. The edges of each surface are displayed in a shade of grey chosen for best contrast with both the element color and the view's background color.
- Hidden line: Surfaces are drawn without materials or lighting, using the view's background color. Edges are displayed using the underlying element colors.

The latter two modes are somewhat old-fashioned; more visually pleasing results can generally be achieved using smooth-shaded mode with visible edges enabled.

## Edge appearance

A [DisplayStyleState]($frontend) can customize the appearance of the edges by overriding their color, width, and/or style using [HiddenLine.Settings]($common). Optionally, edges obscured by surfaces can also be displayed.

The "Comic Book", "Schematic", "Illustration", and "Architectural: Monochrome" display styles in [this sample](https://www.itwinjs.org/sample-showcase/?group=Viewer+Features&sample=display-styles-sample&imodel=Villa) demonstrate edge display in shaded views.
