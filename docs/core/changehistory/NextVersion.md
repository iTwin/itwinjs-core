---
ignore: true
---
# NextVersion

## iModelHub file handlers have been moved to imodeljs-clients-backend

Moved AzureFileHandler, IOSAzureFileHandler, UrlFileHandler and the iModelHub tests to the imodeljs-clients-backend package. This removes the dependency of imodeljs-clients on the "fs" module, and turns it into a browser only package.

To fix related build errors, update imports for these utilities from
```import {AzureFileHandler, IOSAzureFileHandler, UrlFileHandler} from "@bentley/imodels-clients";```
to
```import {AzureFileHandler, IOSAzureFileHandler, UrlFileHandler} from "@bentley/imodels-clients-backend";```

## Prevented partial downloads of ChangeSets and Briefcases

Backend ChangeSet and Briefcase downloads are atomic - i.e., will not be partially downloaded, and can simultaneously happen in multiple machines.

## Changes to IModelConnection

* In the case of ReadWrite connections, IModelConnection.close() now always disposes the briefcase held at the backend. Applications must ensure that any changes are saved and pushed out to the iModelHub before making this call.
* IModelConnection.connectionTimeout is now public, allowing applications to customize this in the case of slow networks.
* Removed unique id per connection: IModelConnection.connectionId

## Changes to IModelApp

Added unique id per session: IModelApp.sessionId

## Authentication and Authorization related changes (OpenID Connect, OAuth)

Fixes to OidcDelegationClient-s. Backend applications can now exchange -
* OIDC Jason Web Tokens (JWT) for other JWT tokens with additional scope.
* JWT tokens for legacy SAML tokens for legacy applications.
