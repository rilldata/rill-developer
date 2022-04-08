import {TestBase} from "@adityahegde/typescript-test-utils";
import {JestTestLibrary} from "@adityahegde/typescript-test-utils/dist/jest/JestTestLibrary";
import {QueryParser} from "$common/query-parser/QueryParser";
import {NestedQuery} from "../data/ModelQuery.data";

@TestBase.Suite
@TestBase.TestLibrary(JestTestLibrary)
export class QueryParserSpec extends TestBase {
    @TestBase.Test()
    public shouldParseQuery() {
        const parser = new QueryParser();
        const tree = parser.parse(NestedQuery);
        console.log(tree.root.tables.map(t => t.alias));
        console.log(tree.root.columns.map(c =>
            `${c.alias} (${c.columnRefs.map(cr => cr.fullName)})` ));
    }
}
