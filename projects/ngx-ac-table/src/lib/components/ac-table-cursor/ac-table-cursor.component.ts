import {ChangeDetectionStrategy, Component, forwardRef, Input, ViewChild,} from '@angular/core';

// import {cloneDeep} from 'lodash';
import {AcTableActions} from '../../state/ac-table.actions';
import {AcTableState} from '../../state/ac-table.state';
import {AC_TABLE_STATE_TOKEN, AcTableCursor} from '../../state/ac-table-state.models';
import {AcTableComponent} from '../ac-table/ac-table.component';
import {AcPaginationComponent} from '../../../utils/components/ac-pagination/ac-pagination.component';
import {AcPagingEvent} from '../../../utils/components/ac-pagination/ac-paging.interface';

@Component({
    selector: 'ac-table-cursor',
    templateUrl: '../ac-table/ac-table.component.html',
    styleUrls: ['../ac-table/ac-table.component.less'],
    providers: [{ provide: AcTableComponent, useExisting: forwardRef(() => AcTableCursorComponent) }],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: false
})
export class AcTableCursorComponent extends AcTableComponent {

    @ViewChild(AcPaginationComponent, {static: false}) acPagination: AcPaginationComponent;

    override setRows(rows) {
        this.totalElements = rows?.length || 0;
        super.setRows(rows);
    }

    _cursor: AcTableCursor = {};
    @Input() set cursor(cursor) {
        if (!cursor) {
            return;
        }
        this._cursor = {...cursor, current: this._cursor.current};
        this.store.dispatch(new AcTableActions.UpdateCursor(this.tableId, this._cursor));
        this.acPagination.isLastPage = !cursor.after || cursor.after === -1  || cursor.after === '-1';
        this.acPagination.update();
    }

    override ngAfterViewInit() {
        this.acPagination.showLast = false;
        this.acPagination.pagePicker = false;
        this.acPagination.updateLastPage = false;
        this.acPagination.itemsDisplayType = 'itemsCount';
        this.acPagination.update();

        const tableState = this.store.selectSnapshot<AcTableState>(AC_TABLE_STATE_TOKEN)[this.tableId];
        if (tableState?.cursor) {
            // this._cursor = cloneDeep(tableState.cursor); // TODO: install or replace lodash
        }

        super.ngAfterViewInit();
    }


    override onPageChange(paging?: AcPagingEvent) {
        this.acPagination.isLastPage = true;
        const prevPageIndex = this.pageIndex;
        super.onPageChange(paging, false);
        const dirType = this.pageIndex > prevPageIndex ? 'after' : 'before';

        this._cursor.current = this.pageIndex > 1 && {[dirType]: this._cursor[dirType]};
        this.dispatchPaging(this.getPaging());
    }

    override dispatchAcTableEvent({...args}: any) {
        super.dispatchAcTableEvent( {
            ...args,
            additionalData: this._cursor.current ? {cursor: this._cursor.current} : undefined
        });
    }
}
