import {AfterViewInit, Component, DestroyRef, ElementRef, HostBinding, HostListener, Inject, Input, QueryList, TemplateRef, ViewChildren} from '@angular/core';
import {AC_TABLE_COMPONENT, AcTableColumn, AcTableRow, IAcTableComponent} from '../../models/ac-table.interface';
import {AcTableService} from '../../services/ac-table.service';
import {Store} from '@ngxs/store';
import {AcTableState} from '../../state/ac-table.state';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';

@Component({
    selector: '[ac-table-body]',
    templateUrl: './ac-table-body.component.html',
    styleUrls: ['./ac-table-body.component.less'],
})
export class AcTableBodyComponent implements AfterViewInit {
    // @ts-ignore

    @ViewChildren('rowsElementsRef') rowsElementsRef: QueryList<ElementRef>;
    @Input() columns: AcTableColumn[];
    @Input() rows: AcTableRow[];
    @Input() showBufferLoader = false;
    @Input() templates: { [key: string]: TemplateRef<any>, infiniteScrollBufferLoader?: TemplateRef<any> } = {};

    @HostBinding('class.no-user-selection') isUserSelecting = false;
    rowsExpansion;
    startIndex = 0;

    constructor(@Inject(AC_TABLE_COMPONENT) public acTableComponent: IAcTableComponent,
                public acTableService: AcTableService,
                private destroyRef: DestroyRef,
                private store: Store) {
        this.store.select(AcTableState.rowsExpansion(this.acTableComponent.tableId)).pipe(takeUntilDestroyed(this.destroyRef)).subscribe((rowsExpansion) => {
            this.rowsExpansion = rowsExpansion;
        });
    }

    ngAfterViewInit() {
        this.acTableComponent.vsComponent.scrolledIndexChange.subscribe((index) => {
            this.startIndex = index;
        });
    }

    getRowColSpan = (column, row) => {
        // !!!!!!!!!!!! reduceCells removes columns width  colspan = 0 !!!!!!!!!
        if (row._groupId) {
            return this.columns.length;
        }
        return row.data[column.field]?.colspan || 1;
        // !!!!!!!!!!!! reduceCells removes columns width  colspan = 0 !!!!!!!!!
    };

    reduceCells = (columns, row): Partial<AcTableColumn[]> => {
        if (row._groupId) {
            return [{field: 'group'}] as AcTableColumn[];
        }
        return columns?.filter((column) => this.isCellExist(row.data, column.field));
    };

    isCellExist = (row, field) => {
        const cellData = row[field];
        return isNaN(cellData?.colspan) || cellData.colspan > 0;
    };

    @HostListener('document:keydown', ['$event'])
    disableUserSelect($event: KeyboardEvent) {
        if (!this.acTableComponent.selection) {
            return;
        }
        if ($event.key === 'Shift' && !this.isUserSelecting) {
            this.isUserSelecting = true;
        }
        if (this.acTableComponent.isFocused && !$event.ctrlKey && !this.acTableComponent.groupBy && !this.acTableComponent.expandableRows) {
            this.selectNextRow($event);
        }
    }

    nextRowKeyDownAction = (rows: AcTableRow[], anchorIndex: number, rowStartIndex, rowEndIndex): number => {
        if (anchorIndex > rowStartIndex) {
            return rowStartIndex + 1;
        } else if (anchorIndex <= rowEndIndex) {
            return rowEndIndex + 1;
        }
        return rowEndIndex;
    };

    nextRowKeyUpAction = (rows, anchorIndex, rowStartIndex, rowEndIndex) => {
        if (anchorIndex < rowEndIndex) {
            return rowEndIndex - 1;
        } else if (anchorIndex >= rowStartIndex) {
            return rowStartIndex - 1;
        }
        return rowStartIndex;
    };

    @HostListener('document:keyup', ['$event'])
    enableUserSelect($event: KeyboardEvent) {
        if ($event.key === 'Shift') {
            this.isUserSelecting = false;
        }
    }

    TrackById = (index: number) => {
        return this.rows[index].id;
    }

    private selectNextRow($event: KeyboardEvent) {

        const rows = this.acTableComponent._rows;
        const anchorIndex = this.acTableService.getRowIndexById(rows, this.acTableComponent.selectionAnchor);
        const rowIndex = this.getRowNextRowIndex($event, rows, anchorIndex);
        const nextRow = rows[rowIndex];
        if (nextRow) {
            this.acTableComponent.selectRow($event, nextRow, {rowIndex, anchorIndex});

            const RenderedContentSize = this.acTableComponent.vsComponent.measureRenderedContentSize();
            const {start, end} = this.acTableComponent.vsComponent.getRenderedRange()
            const viewportSize = this.acTableComponent.vsComponent.measureViewportSize('vertical');
            const topScrollOffset = this.acTableComponent.vsComponent.measureScrollOffset('top');

            const rowsInViewPort = Math.ceil(viewportSize / 50);

            if (rowIndex <= this.startIndex) {
                this.acTableComponent.vsComponent.scrollToIndex(rowIndex);
            } else if (rowIndex - this.startIndex >= rowsInViewPort) {
                const itemSize = RenderedContentSize / (end - start);
                const offsetToBottomViewport = topScrollOffset + viewportSize;
                const lastItemSizeOutOfViewport = itemSize - (offsetToBottomViewport) % itemSize;

                const rowsOutOfBottomViewport = rowIndex - this.startIndex - rowsInViewPort;

                const firstItemSize = topScrollOffset > 0 ? 0 : itemSize
                this.acTableComponent.vsComponent.scrollToOffset(topScrollOffset + firstItemSize + (rowsOutOfBottomViewport * itemSize) + lastItemSizeOutOfViewport + 1);
            }
        }
    }

    private getRowNextRowIndex($event: KeyboardEvent, rows: AcTableRow[], anchorIndex: number): number {
        let rowIndex = -1;
        const firstSelectedIndex = rows.findIndex((row) => !!this.acTableComponent.selection[row.id]);
        const lastSelectedIndex = rows.length - 1 - [...rows].reverse().findIndex((row) => !!this.acTableComponent.selection[row.id]);

        switch ($event.code) {
            case 'KeyS':
            case 'ArrowDown':
                rowIndex = this.nextRowKeyDownAction(rows, anchorIndex, firstSelectedIndex, lastSelectedIndex);
                break;
            case 'KeyW':
            case 'ArrowUp':
                rowIndex = this.nextRowKeyUpAction(rows, anchorIndex, firstSelectedIndex, lastSelectedIndex);
                break;
        }
        return rowIndex;
    }
}
