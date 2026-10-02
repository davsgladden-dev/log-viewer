import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  ActiveKubeConfig, ClusterStatus, KubeConfigFile, LogQuery, NamespaceList,
  PodSummary, SecretDetail, SecretEntry, SecretSummary,
} from './kube-api.models';

const enc = encodeURIComponent;

@Injectable({ providedIn: 'root' })
export class KubeApi {
  private readonly http = inject(HttpClient);
  private readonly base = '/api'; // proxied to Spring Boot (proxy.conf.json)

  status(): Observable<ClusterStatus> {
    return this.http.get<ClusterStatus>(`${this.base}/status`);
  }

  kubeConfigs(): Observable<KubeConfigFile[]> {
    return this.http.get<KubeConfigFile[]>(`${this.base}/kubeconfigs`);
  }

  selectKubeConfig(file: string, context?: string): Observable<ActiveKubeConfig> {
    return this.http.put<ActiveKubeConfig>(`${this.base}/kubeconfigs/active`, { file, context });
  }

  namespaces(): Observable<NamespaceList> {
    return this.http.get<NamespaceList>(`${this.base}/namespaces`);
  }

  pods(ns: string): Observable<PodSummary[]> {
    return this.http.get<PodSummary[]>(`${this.base}/namespaces/${enc(ns)}/pods`);
  }

  /** Raw log text; goes straight into LogStore.load(). */
  podLogs(ns: string, pod: string, query: LogQuery = {}): Observable<string> {
    let params = new HttpParams();
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== '') {
        params = params.set(k, String(v));
      }
    }
    return this.http.get(`${this.base}/namespaces/${enc(ns)}/pods/${enc(pod)}/logs`, {
      params,
      responseType: 'text',
    });
  }

  secrets(ns: string): Observable<SecretSummary[]> {
    return this.http.get<SecretSummary[]>(`${this.base}/namespaces/${enc(ns)}/secrets`);
  }

  secret(ns: string, name: string, reveal = false): Observable<SecretDetail> {
    return this.http.get<SecretDetail>(`${this.base}/namespaces/${enc(ns)}/secrets/${enc(name)}`, {
      params: { reveal: String(reveal) },
    });
  }

  secretEntry(ns: string, name: string, key: string): Observable<SecretEntry> {
    return this.http.get<SecretEntry>(
      `${this.base}/namespaces/${enc(ns)}/secrets/${enc(name)}/entries/${enc(key)}`,
    );
  }
}

/**
 * Turns any failure into a user-facing message.
 * - Backend errors carry an ApiError JSON body. For the logs call it arrives
 *   as a string because of responseType 'text', so we parse it.
 * - No ApiError body plus 0/500/502/503/504 means the dev proxy could not reach Spring Boot.
 */
export function apiErrorMessage(e: unknown): string {
  if (e instanceof HttpErrorResponse) {
    let body: unknown = e.error;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { /* not JSON */ }
    }
    const message = (body as { message?: unknown } | null)?.message;
    if (typeof message === 'string' && message) {
      return message;
    }
    if ([0, 500, 502, 503, 504].includes(e.status)) {
      return 'Backend not reachable. Is the Spring Boot app running on 127.0.0.1:8080?';
    }
    return `${e.status} ${e.statusText}`;
  }
  return e instanceof Error ? e.message : String(e);
}
