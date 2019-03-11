---
ignore: true
---
# NextVersion

## Changes to OidcAgentClient

OidcAgentClient now follows the typical OIDC client credentials authorization workflow. This implies the caller need not supply "serviceUserEmail" and "serviceUserPassword" as part of the configuration. For example:

```ts
const agentConfiguration:  = {
      clientId: "some-client-id-obtained-through-registration",
      clientSecret: "some-client-secret-obtained-through-registration",
      scope: "context-registry-service imodelhub",
    };

const agentClient = new OidcAgentClient(agentConfiguration);
```

Note that what was OidcAgentClientV2 has now become OidcAgentClient - i.e., the older OidcAgentClient has been entirely replaced.

## Deprecation of *standalone* iModels

The confusing concept of *standalone* iModels is now deprecated and will be eliminated prior to the 1.0 release.
All uses of the following *standalone* iModel functions must be migrated:

- [IModelDb.openStandalone]($backend)
- [IModelDb.createStandalone]($backend)
- [IModelConnection.openStandalone]($frontend)

Change history is essential for editing scenarios, so should use iModels managed by iModelHub. See:

- [IModelDb.open]($backend)
- [IModelConnection.open]($frontend)

Archival scenarios can use *snapshot* iModels. Once created, a *snapshot* iModel is read-only. See:

- [IModelDb.createSnapshot]($backend)
- [IModelDb.createSnapshotFromSeed]($backend)
