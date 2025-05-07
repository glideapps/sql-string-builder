# sql-query-builder

This package provides utilities for building SQL query strings in a safe, composable, and parameterized manner. It is designed to prevent SQL injection vulnerabilities and enhance code readability when constructing complex queries.

Primary author: [Alex Corrado](https://github.com/chkn)

## Installation

```bash
npm install sql-query-builder
```

## Core Concepts

At the heart of this package are two main concepts:

1.  **`QueryStringBuilder`**: A class that allows you to progressively build SQL queries by appending fragments and parameterized values.
2.  **`sql` tagged template literal**: A function that simplifies the creation of `QueryStringBuilder` instances, enabling a more natural and readable way to write SQL queries within JavaScript/TypeScript code.

Additionally, the package offers `UnsafeQueryLiteral` for situations where direct string interpolation is necessary (with strong warnings) and helper functions for common SQL construction patterns.

## `sql` Tagged Template Literal

```typescript
import { sql } from "sql-query-builder";
```

The `sql` tagged template literal is the most convenient and recommended way to create `QueryStringBuilder` instances. It allows you to write SQL queries in a template literal syntax, embedding JavaScript/TypeScript expressions as parameterized values.

**Usage:**

```typescript
const query = sql`SQL query text with ${parameter1} and ${parameter2}`;
```

-   The template literal is tagged with `sql`.
-   Placeholders `${expression}` are used to embed JavaScript/TypeScript expressions. These expressions will be treated as parameterized values.
-   The `sql` function returns a `QueryStringBuilder` instance.

**Example:**

```typescript
import { sql } from "sql-query-builder";

const productName = "Awesome Gadget";
const price = 99.99;

const query = sql`
    SELECT *
    FROM products
    WHERE name = ${productName}
      AND price <= ${price}
`;

const [queryText, values] = query.build();
console.log(queryText); // Output: SELECT * FROM products WHERE name = $1 AND price <= $2
console.log(values); // Output: [ 'Awesome Gadget', 99.99 ]
```

## `UnsafeQueryLiteral`

```typescript
import { UnsafeQueryLiteral } from "sql-query-builder";
```

`UnsafeQueryLiteral` is a special type that wraps a string. When a `QueryStringBuilder` encounters an `UnsafeQueryLiteral`, it **directly interpolates** the string value into the SQL query without parameterization or escaping.

**⚠️ WARNING: Use with Extreme Caution! ⚠️**

`UnsafeQueryLiteral` should **ONLY** be used for parts of the SQL query that are **absolutely guaranteed** to be safe and not derived from user input or any untrusted source. Using `UnsafeQueryLiteral` with user-controlled strings **creates a severe SQL injection vulnerability**.

**When to (Rarely) Use `UnsafeQueryLiteral`:**

-   For injecting **static, hardcoded SQL keywords, identifiers (table names, column names), or functions** that are known to be safe.
-   In scenarios where parameterization is not possible for a specific part of the SQL syntax (e.g., table or column names in some database systems).

**Example (Use with Caution - for illustration only):**

```typescript
import { sql, UnsafeQueryLiteral } from "sql-query-builder";

const tableName = new UnsafeQueryLiteral("users_table"); // Static, known table name
const columnName = new UnsafeQueryLiteral("username"); // Static, known column name

const query = sql`SELECT ${columnName} FROM ${tableName} WHERE id = ${123}`;

const [queryText, values] = query.build();
console.log(queryText); // Output: SELECT username FROM users_table WHERE id = $1
console.log(values); // Output: [ 123 ]
```

**In most cases, you should avoid `UnsafeQueryLiteral` and rely on parameterized values and the `QueryStringBuilder` to construct your SQL queries safely.**

## `QueryStringBuilder`

```typescript
import { QueryStringBuilder, sql } from "sql-query-builder";
```

`QueryStringBuilder` is the primary class in this package for constructing SQL queries. It provides a fluent interface for appending SQL fragments and parameterized values.

### Constructor

```typescript
constructor(
    tokenForIndex: (i: number) => string,
    queryTexts?: string[],
    values?: readonly any[]
)
```

While you can directly instantiate `QueryStringBuilder`, it is generally recommended to use the `sql` tagged template literal for easier creation.

**Parameters (for direct instantiation - usually not needed):**

-   `tokenForIndex: (i: number) => string`: A function that, given an index `i`, returns the placeholder token for the i-th value. For PostgreSQL, this is typically `(i) => "$" + (i + 1)`.
-   `queryTexts?: string[]`: An array of string fragments that form the base SQL query.
-   `values?: readonly any[]`: An optional array of values to be parameterized into the query.

### `append(part: QueryStringBuilder): QueryStringBuilder`

Appends another `QueryStringBuilder` to the current builder. This is the core method for composing larger queries from smaller, reusable parts.

**Parameters:**

-   `part: QueryStringBuilder`: The `QueryStringBuilder` to append.

**Returns:**

-   `QueryStringBuilder`: Returns `this` (the current `QueryStringBuilder`) for method chaining.

**Example:**

```typescript
import { sql } from "sql-query-builder";

const selectClause = sql`SELECT * FROM users`;
const whereClause = sql`WHERE age > ${18}`;

const query = selectClause.append(whereClause);

const [queryText, values] = query.build();
console.log(queryText); // Output: SELECT * FROM usersWHERE age > $1
console.log(values); // Output: [ 18 ]
```

### `appendRawString(part: string): QueryStringBuilder`

Appends a raw string directly to the SQL query.

**⚠️ WARNING: Use with Extreme Caution! ⚠️**

Similar to `UnsafeQueryLiteral`, `appendRawString` bypasses parameterization and directly injects the provided string into the SQL query. This should only be used for **safe, trusted, and non-user-controlled** parts of the query.

**Parameters:**

-   `part: string`: The raw string to append.

**Returns:**

-   `QueryStringBuilder`: Returns `this` for method chaining.

**Example (Use with Caution - for illustration only):**

```typescript
import { sql } from "sql-query-builder";

const orderByClause = sql`ORDER BY created_at`;
const direction = "DESC"; // Static, known direction

const query = orderByClause.appendRawString(` ${direction}`);

const [queryText, values] = query.build();
console.log(queryText); // Output: ORDER BY created_at DESC
console.log(values); // Output: []
```

### `clone(): QueryStringBuilder`

Creates a new, mutable `QueryStringBuilder` that is a copy of the current builder. This is useful when you need to modify a query without affecting the original builder.

**Returns:**

-   `QueryStringBuilder`: A new `QueryStringBuilder` instance with the same content as the original.

**Example:**

```typescript
import { sql } from "sql-query-builder";

const baseQuery = sql`SELECT * FROM products`;
const query1 = baseQuery.clone().append(sql` WHERE price < ${100}`);
const query2 = baseQuery
    .clone()
    .append(sql` WHERE category = ${"Electronics"}`);

const [queryText1, values1] = query1.build();
console.log(queryText1); // Output: SELECT * FROM products WHERE price < $1
console.log(values1); // Output: [ 100 ]

const [queryText2, values2] = query2.build();
console.log(queryText2); // Output: SELECT * FROM products WHERE category = $1
console.log(values2); // Output: [ 'Electronics' ]

// baseQuery remains unchanged
const [baseQueryText, baseQueryValues] = baseQuery.build();
console.log(baseQueryText); // Output: SELECT * FROM products
console.log(baseQueryValues); // Output: []
```

### `build(): [queryText: string, values: any[] | undefined]`

Finalizes the `QueryStringBuilder` and generates the SQL query string and an array of parameterized values. After calling `build()`, the `QueryStringBuilder` instance becomes frozen, and further modifications will result in errors.

**Returns:**

-   `[queryText: string, values: any[] | undefined]`: An array containing two elements:
    -   `queryText: string`: The complete SQL query string with parameter placeholders (e.g., `$1`, `$2`, etc.).
    -   `values: any[] | undefined`: An array of values that correspond to the parameter placeholders in `queryText`. This array will be `undefined` if there are no parameterized values.

**Example:**

```typescript
import { sql } from "sql-query-builder";

const name = "John Doe";
const age = 30;

const query = sql`INSERT INTO users (name, age) VALUES (${name}, ${age})`;
const [queryText, values] = query.build();

console.log(queryText); // Output: INSERT INTO users (name, age) VALUES ($1, $2)
console.log(values); // Output: [ 'John Doe', 30 ]

// You can now execute the queryText and values with your database client.
```

### `approximateLength(): number`

Returns an approximate length of the SQL query string being built. This can be useful for performance optimizations or logging purposes.

**Returns:**

-   `number`: An approximate length of the SQL query string.

**Example:**

```typescript
import { sql } from "sql-query-builder";

const longQuery = sql``;
for (let i = 0; i < 100; i++) {
    longQuery.append(sql`SELECT * FROM table${i}; `);
}

console.log(longQuery.approximateLength()); // Output: A number representing the approximate length
```

## Helper Functions

The `sql-query-builder` package provides several helper functions to simplify common SQL construction tasks.

### `joinSQL(items: readonly QueryStringBuilder[], separator: string): QueryStringBuilder`

Joins an array of `QueryStringBuilder` instances into a single `QueryStringBuilder`, using the specified separator string between each item.

**Parameters:**

-   `items: readonly QueryStringBuilder[]`: An array of `QueryStringBuilder` instances to join.
-   `separator: string`: The string to use as a separator between the joined items.

**Returns:**

-   `QueryStringBuilder`: A new `QueryStringBuilder` representing the joined SQL fragments.

**Example:**

```typescript
import { sql, joinSQL } from "sql-query-builder";

const conditions = [
    sql`age > ${18}`,
    sql`city = ${"New York"}`,
    sql`is_active = ${true}`,
];

const whereClause = sql`WHERE `.append(joinSQL(conditions, " AND "));

const query = sql`SELECT * FROM users `.append(whereClause);

const [queryText, values] = query.build();
console.log(queryText); // Output: SELECT * FROM users WHERE age > $1 AND city = $2 AND is_active = $3
console.log(values); // Output: [ 18, 'New York', true ]
```

### `commaJoinSQL(items: readonly QueryStringBuilder[]): QueryStringBuilder`

A convenience function that joins an array of `QueryStringBuilder` instances using a comma and a space (`, `) as the separator. This is commonly used for constructing comma-separated lists in SQL (e.g., in `SELECT` or `INSERT` statements).

**Parameters:**

-   `items: readonly QueryStringBuilder[]`: An array of `QueryStringBuilder` instances to join.

**Returns:**

-   `QueryStringBuilder`: A new `QueryStringBuilder` representing the comma-separated SQL fragments.

**Example:**

```typescript
import { sql, commaJoinSQL } from "sql-query-builder";

const columns = [sql`name`, sql`email`, sql`created_at`];

const selectClause = sql`SELECT `
    .append(commaJoinSQL(columns))
    .append(sql` FROM users`);

const [queryText, values] = selectClause.build();
console.log(queryText); // Output: SELECT name, email, created_at FROM users
console.log(values); // Output: []
```

### `commaJoinStringsToSQL(strings: readonly string[]): QueryStringBuilder`

A helper function that takes an array of strings and converts them into a comma-separated list of parameterized values within a `QueryStringBuilder`.

**Parameters:**

-   `strings: readonly string[]`: An array of strings to be joined and parameterized.

**Returns:**

-   `QueryStringBuilder`: A new `QueryStringBuilder` representing the comma-separated parameterized string values.

**Example:**

```typescript
import { sql, commaJoinStringsToSQL } from "sql-query-builder";

const userEmails = [
    "user1@example.com",
    "user2@example.com",
    "user3@example.com",
];

const whereClause = sql`WHERE email IN (`
    .append(commaJoinStringsToSQL(userEmails))
    .append(sql`)`);

const query = sql`SELECT * FROM users `.append(whereClause);

const [queryText, values] = query.build();
console.log(queryText); // Output: SELECT * FROM users WHERE email IN ($1, $2, $3)
console.log(values); // Output: [ 'user1@example.com', 'user2@example.com', 'user3@example.com' ]
```

## Security Considerations

-   **SQL Injection Prevention:** This package is designed to help prevent SQL injection vulnerabilities by promoting the use of parameterized queries. Always use parameterized values (using `${expression}` within the `sql` template literal) for any data that originates from user input or untrusted sources.
-   **`UnsafeQueryLiteral` and `appendRawString`:** These features should be used with extreme caution and only when absolutely necessary for static, trusted parts of the SQL query. Improper use can reintroduce SQL injection risks. Thoroughly review and understand the security implications before using them.

By using the `sql-query-builder` package correctly, you can build robust, readable, and secure SQL queries in your applications.

## License

MIT
