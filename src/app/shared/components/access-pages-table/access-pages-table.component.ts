import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { AccessPages } from 'src/app/model/roles.model';
import { AppConfigService } from 'src/app/services/app-config.service';

@Component({
  selector: 'app-access-pages-table',
  templateUrl: './access-pages-table.component.html',
  styleUrls: ['./access-pages-table.component.scss'],
  host: {
    class: "access-pages"
  }
})
export class AccessPagesTableComponent {

  displayedColumns = ['page', 'view', 'modify', 'rights'];
  accessPagesDataSource = new MatTableDataSource<AccessPages>();
  @Output() accessGridChange = new EventEmitter();
  @Input() isReadOnly = true;
  constructor(
    private appconfig: AppConfigService){
    }


  get accessPagesData () {
    return this.accessPagesDataSource.data;
  }

  get accessPagesCheckBox() {
    return {
      view: {
        all:
          this.accessPagesData.length ===
          this.accessPagesData.filter((x) => x.view).length,
        indeterminate: this.accessPagesData.some((x) => x.view),
        changeAll: (check: boolean) => {
          this.accessPagesDataSource = new MatTableDataSource(
            this.accessPagesDataSource.data.map((x) => {
              x.view = check;
              if(!check) {
                x.modify = check;
                x.rights = [];
              }
              return x as AccessPages;
            })
          );
          this.accessGridChange.emit(this.accessPagesData);
        },
      },
      modify: {
        all:
        this.accessPagesData.length ===
          this.accessPagesData.filter((x) => x.modify).length,
        indeterminate: this.accessPagesData.some((x) => x.modify),
        changeAll: (check: boolean) => {
          this.accessPagesDataSource = new MatTableDataSource(
            this.accessPagesDataSource.data.map((x) => {
              x.modify = !check ? false : check && x.view ? true : false;
              return x as AccessPages;
            })
          );
          this.accessGridChange.emit(this.accessPagesData);
        },
      },
    };
  }

  ngOnInit(): void {
    for (var item of this.appconfig.config.lookup.accessPages) {
      this.accessPagesDataSource.data.push({
        page: item.page,
        view: item.view,
        modify: false,
        rights: item.rights,
      } as AccessPages);
    }
  }

  ngAfterViewInit() {
  }

  setDataSource(accessPages: AccessPages[]) {
    for(var item of this.accessPagesDataSource.data) {
      if(accessPages.some(x=>x.page.toUpperCase() === item.page.toUpperCase())) {
        const pageAccess = accessPages.find(x=>x.page.toUpperCase() === item.page.toUpperCase());
        item.modify = pageAccess.modify;
        item.view = pageAccess.view;
        item.rights = pageAccess.rights;
      }
    }
  }

  rightsOptions(page: string) {
    const accessPages = (this.appconfig.config.lookup.accessPages as AccessPages[]).find(
      (x) => x.page.toUpperCase() === page.toUpperCase()
    );
    return accessPages && accessPages.rights ? accessPages.rights : [];
  }
}
