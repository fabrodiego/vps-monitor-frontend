import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../environments/environment';
import { Alert, AppsResponse, DatabaseResponse, Overview, PodsResponse, SeriesMetric, SeriesRange, SeriesResponse, Site } from './models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/api/monitor`;

  overview() {
    return this.http.get<Overview>(`${this.base}/overview`);
  }

  series(metric: SeriesMetric, range: SeriesRange) {
    return this.http.get<SeriesResponse>(`${this.base}/series/${metric}`, { params: { range } });
  }

  apps() {
    return this.http.get<AppsResponse>(`${this.base}/apps`);
  }

  pods() {
    return this.http.get<PodsResponse>(`${this.base}/pods`);
  }

  sites() {
    return this.http.get<Site[]>(`${this.base}/sites`);
  }

  database() {
    return this.http.get<DatabaseResponse>(`${this.base}/database`);
  }

  alerts() {
    return this.http.get<Alert[]>(`${this.base}/alerts`);
  }
}
