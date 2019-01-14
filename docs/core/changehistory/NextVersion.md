---
ignore: true
---
# NextVersion

## More diagnostics and trace logging of all HTTP requests
* Added API to detect and use fiddler proxy (if available) at the backend to route requests for troubleshooting:
  ```imodeljs-clients-backend: RequestProxy.setupFiddlerProxyIfReachable();```

  The API is called automatically when opening iModel-s, but must be typically setup by backend applications at startup.

* Setup trace logs of all requests made through the Request API. To enable this, do:
   ```Logger.setLevel("imodeljs-clients.Request", LogLevel.Trace);```

