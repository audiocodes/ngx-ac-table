
import {AcTableStateModels} from './ac-table-state.models';
import {AcTableCursor} from './ac-table-state.models';
import {AcTableScrollPosition, AcTableSorter} from '../models/ac-table.interface';
import {AcPaging} from '../../utils/components/ac-pagination/ac-paging.interface';

export namespace AcTableActions {

    export class SetTableState {
        static readonly type = '[Table State] Set';
        constructor(public state: AcTableStateModels) {}
    }

    export class Select {
        static readonly type = '[Table Selection] Select';
        constructor(public tableId: string, public selection: any[] | any, public anchor = null, public updateLastState = false) {}
    }
    export class Unselect {
        static readonly type = '[Table Selection] Unselect';
        constructor(public tableId: string, public selection: any, public anchor) {}
    }
    export class ClearSelection {
        static readonly type = '[Table Selection] Clear';
        constructor(public tableId: string, public keepAnchor = false) {}
    }

    export class SetRowExpansion {
        static readonly type = '[Table Row Expansion] Set';
        constructor(public tableId: string, public rowsExpansion: any, public updateLastState = false) {}
    }

    export class SetAllRowExpansion {
        static readonly type = '[Table Row Expansion] Set All';
        constructor(public tableId: string, public isExpanded: boolean = false) {}
    }

    export class UpdatePaging {
        static readonly type = '[Table paging] Update';
        constructor(public tableId: string, public paging: AcPaging) {}
    }

    export class UpdateCursor {
        static readonly type = '[Table cursor] Update';
        constructor(public tableId: string, public cursor: AcTableCursor) {}
    }

    export class SetResetPagingOnLoad {
        static readonly type = '[Table paging] Reset On Load';
        constructor(public resetPagingState: boolean = true) {}
    }

    export class ResetPaging {
        static readonly type = '[Table paging] Reset';
        constructor(public tableId: string) {}
    }

    export class UpdateSorting {
        static readonly type = '[Table sorting] Update';
        constructor(public tableId: string, public sorting: Array<AcTableSorter>) {}
    }

    export class UpdateScrollPosition {
        static readonly type = '[Table scroll position] Update';
        constructor(public tableId: string, public scrollPosition: AcTableScrollPosition, public update = true) {}
    }

    export class UpdateColumnsWidth {
        static readonly type = '[Table columns width] Update';
        constructor(public tableId: string, public columnsWidth: {[key: string]: number}, public update=true) {}
    }

    export class ClearColumnsWidth {
        static readonly type = '[Table columns width] Clear';
        constructor(public tableId: string) {}
    }

    export class UpdateCollapsedGroups {
        static readonly type = '[Table group collapse] Update';
        constructor(public tableId: string, public collapsedGroups, public update = true) {}
    }

    export class SetAllCollapsedGroups {
        static readonly type = '[Table group collapse] Set All';
        constructor(public tableId: string, public state: boolean) {}
    }

    export class UpdateTableSettings {
        static readonly type = '[Table settings] Update';
        constructor(public tableId: string, public settings: any, public update = true) {}
    }

    export class ClearAllTablesCurrentPage {
        static readonly type = '[Table Clear All Tables Current Page] Clear All';
        constructor() {}
    }
}
