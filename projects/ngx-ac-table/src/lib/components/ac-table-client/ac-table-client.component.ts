import {ChangeDetectionStrategy, Component, forwardRef, Input,} from '@angular/core';

import {AcTableRow, AcTableSorters, SorterFunc} from '../../models/ac-table.interface';
import {AcTableComponent} from '../ac-table/ac-table.component';
import {AcPagingEvent} from '../../../utils/components/ac-pagination/ac-paging.interface';
import {StringUtils} from '../../../utils/string-utils';

@Component({
    selector: 'ac-table-client',
    templateUrl: '../ac-table/ac-table.component.html',
    styleUrls: ['../ac-table/ac-table.component.less'],
    providers: [{ provide: AcTableComponent, useExisting: forwardRef(() => AcTableClientComponent) }],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: false
})
export class AcTableClientComponent extends AcTableComponent {

    _allRows: AcTableRow[];
    viewInitialized = false;

    @Input() sorters: AcTableSorters;

    override ngOnInit() {
        this.sorters = {
            number: this.numberCompare,
            string: this.stringCompare,
            boolean: this.booleanCompare,
            version: this.versionCompare,
            ...this.sorters
        };
    }

    override ngAfterViewInit() {
        super.ngAfterViewInit();
        this.viewInitialized = true;
        this._allRows && this.setRows([...this._allRows]);
    }

    override onPageChange(paging?: AcPagingEvent) {
        super.onPageChange(paging);
        this.setRows();
    }

    override onColumnSort(column: any) {
        super.onColumnSort(column);
        this.setRows();
    }

    override setRows(rows?: AcTableRow[]) {
        if (rows) {
            this._allRows = rows;
            this.totalElements = this._allRows?.length || 0;
            this.loading = true;
        }

        if (!this.viewInitialized) {
            return;
        }

        let sortedRows: AcTableRow[] = this.getSortedRows();
        if (this.paginator && this.pageSelector) {
            sortedRows = sortedRows.slice((this.pageIndex - 1) * this.pageSize, this.pageIndex * this.pageSize);
        }

        super.setRows(sortedRows);
    }

    private getSortedRows(): AcTableRow[] {
        if (this._sorting?.length <= 0 || !this._allRows) {
            return this._allRows || [];
        }

        const sortedRows: AcTableRow[] = [...this._allRows];
        sortedRows.length > 0 && this._sorting.forEach((sorterState) => {
            const sorterType = typeof (StringUtils.byString(sortedRows[0].data, sorterState.field));
            const sorter: SorterFunc = this.sorters[sorterState.sorter || sorterType] || this.sorters['string'];

            sorter && sortedRows.sort(({data: row1}, {data: row2}) => {
                return sorter(StringUtils.byString(row1, sorterState.field), StringUtils.byString(row2, sorterState.field), sorterState.dir);
            });
        });
        return sortedRows;
    }

    private numberCompare: SorterFunc = (exp1, exp2, dir) => {
        let compareResult;
        if (exp2 < 0) {
            compareResult = -1;
        } else if (parseFloat(exp1 || 0) < 0) {
            compareResult = 1;
        } else {
            compareResult = parseFloat(exp1|| 0) - parseFloat(exp2|| 0);
        }

        return dir === 'asc' ? compareResult : (compareResult * -1);
    };

    private stringCompare: SorterFunc = (string1 = '', string2 = '', dir) => {
        const compareResult = ((string1 || '').toLowerCase()).localeCompare((string2 || '').toLowerCase());
        return dir === 'asc' ? compareResult : (compareResult * -1);
    };

    private booleanCompare: SorterFunc = (exp1, exp2, dir) => {
        const el1 = (exp1 === true || exp1 === 'true' || exp1 === 'True' || exp1 === 1) ? 1 : 0;
        const el2 = exp2 === true || exp2 === 'true' || exp2 === 'True' || exp2 === 1 ? 1 : 0;

        return dir === 'asc' ? el1 - el2 : el2 - el1;
    };

    private versionCompare: SorterFunc = (ver1, ver2, dir) => {
        const isBigger = this.isGt(ver1, ver2);
        return ((dir === 'asc' && isBigger) || (dir === 'desc' && !isBigger)) ? 1 : -1;
    };

    private isGt = (ver1: string, ver2: string) => {
        if (!ver1 || !ver2) {
            return false;
        }

        const parts1 = ver1.split('.');
        parts1.length = 3;
        const parts2 = ver2.split('.');

        for (let i = 0; i < parts1.length; i++) {
            const p1 = (parseInt(parts1[i], 10) || 0);
            const p2 = (parseInt(parts2[i], 10) || 0);

            if (p1 < p2) {
                return false;
            } else if (p1 > p2){
                return true;
            }
        }

        return false;
    };
}
