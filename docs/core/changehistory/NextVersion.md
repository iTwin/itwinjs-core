---
ignore: true
---
# NextVersion


## Changes to OidcAgentClient

OidcAgentClient now follows the typical OIDC client credentials authorization workflow. This implies the caller need not supply "serviceUserEmail" and "serviceUserPassword" as part of the configuration. For example:

```
const agentConfiguration:  = {
      clientId: "some-client-id-obtained-through-registration",
      clientSecret: "some-client-secret-obtained-through-registration",
      scope: "context-registry-service imodelhub",
    };

const agentClient = new OidcAgentClient(agentConfiguration);
```

Note that what was OidcAgentClientV2 has now become OidcAgentClient - i.e., the older OidcAgentClient has been entirely replaced.
