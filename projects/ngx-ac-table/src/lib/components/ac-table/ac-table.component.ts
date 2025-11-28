import {
    AfterViewInit,
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    ContentChild,
    DestroyRef,
    ElementRef,
    EventEmitter,
    HostListener,
    Inject,
    Injector,
    Input,
    NgZone, OnInit,
    Output,
    TemplateRef,
    Type,
    ViewChild
} from '@angular/core';
import {DOCUMENT} from '@angular/common';

import {Store} from '@ngxs/store';
import {
    AC_TABLE_CONFIG,
    AcTableColumn,
    AcTableConfig,
    AcTableDispatchEvent,
    AcTableEvent,
    AcTableRow,
    AcTableSharedInputs,
    AcTableSort,
    AcTableSorter,
    ELayoutType,
    ESelectBehavior,
    RefreshTableProperties,
    AC_TABLE_COMPONENT,
    IAcTableComponent
} from '../../models/ac-table.interface';

import {CdkVirtualScrollViewport} from '@angular/cdk/scrolling';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {AcTableExpandedRowDirective} from '../../directives/ac-table-expanded-row.directive';
import {debounceTime, fromEvent, Observable, Subject} from 'rxjs';
import {AcTableService} from '../../services/ac-table.service';
import {AcTableActionsService} from '../../services/ac-table-actions.service';
import {AcTableActions} from '../../state/ac-table.actions';
import {ThrottleClass} from '../../../utils/throttle.class';
import {AcTableState} from '../../state/ac-table.state';
import {AC_TABLE_STATE_TOKEN, AcTableStateModels} from '../../state/ac-table-state.models';
import {StringUtils} from '../../../utils/string-utils';
import {AcTableDataActions} from '../../state/ac-table-data/ac-table-data.actions';
import {AcTableDataState} from '../../state/ac-table-data/ac-table-data.state';
import {AcPaging, AcPagingEvent} from '../../../utils/components/ac-pagination/ac-paging.interface';
import {AcPaginationItemsTemplateType} from '../../../utils/components/ac-pagination/ac-pagination.component';


