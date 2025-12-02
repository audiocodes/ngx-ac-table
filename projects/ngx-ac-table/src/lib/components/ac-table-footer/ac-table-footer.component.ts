import {Component, Inject, Input} from '@angular/core';
import {AC_TABLE_COMPONENT, AC_TABLE_CONFIG, AcTableColumn, AcTableConfig, IAcTableComponent} from '../../models/ac-table.interface';
import {AcTableService} from '../../services/ac-table.service';

@Component({
    selector: '[ac-table-footer]',
    templateUrl: './ac-table-footer.component.html',
    styleUrls: ['./ac-table-footer.component.less'],
    standalone: false
})
export class AcTableFooterComponent {
    @Input() columns: AcTableColumn[];

    constructor(@Inject(AC_TABLE_COMPONENT) public acTableComponent: IAcTableComponent,
                public acTableService: AcTableService,
                @Inject(AC_TABLE_CONFIG) public acTableConfig: AcTableConfig) {
    }

}
