# AccessToken
A client must have an [AccessToken]($imodeljs-clients) in order to open an iModel. To obtain an AccessToken, the client must first obtain a [AuthorizationToken]($imodeljs-clients). That requires an IMS login.

*Example:*
``` ts
[[include:imodeljs-clients.getAccessToken]]
```

AccessTokens have a limited lifetime and so the client may have to obtain a fresh AccessToken from time to time.
