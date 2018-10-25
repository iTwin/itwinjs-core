# RpcInterface Versioning

For web applications, it is common to encounter situations where the frontend (which uses an RPC client) is deployed separately from the backend sever (which provides the RPC implementation).
Any time things are deployed separately, it is easy to imagine how they might get out of sync.
The version of the RpcInterface can be used to determine if the frontend client is compatible with the server implementation - as long as the semantic versioning rules below are followed.

## Non-Zero Major Versions (released)

- Change in major version indicates a breaking change
- Change in minor version indicates a method was added
- Change in patch indicates a fix not affecting compatibility was made

## Zero Major Versions (prerelease)

- Major version locked at zero
- Change in minor version indicates a potentially breaking change
- Change in patch indicates that a method was added or a fix was made

## Compatibility Strategies

Semantic versioning can be used to communicate what happened.
However, the goal is usually to maintain compatibility as long as it is feasible.
In this case, compatibility means the ability of an older client to talk to a newer server.
Strategies that help maintain this type of compatibility include:

- Don't remove or modify existing methods
- Deprecate methods rather than removing them
- Only add new methods
- Don't add new methods until you are prepared to support them
- Develop new methods separately (see WipRpcInterface.ts) and only move in when ready for long term support
- If compatibility must be broken for an important performance or functionality reason, try to batch other breaking changes together to minimize the total impact on your consumers
