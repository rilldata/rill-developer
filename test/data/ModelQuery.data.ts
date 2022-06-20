import type {TestDataColumns} from "./DataLoader.data";
import type {DataProviderData} from "@adityahegde/typescript-test-utils";

type Args = [string, TestDataColumns];

export const SingleSourceQueryColumnsTestData: TestDataColumns = [{
    name: "impressions",
    type: "BIGINT",
    isNull: false,
}, {
    name: "publisher",
    type: "VARCHAR",
    isNull: true,
}, {
    name: "domain",
    type: "VARCHAR",
    isNull: false,
}];
export const SingleSourceQuery = "select count(*) as impressions, publisher, domain from AdBids group by publisher, domain";
const SingleSourceQueryTestData: Args = [SingleSourceQuery, SingleSourceQueryColumnsTestData];

export const TwoSourceJoinQueryColumnsTestData: TestDataColumns = [{
    name: "impressions",
    type: "BIGINT",
    isNull: false,
}, {
    name: "bid_price",
    type: "DOUBLE",
    isNull: false,
}, {
    name: "publisher",
    type: "VARCHAR",
    isNull: true,
}, {
    name: "domain",
    type: "VARCHAR",
    isNull: false,
}, {
    name: "city",
    type: "VARCHAR",
    isNull: true,
}, {
    name: "country",
    type: "VARCHAR",
    isNull: false,
}];
export const TwoSourceJoinQuery = `
select count(*) as impressions, avg(bid.bid_price) as bid_price, bid.publisher, bid.domain, imp.city, imp.country
from AdBids bid join AdImpressions imp on bid.id = imp.id
group by bid.publisher, bid.domain, imp.city, imp.country
`;
const TwoSourceJoinQueryTestData: Args = [TwoSourceJoinQuery, TwoSourceJoinQueryColumnsTestData];

export const NestedQuery = `
select
    count(*), avg(bid.bid_price) as bid_price,
    bid.publisher, bid.domain, imp.city, imp.country,
    CASE WHEN imp.country = 'India' THEN 'TRUE' ELSE 'FALSE' END as indian
from
    AdBids bid join
    (select imp.id, imp.city, imp.country, u.name from AdImpressions imp join Users u on imp.user_id=u.id where u.city like 'B%') as imp
    on bid.id = imp.id
group by bid.publisher, bid.domain, imp.city, imp.country
`;
export const NestedQueryColumnsTestData: TestDataColumns = [{
    name: "count_star()",
    type: "BIGINT",
    isNull: false,
}, {
    name: "bid_price",
    type: "DOUBLE",
    isNull: false,
}, {
    name: "publisher",
    type: "VARCHAR",
    isNull: true,
}, {
    name: "domain",
    type: "VARCHAR",
    isNull: false,
}, {
    name: "city",
    type: "VARCHAR",
    isNull: true,
}, {
    name: "country",
    type: "VARCHAR",
    isNull: false,
}, {
    name: "indian",
    type: "VARCHAR",
    isNull: false,
}];
const NestedQueryTestData: Args = [NestedQuery, NestedQueryColumnsTestData];

export const CTE = `
with
    UserImpression as (
        select
            imp.id, imp.city, imp.country, u.name
        from AdImpressions imp join Users u on imp.user_id=u.id
    )
    select
        count(*) as impressions,
        avg(bid.bid_price) as bid_price,
        bid.publisher, bid.domain, imp.city, imp.country,
        (select uimp.name from UserImpression uimp where uimp.city=imp.city) as users
    from AdBids bid join AdImpressions imp on bid.id = imp.id
    group by bid.publisher, bid.domain, imp.city, imp.country
`;

export type ModelQueryTestDataProvider = DataProviderData<Args>;
export const ModelQueryTestData: ModelQueryTestDataProvider = {
    subData: [{
        title: "Single source group",
        args: SingleSourceQueryTestData,
    }, {
        title: "Two source join",
        args: TwoSourceJoinQueryTestData,
    }, {
        title: "Nested queries",
        args: NestedQueryTestData
    }],
};
