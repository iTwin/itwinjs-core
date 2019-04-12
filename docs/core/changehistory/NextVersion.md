---
ignore: true
---
# NextVersion

## Changes to OidcAgentClient

[OidcAgentClient]($clients-backend) now follows the typical OIDC client credentials authorization workflow. This implies the caller need not supply "serviceUserEmail" and "serviceUserPassword" as part of the configuration. For example:

```ts
const agentConfiguration:  = {
      clientId: "some-client-id-obtained-through-registration",
      clientSecret: "some-client-secret-obtained-through-registration",
      scope: "context-registry-service imodelhub",
    };

const agentClient = new OidcAgentClient(agentConfiguration);
```

Note that what was OidcAgentClientV2 has now become [OidcAgentClient]($clients-backend) - i.e., the older OidcAgentClient has been entirely replaced.

## Deprecation of *standalone* iModels

The confusing concept of *standalone* iModels has been removed from the frontend API and deprecated in the backend API.
All API related to *standalone* iModels will be eliminated prior to the 1.0 release.
All uses of the following *standalone* iModel functions must be migrated:

* [IModelDb.openStandalone]($backend)
* [IModelDb.createStandalone]($backend)
* [IModelConnection.openStandalone]($frontend)

Change history is essential for editing scenarios, so should use iModels managed by iModelHub. See:

* [IModelDb.open]($backend)
* [IModelConnection.open]($frontend)

Archival scenarios can use *snapshot* iModels. Once created, a *snapshot* iModel is read-only. See:

* [IModelDb.createSnapshot]($backend)
* [IModelDb.createSnapshotFromSeed]($backend)
* [IModelDb.openSnapshot]($backend)
* [IModelConnection.openSnapshot]($frontend)

## Node 10.15.3

