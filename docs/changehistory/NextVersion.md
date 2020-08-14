---
ignore: true
---
# NextVersion

## Restart Query (ECSQL)
Added method that let you cancel last query with same token. This cause last query to throw a exception that was cancelled.

```ts
    // A async task running following query
    for await (const row of db.restartQuery("my-tag", "SELECT * FROM ts.Foo")) {
        // ...
    }

    // Now submit another query with same tag 'my-tag'.
    // If above query still running it would be cancelled and exception would be thrown
    for await (const row of db.restartQuery("my-tag", "SELECT * FROM ts.Goo")) {
        ...
    }

    // In order to see what error was thrown use
    try {
        for await (const row of db.restartQuery("my-tag", "SELECT * FROM ts.Foo")) {
            // ...
        }
    } catch(err) {
        if (err.errorNumber === DbResult.BE_SQLITE_INTERRUPT){
            // query cancelled
        }
    }
```

This method is available on all following classes

* ECDb (backend)
* IModelDb (backend)
* IModelConnection (frontend)
