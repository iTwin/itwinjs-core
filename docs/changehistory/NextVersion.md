---
publish: false
---
# NextVersion

## Changes to Authorization

### Authorization utilities made public

More of the utilities for authorization are now declared public -

- Single Page Applications (Browser) - [BrowserAuthorizationClient]($frontend-authorization-client)
- Agent Authorization - [AgentAuthorizationClient]($backend-itwin-client)

### Changes to authorization with agents

The deprecated methods below have been removed -

- [AgentAuthorizationClient.getToken]($backend-itwin-client)
- [AgentAuthorizationClient.refreshToken]($backend-itwin-client)

Provided ways to control the expiry of tokens issued by AgentAuthorizationClient -

- [AgentAuthorizationClient.refreshAccessToken]($backend-itwin-client) refreshes the token for the maximum period of validity, irrespective of whether the token has expired or not
- [AgentAuthorizationClientConfiguration.expireSafety]($backend-itwin-client) can be now be passed when initializing [AgentAuthorizationClient]($backend-itwin-client) to control the expiry check. The value supplied (in seconds) is used as a buffer to check the token for validity/expiry.
