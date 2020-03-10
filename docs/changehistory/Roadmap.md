# The iModel.js Roadmap

This roadmap provides the *big picture* view of the development path for the iModel.js platform, and the relative priorities along the path.

## Themes

We will use the following themes (that may be adjusted from time-to-time according to your input) to drive the evolution of iModel.js:

- Be *the open platform* for Infrastructure Digital Twins for melding data from iModels, GIS data,and reality data with the magnitude of other data sources of digital twins into a seamless user experience.
- Be cloud provider, operating system, and browser neutral to the extent possible.
- Performance, scalability, security, and stability are paramount concerns.
- Make developing with iModel.js as easy, productive, predictable, and profitable as possible.
- Adhere to open source standards and norms wherever possible.
- Build an ecosystem of innovation and enterprise.

## Release 2.0

We plan to release `iModel.js 2.0` in 2Q20.

It will include necessary breaking API changes to:

- remove some concepts and apis that were *deprecated* during 1.x
- add new UI concepts to subsume/replace existing ones
- formalize the [Extension API](../learning/frontend/extensions.md) as the primary way to add functionality to web applications
- enhance and refine the Briefcase APIs
- enhance and refine the authorization APIs to
  - remove support for SAML tokens - all authorization will be done through [JSON Web Tokens](https://jwt.io/) following the OAuth 2.0 protocol for authorization.
  - use Authorization Code flow instead of Implicit flow for Web Applications

We expect the transition from 1.x to 2.x to be trivial and uneventful for most users.

## Additional Priorities for 1H2020

### Visualization

- Support for "hyper-modeling" (embedding section drawings and sheets segments in-situ in spatial views)
- Additional support for large scale scene animations and actors (e.g. schedule simulations, pedestrian simulations, weather animations, disaster simulations, etc.)
- Take advantage of WebGL 2.0, when present
- Improve lighting system and make lighting more configurable
- Support for compressed texture formats
- Support anti-aliasing

### Desktop Support

- Improve support for building Windows native applications (MacOS and Linux to follow in future versions)
- Support interactive iModel creation and editing

### Mobile Device Support

- Support both *completely offline* and *occasionally connected* in iOS
- Synch with changesets from iModelHub
- Minimize power consumption

### Plugins

- Finalize Plugin APIs
- Streamline Plugin development and deployment processes
- Create Plugin examples for broad set of scenarios

### User Interface

- Improvements to look and feel of 9 zone applications

### Interfaces to external systems

- Extend techniques to write bridges import data from foreign file formats

### Developer experience

- Add more samples and improve clarity of existing examples
- Create interactive "jsfiddle-like" exploration examples

> **Feedback welcome!** - Please let us know what **you** think should be on our priority list. File an issue on [GitHub](https://github.com/imodeljs/imodeljs/issues).
