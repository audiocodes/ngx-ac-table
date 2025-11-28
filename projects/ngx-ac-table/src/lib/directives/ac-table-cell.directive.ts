import {ChangeDetectorRef, ComponentRef, Directive, Input, SecurityContext, ViewContainerRef} from '@angular/core';
import {DomSanitizer} from '@angular/platform-browser';
import {AcTableCell, AcTableColumn} from '../models/ac-table.interface';
import {StringUtils} from '../../utils/string-utils';

@Directive({
    selector: '[acTableCell]',
    standalone: false
})
export class AcTableCellDirective {
    @Input() acTableCell;
    @Input('acTableCellFormatter') formatter;
    @Input('acTableCellTemplate') template;

    @Input() isHeader = false;

    private column: AcTableColumn;
    @Input('acTableCellColumn') set setColumn(column) {
        this.column = column;
        this.isHeader && this.updateContainer();
    }

    private _row;
    @Input('acTableCellRow') set row(row: any) {
        this._row = row;
        this.updateContainer();
    }

    @Input('acTableCellSelection') set setSelection(selection: boolean) {
        if (!this.column.onRowSelection) {
            return;
        }
        this.column.onRowSelection(!!selection, this.contentRef);
    }
    contentRef: any | ComponentRef<any>;

    constructor(public viewContainerRef: ViewContainerRef,
                private domSanitizer: DomSanitizer,
                private cdRef: ChangeDetectorRef) {
    }


    // REMOVE BACKWARD COMPATIBILITY
    backwardCompFormatter = (): (AcTableCell: AcTableCell) => any => {
        const row = this._row?.data;
        const column = this.column;
        if (row) {
            return this.formatter({
                viewContainerRef: this.viewContainerRef,
                getValue: () => StringUtils.byString(row, column.field),
                getTableRow: () => this._row,
                getRow: () => row,
                getField: () => column.field,
            } as AcTableCell);
        } else {
            return this.formatter({viewContainerRef: this.viewContainerRef, ...column});
        }
    };

    // END REMOVE BACKWARD COMPATIBILITY
    private updateContainer() {
        queueMicrotask(() => {
            this.viewContainerRef.clear();
            if (!this.formatter) {
                this.template && this.viewContainerRef.createEmbeddedView(this.template,{row: this._row?.data || this._row, column: this.column});
                return;
            }

            this.contentRef = this.backwardCompFormatter() || '';
            if (typeof this.contentRef === 'string' || typeof this.contentRef === 'number') {
                this.acTableCell.innerHTML = this.domSanitizer.sanitize(SecurityContext.HTML, this.contentRef);
            }
            this.cdRef.markForCheck();
        });
    }
}
