# Polyface Analytical Data Visualization
The `PolyfaceAuxData` structure contains one or more analytical data channels for each vertex of a `Polyface`.  Typically a `Polyface` will contain only vertex data required for its basic display,the vertex position, normal and possibly texture parameter.  The `PolyfaceAuxData` structure contains supplemental data that is generally computed in an analysis program or other external data source.  This can be scalar data used to either overide the vertex colors through *Thematic Colorization* or XYZ data used to deform the mesh by adjusting the vertex postions or normals.

Analytical Data Channels.
-
The `PolyfaceAuxData` structure contains an array of `Polyface::AuxChannel` structures that may each represent a separate quantity (temperature, stress, displacement etc.).  A channel will include one or more input values and a set of vertex values for each input value.  If more than one input value is included then it is possible to animate the visualization as the input changes.  The input would typically be either elapsed time or an external input such as load.  Each input channel is independent and only a single channel of a type (scalar, displacement or normal) may be displayed at a time.

Thematic Colorization
-
Visualization of scalar vertex data is achieved by using the vertex values to map into a color gradient.  The gradients used to colorize the data are stored in view  *DisplayStyles* so the same data can be viewed with different color schemes or gradient styles.

Display Styles and Analysis Style.
  -
In IModelJS a `DisplayStyle` contains a group of display settings.  A single `DisplayStyle` can be shared by on or more views.  The `AnalysisStyle` member of `DisplayStyle` contains settings that control the display of `PolyfaceAuxData`.  An `AnalysisStyle` may include:
* A single displacement channel.
* A single normal channel.
* A single scalar channel, the scalar channel range and the thematic gradient to display the scalar data (`Gradient.ThematicSettings`).




