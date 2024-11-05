---
publish: false
---

# NextVersion

Table of contents:

- [API deprecations](#api-deprecations)
  - [@itwin/presentation-common](#itwinpresentation-common)

## API deprecations

### @itwin/presentation-common

- All public methods of [PresentationRpcInterface]($presentation-common) have been deprecated. Going forward, RPC interfaces should not be called directly. Public wrappers such as [PresentationManager]($presentation-frontend) should be used instead.

