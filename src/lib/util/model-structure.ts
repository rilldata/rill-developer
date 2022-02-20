/**
 * Below are a set of brute-force tools to solve common query inspection tasks:
 * - can I isolate and inspect the CTEs of my query?
 * - can I extract the column names?
 * 
 * These functions all assume that the query is properly formed 
 * in the first place; that is, there are no syntax errors.
 */

interface CTE {
    start:number,
    end:number,
    name:string,
    substring:string
}

const viableReferences = (name:string) => {
    return [
        `join ${name} `, 
        `join '${name}' `,
        `join "${name}" `, 
        `from ${name} `, 
        `from '${name}' `,
        `from "${name}" `,
    ]
}

/**
 * Sorts according to which CTE has the other as a dependency.
 * This is useful when we want to re-order CTEs to materialize them
 * according to dependence on existing CTEs.
 * @param a a CTE
 * @param b another CTE
 * @returns numbers (0, 1, -1)
 */
export function sortByCTEDependency(a:CTE, b:CTE) {
    const bQuery = b.substring.toLowerCase() + ' ';
    const aSet = viableReferences(a.name);
    const aReferencedInB = aSet.some((reference) => bQuery.includes(reference));
    // check to see if the a CTE alias is mentioned in b somehow
    if (aReferencedInB) { return -1 };
    const aQuery = a.substring.toLowerCase() + ' ';
    const bSet = viableReferences(b.name);
    const bReferencedInA = bSet.some((reference) => bQuery.includes(reference));
    // check to see if the b CTE alias is mentioned in a somehow
    if (bReferencedInA) { return 1 };
    // there is no inclusion.
    return 0;
}

export function extractCTEs(query:string) : CTE[] {
    if (!query) { return []; }
    if (query.toLowerCase().trim().startsWith('select ')) { return [] };

    // Find the very start of of the expression.
    const withExpressionStartPoint = query.toLowerCase().indexOf('with ');

    // this is the start of the tape, where teh first CTE alias should be.
    let si = withExpressionStartPoint + 'WITH '.length;

    // exit if there is no `WITH` statement.
    if (si === -1) return undefined;
    const CTEs:CTE[] = [];
    // set the tape at the start.
    let ri = si;
    // the expression index.
    let ei
    // this will track the nested parens level.
    let nest = 0;
    let inside = false;
    let currentExpression = {} as CTE;
    let reachedEndOfCTEs = false;
    while (ri < query.length && !reachedEndOfCTEs) {
        let char = query[ri];

        // let's get the name of this thing.
        // we should only trigger this if nest === 1; otherwise we're selecting the CTEs of CTEs :)
        if (nest === 1 && query.slice(si, ri).toLowerCase().endsWith(' as (')) {
            currentExpression.name = query.slice(si, ri - 4).replace(',', '').trim();
        }

        // Let's up the nest by one if we encounter an open paren.
        // we will set the inside flag to true, then set the expression index
        // to match the right index.
        if (char === '(') {
            nest += 1;
            if (!inside) {
                inside = true;
                ei = ri;
            }
        }

        // If we encounter a close paren, let's unnest.
        if (char === ')') {
            nest -= 1;
        }

        // if we encounter a close parent AND the nest is at 0, then we've found the end of the CTE.
        if (char ===')' && nest === 0) {
            // we reset.
            currentExpression.start = ei;
            currentExpression.end = ri;
            currentExpression.substring = query.slice(ei, ri+1).slice(1, -1).trim();
            CTEs.push({...currentExpression});
            si = ri+1;
            // reset the expression
            currentExpression = {} as CTE;
            nest = 0;
            inside = false;
        }

        ri += 1;
        // do we kill things if SELECT is at the end?
        if (!inside && query.slice(si, ri).trim().toLowerCase().startsWith('select ')) {
            reachedEndOfCTEs = true;
        }
    }
    return CTEs;
}

export function getCoreQuerySelectStatements(query:string) {
    const ctes = extractCTEs(query);
    const latest = ctes.slice(-1)[0].end;
    const restOfQuery = query.slice(latest + 1).trim();

    if (!restOfQuery.toLowerCase().startsWith('select ')) {
        throw Error(`rest of query must start with select, instead with ${restOfQuery.slice(0,10)}`);
    }
    let i = 'SELECT '.length;
    let ri = i;
    let ei = ri;
    let reachedFrom = false;
    let nestLevel = 0;
    let columnSelects = [];
    
    function queryEndsWithFrom(query) {
        return query.toLowerCase().replace(/[\s\n\t\r]/g, ' ').endsWith('from ');
    }
    // goal:
    // when you hit AS or a , at nest level 0 (or reach nest 0 FROM statement), 
    // then put that as a column: {expression: ___, name: ____}
    while (!reachedFrom && ri < restOfQuery.length) {
        ri += 1;
        // start with the valid query situation. 
        // We split on " as " or " AS " 
        // and then make the expression the first part
        // and then the name the second
        // if no `as` then the expression is the name
        // later, we crawl the expression for the column names.
        let querySoFar = restOfQuery.slice(ei, ri).toLowerCase()
        let endsWithFrom = queryEndsWithFrom(querySoFar)
             && 
            nestLevel === 0;
        if ((restOfQuery[ri] === ',' && nestLevel === 0) || endsWithFrom) {
            const start = ei;
            const end = ri - (endsWithFrom ? ' from '.length : 0);
            const columnExpression = restOfQuery.slice(start, end).trim();
            const hasAs = columnExpression.toLowerCase().indexOf(' as ');
            let name;
            let expression;
            if (hasAs !== -1) {
                expression = columnExpression.slice(0, hasAs);
                name = columnExpression.slice(hasAs + 4); // remove the comma
            } else {
                expression = columnExpression;
                name = expression;
            }
            columnSelects.push({ name, expression, start, end });
            // move ri past the comma
            ri += 1;
            ei = ri;
        } else if (restOfQuery[ri] === '(') {
            nestLevel += 1;
        } else if (restOfQuery[ri] === ')') {
            nestLevel -= 1;
        }
    
        // cut the tape
        if (endsWithFrom) {
            reachedFrom = true;
        }
    };
    return columnSelects;
}