@Component({
    selector: 'ac-table',
    templateUrl: './ac-table.component.html',
    styleUrls: ['./ac-table.component.less'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: {
        '[class.rtl]': 'rtl'
    },
    providers: [{provide: AC_TABLE_COMPONENT, useExisting: AcTableComponent}]
})
export class AcTableComponent implements AcTableSharedInputs, IAcTableComponent, OnInit, AfterViewInit {
    static readonly AC_TABLE_STATE_AND_CONFIGS = 'tableState';
    @ContentChild(AcTableExpandedRowDirective, {static: true}) acTableExpandedRowDirective: AcTableExpandedRowDirective;
    @ContentChild('noDataPlaceholder') noDataPlaceholderContentTemplate: TemplateRef<any>;
    @ContentChild('infiniteScrollBufferLoader') infiniteScrollBufferLoader: TemplateRef<any>;
    @ViewChild('tableContainer') tableContainer: ElementRef;

    @ViewChild('acTableHeader') acTableHeader;

    @Input() tableId = '';
    @Input() refresh$: Observable<RefreshTableProperties>;
    @Input() noDataComponent: Type<any>;

    @ViewChild(CdkVirtualScrollViewport) vsComponent: CdkVirtualScrollViewport;
    @Input() itemSize: number = 50;
    @Input() minBufferPx: number = 300;
    @Input() maxBufferPx: number = 500;

    //region @Input BEHAVIOR BLOCK
    @Input() idField = 'id';
    @Input() autoResizeLastColumn = false;
    @Input() defaultLayout = ELayoutType.byFit;
    @Input() dblClickResizeIncludeHeader = true;
    @Input() footer = false;
    @Input() multiSort = false;
    @Input() selection = {};
    @Input() multiSelection = true;
    @Input() selectBehavior = ESelectBehavior.select;
    @Input() forceSelection = false;
    @Input() collapsedGroups = {};
    @Input() groupBy: ((...args) => string) | string;
    @Input() minCellWidth = 40;
    @Input() infiniteScroll = false;
    @Input() infiniteScrollStopped = false;
    @Input() rtl = false;
    @Input() expandableRows = false;
    @Input() disableVirtualScroll = false;
    @Input() multiExpandableRows = true;
    //endregion

    //region @Input PAGINATION BLOCK
    @Input() paginator = true;
    @Input() pageSelector = true;
    @Input() pageIndex = 1;
    @Input() totalElements = 0;
    @Input() pagingSizeOption: number[] | boolean = [25, 50, 100];
    @Input() pageSize;
    @Input() pageItemsDisplayTemplate: TemplateRef<any>;
    @Input() itemsDisplayType: AcPaginationItemsTemplateType = 'itemsRange';
    //endregion

    //region @Outputs BLOCK
    @Output() initialized = new EventEmitter<AcTableEvent>();
    @Output() updatePaging = new EventEmitter<AcTableEvent>();
    @Output() updateData = new EventEmitter<AcTableEvent>();
    @Output() infiniteScrollUpdate = new EventEmitter<AcTableEvent>();
    @Output() rowsUpdate = new EventEmitter<AcTableEvent>();
    @Output() sortChange = new EventEmitter<AcTableEvent>();
    @Output() collapsedGroupsChanged = new EventEmitter<AcTableEvent>();
    @Output() selectionChanged = new EventEmitter<AcTableEvent>();
    @Output() tableUpdate = new EventEmitter<AcTableEvent>();
    //endregion

    rowExpantionState = {};
    updateColumnsWidthSubject = new Subject();
    groupedRows;
    sortingMap: AcTableSort = {};
    loading = false;
    userSelectState = true;
    doSelect = true;
    selectionAnchor;
    viewportScrollBarWidth = 0;
    isBodyVisible = false;
    isHeaderVisible = false;
    filters = {};
    viewPortVisible = false;
    bufferingInfiniteScroll = false;
    isFocused = false;
    lastEndIndex = 0;
    // COLUMN WIDTH
    headerTableWidthChanges = 0;
    tableCellContextIndex = -1;
    customColumnsWidth = false;
    externalSelection: ThrottleClass;

    activeColumns: AcTableColumn[];
    private originalClientX;
    private originalHeaderWidth;
    private trackResizeSubject = new Subject();

    constructor(public acTableService: AcTableService,
                private acTableActionsService: AcTableActionsService,
                protected cdRef: ChangeDetectorRef,
                protected store: Store,
                private zone: NgZone,
                public injector: Injector,
                private destroyRef: DestroyRef,
                @Inject(DOCUMENT) private document: Document,
                @Inject(AC_TABLE_CONFIG) protected forRootAcTableConfig: AcTableConfig) {

        this.externalSelection = new ThrottleClass({
            callback: (select, selection, candidateAnchor, update) => {
                this.acTableActionsService.dispatch(new AcTableActions.Select(this.tableId, selection, candidateAnchor, update));
            },
            destroyComponentOperator: takeUntilDestroyed(this.destroyRef),
            debounce: this.acTableService.selectDebounceTime,
            maxRecurrentTime: this.acTableService.selectDebounceTime,
        });

        AcTableComponent.updateGlobalConfig(this, forRootAcTableConfig);
    }

    static updateGlobalConfig = (context, forRootConfig) => {
        if (!forRootConfig) {
            return;
        }
        Object.getOwnPropertyNames(forRootConfig)
            .filter((configKey) => {
                return forRootConfig[configKey] !== undefined;
            })
            .forEach((configKey) => {
                context[configKey] = forRootConfig[configKey];
            });
    };

    get vsElement() {
        return this.vsComponent.elementRef?.nativeElement;
    }

    _columns:  Array<AcTableColumn>;

    @Input() set columns(columns: Array<AcTableColumn>) {
        this.setColumns(columns);

        const tableColumnsWidthState = this.store.selectSnapshot<AcTableState>(AC_TABLE_STATE_TOKEN)[this.tableId]?.columnsWidth;

        this.customColumnsWidth = !!tableColumnsWidthState;
        if (tableColumnsWidthState) {
            this._columns.forEach((column, index) => {
                this.setColumnWidth(index, tableColumnsWidthState[column.field || column.title] || column.width);
            });
        }
        setTimeout(() => {
            !this.initialized.closed && this.initializeComplete(); // show columns before rows sets
            this.isHeaderVisible = true;
            this.onResizeColumnsWidthUpdate();
        });
    }

    _rows: AcTableRow[];

    @Input() set rows(rows) {
        rows = rows && rows.map((row) => ({id: StringUtils.byString(row, this.idField), data: row}));


        if (!this._rows && !rows) {
            return;
        }
        this.acTableActionsService.dispatch(new AcTableDataActions.SetRows(this.tableId, rows));
    }

    _sorting: Array<AcTableSorter> = [];

    @Input() set sorting(sorting: Array<AcTableSorter>) {
        this._sorting = sorting || [];
        this.updateSortingMap();
    }

    get headerRowElementChildren() {
        return [...this.headerRowElement.children];
    }

    get headerRowElement() {
        return this.acTableHeader?.headerRow.nativeElement;
    }

    ngOnInit() {
        if (!this.tableId) {
            throw new Error('Table ID must be provided');
        }
        this.resetPagingOnLoad();
    }

    ngAfterViewInit() {

        this.initializeRefresh();
        this.updateColumnsWidthSubject.pipe(takeUntilDestroyed(this.destroyRef), debounceTime(200)).subscribe(() => this.dispatchColumnsWidth());

        this.initializeStoreSnapshot();
        this.initializeStoreUpdated();

        this.store.select(AcTableDataState.rowsUpdated(this.tableId))
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe((rows) => {
                rows && this.setRows(rows);
            });

        this.initializeScrollPositionUpdate();
        // setTimeout(() => this.updateTableHeaderMargin(), 100);

        this._columns && this.initializeComplete();
    }

    ngOnDestroy() {
        setTimeout(() => { // timeout for unsubscribe
            this.acTableActionsService.dispatch(new AcTableDataActions.ClearRows(this.tableId));
        });
    }

    resetPagingOnLoad() {
        const tablesState = this.store.selectSnapshot<AcTableStateModels>(AC_TABLE_STATE_TOKEN);

        if (tablesState.resetPagingOnLoad) {
            this.acTableActionsService.dispatch(new AcTableActions.ResetPaging(this.tableId));
        }
    }

    refreshTable = (tableProperties: RefreshTableProperties) => {
        tableProperties = {...tableProperties};

        if (tableProperties.selection) {
            tableProperties.selection = tableProperties.selection.map((row) => ({
                id: StringUtils.byString(row, this.idField),
                data: row
            }));
            this.executeSelection(tableProperties.selection);
            return;
        }

        tableProperties.gotoPage && this.onPageChange({
            type: 'userEvent',
            page: tableProperties.gotoPage,
            size: this.pageSize
        }, false);

        this.initialized.closed && this.dispatchAcTableEvent({
            type: 'updateData',
            emitter: this.updateData,
            loadingState: !!tableProperties.showLoader
        });
        this.cdRef.detectChanges();
    };

    initializeRefresh() {
        this.refresh$?.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((tableProperties) => this.refreshTable(tableProperties));
    }

    initializeStoreUpdated() {
        this.store.select(AcTableState.collapsedGroups(this.tableId)).pipe(takeUntilDestroyed(this.destroyRef)).subscribe((collapsedGroups) => {
            if (!this.groupBy || !this.groupedRows) {
                return;
            }

            this.collapsedGroups = {...collapsedGroups};
            this.dispatchAcTableEvent({
                emitter: this.collapsedGroupsChanged,
                type: 'collapsedGroupsChanged',
                loadingState: false,
                tableUpdate: false,
            });
        });

        this.store.select(AcTableState.settings(this.tableId)).subscribe(_ => {
            this.setColumns(this.activeColumns);
        });
    }

    internalSelect = (selection) => {
        this.dispatchAcTableEvent({
            emitter: this.selectionChanged,
            type: 'selectionChanged',
            loadingState: false,
            tableUpdate: false,
        });
    };

    initializeComplete() {
        this.dispatchAcTableEvent({
            emitter: this.initialized,
            type: 'initialized',
            loadingState: !this._rows
        });
        this.initialized.unsubscribe();
        // queueMicrotask(() => {
        //     GeneralService.dispatchResizeEvent();
        // });
    }

    initializeStoreSnapshot() {
        const tableState = this.store.selectSnapshot<AcTableState>(AC_TABLE_STATE_TOKEN)[this.tableId];

        this.pageIndex = tableState?.paging?.page || this.pageIndex;
        this.pageSize = tableState?.paging?.size || this.pageSize || this.pagingSizeOption?.[0] || 25;

        if (!tableState) {
            return;
        }

        this.collapsedGroups = {...tableState.collapsedGroups};
        if (tableState?.sorting) {
            this.sorting = tableState?.sorting;
        }
    }

    getElementWidth = (nativeElement: any) => {
        return nativeElement?.getBoundingClientRect().width || 0;
    };

    resizeLastColumn = (viewportWidth?) => {
        if (!this.autoResizeLastColumn || !this._columns) {
            return;
        }
        viewportWidth = viewportWidth || this.getElementWidth(this.vsElement);

        const columnIndex = this._columns.length - 1;
        const whitespace = viewportWidth - this.getElementWidth(this.headerRowElement);

        if (this._columns[columnIndex] && whitespace > 0) {
            const newColumnWidth = Math.floor(this._columns[columnIndex].colWidth + whitespace);
            this.setColumnWidth(columnIndex, newColumnWidth);
        }

        setTimeout(() => {
            this.cdRef.markForCheck();
        });
    };

    setColumnsWidth() {
        if (!this._columns) {
            return;
        }
        this.headerTableWidthChanges += 1;
        setTimeout(() => this.cdRef.detectChanges())

        let viewportWidth = this.getElementWidth(this.vsElement);
        if (viewportWidth <= 0 || !this.headerRowElement) {
            return;
        }

        this.viewPortVisible = true;

        const tableColumnsWidthState = this.store.selectSnapshot<AcTableState>(AC_TABLE_STATE_TOKEN)[this.tableId]?.columnsWidth || {};

        const widthGroupMap = {};
        this.headerRowElementChildren.forEach((headerCell, cellIndex) => {
            const column = this._columns[cellIndex];
            const columnCustomWidth = tableColumnsWidthState[column.field || column.title];
            const widthGroup = column.widthGroup;
            const columnWidth = columnCustomWidth || column.width || Math.ceil(headerCell.getBoundingClientRect().width);

            if (column.minWidthByHeader && !column.minWidth) {
                column.minWidth = columnWidth;
            }

            if (!column.widthGrow) {
                viewportWidth -= columnWidth;
            }

            if (!this._columns[cellIndex].width && widthGroup) {
                widthGroupMap[widthGroup] = Math.max(widthGroupMap[widthGroup] || 0, columnWidth);
            }
            if (column.colWidth !== columnWidth) {
                this.setColumnWidth(cellIndex, columnWidth);
            }
        });

        const widthGrowMap = {};
        let widthGrowSum = this._columns.reduce((acc, column) => {
            return acc + (column.widthGrow || 0);
        }, 0);
        this._columns.forEach((column, index) => {
            const columnCustomWidth = tableColumnsWidthState[column.field || column.title];
            if (!column.widthGrow || columnCustomWidth) {
                return;
            }
            const columnWidth = viewportWidth * (column.widthGrow / widthGrowSum);
            if (column.minWidth > columnWidth) {
                widthGrowMap[column.field] = true;
                viewportWidth -= column.minWidth;
                widthGrowSum -= column.widthGrow;
                this.setColumnWidth(index, column.minWidth);
            }
        });

        this._columns.forEach((column, index) => {
            const columnCustomWidth = tableColumnsWidthState[column.field || column.title];
            if (columnCustomWidth) {
                return;
            }
            let columnWidth = column.colWidth;
            if (widthGroupMap[column.widthGroup]) {
                columnWidth = widthGroupMap[column.widthGroup];
            } else if (widthGrowMap[column.field]) {
                return;
            } else if (column.widthGrow && this.defaultLayout === ELayoutType.byFit) {
                columnWidth = viewportWidth * (column.widthGrow / widthGrowSum);
            }

            if (column.colWidth !== columnWidth) {
                this.setColumnWidth(index, columnWidth);
            }
        });

        this.resizeLastColumn(viewportWidth);
    }

    initializeScrollPositionUpdate() {
        this.zone.runOutsideAngular(() => {

            const scrollObservable = fromEvent(this.vsElement, 'scroll').pipe(takeUntilDestroyed(this.destroyRef));

            scrollObservable.pipe(debounceTime(200)).subscribe(({target}: Event) => {
                this.acTableActionsService.dispatch(new AcTableActions.UpdateScrollPosition(this.tableId, {
                    [this.pageIndex]: (target as HTMLElement).scrollTop
                }));
            });

            fromEvent(this.document, 'mousemove').pipe(takeUntilDestroyed(this.destroyRef)).subscribe(this.tableMousemove);
        });
    }

    @HostListener('window:blur', ['$event'])
    @HostListener('document:mouseup', ['$event'])
    tableMouseup = ($event?: MouseEvent) => {
        $event?.stopPropagation();
        if (this.tableCellContextIndex >= 0) {
            (this.getTableCellContext().offsetWidth !== this.originalHeaderWidth) && this.updateColumnsWidthSubject.next(null);
            this.tableCellContextIndex = -1;
            this.resizeLastColumn();
        }
    };

    @HostListener('window:resize')
    onResizeColumnsWidthUpdate() {
        if (!this.initialized.closed) {
            return;
        }

        this.setColumnsWidth();
        this.updateTableHeaderMargin();
    }

    updateTableHeaderMargin() {
        const vsNativeElement = this.vsElement;
        if (!vsNativeElement) {
            return;
        }
        const {width} = vsNativeElement.getBoundingClientRect();
        const {clientWidth, scrollHeight, offsetHeight} = vsNativeElement;

        this.viewportScrollBarWidth = scrollHeight > offsetHeight ? Math.floor(width - clientWidth) : 0;
    }

    tableMousedown($event: any) {
        if ($event.target.classList.contains('resize-handle') && this.tableContainer?.nativeElement.contains($event.target)) {
            this.tableCellContextIndex = $event.target.parentElement.cellIndex;
            this.originalClientX = $event.clientX;
            this.originalHeaderWidth = this.getTableCellContext().offsetWidth;
        }
    }

    tableMousemove = ($event: MouseEvent) => {
        if (this.tableCellContextIndex < 0) {
            return;
        }
        this.zone.run(() => {
            const direction = this.rtl ? -1 : 1;
            const clientDelta = $event.clientX - this.originalClientX;
            this.setColumnWidth(this.getTableCellContext().cellIndex, this.originalHeaderWidth + (clientDelta * direction), {dispatchWidths: true});
        });
    };

    getHeaderColumnWidth(headerRow, columnIndex) {

        const resizableElement: any = headerRow.children[columnIndex].firstElementChild;
        const originalWidth = resizableElement.style.width;

        resizableElement.style.width = 'max-content';
        const maxWidth = this.dblClickResizeIncludeHeader ? resizableElement.getBoundingClientRect().width : 0;

        resizableElement.style.width = originalWidth;

        return maxWidth;
    }

    dblClick($event: any, body: any, headerContainer: HTMLElement) {
        if (!$event.target.classList.contains('resize-handle')) {
            return;
        }

        const columnIndex = $event.target.parentElement.cellIndex;
        let maxWidth = this.getHeaderColumnWidth(this.headerRowElement, columnIndex);

        body.rowsElementsRef.forEach(({nativeElement: tableRow}, rowIndex) => {
            const isColspan = Object.values(this._rows[rowIndex]).some((cell: any) => cell && typeof cell === 'object' && ('colspan' in cell));
            const cellElement = tableRow.children[columnIndex];

            if (isColspan || !cellElement) {
                return;
            }

            const originalDisplay = cellElement.firstElementChild.style.display;
            cellElement.firstElementChild.style.display = 'inline-block';

            const elementAbsoluteWidth = cellElement.firstElementChild.getBoundingClientRect().width || 0;
            cellElement.firstElementChild.style.display = originalDisplay;

            if (elementAbsoluteWidth > maxWidth) {
                maxWidth = elementAbsoluteWidth;
            }
        });

        headerContainer.scrollLeft = this.vsElement.scrollLeft;
        this.setColumnWidth(columnIndex, Math.ceil(maxWidth), {dispatchWidths: true});

        setTimeout(() => {
            this.resizeLastColumn();
            this.cdRef.markForCheck();
        });
    }

    dispatchColumnsWidth() {
        const columnsWidth = this._columns.reduce((acc, cur) => {
            acc[cur.field || cur.title] = cur.colWidth;
            return acc;
        }, {});

        this.customColumnsWidth && this.acTableActionsService.dispatch(new AcTableActions.UpdateColumnsWidth(this.tableId, columnsWidth));
    }

    setColumnWidth(columnIndex: number, width: number, {dispatchWidths = false} = {}) {
        if (!width || this._columns[columnIndex].colWidth === width) {
            return;
        }
        const minWidth = this._columns[columnIndex].minWidth || this.minCellWidth;

        this._columns[columnIndex].colWidth = Math.max(width, minWidth);
        if (dispatchWidths) {
            this.customColumnsWidth = true;
            this.updateColumnsWidthSubject.next(null);
            this.trackResizeSubject.next(this._columns[columnIndex]);
        }
        this.headerTableWidthChanges += 1;
        this.cdRef.markForCheck();
    }

    dispatchPaging(pagingState: AcPaging) {
        this.dispatchAcTableEvent({
            type: 'updatePaging',
            emitter: this.updatePaging,
            paging: pagingState,
        });
    }

    onPageChange(pageEvent?: AcPagingEvent, dispatchAcEvent = true) {
        this.isBodyVisible = false;
        if (pageEvent?.type === 'pageSize' || pageEvent?.type === 'userEvent') {
            pageEvent.page = 1;
            this.clearScrollPosition();
        }
        const pagingState = this.getPaging(pageEvent);
        this.pageIndex = pagingState.page;
        this.pageSize = pagingState.size;
        this.acTableActionsService.dispatch(new AcTableActions.UpdatePaging(this.tableId, pagingState));
        dispatchAcEvent && this.dispatchPaging(pagingState);
    }

    onColumnSort(column: AcTableColumn) {
        const sorter = this.sortingMap[column.field]; // this.getSorterByCol(column);

        if (!this.multiSort) {
            this._sorting = [];
        }

        const sorterIndex = sorter?.order - 1;
        const sortItem: AcTableSorter = {
            field: column.field,
            sorter: column.sorter,
            sortField: column.sortField
        };
        if (!sorter) {
            sortItem.dir = 'asc';
            this._sorting.push(sortItem);
        } else if (sorter.dir === 'asc') {
            sortItem.dir = 'desc';
            this._sorting.splice(sorterIndex, 1, sortItem);
        } else if (sorter.dir === 'desc') {
            this._sorting.splice(sorterIndex, 1);
        }

        this.updateSortingMap();
        this.acTableActionsService.dispatch(new AcTableActions.UpdateSorting(this.tableId, this._sorting));
        this.dispatchAcTableEvent({emitter: this.sortChange, type: 'sortChange'});
    }

    selectRow($event, row: any, {rowIndex, anchorIndex, forceToggle}: any = {}) {
        if ($event.target.classList.contains('resize-handle') || !this.selection) {
            return;
        }

        let candidateAnchor = row.id;
        let rows = [row];
        let update = false;
        const ctrlKey = $event.ctrlKey || forceToggle;

        if ($event.shiftKey && this.multiSelection) {
            anchorIndex = anchorIndex || this.acTableService.getRowIndexById(this._rows, this.selectionAnchor);
            rowIndex = rowIndex || this.acTableService.getRowIndexById(this._rows, row.id);
            const [startIndex, endIndex] = anchorIndex <= rowIndex ? [anchorIndex, rowIndex] : [rowIndex, anchorIndex];

            rows = this._rows.slice(startIndex, endIndex + 1).filter((selectionRow) => !!selectionRow.id && !selectionRow._groupId);
            candidateAnchor = undefined;
            update = ctrlKey;
            if (!this.doSelect) {
                this.doSelect = !ctrlKey;
            }
        } else if (ctrlKey || this.selectBehavior === ESelectBehavior.toggle) {
            update = this.doSelect = !this.selection[row.id];
        } else {
            this.doSelect = true;
        }

        this.executeSelection(rows, {candidateAnchor, select: this.doSelect, update});
    }

    getActiveCollapsedGroups() {
        if (!this.groupedRows) {
            return {};
        }

        return Object.getOwnPropertyNames(this.groupedRows).reduce((activeGroups, group) => {
            activeGroups[group] = this.collapsedGroups[group];
            return activeGroups;
        }, {});
    }

    setRowsGroups(rows) {
        this.groupedRows = rows.reduce((acc, currRow) => {
            const group = (typeof this.groupBy === 'string') ? currRow.topicId : this.groupBy(currRow.data);
            if (!acc[group]) {
                acc[group] = [currRow];
            } else {
                acc[group].push(currRow);
            }
            return acc;
        }, {});
    }

    toggleGroupCollapsedState(tableRowGroup: any) {
        this.collapsedGroups[tableRowGroup._groupId] = !this.collapsedGroups[tableRowGroup._groupId];
        this.acTableActionsService.updateCollapseGroupsState(this.tableId, {
            [tableRowGroup._groupId]: this.collapsedGroups[tableRowGroup._groupId]
        });
    }

    onWheelUpdateHorizontalScroller(wheelEvent: WheelEvent, horizontalScroller: HTMLDivElement) {
        horizontalScroller?.scrollBy({left: wheelEvent.shiftKey ? wheelEvent.deltaY : wheelEvent.deltaX});
    }

    updateHorizontalScroll(scrollEvent: Event, containers: HTMLElement[]) {
        const scrollLeft = (scrollEvent.target as HTMLElement).scrollLeft;

        containers.forEach((container) => {
            if (container) {
                container.scrollLeft = scrollLeft;
            }
        });
    }

    calcHorizontalScrollWidth = (headerTable, viewportScrollBarWidth) => {
        this.headerTableWidthChanges = 0;
        return this.acTableService.getLimitedWidth(headerTable.offsetWidth - viewportScrollBarWidth);
    };

    getViewPortRows = (rows) => {
        if (!rows) {
            return;
        }

        this.loading = false;
        return this.getGroupedRows(this.getFilteredRows(rows));
    };

    onColumnFilterChanged($event: string, column: AcTableColumn) {
        this.filters = {...this.filters};
        if (!$event || $event === '') {
            delete this.filters[column.field];
        } else {
            this.filters[column.field] = {query: $event.toLowerCase()};
        }
    }

    getBodyScrollTop = () => {
        const tableState = this.store.selectSnapshot<AcTableState>(AC_TABLE_STATE_TOKEN)[this.tableId];
        return tableState?.scrollPosition?.[this.pageIndex] || 0;
    };

    getTableCellContext = () => {
        if (this.tableCellContextIndex < 0) {
            return null;
        }
        return this.headerRowElementChildren[this.tableCellContextIndex];
    };

    getRowCount = (rows) => rows?.length || 0;

    updateInfiniteScroll = (a) => {
        this.cdRef.markForCheck();//detectChanges();
        if (this.infiniteScroll) {
            console.warn('Infinite scroll disabled temporary');
            return;
        }
        // if (!this.infiniteScroll || !this._rows || this.bufferingInfiniteScroll || this.lastEndIndex === endIndex) {
        //     return;
        // }
        //
        // this.lastEndIndex = endIndex;
        //
        // const rowCount = this._rows.length;
        // const groupCount = this.groupedRows ? Object.getOwnPropertyNames(this.groupedRows).length : 0;
        // const tableRowsEndIndex = Math.max(0, rowCount - 1) + Math.max(0, groupCount);
        // if (endIndex === tableRowsEndIndex) {
        //     this.bufferingInfiniteScroll = true;
        //
        //     this.initialized.closed && this.dispatchAcTableEvent({
        //         type: 'infiniteScrollUpdate',
        //         emitter: this.infiniteScrollUpdate,
        //         loadingState: false,
        //         additionalData: this.infiniteScrollEventData(),
        //     });
        // }
    };

    // infiniteScrollEventData = () => {
    //     return {cursor: this.store.selectSnapshot(AcTableState.cursor(this.tableId))};
    // };

    clearColumnWidth = () => {
        if (!this.customColumnsWidth) {
            return;
        }
        this.customColumnsWidth = false;
        this.acTableActionsService.clearColumnsWidth(this.tableId);
        this._columns.forEach((column) => {
            delete column.colWidth;
        });
        setTimeout(() => this.setColumnsWidth());
        this.cdRef.detectChanges();
    };

    hasSelection = (selection: any) => selection && Object.getOwnPropertyNames(selection).length > 0;

    forceSelectionWhenNeed = (rows) => {
        if (!this.forceSelection || this.hasSelection(this.selection)) {
            return;
        }
        this.executeSelection([rows[0]], {candidateAnchor: rows[0].id});
    };

    toggleFocus(state: boolean) {
        this.isFocused = state;
    }

    filterVisibilityColumns = (columns: Array<AcTableColumn>) => {
        const {columnVisibility} = this.acTableActionsService.getSettings(this.tableId);
        if (!columnVisibility) {
            return columns.filter(({isVisible}) => isVisible !== false);
        }
        return columns.filter((column) => columnVisibility[column.field] !== false);
    };

    isAllRowsSelected = () => {
        if (!this._rows || this._rows.length === 0) {
            return false;
        }
        return this._rows.every((row) => !!this.selection[row.id]);
    }

    protected clearScrollPosition() {
        this.acTableActionsService.dispatch(new AcTableActions.UpdateScrollPosition(this.tableId, {}, false));
    }

    // protected getSelectionCheckboxColumn(activeColumns: Array<AcTableColumn>): AcTableColumn | void {
    //     if (!this.selection) {
    //         return;
    //     }
    //     return this.acTableService.createNativeColumn(this.tableId, activeColumns, {
    //         field: `${this.tableId}_selection`,
    //         width: 60,
    //         cellClass: 'textAlignCenter ac-table-select-row-checkbox',
    //         titleFormatter: ({viewContainerRef}: any) => {
    //             return this.acTableService.createNativeColumnFormatter(viewContainerRef, AcCheckboxComponent, {},
    //                 (componentRef) => [
    //                     this.store.select(AcTableState.selection(this.tableId, true, true)).subscribe((selection) => setTimeout(() => {
    //                         const isAllSelected = this.isAllRowsSelected();
    //                         componentRef.instance.acModel = !isAllSelected && (selection.length > 0) ? 'indeterminate' : isAllSelected;
    //                         this.cdRef.detectChanges();
    //                     })),
    //                     fromEvent(componentRef.location.nativeElement, 'click').subscribe(($event: any) => {
    //                         $event.stopPropagation();
    //                         $event.preventDefault();
    //                         this.executeSelection(this._rows, {update: true, select: !this.isAllRowsSelected()});
    //                     })
    //                 ])
    //         },
    //         formatter: ({viewContainerRef, ...cell}: AcTableCell) => {
    //             const {id} = cell.getTableRow();
    //             return this.acTableService.createNativeColumnFormatter(viewContainerRef, AcCheckboxComponent,
    //                 {
    //                     componentInputs: {acModel: !!this.selection[id], sideMargin: false},
    //                 },
    //                 (componentRef) => [
    //                     fromEvent(componentRef.location.nativeElement, 'click').subscribe(($event: any) => {
    //                         $event.stopPropagation();
    //                         $event.preventDefault();
    //                         this.selectRow($event, cell.getTableRow(), {forceToggle: true});
    //                     })
    //                 ]);
    //         },
    //         onRowSelection: (selection, contentRef: ComponentRef<AcCheckboxComponent>) => {
    //             if (!contentRef) {
    //                 return;
    //             }
    //             contentRef.instance.acModel = selection;
    //             this.cdRef.detectChanges();
    //         }
    //     });
    // }

    // protected getRowsExpansionColumn(activeColumns: Array<AcTableColumn>): AcTableColumn {
    //     if (!this.expandableRows) {
    //         return;
    //     }
    //     const initialRowExpansionState = this.store.selectSnapshot(AcTableState.rowsExpansion(this.tableId));
    //     const setArrowDirection = (componentRef: ComponentRef<AcSvgComponent>, isRowExpanded: boolean) => {
    //         if (!componentRef) {
    //             return;
    //         }
    //         componentRef.instance.mirrorVer = isRowExpanded;
    //         componentRef.instance.cdRef.detectChanges()
    //     };
    //     return this.acTableService.createNativeColumn(this.tableId, activeColumns, {
    //         field: `${this.tableId}_expand`,
    //         width: 20,
    //         minWidth: 20,
    //         cellClass: 'no-padding ac-table-expand-row',
    //         formatter: ({viewContainerRef, ...cell}: AcTableCell) => {
    //             const {id} = cell.getTableRow();
    //             const isInitiallyExpanded = initialRowExpansionState[id];
    //             return this.acTableService.createNativeColumnFormatter(viewContainerRef, AcSvgComponent,
    //                 {componentInputs: {name: 'chevron', rotate: 90, mirrorVer: isInitiallyExpanded}},
    //                 (componentRef) => [
    //                     this.store.select(AcTableState.rowsExpansion(this.tableId)).subscribe((rowsExpansion) => {
    //                         setArrowDirection(componentRef, rowsExpansion[id]);
    //                         this.cdRef.detectChanges();
    //                     }),
    //                     fromEvent(componentRef.location.nativeElement, 'click').subscribe(($event: any) => {
    //                         $event.stopPropagation();
    //                         $event.preventDefault();
    //
    //                         const rowsExpansion = this.store.selectSnapshot(AcTableState.rowsExpansion(this.tableId));
    //                         const isRowExpanded = !rowsExpansion[id];
    //                         setArrowDirection(componentRef, isRowExpanded);
    //                         this.acTableActionsService.dispatch(new AcTableActions.SetRowExpansion(this.tableId, {[id]: isRowExpanded}, this.multiExpandableRows));
    //
    //                         this.cdRef.detectChanges();
    //                     })
    //                 ]
    //             )
    //         },
    //     });
    // }

    protected setColumns(columns: Array<AcTableColumn>) {
        if (!columns) {
            return;
        }

        // const expandColumn = this.getRowsExpansionColumn(this.activeColumns);
        // const selectionColumn = this.getSelectionCheckboxColumn(this.activeColumns);
        columns = [
            // selectionColumn,
            // expandColumn,
            ...columns
        ].filter((col) => !!col);
        this.activeColumns = this.filterActiveColumns(columns).map((column) => ({
            // defaults
            widthGrow: (column.width || column.widthByHeader) ? 0 : (column.widthGrow || 1),
            isActive: true,
            isResizable: true,
            configurable: true,
            ...column
        }));

        this._columns = this.filterVisibilityColumns(this.activeColumns);
        this.cdRef.detectChanges();
    }

    protected setRows(rows) {
        this.updateSelectionByRows(rows); // new rows selection may change
        if (this.getRowCount(rows) > 0) {

            if (this.groupBy) {
                this.setRowsGroups(rows);
                this.acTableActionsService.setCollapseGroupsState(this.tableId, this.getActiveCollapsedGroups());
            }

            this.dispatchAcTableEvent({
                emitter: this.rowsUpdate,
                type: 'updateData',
                loadingState: false,
                tableUpdate: false,
            });

            this.forceSelectionWhenNeed(rows);

        } else if (this.getRowCount(rows) <= 0 && this.pageIndex > 1) {
            this.pageIndex--;
            this.onPageChange();
        }

        if (!this.isBodyVisible && rows) {
            setTimeout(() => {
                this.vsComponent.scrollToOffset(this.getBodyScrollTop());
                this.updateTableHeaderMargin();
                this.isBodyVisible = true;
                this.cdRef.markForCheck();
            });
        }
        this.bufferingInfiniteScroll = false;
        this._rows = rows;
        this.cdRef.detectChanges();
    }

    protected dispatchAcTableEvent(
        {
            emitter,
            type,
            paging = undefined,
            loadingState = true,
            additionalData = undefined,
            tableUpdate = true,
        }: AcTableDispatchEvent
    ) {
        if (!this.loading) {
            this.loading = loadingState;
        }

        const sorting = this._sorting.map(({field, sortField, ...args}) => {
            return {field: (sortField || field), ...args};
        });

        const acEventObject = {
            type,
            paging: this.getPaging(paging),
            sorting,
            selection: {...this.selection},
            collapsedGroups: this.getActiveCollapsedGroups(),
            ...additionalData
        };
        emitter.emit(acEventObject);
        tableUpdate && this.tableUpdate.emit(acEventObject);
    }

    protected getPaging = (paging?: AcPagingEvent | AcPaging): AcPaging => {
        if (paging) {
            delete (paging as AcPagingEvent).type;
            return paging;
        }

        const page = typeof this.pageIndex === 'string' ? parseInt(this.pageIndex, 10) : this.pageIndex;
        const size = typeof this.pageSize === 'string' ? parseInt(this.pageSize, 10) : this.pageSize;
        return {page, size};
    };

    private updateSelectionByRows(rows) {

        const selection = this.store.selectSnapshot(AcTableState.selection(this.tableId, false));
        if (!rows || !this.hasSelection(selection)) {
            return;
        }

        const selectedRows = rows.filter((row) => selection[row.id]);

        this.executeSelection(selectedRows, {externalUpdate: selectedRows.length !== Object.getOwnPropertyNames(selection).length});
    }

    private executeSelection(selection, {
        candidateAnchor = null,
        select = true,
        update = false,
        externalUpdate = true
    } = {}) {
        update = this.multiSelection && update;
        select = select || this.forceSelection;

        if (select || this.forceSelection) {
            const selectionState = selection.reduce((acc, row) => {
                acc[row.id] = true;
                return acc;
            }, {});
            this.selection = update ? {...this.selection, ...selectionState} : selectionState;
        } else {
            selection.forEach((rowSelection) => delete this.selection[rowSelection.id]);
        }
        this.selectionAnchor = candidateAnchor || this.selectionAnchor;

        this.internalSelect(this.selection);
        externalUpdate && this.externalSelection.tick(select, this.selection, candidateAnchor, update);
    }

    private filterActiveColumns = (columns: Array<AcTableColumn>): Array<AcTableColumn> => {
        return columns.filter((column) => column.isActive !== false);
    };

    private updateSortingMap() {
        this.sortingMap = this._sorting.reduce((acc, cur, index) => {
            acc[cur.field] = {...cur, order: index + 1};
            return acc;
        }, {}) as AcTableSort;
    }

    private getGroupedRows(rows) {
        if (!this.groupBy) {
            return rows;
        }

        this.setRowsGroups(rows);
        return Object.getOwnPropertyNames(this.groupedRows).reduce((acc, curr) => {
            const rowGroupHeader = {
                _groupId: curr,
                groupCount: this.groupedRows[curr].length,
                isCollapsed: !!this.collapsedGroups[curr]
            };

            acc.push(rowGroupHeader, ...(rowGroupHeader.isCollapsed ? [] : this.groupedRows[curr]));
            return acc;
        }, []);
    }

    private getFilteredRows(rows) {
        const filteredColumnsFields = Object.getOwnPropertyNames(this.filters);
        if (filteredColumnsFields.length <= 0) {
            return rows;
        }

        return rows.filter(row => {
            return filteredColumnsFields.every((filteredColumnField) => {
                return StringUtils.byString(row?.data, filteredColumnField)?.toLowerCase().includes(this.filters[filteredColumnField].query);
            });
        });
    }
}
