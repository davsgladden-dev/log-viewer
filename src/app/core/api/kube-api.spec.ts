import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { KubeApi, apiErrorMessage } from './kube-api';

describe('KubeApi', () => {
  let api: KubeApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(KubeApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('requests logs as text with tail and container params', () => {
    let body = '';
    api.podLogs('team a', 'pod-1', { tailLines: 200, container: 'app', previous: undefined })
      .subscribe(t => (body = t));

    const req = http.expectOne(r => r.url === '/api/namespaces/team%20a/pods/pod-1/logs');
    expect(req.request.responseType).toBe('text');
    expect(req.request.params.get('tailLines')).toBe('200');
    expect(req.request.params.get('container')).toBe('app');
    expect(req.request.params.has('previous')).toBe(false);
    req.flush('line1\nline2');
    expect(body).toBe('line1\nline2');
  });

  it('sends tailLines=0 (all lines) rather than dropping it', () => {
    api.podLogs('ns', 'p', { tailLines: 0 }).subscribe();
    const req = http.expectOne(r => r.url.endsWith('/logs'));
    expect(req.request.params.get('tailLines')).toBe('0');
    req.flush('');
  });

  it('switches kubeconfig with PUT', () => {
    api.selectKubeConfig('config-dev').subscribe();
    const req = http.expectOne('/api/kubeconfigs/active');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body.file).toBe('config-dev');
    req.flush({ file: 'config-dev', context: 'dev', namespace: 'default', server: null, directory: '' });
  });

  it('encodes secret keys in the entry URL', () => {
    api.secretEntry('ns', 'my-secret', 'tls.crt').subscribe();
    http.expectOne('/api/namespaces/ns/secrets/my-secret/entries/tls.crt')
      .flush({ key: 'tls.crt', value: 'x', decoded: true, binary: false, sizeBytes: 1 });
  });
});

describe('apiErrorMessage', () => {
  it('uses the ApiError message from a JSON body', () => {
    const e = new HttpErrorResponse({ status: 404, error: { message: 'Pod ns/x not found' } });
    expect(apiErrorMessage(e)).toBe('Pod ns/x not found');
  });

  it('parses a string body (logs endpoint uses responseType text)', () => {
    const e = new HttpErrorResponse({ status: 400, error: '{"message":"container is waiting to start"}' });
    expect(apiErrorMessage(e)).toBe('container is waiting to start');
  });

  it('reports an unreachable backend', () => {
    const e = new HttpErrorResponse({ status: 504, error: 'proxy error' });
    expect(apiErrorMessage(e)).toContain('Backend not reachable');
  });
});
