import {StateToken} from '@ngxs/store';

export interface AcTableCursor {
    [key: string]: any;
    current?: AcTableCursor;
    after?: string;
    before?: string;
}

export interface AcTableStateModels {
    [key: string]: any;
    resetPagingOnLoad?: boolean;
};
export const AC_TABLE_STATE_TOKEN = new StateToken<AcTableStateModels>('tableState');
export const AC_TABLE_STATE_DEFAULTS = {};
