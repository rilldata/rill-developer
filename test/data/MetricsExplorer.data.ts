import type { TimeSeriesTimeRange } from "$common/database-service/DatabaseTimeSeriesActions";
import { PreviewRollupInterval } from "$lib/duckdb-data-types";
import type { ActiveValues } from "$lib/redux-store/explore/explore-slice";
import type { TimeSeriesMeasureRange } from "../utils/time-series-helpers";
import { getTimeRange } from "../utils/time-series-helpers";

export interface MetricsExplorerTestDataType {
  title: string;

  // request arguments
  measures?: Array<number>;
  filters?: ActiveValues;
  timeRange?: TimeSeriesTimeRange;

  // assert arguments
  previewRollupInterval: PreviewRollupInterval;
  measureRanges?: Array<TimeSeriesMeasureRange>;
  leaderboards: Array<[string, Array<string>]>;
  bigNumber: TimeSeriesMeasureRange;
}

const DefaultPublisherLeaderboard: [string, Array<string>] = [
  "publisher",
  ["Facebook", "Google", "Yahoo", "Microsoft"],
];
const DefaultDomainLeaderboard: [string, Array<string>] = [
  "domain",
  [
    "facebook.com",
    "google.com",
    "msn.com",
    "news.yahoo.com",
    "instagram.com",
    "news.google.com",
    "sports.yahoo.com",
  ],
];
const DefaultCityLeaderboard: [string, Array<string>] = [
  "city",
  [
    "Bengaluru",
    "Boston",
    "Delhi",
    "Dublin",
    "Kolkata",
    "London",
    "Los Angeles",
    "Mumbai",
    "New York City",
    "San Francisco",
  ],
];

export const MetricsExplorerTestData: Array<MetricsExplorerTestDataType> = [
  {
    title: "basic request",
    previewRollupInterval: PreviewRollupInterval.day,
    leaderboards: [
      DefaultPublisherLeaderboard,
      DefaultDomainLeaderboard,
      DefaultCityLeaderboard,
      ["country", ["India", "USA", "Ireland", "UK"]],
    ],
    bigNumber: { impressions: [50000, 50000], bid_price: [2.75, 3.25] },
  },
  {
    title: "request by month",
    timeRange: getTimeRange(PreviewRollupInterval.month),
    previewRollupInterval: PreviewRollupInterval.month,
    leaderboards: [
      DefaultPublisherLeaderboard,
      DefaultDomainLeaderboard,
      DefaultCityLeaderboard,
      ["country", ["India", "USA", "Ireland", "UK"]],
    ],
    bigNumber: { impressions: [50000, 50000], bid_price: [2.75, 3.25] },
  },
  {
    title: "request with filters",
    timeRange: getTimeRange(PreviewRollupInterval.month),
    previewRollupInterval: PreviewRollupInterval.month,
    filters: {
      domain: [["sports.yahoo.com", true]],
    },
    measureRanges: [
      { impressions: [3500, 4500], bid_price: [3, 4] },
      { impressions: [750, 1250], bid_price: [1, 2] },
      { impressions: [750, 1250], bid_price: [1, 2] },
    ],
    leaderboards: [
      ["publisher", ["Yahoo"]],
      DefaultDomainLeaderboard,
      DefaultCityLeaderboard,
      ["country", ["India", "USA", "Ireland", "UK"]],
    ],
    bigNumber: { impressions: [6000, 7000], bid_price: [2.5, 3] },
  },
  {
    title: "request with filters and time range and single measure",
    timeRange: getTimeRange(PreviewRollupInterval.month, "2022-02-01"),
    previewRollupInterval: PreviewRollupInterval.month,
    filters: {
      publisher: [["Yahoo", false]],
    },
    measures: [1],
    measureRanges: [{ bid_price: [2.5, 3] }, { bid_price: [3, 3.5] }],
    leaderboards: [
      ["publisher", ["Microsoft", "Facebook", "Google", "Yahoo"]],
      [
        "domain",
        [
          "facebook.com",
          "google.com",
          "msn.com",
          "instagram.com",
          "news.google.com",
        ],
      ],
      DefaultCityLeaderboard,
      ["country", ["India", "Ireland", "UK", "USA"]],
    ],
    bigNumber: { bid_price: [2.75, 3.25] },
  },
  {
    title: "request with missing start time",
    timeRange: getTimeRange(
      PreviewRollupInterval.month,
      "2021-11-01",
      "2022-02-28"
    ),
    previewRollupInterval: PreviewRollupInterval.month,
    measures: [1],
    measureRanges: [
      { bid_price: [0, 0] },
      { bid_price: [0, 0] },
      { bid_price: [2.75, 3.25] },
      { bid_price: [2.75, 3.25] },
    ],
    leaderboards: [
      ["publisher", ["Google", "Yahoo", "Facebook", "Microsoft"]],
      [
        "domain",
        [
          "google.com",
          "instagram.com",
          "news.google.com",
          "news.yahoo.com",
          "sports.yahoo.com",
          "facebook.com",
          "msn.com",
        ],
      ],
      DefaultCityLeaderboard,
      ["country", ["India", "Ireland", "UK", "USA"]],
    ],
    bigNumber: { bid_price: [2.75, 3.25] },
  },
  {
    title: "request with non standard time range",
    timeRange: {
      interval: PreviewRollupInterval.month,
      start: new Date(`2022-02-01 UTC`).toString(),
      end: new Date(`2022-03-01 UTC`).toString(),
    },
    previewRollupInterval: PreviewRollupInterval.month,
    leaderboards: [
      ["publisher", ["Google", "Yahoo", "Facebook", "Microsoft"]],
      [
        "domain",
        [
          "google.com",
          "news.yahoo.com",
          "facebook.com",
          "instagram.com",
          "msn.com",
          "news.google.com",
          "sports.yahoo.com",
        ],
      ],
      DefaultCityLeaderboard,
      ["country", ["India", "USA", "Ireland", "UK"]],
    ],
    bigNumber: { impressions: [15000, 16000], bid_price: [2.75, 3.25] },
  },
];
