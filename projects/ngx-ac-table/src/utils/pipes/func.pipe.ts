import {Pipe, PipeTransform} from '@angular/core';

@Pipe({
    name: 'acFunc',
    standalone: false
})
export class AcFuncPipe implements PipeTransform {
    static urlToId = (url) => {
        return url.toLowerCase().split('/').filter((u) => !!u).join('-');
    };

    transform<T = any>(value: any, func: (...args: any[]) => T, ...args): T {
        return func(value, ...args);
    }
}
