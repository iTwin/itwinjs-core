# The iModel.js Roadmap

This roadmap provides the *big picture* view of the development path for the iModel.js platform, and the relative priorities along the path.

## Themes

We will use the following themes (that may be adjusted from time-to-time according to your input) to drive the evolution of iModel.js:

- Be the library for Digital Twins, bringing data from iModels and many other sources together seamlessly.
- Empower Developers to write Digital Twin applications and services from scratch or integrate into existing applications.
- Developing with iModel.js is enjoyable and productive.
- Adhere to open source standards and norms where possible
- Be the best library for visualization of large 3d models.
- Build a welcoming and inclusive ecosystem of innovation and enterprise.
- Performance, scalability, security and extensibility are more important than new features.

## Priorities for 2019-2020

### Expand the number of supported platforms (ranked according to development resources)

>For currently supported platforms see [Supported Platforms](../learning/SupportedPlatforms.md)

- Frontend:
  1. Web browsers
  2. Desktop (Electron)
     - Windows
     - MacOS
     - Linux
  3. Mobile
     - iOS
     - Android

- Backend:
  1. Linux
  2. Windows

### Interface better with External systems

- Provide a mechanism to expose content from an iModel to 3rd applications and frameworks
- Improve the ability to write bridges that transform and import data from 3rd party file formats

### Improve modeling of data within iModels

- Support transformation and synchronization between iModels
- Expand the scope of the delivered BIS schemas
- Refine BIS documentation with a focus on the information needed by Bridge and Application developers
- Support the visualization and extension of BIS schemas

### Improve developer experience

- Docker for Linux development and deployment support
- Deliver a server side deployment example based on Kubernetes
- Add more client side samples and improve clarity of existing examples
- Incrementally bring all APIs out of @alpha and @beta and into the stable @public API [Release Tag Guidelines](../learning/guidelines/release-tags-guidelines.md)

>**We want your feedback** - What do you want us to work on most?  What are we doing that we could do better?  What should be on this roadmap but is not?  File an issue on [GitHub](https://github.com/imodeljs/imodeljs/issues) and let us know.
