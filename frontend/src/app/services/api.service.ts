import { inject, Injectable } from '@angular/core'
import { HttpClient } from '@angular/common/http'
import { Observable } from 'rxjs'

import { ResponseModel } from '../models/response.model';

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  #http = inject(HttpClient)

  parse(names: string[]): Observable<ResponseModel[]> {
    return this.#http.post<ResponseModel[]>(`/api`, { names })
  }
}
