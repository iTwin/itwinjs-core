# DATE, TIME & TIMESTAMP Literals

## `TIMESTAMP`

Describe a literal timestamp value. Timestamp is provided according to
[iso-8601](https://en.wikipedia.org/wiki/ISO_8601) standard.

```bnf
TIMESTAMP <iso-8601-timestamp>
```

Following example use [strftime()](https://www.sqlite.org/lang_datefunc.html) to extract date/time component from a timestamp value.

```sql
SELECT strftime('%m/%d/%Y %H:%M:%S', TIMESTAMP '2013-02-09T12:01:22') AS [output]
```

Output look like following

```text
output
--------------------
02/09/2013 12:01:22
```

## `DATE`

Describe a literal timestamp value. Timestamp is provided according to
[iso-8601](https://en.wikipedia.org/wiki/ISO_8601) standard.

```bnf
DATE <iso-8601-date>
```

Following example use [strftime()](https://www.sqlite.org/lang_datefunc.html) to extract date component from a date literal value.

```sql
SELECT strftime('%m/%d/%Y', DATE '2013-02-09') AS [output]
```

Output look like following

```text
output
--------------------
02/09/2013
```

## `TIME`

Describe a literal timestamp value. Timestamp is provided according to
[iso-8601](https://en.wikipedia.org/wiki/ISO_8601) standard.

```bnf
DATE <iso-8601-time>
```

Following example use [strftime()](https://www.sqlite.org/lang_datefunc.html) to extract time component from a time literal value.

```sql
SELECT strftime('%H:%M:%S', TIME '12:01:22') AS [output]
```

Output look like following

```text
output
--------------------
12:01:22
```

[ECSql Syntax](./index.md)