The iModel.js backend now requires [Node version 10.15.3](https://nodejs.org) or later.

## Starting up of backends

For web applications that have *not* migrated to using [OpenId Connect]($docs/core/learning/common/AccessToken.md) for authentication, it's  important that backends are started with a configuration that increases the allowed maximum size of headers to accommodate the larger SAML based access tokens, and the additional headers that are now needed to be passed through.

e.g., in package.json

```json
...
"start:backend": "node --max-http-header-size=16000 lib/backend/main.js",
...
```

## Electron 4.10.0

The electron version used internally has  been updated to v4.10.0.

## Changes to authorization of frontend applications

* [IModelApp.accessToken]($frontend) has now been removed.
* Frontend applications that need to access protected data from the iModelHub must now provide an implementation of [IAuthorizationClient]($clients) through the [IModelApp.authorizationClient]($frontend) setting.
* The following implementations of [IModelApp.authorizationClient]($frontend) can be used:
  * Frontends running in a browser: [OidcBrowserClient]($clients)
  * Test implementations that use [ImsCredentials]($clients) to fetch legacy SAML tokens: [ImsTestAuthorizationClient]($clients)
* Frontend methods that require authorization do not require the accessToken to be passed in anymore -
  * [IModelConnection.open]($frontend)
  * [IModelConnection.close]($frontend)

## Breaking changes to RPC interfaces

* Breaking changes have been made to [IModelReadRpcInterface]($common) and [IModelWriteRpcInterface]($common). This implies the frontend and backends based on the next version of iModel.js break compatibility and have to be deployed simultaneously.
* None of the RPC interfaces now need to pass the [AccessToken]($client) as an argument. The RPC implementation provides the mechanism to to make this happen through a generic context. More on this below.
* `RpcOperationPolicy.requestId()` has now been removed

## Enhancements to authorization and logging

* A new family of classes starting with [ClientRequestContext]($bentley) now provide generic context for a specific client request. The context carries the necessary information for making the API calls to generate usage metrics, logging diagnostics (telemetry), and authorizing the use of various services.

* Instances of these classes are passed to almost all asynchronous calls that eventually call into the various services. For synchronous calls, a static "current" context avoids the need to pass the context as an argument.

* The base class [ClientRequestContext]($bentley) includes information on the *`session`*, *`application`* and *`activity`* for logging and usage metrics. Note that this replaces the use of `ActivityLoggingContext` in previous versions.

* The sub class [AuthorizedClientRequestContext]($clients) includes the [AccessToken]($clients) that carries the information on *`authorization`*. Note that this replaces the use of `ActivityLoggingContext` and `AccessToken` as parameters in various method calls. For example,

  ```ts
  function updateVersion(actx: ActivityLoggingContext, accessToken: AccessToken) {
    const version: Version = await iModelClient.versions.update(actx, accessToken, imodelId, version);
    ...
  }
  ```

  becomes

  ```ts
  function updateVersion(requestContext: AuthorizedClientRequestContext) {
    const version: Version = await iModelClient.versions.update(requestContext, imodelId, version);
    ...
  }
  ```

* For web, desktop and mobile applications, at the frontend, the sub classes [FrontendRequestContext]($frontend) and [AuthorizedFrontendRequestContext]($frontend) can be used as helpers to create these contexts with the necessary session, application and authorization information (if applicable) filled out.

* Similarly, for agent applications, at the backend, the sub classes [BackendRequestContext]($backend) and [AuthorizedBackendRequestContext]($backend) can be used as helpers to create these contexts with the necessary session and host information filled out.

* In the case of web applications the context is serialized and passed as HTTP headers from the frontend to the backend. Note that all backends (for web frontends) must now be configured to allow the following headers to avoid CORS errors -

```ts
      res.header("Access-Control-Allow-Headers", "Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With, X-Correlation-Id, X-Session-Id, X-Application-Id, X-Application-Version, X-User-Id");
```

* It is important for logging purposes that different frontend calls are tracked with a unique `activityId`. The system tries to ensure this by setting it up as a new Guid after every RPC request by default.

* Any frontend methods that contact multiple services (and not just the backend through RPC) need to explicitly create the context at the top level, and manage the context through multiple service calls. Right before the RPC request is made, call  [ClientRequestContext.useContextForRpc]($bentley) or [AuthorizedClientRequestContext.useContextForRpc]($clients) to setup the use of that context (and the contained `activityId`) for the subsequent RPC request.

### Changes to authorization for Single Page Applications

[OidcBrowserClient]($frontend) attempts to silently sign-in during initialization, when signIn() is called, or when the accesss token expires. The signIn() calls also takes a successRedirectUri parameter that can be used to control the redirection after the entire authorization process is completed.


## Changes required for Usage Logging

* Frontend applications must set the [IModelApp.applicationId]($frontend) and [IModelApp.applicationVersion]($frontend) fields to ensure the usage is logged. Bentley applications must set `applicationId` to the Bentley Global Product Registry Id (GPRID).

* Similarly agent applications must set these fields in [IModelHost]($backend). Note that [IModelHost.applicationId]($backend) replaces [IModelHost]($backend).backendVersion for consistency.

* `applicationId` may eventually be removed once it becomes possible to infer it from the [AccessToken]($client). A service to make this available is in the works.

## Miscellaneous changes

* The [IModelJsExpressServer]($express-server) class has been moved to its own package (`@bentley/express-server`).
  * This package has a dependency on express, so the first constructor argument to `IModelJsExpressServer` has been removed.
* [IModelConnection.openSnapshot]($frontend) throws an exception if [IModelApp.startup]($frontend) has not been called.
* [IModelDb.onOpened.addListener]($backend) takes a callback with a different signature -  [AuthorizedClientRequestContext]($clients) is now passed as te first argument.
* [ImsActiveSecureTokenClient]($client) takes [ImsCredentials]($client) as a single argument instead of separate email and password fields.
* Deleted agent-test-app from the repository.

## Breaking changes to ImodelServices.openIModel

* The first argument to openIModel is now a context (project) id. It replaces passing in a ProjectInfo object.

## Breaking changes to [ViewState]($frontend)

To reduce errors in synchronizing a [Viewport]($frontend)'s state with that of the ViewState it controls, several mutator methods were removed from `ViewState` and transferred to `Viewport`. These include:

* The setter for the `viewFlags` property.
* The `overrideSubCategory`, `dropSubCategoryOverride`, getSubCategoryOverride`, and `getSubCategoryAppearance` functions.
* The `changeCategoryDisplay` function.

To adjust your code for these changes, change the call site to invoke the `Viewport` functions/properties instead of those formerly defined on the `ViewState`.

Additionally, the `areFeatureOverridesDirty` property and `setFeatureOverridesDirty` function were removed from `ViewState`. The `Viewport` now keeps track of discrete changes to its state which require feature symbology overrides to be regenerated. This also allows it to expose a variety of more granular events like `onViewedCategoriesChanged` and `onDisplayStyleChanged`. These are far more efficient than listening for `onViewChanged`, which is dispatched immediately upon each change, sometimes multiple times per frame. The new events are dispatched once per frame during which the state they monitor changed.

To adjust your code for these changes:

* If you were previously using `setFeatureOverridesDirty` to notify the `Viewport` that it must refresh its feature symbology overrides, you should no longer need to do so when modifying the display style, displayed categories etc, provided the `Viewport` APIs are used. The `Viewport` APIs automatically record the state changes and internally mark the overrides as 'dirty' if necessary.
* If you were using `setFeatureOverridesDirty` to notify the `Viewport` that a [FeatureOverrideProvider]($frontend) you registered with the `Viewport` had changed internally and therefore the overrides should be recalculated, use [Viewport.setFeatureOverrideProviderChanged]($frontend) instead.
