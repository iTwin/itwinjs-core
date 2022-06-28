---
publish: false
---
# NextVersion

Table of contents:

- [Deprecations](#deprecations)

## Deprecations

### @itwin/core-bentley

The AuthStatus enum has been removed. This enum has fallen out of use since the authorization refactor in 3.0.0, and is no longer a member of [BentleyError]($core-bentley).

The beta functions [Element.collectPredecessorIds]($core-backend) and [Element.getPredecessorIds]($core-backend) have been deprecated and replaced with [Element.collectReferenceIds]($core-backend) and [Element.getReferenceIds]($core-backend), since the term "predecessor" has been inaccurate since 3.2.0, when the transformer became capable of handling cyclic references and not just references to elements that were inserted before itself (predecessors).

### @itwin/core-mobile

IOSApp, IOSAppOpts, and AndroidApp have been removed in favor of [MobileApp]($core-mobile) and [MobileAppOpts]($core-mobile). Developers were previously discouraged from making direct use of [MobileApp]($core-mobile), which was a base class of the two platform specific mobile apps. This distinction has been removed, as the implementation of the two apps was the same. IOSAppOpts, now [MobileAppOpts]($core-mobile), is an extension of [NativeAppOpts]($core-frontend) with the added condition that an [AuthorizationClient]($core-common) is never provided.

IOSHost, IOSHostOpts, AndroidHost, and AndroidHostOpts have been removed in favor of [MobileHost]($core-mobile) for the same reasons described above.