import {AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, ContentChild, EventEmitter, Input, Output, TemplateRef, ViewChild} from '@angular/core';
import {AcPagingEvent} from './ac-paging.interface';

export type AcPaginationItemsTemplateType = 'itemsRange' | 'itemsCount';

@Component({
    selector: 'ac-pagination',
    templateUrl: './ac-pagination.component.html',
    styleUrls: ['./ac-pagination.component.less'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: false
})
export class AcPaginationComponent implements AfterViewInit {

    isFirstPage = true;
    isLastPage = true;

    @Input() selectionLabel = true;
    @Input() showFirst = true;
    @Input() showLast = true;
    @Input() showItemDisplay = true;
    @Input() pageSelector = true;
    @Input() pagePicker = true;
    @Input() updateLastPage = true;
    @Input() pageValuesMap = [];
    @Input() pageSelectTemplate: TemplateRef<any>;

    @Output() pageIndexChange = new EventEmitter<AcPagingEvent>();
    @Output() pageSizeChange = new EventEmitter<AcPagingEvent>();

    @ContentChild('prefixTemplate') prefixTemplate: TemplateRef<any>
    @ContentChild('postfixTemplate') postfixTemplate: TemplateRef<any>
    @ViewChild('itemsRange') itemsRangeTemplate: TemplateRef<any>;
    @ViewChild('itemsCount') itemsCountTemplate: TemplateRef<any>;

    @Input() itemsDisplayTemplate: TemplateRef<any>;
    @Input() itemsDisplayType: AcPaginationItemsTemplateType = 'itemsRange';
    defaultItemsDisplayTemplate = {};

    constructor(private cdRef: ChangeDetectorRef) {
    }

    _pageSize = 25;

    @Input() set pageSize(pageSize) {
        this._pageSize = parseInt(pageSize, 10) || 25;
        this.updateIsLastPage();
    }

    _totalElements = 0;

    @Input() set totalElements(totalElements) {
        this._totalElements = parseInt(totalElements, 10) || 0;
        this.updateIsLastPage();
    }

    _pageIndex = 1;

    @Input() set pageIndex(index) {
        this._pageIndex = parseInt(index, 10) || 1;
        this.isFirstPage = this._pageIndex <= 1;
        this.updateIsLastPage();
    }

    _pageSizeOptions;

    @Input() set pageSizeOptions(options: number[] | boolean) {
        if (!options || typeof options === 'boolean') {
            return;
        }
        this._pageSizeOptions = options;
    }

    ngAfterViewInit() {
        this.defaultItemsDisplayTemplate = {
            itemsRange: this.itemsRangeTemplate,
            itemsCount: this.itemsCountTemplate
        };
    }


    getPages = (totalElements, pageSize, pageValuesMap) => {
        return Array.from({length: this.getTotalPages(totalElements, pageSize)}, (_, i) => {
            return {value: (i + 1), text: pageValuesMap[i] || (i + 1)};
        });
    };

    getTotalPages = (totalElements, size) => {
        return Math.ceil(totalElements / size) || 1;
    };

    getButtonStateColor = (state) => {
        return state ? 'grey' : 'black';
    };

    onPageSizeChange(pageSize: string) {
        this.pageSize = pageSize;
        this.pageSizeChange.emit(this.getPaging('pageSize'));
    }

    onPageIndexChange(pageIndex: string | number) {
        pageIndex = (typeof pageIndex === 'string') ? parseInt(pageIndex, 10) : pageIndex;
        this.pageIndexChange.emit(this.getPaging('pageIndex', pageIndex));
    }

    getPaging = (type: string, pageIndex?): AcPagingEvent => {
        return {
            type,
            page: pageIndex || this._pageIndex,
            size: this._pageSize
        };
    };

    getFromPageElements = () => {
        if (this._totalElements < 1) {
            return 0;
        }
        return this._pageSize * (this._pageIndex - 1) + 1;
    };

    getToPageElements = () => {
        if (this._pageSize > this._totalElements || this.isLastPage) {
            return this._totalElements;
        }

        return this._pageSize * this._pageIndex;
    };
    getItemRangeContext = (totalElements, pageIndex, pageSize) => {
        return {
            $implicit: totalElements,
            pageIndex,
            pageSize
        };
    };

    updateIsLastPage() {
        if (!this.updateLastPage) {
            return;
        }
        this.isLastPage = this._pageIndex >= this.getTotalPages(this._totalElements, this._pageSize);
    }

    update = () => {
        this.cdRef.detectChanges();
    };
}



