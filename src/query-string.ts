import { assert, defined } from "@glideapps/ts-necessities";

// UnsafeQueryLiteral is a boxed string that will be interpolated directly into the query
// It should not be used with strings that are user controlled in any way
// or areof unknown provenance. Doing so risks SQL injection.
export class UnsafeQueryLiteral extends String {}

export class QueryStringBuilder {
    // queryTexts is string[] until build() is called, when it will be set to a string.
    //  After that point, this QueryStringBuilder is frozen and attempts to mutate it will
    //  blow up. Call clone() before build() if you need to get a new, mutable QueryStringBuilder.
    private queryTexts: string[] | string;
    private values: any[] | undefined;

    constructor(
        private readonly tokenForIndex: (i: number) => string,
        queryTexts: string[] = [],
        values?: readonly any[]
    ) {
        if (values === undefined || values.length === 0) {
            this.queryTexts = queryTexts;
            return;
        }

        this.queryTexts = [];
        this.values = [];

        // queryTexts.length should be at least values.length + 1
        //  we use `defined` to assert this in the following...
        this.queryTexts.push(defined(queryTexts.shift()));
        for (const v of values) {
            if (v instanceof QueryStringBuilder) {
                this.appendInternal(v);
                // instead of appending the next query text to the array,
                //  we need to concat it to the last one
                this.queryTexts[this.queryTexts.length - 1] += defined(queryTexts.shift());
            } else {
                this.values.push(v);
                this.queryTexts.push(defined(queryTexts.shift()));
            }
        }
        this.queryTexts.push(...queryTexts);
    }

    // Mutates and returns `this` for convenience.
    private appendInternal(part: QueryStringBuilder | string): QueryStringBuilder {
        const { queryTexts } = this;
        assert(typeof queryTexts !== "string");

        const appendTexts = typeof part === "string" ? [part] : [...part.queryTexts];

        // The first query text to append must be concatenated onto our last query text.
        const len = queryTexts.length;
        if (len > 0) {
            const first = appendTexts.shift();
            if (first !== undefined) {
                queryTexts[len - 1] += first;
            }
        }

        queryTexts.push(...appendTexts);
        if (part instanceof QueryStringBuilder && part.values !== undefined) {
            if (this.values === undefined) {
                this.values = [...part.values];
            } else {
                this.values.push(...part.values);
            }
        }
        return this;
    }

    // We have two separate append functions to avoid the case where we forget
    // to use a `QueryStringBuilder` and just append a string, because in that
    // case the quoted parts of the string would not be properly quoted which
    // could lead to SQL injection. To avoid this, use `append` wherever possible.

    // Mutates and returns `this` for convenience.
    public append(part: QueryStringBuilder): QueryStringBuilder {
        return this.appendInternal(part);
    }

    // WARNING: If not used properly, this method could be susceptible to SQL injection!!
    // This is ONLY intended for cases where you need to interpolate trusted variable strings
    //  in places that can't use proper query parameters.
    // In most cases you should just use the regular `append` method above.
    //
    // Mutates and returns `this` for convenience.
    public appendRawString(part: string): QueryStringBuilder {
        return this.appendInternal(part);
    }

    public clone(): QueryStringBuilder {
        const { tokenForIndex, queryTexts, values } = this;
        assert(typeof queryTexts !== "string");

        // The QueryStringBuilder constructor copies the queryTexts and values arrays.
        return new QueryStringBuilder(tokenForIndex, queryTexts, values);
    }

    public build(): [queryText: string, values: any[] | undefined] {
        let { queryTexts, values } = this;
        if (typeof queryTexts !== "string") {
            if (values === undefined || values.length === 0) {
                queryTexts = queryTexts.join("");
                values = undefined;
            } else {
                let pi = 1; // first value token gets inserted at queryTexts[1]
                for (let i = 0; i < values.length; i++) {
                    const value = values[i];
                    if (value instanceof UnsafeQueryLiteral) {
                        queryTexts.splice(pi, 0, value.valueOf());
                        values.splice(i, 1);
                        i--;
                    } else {
                        // find the first index of the value so we can de-dupe
                        const vi = values.indexOf(value);
                        if (vi !== i) {
                            values.splice(i, 1);
                            i--;
                        }
                        queryTexts.splice(pi, 0, this.tokenForIndex(vi));
                    }
                    pi += 2;
                }
                queryTexts = queryTexts.join("");
            }

            // Freeze this instance with the built values
            this.queryTexts = queryTexts;
            this.values = values;
        }
        return [queryTexts, values];
    }

    public get approximateLength(): number {
        return JSON.stringify(this.queryTexts).length + JSON.stringify(this.values).length;
    }
}

// Tagged template literal QueryStringBuilder that uses 1-based $i as the token,
//  e.g. first value is $1, second is $2 and so forth.
export function sql(queryTexts: TemplateStringsArray, ...values: readonly any[]): QueryStringBuilder {
    return new QueryStringBuilder(i => "$" + (i + 1), [...queryTexts], values);
}

export function joinSQL(items: readonly QueryStringBuilder[], separator: string): QueryStringBuilder {
    assert(items.length > 0);

    const separatorLiteral = new UnsafeQueryLiteral(separator);
    return items.reduce((a, b) => sql`${a}${separatorLiteral}${b}`);
}

export function commaJoinSQL(items: readonly QueryStringBuilder[]): QueryStringBuilder {
    return joinSQL(items, ", ");
}

export function commaJoinStringsToSQL(strings: readonly string[]): QueryStringBuilder {
    return commaJoinSQL(strings.map(s => sql`${s}`));
}
