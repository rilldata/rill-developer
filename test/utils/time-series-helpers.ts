import type { TimeSeriesResponse } from "$common/database-service/DatabaseTimeSeriesActions";
import type { PreviewRollupInterval } from "$lib/duckdb-data-types";
import { isTimestampDiffAccurate } from "./time-series-time-diff";
import type { TimeSeriesValue } from "$lib/redux-store/timeseries/timeseries-slice";
import { END_DATE, START_DATE } from "../data/generator/data-constants";
import type { RollupInterval } from "$common/database-service/DatabaseColumnActions";

export type TimeSeriesMeasureRange = Record<string, [min: number, max: number]>;

export function getRollupInterval(
  interval: string,
  startDate = START_DATE,
  endDate = END_DATE
) {
  return {
    rollupInterval: interval,
    minValue: new Date(`${startDate} UTC`).getTime(),
    maxValue: new Date(`${endDate} UTC`).getTime(),
  } as RollupInterval;
}

export function assertTimeSeries(
  timeSeries: TimeSeriesResponse,
  rollupInterval: PreviewRollupInterval,
  measures: Array<string>
) {
  expect(timeSeries.rollupInterval).toBe(rollupInterval);
  const mismatchTimestamps = new Array<[string, string]>();
  const mismatchMeasures = new Array<
    [dimension: string, value: number, timestamp: string]
  >();
  const rollupIntervalGrain = rollupInterval.split(" ")[1];

  let prevRow: TimeSeriesValue;
  for (const row of timeSeries.results) {
    if (prevRow) {
      if (!isTimestampDiffAccurate(prevRow.ts, row.ts, rollupIntervalGrain)) {
        mismatchTimestamps.push([prevRow.ts, row.ts]);
      }
    }
    prevRow = row;
    for (const measure of measures) {
      if (Number.isNaN(Number(row[measure]))) {
        mismatchMeasures.push([measure, row[measure], row.ts]);
      }
    }
  }

  if (mismatchTimestamps.length) {
    console.log("Mismatch timestamps: ", mismatchTimestamps);
  }
  if (mismatchMeasures.length) {
    console.log("Mismatch measures: ", mismatchMeasures);
  }
  expect(mismatchTimestamps.length).toBe(0);
  expect(mismatchMeasures.length).toBe(0);
}

export function assertTimeSeriesMeasureRange(
  timeSeries: TimeSeriesResponse,
  measureRanges: Array<TimeSeriesMeasureRange>
) {
  expect(timeSeries.results.length).toBe(measureRanges.length);

  const mismatchMeasures = new Array<
    [dimension: string, value: number, timestamp: string]
  >();

  timeSeries.results.forEach((row, index) => {
    for (const measureName in measureRanges[index]) {
      const value = row[measureName];
      if (
        value < measureRanges[index][measureName][0] &&
        value > measureRanges[index][measureName][1]
      ) {
        mismatchMeasures.push([measureName, value, row.ts]);
      }
    }
  });

  if (mismatchMeasures.length) {
    console.log("Mismatch measures value ranges: ", mismatchMeasures);
  }
  expect(mismatchMeasures.length).toBe(0);
}