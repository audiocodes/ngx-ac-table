import {Injectable} from '@angular/core';
import {Action, createSelector, State, StateContext, Store} from '@ngxs/store';

import {cloneDeep} from 'lodash';
import {AcTableActions} from './ac-table.actions';
import {AC_TABLE_STATE_DEFAULTS, AC_TABLE_STATE_TOKEN, AcTableStateModels, AcTableCursor} from './ac-table-state.models';
import {AcTableDataState} from './ac-table-data/ac-table-data.state';

@State({
    name: AC_TABLE_STATE_TOKEN,
    defaults: {}
})
@Injectable({providedIn: 'root'})
export class AcTableState {
    constructor(private store: Store) {}
    static selection(tableId: string, asArray = true, selectionOnlyIfData = false) {
        return createSelector([
            AcTableState.createMemoizedSelector(tableId, 'selection'),
            AcTableDataState.createMemoizedSelector(tableId)
        ], (selection: any, rowsState: any[]) => {
            if (selectionOnlyIfData && !rowsState) {
                return asArray ? [] : undefined;
            }

            const selectedRows = AcTableState.getTableSelection(selection, rowsState);
            return asArray ? Object.values(selectedRows) : selectedRows;
        });
    }

    static getTableSelection = (selection: any, rowsState) => {
        return selection && rowsState.reduce((acc,  row) => {
            if (selection[row.id]) {
                acc[row.id] = row.data;
            }
        }, {});
        // return ArrayUtil.arrayToObject(selection && rowsState, (acc, curr) => {// TODO: Check if right
        //     if (selection[curr.id]) {
        //         acc[curr.id] = curr.data;
        //     }
        // });
    };

    static rowsExpansion(tableId) {
        return createSelector([AcTableState.createMemoizedSelector(tableId, 'rowsExpansion')], (rowsExpansion: AcTableStateModels) => {
            return {...rowsExpansion};
        });
    }

    static collapsedGroups(tableId: string) {
        return createSelector([AcTableState.createMemoizedSelector(tableId, 'collapsedGroups')], (collapsedGroups: any) => {
            return {...collapsedGroups};
        });
    }

    static settings(tableId: string) {
        return createSelector([AcTableState.createMemoizedSelector(tableId, 'settings')], (settings: any) => ({...settings}));
    }

    static cursor(tableId: string) {
        return createSelector([AcTableState.createMemoizedSelector(tableId, 'cursor')], (cursor: AcTableCursor) => {
            return {...cursor};
        });
    }

    private static createMemoizedSelector(tableId: string, field) {
        // memoize selection as sub state
        return createSelector([AcTableState], (state: AcTableStateModels) => {
            return state?.[tableId]?.[field];
        });
    }

    @Action(AcTableActions.SetTableState)
    setTableState(ctx: StateContext<AcTableStateModels>, {state}: AcTableActions.SetTableState) {
        ctx.setState(state || AC_TABLE_STATE_DEFAULTS);
    }

    @Action(AcTableActions.Select)
    select(ctx: StateContext<AcTableStateModels>, {
        tableId,
        selection,
        anchor,
        updateLastState,
    }: AcTableActions.Select) {
        const state = this.getStateByTableId(ctx, tableId);

        if (Array.isArray(selection)) {
            selection = selection.reduce((acc, selected) => {
                acc[selected.id] = true;
            }, {});
            // ArrayUtil.arrayToObject(selection, (selectionAcc, selectionCurr) => { // TODO: Check if right
            //     selectionAcc[selectionCurr.id] = true;
            // });
        }

        if (Object.keys(selection).length === 0) {
            this.deleteSubStateByTableId(ctx, tableId, 'selection');
            return;
        }
        const updateSelection = updateLastState ? state.selection : null;

        this.patchSubStateByTableId(ctx, tableId, {selection: {...selection, ...updateSelection}, anchor: anchor || state?.anchor});
    }

