import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  get<T>(path: string, params?: Record<string, string | number | boolean | undefined | null>): Observable<T> {
    let httpParams = new HttpParams();
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null && value !== '') {
          httpParams = httpParams.set(key, String(value));
        }
      }
    }
    return this.http.get<T>(`${this.baseUrl}${path}`, { params: httpParams });
  }

  post<T>(path: string, body: unknown, idempotencyKey?: string): Observable<T> {
    return this.http.post<T>(`${this.baseUrl}${path}`, body, {
      headers: this.buildWriteHeaders(idempotencyKey)
    });
  }

  put<T>(path: string, body: unknown, idempotencyKey?: string): Observable<T> {
    return this.http.put<T>(`${this.baseUrl}${path}`, body, {
      headers: this.buildWriteHeaders(idempotencyKey)
    });
  }

  patch<T>(path: string, body: unknown, idempotencyKey?: string): Observable<T> {
    return this.http.patch<T>(`${this.baseUrl}${path}`, body, {
      headers: this.buildWriteHeaders(idempotencyKey)
    });
  }

  delete<T>(path: string, idempotencyKey?: string): Observable<T> {
    return this.http.delete<T>(`${this.baseUrl}${path}`, {
      headers: this.buildWriteHeaders(idempotencyKey)
    });
  }

  newIdempotencyKey(): string {
    return crypto.randomUUID();
  }

  private buildWriteHeaders(idempotencyKey?: string): HttpHeaders {
    return new HttpHeaders({
      'Idempotency-Key': idempotencyKey ?? this.newIdempotencyKey()
    });
  }
}
