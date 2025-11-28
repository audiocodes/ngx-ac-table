import {Directive, ElementRef, HostBinding, Input, NgZone} from '@angular/core';
// import $ from 'jquery';

@Directive({
    selector: '[acLabel]',
    standalone: false
})
export class AcLabelDirective {
    @HostBinding('class.acLabelDirective') acLabelDirective = true;
    @Input() @HostBinding('class.ellipsis') acLabelEnabled = true;
    @Input() labelTitle;
    @Input() ngClass: any;
    @Input() forceTitle: false;
    @Input() parentSelectorForTitle: string;
    @Input() postfixTitleInNewRow;
    @Input() parentForTitle;
    static debounce;

    constructor(private hostElement: ElementRef, private zone: NgZone) {
    }

    ngAfterViewInit() {
        this.parentForTitle = this.parentForTitle || this.getParent(this.parentSelectorForTitle, this.hostElement.nativeElement);
        this.zone.runOutsideAngular(() => {
            this.parentForTitle.addEventListener('mousemove', this.mousemove);
        });
    }

    ngOnDestroy() {
        this.parentForTitle?.removeEventListener('mousemove', this.mousemove);
    }

    mousemove = () => {
        if (AcLabelDirective.debounce) {
            return;
        }
        AcLabelDirective.debounce = setTimeout(() => {
            AcLabelDirective.debounce = undefined;
        }, 200);

        const originalDisplay = this.hostElement.nativeElement.style.display;
        const cappedWidth = this.hostElement.nativeElement.getBoundingClientRect().width;
        this.hostElement.nativeElement.style.display = 'inline-table';
        this.hostElement.nativeElement.style.overflow = 'visible';
        const fullWidth = this.hostElement.nativeElement.getBoundingClientRect().width;
        this.hostElement.nativeElement.style.display = originalDisplay;
        this.hostElement.nativeElement.style.overflow = 'hidden';

        let title = '';
        if (cappedWidth < fullWidth || this.forceTitle) {
            // title = $(this.hostElement.nativeElement).text(); // TODO: replace jquery
            if (this.labelTitle) {
                title = this.labelTitle;
            }
        }

        if (this.postfixTitleInNewRow) {
            title += (title ? '\r\n' : '') + this.postfixTitleInNewRow;
        }

        if (title) {
            this.parentForTitle.setAttribute('title', title.trim());
        } else {
            this.parentForTitle.removeAttribute('title');
        }
    };

    private getParent(parentSelector: string, parentElement) {
        return parentElement;
        // return parentSelector ? $(this.hostElement.nativeElement).parents(parentSelector)[0] : parentElement;  // TODO: replace jquery
    }
}