    @Action(AcTableActions.Unselect)
    unselect(ctx: StateContext<AcTableStateModels>, {tableId, selection, anchor}: AcTableActions.Unselect) {
        const state = this.getStateByTableId(ctx, tableId);
        const selectionState = {...state?.selection};

        selection.forEach((rowSelection) => delete selectionState[rowSelection.id]);
        ctx.patchState({
            [tableId]: {
                ...state,
                selection: {...selectionState},
                anchor: anchor || state.anchor
            }
        });
    }

    @Action(AcTableActions.ClearSelection)
    clearSelection(ctx: StateContext<AcTableStateModels>, {tableId, keepAnchor}: AcTableActions.ClearSelection) {
        const state = this.getStateByTableId(ctx, tableId);
        const anchor = state?.anchor;
        ctx.patchState({
            [tableId]: {...state, selection: {}, anchor: keepAnchor ? anchor : null}
        });
    }

    @Action([AcTableActions.SetRowExpansion])
    setRowExpandState(ctx: StateContext<AcTableStateModels>, {tableId, rowsExpansion, updateLastState}: AcTableActions.SetRowExpansion) {
        const rowsExpansionState = updateLastState ? this.getStateByTableId(ctx, tableId)?.rowsExpansion : undefined;
        return this.patchSubStateByTableId(ctx, tableId, {rowsExpansion: {...rowsExpansionState, ...rowsExpansion}});
    }

    @Action([AcTableActions.SetAllRowExpansion])
    setAllRowExpandState(ctx: StateContext<AcTableStateModels>, {tableId, isExpanded}: AcTableActions.SetAllRowExpansion) {
        let rowsExpansionState = {}
        if (isExpanded) {
            const rows = this.store.selectSnapshot(AcTableDataState.createMemoizedSelector(tableId));
            // rowsExpansionState = ArrayUtil.arrayValuesToObjectMap(rows, 'id', true); // TODO: Check if right
            rows.reduce((acc, row) => {
                if (row && !Array.isArray(row) && typeof row === 'object') {
                    acc[row['id']] = true;
                } else {
                    acc[row] = true;
                }
            });
        }

        this.patchSubStateByTableId(ctx, tableId, {rowsExpansion: rowsExpansionState});
    }

    @Action(AcTableActions.UpdatePaging)
    updatePaging(ctx: StateContext<AcTableStateModels>, {tableId, paging}: AcTableActions.UpdatePaging) {
        this.patchSubStateByTableId(ctx, tableId, {paging});
    }

    @Action(AcTableActions.UpdateCursor)
    updateCursor(ctx: StateContext<AcTableStateModels>, {tableId, cursor}: AcTableActions.UpdateCursor) {
        this.patchSubStateByTableId(ctx, tableId, {cursor});
    }

    @Action(AcTableActions.ResetPaging)
    resetPaging(ctx: StateContext<AcTableStateModels>, {tableId}: AcTableActions.ResetPaging) {
        const paging = this.getStateByTableId(ctx, tableId)?.paging;
        this.patchSubStateByTableId(ctx, tableId, {cursor: {}, paging: {...paging, page: 1}});
        ctx.dispatch(new AcTableActions.SetResetPagingOnLoad(false));
    }

    @Action(AcTableActions.SetResetPagingOnLoad)
    resetPagingOnLoad(ctx: StateContext<AcTableStateModels>, {resetPagingState}: AcTableActions.SetResetPagingOnLoad) {
        const state = ctx.getState();
        ctx.patchState({
            ...state,
            resetPagingOnLoad: resetPagingState,
        });
    }

    @Action(AcTableActions.UpdateSorting)
    updateSorting(ctx: StateContext<AcTableStateModels>, {tableId, sorting}: AcTableActions.UpdateSorting) {
        this.patchSubStateByTableId(ctx, tableId, {sorting});
    }

