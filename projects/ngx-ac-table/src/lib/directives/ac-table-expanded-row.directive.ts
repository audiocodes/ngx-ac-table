import {Directive, TemplateRef} from '@angular/core';

@Directive({
    selector: '[acTableExpandedRow]',
    standalone: false
})
export class AcTableExpandedRowDirective {

    constructor(public template: TemplateRef<any>,) {
    }
}
