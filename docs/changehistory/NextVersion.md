---
publish: false
---
# NextVersion

Table of contents:

- [Progress API for downloading changesets](#progress-api-for-downloading-changesets)
- [Deprecations](#deprecations)

## Progress API for downloading changesets

Progress of changeset(s) download is now reported and download can be cancelled. [BackendHubAccess.downloadChangeset]($core-backend) and [BackendHubAccess.downloadChangesets]($core-backend) take optional argument `progressCallback` of type [ProgressFunction]($core-backend).
If function is passed, it is regularly called to report download progress. Changeset(s) download can be cancelled by returning
[ProgressStatus.Abort]($core-backend) from said function.

## Deprecations

### @itwin/core-bentley

The AuthStatus enum has been removed. This enum has fallen out of use since the authorization refactor in 3.0.0, and is no longer a member of [BentleyError]($core-bentley).

### @itwin/core-mobile

IOSApp, IOSAppOpts, and AndroidApp have been removed in favor of [MobileApp]($core-mobile) and [MobileAppOpts]($core-mobile). Developers were previously discouraged from making direct use of [MobileApp]($core-mobile), which was a base class of the two platform specific mobile apps. This distinction has been removed, as the implementation of the two apps was the same. IOSAppOpts, now [MobileAppOpts]($core-mobile), is an extension of [NativeAppOpts]($core-frontend) with the added condition that an [AuthorizationClient]($core-common) is never provided.

IOSHost, IOSHostOpts, AndroidHost, and AndroidHostOpts have been removed in favor of [MobileHost]($core-mobile) for the same reasons described above.