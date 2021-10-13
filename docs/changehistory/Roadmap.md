# The iTwin.js Roadmap

This roadmap provides the *big picture* view of the development path for the iTwin.js platform, and the relative priorities along the path.

## Themes

We will use the following themes (that may be adjusted from time-to-time according to your input) to drive the evolution of iTwin.js:

- Be *the open platform* for Infrastructure Digital Twins for federating BIM Models, GIS data, reality data, IT and OT into a single pane of glass for a seamless user experience.
- Be cloud provider, operating system, and browser neutral to the extent possible.
- Performance, scalability, security, and stability are our paramount concerns.
- Make developing with iTwin.js as easy, productive, predictable, and profitable as possible.
- Adhere to open source standards and norms wherever possible.
- Build an ecosystem of innovation and enterprise.

## Release 3.0

We plan to release `iTwin.js 3.0` in 2H21. The projects listed below will comprise the priorities during the 3.0 development cycle. However it's likely that some may not be fully functional, or even beta-ready by the release deadline. In that case they will become candidates for the 4.0 cycle.

Volunteers for help on any or all of these projects are welcome. In particular, the iTwin.js team always benefits from real-world use cases and data sets. If you would like to work together with us on any of these projects, particularly those that describe creating examples and templates for interfacing to external systems, please let us know.

### Visualization

- Support hardware anti-aliasing.
- Thematic display of point clouds and terrain.
- Support for compressed texture formats.
- Large-scale scene animations (e.g., pedestrian simulations, weather animations, disaster simulations).
- Support atmospheric rendering effects.

### Extensions

- Enhance publishing workflow to Bentley's Extension Service.
- Create examples and templates for building and publishing Extensions.
- Support for better testing in the Extension's Hosting App, i.e. iTwin Viewer, iTwin Design Review, PlantSight, etc.

### GIS Display

- Expand base map support to include additional sources (AzureMaps, MapBox etc.) or solid color. Transparency of base map can be controlled independently of layers.
- Add support for display of raster map layers connected to live WMS, WMTS, AzureMaps, MapBox, or ArcGIS REST API servers. Map layer visibility and transparency can be controlled independently. Layers can be attached either as background below BIM geometry or overlays above BIM geometry.

### Microsoft Teams integration

- Provide api for hosting iTwin.js applications directly within Microsoft Teams.

### ET/IT/OT Integration

- Provide working examples and templates for interfacing between engineering content in iModels, enterprise systems, and realtime IOT sensors, cameras, controllers, devices, and processors.
- Create tools for augmenting data synchronized with connectors from engineering design tools with IOT-link elements.
- Enhance BIS schemas for common IOT patterns and query engines.

### Agent Deployment

- Provide working examples and templates of agents deployed via Kubernetes.
- Perform operations on iModels that are triggered by relevant events from iModelHub.

### iTwin Viewer

- Create fully functional iTwin web viewing application platform, deployable on any cloud infrastructure. The Bentley iTwin Design Review product will be built from this application.
- Provide necessary infrastructure to host Extensions within any iTwin Viewer-based solution.

### Point Clouds

- Support visualization of time-based differencing of large scale point clouds.

### Reality Data Sources

- Implement a grid of linear transformations for large reality data.

### Geolocated Photos and Panoramas

- Improve server-side extraction of tags from photos and panoramas.
- Incorporate geophoto package into an Extension loadable from any iTwin Viewer application.

### Geolocation (general)

- Provide a method to access geolocation gcs definition for i model and context data horizontal and vertical
- Implement frontend reprojection when possible based on orbit gt implementation.
- Implement backend of new geo coord service reprojection for complex gcs.
- Obtain geoid separation from new geo coord service.

### iModel Transformations

- Create examples and templates illustrating usage of iModel-to-iModel transformations and synchronization.

### iTwin.js based connector framework

- Support for creating multi-process connectors using iTwin.js backends. One process links with source application api to read the source application files. It then communicates with another iTwin.js process via IPC to update the iModel.

### iModel Editing applications

- Support interactive iModel creation, editing, and augmenting on desktops via Electron.

### Mobile Device Support

- Minimize memory, power, and bandwidth requirements for mobile browsers.
- Improve usability for touch and small screen form factors.
- Support both *completely offline* and *occasionally connected* tablets and phones (iOS and Android).

### Non-Graphical Data Presentation

- Filtering presentation rules and rulesets by supported ECSchema version.
- Auto-updating data in all presentation rules -driven components when:
  - data in source iModel changes
  - presentation rules change
  - presentation ruleset variables change

#### Tree-related Improvements

- Making tree nodes "favorite" to make them appear at the top of the hierarchy.
- Improve filtering performance.
- Excluding or exclusively including some nodes from the hierarchy when filtering.

#### Properties-related Improvements

- Nested property grouping.
- Clickable navigation properties that select the target element.
- Better support for composite properties (arrays, structs, points).
- Support relationship properties.
- Support ad-hoc properties.

### User Interface

- Extend functionality of panel-based AppUi.
- Improve touch support and user experience on mobile devices.
- Multi-window support for desktop Electron applications.
- Enhance accessibility and keyboard navigation.
- Enhance UiItemProvider to support:
  - More type editors, especially those necessary to read/write workflows
  - Async list population
- Provide an API to allow apps, extensions, and packages to supply settings to the Settings Stage.

### Interfaces to external systems

- Support for exporting to common file formats (e.g. gltf, obj, dxf, pdf, etc.)
- Provide reference implementation of reality data in Unity.
- Provide more open source examples of integration with third-party visualization systems (Unity, Blender, etc.)
- Expand filtering and quality control options for graphics extraction.

### Developer experience

- Migrate full development of iTwin.js and associated repositories to GitHub.

> **Feedback welcome!** - Please let us know what you think should be on our priority list. File an issue on [GitHub](https://github.com/imodeljs/imodeljs/issues).
