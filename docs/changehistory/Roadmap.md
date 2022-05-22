# The iTwin.js Roadmap

This roadmap provides an overview of the development path for the iTwin.js platform, cataloging proposed features that have received at least some level of priority for development. It is updated with each release.

## Themes

We will use the following themes (that may be adjusted from time-to-time according to your input) to drive the evolution of iTwin.js:

- Be *the open platform for Infrastructure Digital Twins* for federating BIM Models, GIS data, reality data, IT and OT together for a seamless user experience.
- Be cloud provider-, operating system-, and browser-agnostic to the extent possible.
- Performance, scalability, security, and stability are our paramount concerns.
- Make developing with iTwin.js as easy, productive, predictable, and profitable as possible.
- Adhere to open source standards and norms wherever possible.
- Build an ecosystem of innovation and enterprise.

## Roadmap

A checked box denotes a feature completed in the most recent release. An unchecked box indicates work upon the feature is either in progress or tentatively planned for a future release. The sections of this document change over time and are in no particular order. Within a section items are generally sorted by priority (note: priority order doesn't always indicate completion order, since lower priority but simple tasks may be completed quickly). If an item is prioritized lower than you'd like, that represents a tremendous opportunity for submitting a PR.

Contributions and suggestions are welcome. Feel free to [discuss](https://github.com/iTwin/itwinjs-core/discussions) or submit a PR.

### Visualization

- [X] Support hardware anti-aliasing.
- [X] Thematic display of point clouds and terrain.
- [ ] Support for compressed texture formats.
- [X] Particle effects
- [X] Screen-space effects
- [ ] Large-scale scene animations (e.g., pedestrian simulations, weather animations, disaster simulations).
- [ ] Support atmospheric rendering effects.

### Extensions

- [ ] Support "built-in" and runtime Extensions that are UI technology agnostic (i.e. does not rely on React, Angular, Vue.js, etc.)
- [ ] Support adding Tools and minimal UI capabilities
- [ ] Create examples and templates for building Extensions.
- [ ] Create quick and easy support for creating in an Extension's hosting app - e.g., iTwin Viewer.

### GIS Display

- [X] Expand base map support to include additional sources (AzureMaps, MapBox etc.) or solid color. Transparency of base map can be controlled independently of layers.
- [X] Add support for display of raster map layers connected to live WMS, WMTS, AzureMaps, MapBox, or ArcGIS REST API servers. Map layer visibility and transparency can be controlled independently. Layers can be attached either as background below BIM geometry or overlays above BIM geometry.

### Microsoft Teams integration

- [ ] Provide api for hosting iTwin.js applications directly within Microsoft Teams.

### ET/IT/OT Integration

- [ ] Provide working examples and templates for interfacing between engineering content in iModels, enterprise systems, and realtime IOT sensors, cameras, controllers, devices, and processors.
- [ ] Create tools for augmenting data synchronized with connectors from engineering design tools with IOT-link elements.
- [ ] Enhance BIS schemas for common IOT patterns and query engines.

### Agent Deployment

- [ ] Provide working examples and templates of agents deployed via Kubernetes.
- [ ] Perform operations on iModels that are triggered by relevant events from iModelHub.

### iTwin Viewer

- [X] Create fully functional iTwin web viewing application platform, deployable on any cloud infrastructure.
- [ ] Provide necessary infrastructure to host Extensions within any iTwin Viewer-based solution.

### Point Clouds

- [ ] Support visualization of time-based differencing of large scale point clouds.

### Reality Data Sources

- [X] Implement a grid of linear transformations for large reality data.

### Geolocated Photos and Panoramas

- [ ] Improve server-side extraction of tags from photos and panoramas.
- [ ] Incorporate geophoto package into an Extension loadable from any iTwin Viewer application.

### Geolocation (general)

- [X] Provide a method to access geolocation gcs definition for iModel and context data horizontal and vertical
- [ ] Implement frontend reprojection when possible based on orbit gt implementation.
- [ ] Implement client of new geo coord service.
- [ ] Obtain geoid separation from new geo coord service client.
- [ ] Complete system grid files in itwin-workspace support.

### iModel Transformations

- [X] Create examples and templates illustrating usage of iModel-to-iModel transformations and synchronization.

### iTwin.js based connector framework

- [X] Support for creating multi-process connectors using iTwin.js backends. One process links with source application api to read the source application files. It then communicates with another iTwin.js process via IPC to update the iModel.

### iModel Editing applications

- [X] Support interactive iModel creation, editing, and augmenting on desktops via Electron.

### Mobile Device Support

- [ ] Minimize memory, power, and bandwidth requirements for mobile browsers.
- [X] Improve usability for touch and small screen form factors.
- [ ] Support both *completely offline* and *occasionally connected* tablets and phones (iOS and Android).

### Non-Graphical Data Presentation

- [x] Filtering presentation rules and rulesets by supported ECSchema version.
- [x] Auto-updating data in all presentation rules -driven components when:
  - [x] data in source iModel changes
  - [x] presentation rules change
  - [x] presentation ruleset variables change

#### Properties-related Improvements

- [x] Nested property grouping.
- [x] Clickable navigation properties that select the target element.
- [ ] Better support for composite properties (arrays, structs, points).
- [ ] Support relationship properties.
- [ ] Support ad-hoc properties.

### User Interface

- [x] Extend functionality of panel-based AppUi.
- [ ] Improve touch support and user experience on mobile devices.
- [x] Multi-window support for desktop Electron applications.
- [ ] Enhance accessibility and keyboard navigation.
- [ ] Enhance UiItemProvider to support:
  - [ ] More type editors, especially those necessary to read/write workflows
  - [ ] Async list population
- [x] Provide an API to allow apps, extensions, and packages to supply settings to the Settings Stage.

### Interfaces to external systems

- [X] Provide base functionality for building exporters to other file formats (e.g. glTF, OBJ, USD)
- [X] Expand filtering and quality control options for graphics extraction.

### Developer experience

- [X] Migrate iTwin.js and associated repositories to GitHub.

> **Feedback welcome!** - Please let us know what you think should be on our priority list. File an issue on [GitHub](https://github.com/iTwin/itwinjs-core/issues).
