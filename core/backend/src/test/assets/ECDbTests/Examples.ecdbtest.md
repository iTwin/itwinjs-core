# Example test

- dataset: AllProperties.bim

```sql
Select s.Name, s.Alias from meta.ECSchemaDef s WHERE s.Name LIKE 'ECDb%' LIMIT 4;
```

| AccessString | Type    |
|--------------|---------|
| Name         | String  |
| Alias        | String  |

| Name              | Alias   |
|-------------------|---------|
| ECDbFileInfo      | ecdbf   |
| ECDbMap           | ecdbmap |
| ECDbMeta          | meta    |
| ECDbSchemaPolicies| ecdbpol |
