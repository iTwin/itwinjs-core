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
* Removed `executeQuery` which could not page the result and therefore cannot stream results from backend. This is now replaced with `query`. Code can be updated as following.

```
  const rows = await conn.executeQuery("SELECT ECInstanceId FROM bis.Element");
```
can be change to following async iterator call
```
  for await (const row of conn.query("SELECT ECInstanceId FROM bis.Element")) {
    /* process row */
  }
```
in case user want to control paging manually like in case of virtual grid
```
  const pageSize = 500; // Numer of rows per page
  const pageNo = 20;    // Page of interest
  const pageOptions = {size: noOfRowsPerPage, start: pageNo};
  const rows = await conn.queryPage ("SELECT ECInstanceId FROM bis.Element", undefined, pageOptions);
  // rows will contain 0 to pageSize rows.
  if (rows.length > 0 ){
    // process rows
  } else {
    // empty page mean there is no rows in that page and next page would also return no rows.
  }
```
in addition to above following can get the maximum number of rows returned by the query
```
  const numberOfRows = await conn.queryRowCount("SELECT ECInstanceId FROM bis.Element");
  // initialize grid scrollbar according to expected number of rows that can be returned by query.
```

All above can also be used with `ECDb` and `IModelDb` on backend.
## Changes to IModelApp

Added unique id per session: IModelApp.sessionId

## Authentication and Authorization related changes (OpenID Connect, OAuth)

Fixes to OidcDelegationClient-s. Backend applications can now exchange -
* OIDC Jason Web Tokens (JWT) for other JWT tokens with additional scope.
* JWT tokens for legacy SAML tokens for legacy applications.

## Logger Configuration Changes

The BunyanLoggerConfig, FluentdBunyanLoggerConfig, FluentdLoggerStream, and SeqLoggerConfig classes have been moved out of @bentley/bentleyjs-core and into the new @bentley/logger-config package.

## Removed RbacClient

The RBAC API is considered internal and has been removed from the iModel.js stack. More comments on the individual methods that have been removed below.

```
RbacClient.getProjects() // Use ConnectClient.getProjects() instead
RbacClient.getIModelHubPermissions() // The plan is for iModelHub to support this API.
RbacClient.getUsers() // This method is little used. Bentley internal clients can make the necessary REST API calls directly.

```