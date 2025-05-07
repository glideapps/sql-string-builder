import { describe, expect, test } from "vitest";
import {
    UnsafeQueryLiteral,
    sql,
    joinSQL,
    commaJoinSQL,
    commaJoinStringsToSQL,
} from "./query-string";

test("sql template with simple values", () => {
    const str = "foo";
    const num = 42;
    const bln = false;
    const [queryText, values] =
        sql`insert into MyTable(col1, col2) values (${str}, ${num}, ${bln})`.build();

    expect(queryText).toEqual(
        "insert into MyTable(col1, col2) values ($1, $2, $3)"
    );
    expect(values).toEqual([str, num, bln]);
});

test("appending sql templates", () => {
    const query = sql`select * from MyTable`;
    query.append(sql` where foo = ${"bar"}`);
    query.append(sql` and baz = ${true}`);
    query.append(sql` and bong = ${99}`);

    const [queryText, values] = query.build();
    expect(queryText).toEqual(
        "select * from MyTable where foo = $1 and baz = $2 and bong = $3"
    );
    expect(values).toEqual(["bar", true, 99]);
});

test("appending literal strings", () => {
    const coercion = "as_number";
    const columnName = "foof";
    const value = "floof";

    const query = sql`select data from GoodStuff`;
    query.append(
        sql` order by `.appendRawString(
            `${coercion}(data->'${columnName}') asc`
        )
    );
    query.append(sql` where foo = ${value}`);

    const [queryText, values] = query.build();
    expect(queryText).toEqual(
        "select data from GoodStuff order by as_number(data->'foof') asc where foo = $1"
    );
    expect(values).toEqual([value]);
});

test("interpolating QueryStringBuilders", () => {
    const str = "foo";
    const num = 42;

    const foo = sql`foo = ${str}`;
    const bar = sql`bar = ${num}`;

    const [queryText, values] = sql`${foo} AND ${bar}`.build();
    expect(queryText).toEqual("foo = $1 AND bar = $2");
    expect(values).toEqual([str, num]);
});

test("values are de-duped", () => {
    const [queryText, values] = sql`${"foo"} ${5} ${"foo"} ${5}`.build();
    expect(queryText).toEqual("$1 $2 $1 $2");
    expect(values).toEqual(["foo", 5]);
});

test("interpolating UnsafeQueryLiteral", () => {
    const columnName = new UnsafeQueryLiteral("my_column");
    const tableName = new UnsafeQueryLiteral("my_table");
    const constant = 42;
    const query = sql`select ${columnName} from ${tableName} where answer = ${constant}`;

    const [queryText, values] = query.build();
    expect(queryText).toEqual(
        "select my_column from my_table where answer = $1"
    );
    expect(values).toEqual([constant]);
});

describe("build() is idempotent", () => {
    test("one", () => {
        const builder = sql`start ${"foo"} ${5} ${"foo"} ${5} ${5} end`;
        const [queryText1, values1] = builder.build();
        expect(queryText1).toEqual("start $1 $2 $1 $2 $2 end");
        expect(values1).toEqual(["foo", 5]);

        const [queryText2, values2] = builder.build();
        expect(queryText2).toEqual(queryText1);
        expect(values2).toEqual(values1);
    });

    test("two", () => {
        const builder = sql`SELECT ${new UnsafeQueryLiteral(
            "bla"
        )} FROM ${new UnsafeQueryLiteral("table")}`;
        builder.append(sql` ORDER BY row_id LIMIT ${123}`);

        const [queryText1, values1] = builder.build();
        expect(queryText1).toEqual(
            "SELECT bla FROM table ORDER BY row_id LIMIT $1"
        );
        expect(values1).toEqual([123]);

        const [queryText2, values2] = builder.build();
        expect(queryText2).toEqual(queryText1);
        expect(values2).toEqual(values1);
    });
});

describe("join", () => {
    const one = [sql`${123}`];
    const more = [sql`a`, sql`${"b"}`, sql`c`];

    describe("joinSQL", () => {
        test("one", () =>
            expect(joinSQL(one, "|").build()).toEqual(["$1", [123]]));
        test("more", () =>
            expect(joinSQL(more, "|").build()).toEqual(["a|$1|c", ["b"]]));
    });

    describe("commaJoinSQL", () => {
        test("one", () =>
            expect(commaJoinSQL(one).build()).toEqual(["$1", [123]]));
        test("more", () =>
            expect(commaJoinSQL(more).build()).toEqual(["a, $1, c", ["b"]]));
    });

    describe("commaJoinStringsToSQL", () => {
        test("one", () =>
            expect(commaJoinStringsToSQL(["a"]).build()).toEqual([
                "$1",
                ["a"],
            ]));
        test("more", () =>
            expect(commaJoinStringsToSQL(["a", "b", "c"]).build()).toEqual([
                "$1, $2, $3",
                ["a", "b", "c"],
            ]));
    });
});
