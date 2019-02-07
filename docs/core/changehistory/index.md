# 0.187.0 Change Notes

## New signature for RpcInterface.forward

To support stricter type checking of apply, call, and bind usage in upcoming versions of the typescript compiler, the signature of RpcInterface.forward is now (parameters: IArguments). This is not a breaking change for most use cases within RPC interfaces that invoke forward via apply. However, it is now possible and preferable with the new signature to directly invoke this.foward(arguments) in RPC interfaces instead of using apply.

## Node 10

The iModel.js backend now requires [Node version 10](https://nodejs.org) or later. If you run the backend, please install it before running this version.

If you build the iModel.js packages from the monorepo, you should follow these steps:

1. `rush clean`
1. `rush unlink`
1. uninstall current version of Node (on Windows, via "add or remove programs")
1. install latest version of Node 10
1. `npm install -g @microsoft/rush`
1. `git pull`
1. `rush install`
   - if you get an error about npm versions, do `npm uninstall -g npm`
1. `rush build`
1. `rush test`

## Allowed backend applications to specify HTTPS_PROXY

Applications can now configure backend HTTP requests to go through a firewall proxy server with the HTTPS_PROXY environment.
To enable this, the backend application must call the following API as part of it's initialization:
  ```imodeljs-clients-backend: RequestHost.initialize();```

## More diagnostics and trace logging of all HTTP requests

* Added API to detect and use fiddler proxy (if available) at the backend to route requests for troubleshooting.
To enable this, the backend application must call the following API as part of it's initialization:
  ```imodeljs-clients-backend: RequestHost.initialize();```

  The API is called automatically when opening iModel-s, but must be typically setup by backend applications at startup.

* Setup trace logs of all requests made through the Request API. To enable this, do:
   ```Logger.setLevel("imodeljs-clients.Request", LogLevel.Trace);```

## Removed IModelDb's cache of accessToken

For long running operations like AutoPush, the developer must explicitly supply an ```IAccessTokenManager``` to keep the token current.
