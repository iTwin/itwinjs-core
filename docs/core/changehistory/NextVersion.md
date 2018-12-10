---
ignore: true
---
# NextVersion

## New signature for RpcInterface.forward

To support stricter type checking of apply, call, and bind usage in upcoming versions of the typescript compiler, the signature of RpcInterface.forward is now (parameters: IArguments). This is not a breaking change for most use cases within RPC interfaces that invoke forward via apply. However, it is now possible and preferable with the new signature to directly invoke this.foward(arguments) in RPC interfaces instead of using apply.