import { EntityType } from "$common/data-modeler-state-service/entity-state-service/EntityStateService";
import type { RillReduxState } from "$lib/redux-store/store-root";
import { prune } from "../../../routes/_surfaces/workspace/explore/utils";
import { fetchWrapper, streamingFetchWrapper } from "$lib/util/fetchWrapper";
import {
  clearSelectedLeaderboardValues,
  initMetricsExplore,
  LeaderboardValues,
  MetricsExploreEntity,
  setExploreSelectedTimeRange,
  setExploreTimeRange,
  setLeaderboardDimensionValues,
  setMeasureId,
  toggleExploreMeasure,
  toggleLeaderboardActiveValue,
} from "$lib/redux-store/explore/explore-slice";
import { createAsyncThunk } from "$lib/redux-store/redux-toolkit-wrapper";
import { generateTimeSeriesApi } from "$lib/redux-store/timeseries/timeseries-apis";
import type { DimensionDefinitionEntity } from "$common/data-modeler-state-service/entity-state-service/DimensionDefinitionStateService";
import type { MeasureDefinitionEntity } from "$common/data-modeler-state-service/entity-state-service/MeasureDefinitionStateService";
import { generateBigNumbersApi } from "$lib/redux-store/big-number/big-number-apis";
import type { TimeSeriesTimeRange } from "$common/database-service/DatabaseTimeSeriesActions";

/**
 * A wrapper to dispatch updates to explore.
 * Currently, it updates these sections
 * 1. Leaderboard values based on selected filters and measure
 * 2. Time series for all selected measures
 * 3. Big numbers for all selected measures
 */
const updateExploreWrapper = (dispatch, metricsDefId: string) => {
  dispatch(generateTimeSeriesApi({ id: metricsDefId }));
  dispatch(generateBigNumbersApi({ id: metricsDefId }));
  dispatch(updateLeaderboardValuesApi(metricsDefId));
};

/**
 * Initialises explore with dimensions and measures.
 * Selected measures is initialised with all measures in the metrics definition.
 * It then calls {@link updateExploreWrapper} to update explore.
 */
export const initAndUpdateExplore = (
  dispatch,
  metricsDefId: string,
  dimensions: Array<DimensionDefinitionEntity>,
  measures: Array<MeasureDefinitionEntity>
) => {
  dispatch(initMetricsExplore(metricsDefId, dimensions, measures));
  updateExploreWrapper(dispatch, metricsDefId);
};

/**
 * Toggles selection of a measures to be displayed.
 * It then updates,
 * 1. Time series for all selected measures
 * 2. Big numbers for all selected measures
 */
export const toggleExploreMeasureAndUpdate = (
  dispatch,
  metricsDefId: string,
  measureId: string
) => {
  dispatch(toggleExploreMeasure(metricsDefId, measureId));
  dispatch(generateTimeSeriesApi({ id: metricsDefId }));
  dispatch(generateBigNumbersApi({ id: metricsDefId }));
};

/**
 * Sets the measure id used in leaderboard for ranking and other calculations.
 * It then updates Leaderboard values based on selected filters and measure
 */
export const setMeasureIdAndUpdateLeaderboard = (
  dispatch,
  metricsDefId: string,
  measureId: string
) => {
  dispatch(setMeasureId(metricsDefId, measureId));
  dispatch(updateLeaderboardValuesApi(metricsDefId));
};

/**
 * Toggles a selected value in the leaderboard.
 * Pass 'include' param boolean to denote whether the value is included or excluded in time series and big number queries.
 * It then calls {@link updateExploreWrapper} to update explore.
 */
export const toggleSelectedLeaderboardValueAndUpdate = (
  dispatch,
  metricsDefId: string,
  dimensionName: string,
  dimensionValue: unknown,
  include: boolean
) => {
  dispatch(
    toggleLeaderboardActiveValue(
      metricsDefId,
      dimensionName,
      dimensionValue,
      include
    )
  );
  updateExploreWrapper(dispatch, metricsDefId);
};

/**
 * Clears all selected values in the leaderboard.
 * It then calls {@link updateExploreWrapper} to update explore.
 */
export const clearSelectedLeaderboardValuesAndUpdate = (
  dispatch,
  metricsDefId: string
) => {
  dispatch(clearSelectedLeaderboardValues(metricsDefId));
  updateExploreWrapper(dispatch, metricsDefId);
};

/**
 * Sets user selected time rage.
 * It then calls {@link updateExploreWrapper} to update explore.
 */
export const setExploreSelectedTimeRangeAndUpdate = (
  dispatch,
  metricsDefId: string,
  selectedTimeRange: Partial<TimeSeriesTimeRange>
) => {
  dispatch(setExploreSelectedTimeRange(metricsDefId, selectedTimeRange));
  updateExploreWrapper(dispatch, metricsDefId);
};

/**
 * Async-thunk to update leaderboard values.
 * Streams dimension values from backend per dimension and updates it in the state.
 */
export const updateLeaderboardValuesApi = createAsyncThunk(
  `${EntityType.MetricsLeaderboard}/updateLeaderboard`,
  async (metricsDefId: string, thunkAPI) => {
    const metricsExplore: MetricsExploreEntity = (
      thunkAPI.getState() as RillReduxState
    ).metricsLeaderboard.entities[metricsDefId];
    const filters = prune(metricsExplore.activeValues);
    const requestBody = {
      measureId: metricsExplore.leaderboardMeasureId,
      filters,
      timeRange: metricsExplore.selectedTimeRange,
    };

    const stream = streamingFetchWrapper<LeaderboardValues>(
      `metrics/${metricsExplore.id}/leaderboards`,
      "POST",
      requestBody
    );
    for await (const dimensionData of stream) {
      thunkAPI.dispatch(
        setLeaderboardDimensionValues(
          metricsExplore.id,
          dimensionData.displayName,
          dimensionData.values
        )
      );
    }
  }
);

/**
 * Fetches time range for the selected timestamp column.
 * Store the response in MetricsExplore slice by calling {@link setExploreTimeRange}
 */
export const fetchTimestampColumnRangeApi = createAsyncThunk(
  `${EntityType.MetricsLeaderboard}/getTimestampColumnRange`,
  async (metricsDefId: string, thunkAPI) => {
    const timeRange = await fetchWrapper(
      `metrics/${metricsDefId}/time-range`,
      "GET"
    );
    thunkAPI.dispatch(setExploreTimeRange(metricsDefId, timeRange));
  }
);
