import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import {AcTableModule} from 'ngx-ac-table';

@Component({
    selector: 'app-root',
    imports: [RouterOutlet, AcTableModule],
    templateUrl: './app.component.html',
    styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'examples';
}