    @Action(AcTableActions.UpdateScrollPosition)
    updateScrollPosition(ctx: StateContext<AcTableStateModels>, {
        tableId,
        scrollPosition,
        update
    }: AcTableActions.UpdateScrollPosition) {
        const scrollPositionState = update ? this.getStateByTableId(ctx, tableId)?.scrollPosition : undefined;
        const newScrollPosition = {...scrollPositionState, ...scrollPosition};

        const scrollValues = Object.values(newScrollPosition);
        if (scrollValues.length === 0 || scrollValues.reduce((a: number, b: number) => (a + b), 0) === 0) {
            this.deleteSubStateByTableId(ctx, tableId, 'scrollPosition');
            return;
        }
        this.patchSubStateByTableId(ctx, tableId, {scrollPosition: newScrollPosition});
    }

    @Action(AcTableActions.UpdateColumnsWidth)
    updateColumnsWidth(ctx: StateContext<AcTableStateModels>, {
        tableId,
        columnsWidth,
        update
    }: AcTableActions.UpdateColumnsWidth) {
        const tableColumnWidthState = update ? this.getStateByTableId(ctx, tableId)?.columnsWidth : null;

        this.patchSubStateByTableId(ctx, tableId, {
            columnsWidth: {...tableColumnWidthState, ...columnsWidth}
        });
    }

    @Action(AcTableActions.ClearColumnsWidth)
    clearColumnsWidth(ctx: StateContext<AcTableStateModels>, {tableId}: AcTableActions.UpdateColumnsWidth) {
        this.deleteSubStateByTableId(ctx, tableId, 'columnsWidth');
    }

    @Action(AcTableActions.UpdateCollapsedGroups)
    updateGroupCollapse(ctx: StateContext<AcTableStateModels>, {
        tableId,
        collapsedGroups,
        update
    }: AcTableActions.UpdateCollapsedGroups) {
        const stateCollapsedGroups = update ? this.getStateByTableId(ctx, tableId)?.collapsedGroups : undefined;
        this.patchSubStateByTableId(ctx, tableId, {
            collapsedGroups: {...stateCollapsedGroups, ...collapsedGroups}
        });
    }

    @Action(AcTableActions.SetAllCollapsedGroups)
    setAllCollapsedGroups(ctx: StateContext<AcTableStateModels>, {
        tableId,
        state
    }: AcTableActions.SetAllCollapsedGroups) {
        const collapsedGroups = {...this.getStateByTableId(ctx, tableId)?.collapsedGroups};
        Object.getOwnPropertyNames(collapsedGroups).forEach((key) => collapsedGroups[key] = state);
        this.patchSubStateByTableId(ctx, tableId, {
            collapsedGroups
        });
    }

    @Action(AcTableActions.UpdateTableSettings)
    updateTableSettings(ctx: StateContext<AcTableStateModels>, {
        tableId,
        settings,
        update,
    }: AcTableActions.UpdateTableSettings) {
        const prevSettingsState = update ? this.getStateByTableId(ctx, tableId)?.settings : null;
        const newSettingsState = {...prevSettingsState, ...settings};
        this.patchSubStateByTableId(ctx, tableId, {
            settings: newSettingsState
        });
    }

    @Action(AcTableActions.ClearAllTablesCurrentPage)
    clearAllTablesCurrentPage(ctx: StateContext<AcTableStateModels>, {}: AcTableActions.ClearAllTablesCurrentPage) {
        const state = cloneDeep(ctx.getState());
        Object.getOwnPropertyNames(state).forEach(tableId => {
            delete state[tableId]?.cursor;
            delete state[tableId]?.paging?.page;
        });
        ctx.patchState(state);
    }

    private patchSubStateByTableId(ctx: StateContext<AcTableStateModels>, tableId: string, value) {
        const state = this.getStateByTableId(ctx, tableId) || {};
        value = cloneDeep(value);
        ctx.patchState({[tableId]: {...state, ...value}});
    }

    private deleteSubStateByTableId(ctx: StateContext<AcTableStateModels>, tableId: string, subState: string) {
        const state = {...this.getStateByTableId(ctx, tableId)};
        delete state[subState]
        ctx.patchState({[tableId]: state});
    }

    private getStateByTableId(ctx: StateContext<AcTableStateModels>, tableId: string) {
        const state = ctx.getState();
        if (!state || !state[tableId]) {
            return {};
        }
        return state[tableId];
    }
}
