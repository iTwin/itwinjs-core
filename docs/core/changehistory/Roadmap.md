# The iModel.js Roadmap

This roadmap provides the *big picture* view of the development path for the iModel.js platform, and the relative priorities along the path.

## Themes

We will use the following themes (that may be adjusted from time-to-time according to your input) to drive the evolution of iModel.js:

- Be *the* open platform for Infrastructure Digital Twins, melding data from iModels, reality models, and many other sources.
- Focus on support for integrated digital project delivery and immersive digital operations.
- Prioritize performance, scalability, security and reliability over new features.
- Make developing with iModel.js enjoyable, productive, predictable, and profitable.
- Adhere to open source standards and norms wherever possible.
- Build a welcoming and inclusive ecosystem of innovation and enterprise.

## Priorities for 2H2019

### Visualization

- Visualization performance improvements for massive data sets and display modes
- Improvements and enhancements to visual fidelity and special effects
- Support for "hyper-modeling" (embedding section drawings and sheets segments in-situ in spatial views)
- Additional support for large scale scene animations and actors (e.g. schedule simulations, pedestrian simulations, weather animations, disaster simulations, etc.)
- Additional graphics formats

### Host platform support

- Prioritize browsers with highest JavaScript and WebGL capabilities
- Improve support for building native (Electron) desktop applications for Windows, macOS, and Linux
- Initiate support for native iOS applications

>For currently supported platforms see [Supported Platforms](../learning/SupportedPlatforms.md)

### Plugins

- Finalize Plugin infrastructure and logistics
- Streamline Plugin development and deployment processes
- Create Plugin examples for broad set of scenarios

### User Interface

- Improve small form factor devices (e.g. phones and tablets)
- Improve touch input experience

### Backend deployment

- Docker for Linux development and deployment support
- Deliver deployment examples based on Kubernetes

### Interfaces to external systems

- Enhance mechanisms to connect iModel.js with other non-JavaScript frameworks (e.g. C++, C#, Python, etc.)
- Create additional examples of interfacing iModel.js with VR/AR platforms (e.g. Unity, Hololens, etc.)
- Extend techniques to write bridges import data from foreign file formats

### Modeling of data within iModels

- Support transformation and synchronization between iModels
- Expand support for and provide more examples of Machine Learning with iModels
- Expand the scope of the delivered BIS schemas
- Refine BIS documentation with a focus on the information needed by Bridge and Application developers
- Support the visualization and extension of BIS schemas

### Developer experience

- Add more samples and improve clarity of existing examples
- Create interactive "jsfiddle-like" exploration examples
- Progress @alpha and @beta APIs towards their stable destinations. See [Release Tag Guidelines](../learning/guidelines/release-tags-guidelines.md)

>**We want your feedback** - What do you want us to work on most?  What are we doing that we could do better?  What should be on this roadmap but is not?  File an issue on [GitHub](https://github.com/imodeljs/imodeljs/issues) and let us know.
