import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { KubeApi } from '../api/kube-api';
import { PodSummary } from '../api/kube-api.models';
import { KubeStore } from './kube-store';
import { LogStore } from './log-store';

const ACTIVE = { file: 'config', context: 'dev', namespace: 'team-a', server: 'https://x', directory: '' };
const POD: PodSummary = {
  name: 'api-1', namespace: 'team-a', phase: 'Running', status: 'Running', ready: '1/1',
  restarts: 0, node: null, createdAt: null, age: '1h', containers: [],
};

describe('KubeStore', () => {
  let store: KubeStore;
  let logCalls: Array<{ ns: string; pod: string; query: unknown }>;
  let loaded: Array<{ text: string; source: string }>;
  let selectCalls: string[];
  let logText: string;

  beforeEach(() => {
    logCalls = []; loaded = []; selectCalls = []; logText = '{"msg":"hi"}\n';
    const sourceName = signal('');

    const fakeApi: Partial<KubeApi> = {
      status: () => of({ active: ACTIVE, reachable: true, serverVersion: 'v1.29', kubeDirectory: '' }),
      kubeConfigs: () => of([
        { name: 'config', path: '', currentContext: 'dev', contexts: [], active: true },
        { name: 'config-qa', path: '', currentContext: 'qa', contexts: [], active: false },
      ]),
      selectKubeConfig: (file: string) => {
        selectCalls.push(file);
        return of({ ...ACTIVE, file, context: 'qa', namespace: 'team-qa' });
      },
      namespaces: () => of({ namespaces: ['team-a', 'team-qa'], listRestricted: false }),
      pods: () => of([POD]),
      podLogs: (ns: string, pod: string, query: unknown) => {
        logCalls.push({ ns, pod, query });
        return of(logText);
      },
      secrets: () => of([]),
    };
    const fakeLogStore = {
      sourceName,
      load: (text: string, source: string) => { loaded.push({ text, source }); sourceName.set(source); },
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: KubeApi, useValue: fakeApi },
        { provide: LogStore, useValue: fakeLogStore },
      ],
    });
    store = TestBed.inject(KubeStore);
  });

  it('connects, picks up the active config and loads pods', async () => {
    await store.init();
    expect(store.selectedFile()).toBe('config');
    expect(store.namespace()).toBe('team-a');
    expect(store.reachable()).toBe(true);
    expect(store.pods().length).toBe(1);
  });

  it('fetches logs with the chosen tail and pushes them through LogStore.load', async () => {
    await store.init();
    store.selectPod('api-1');
    store.setTailLines(1000);
    await store.fetchLogs();

    expect(logCalls.length).toBe(1);
    expect(logCalls[0].pod).toBe('api-1');
    expect((logCalls[0].query as { tailLines: number }).tailLines).toBe(1000);
    expect(loaded.length).toBe(1);
    expect(loaded[0].source).toContain('team-a/api-1');
    expect(store.isKubeSource()).toBe(true);
  });

  it('refreshLogs re-runs the last request with a new tail', async () => {
    await store.init();
    store.selectPod('api-1');
    await store.fetchLogs();
    store.setTailLines(100);
    await store.refreshLogs();

    expect(logCalls.length).toBe(2);
    expect((logCalls[1].query as { tailLines: number }).tailLines).toBe(100);
  });

  it('does not call LogStore.load for an empty log', async () => {
    await store.init();
    store.selectPod('api-1');
    logText = '';
    await store.fetchLogs();
    expect(loaded.length).toBe(0);
    expect(store.logsError()).toContain('No log lines');
  });

  it('switching config resets selection and uses the new namespace', async () => {
    await store.init();
    store.selectPod('api-1');
    await store.selectConfig('config-qa');

    expect(selectCalls).toEqual(['config-qa']);
    expect(store.namespace()).toBe('team-qa');
    expect(store.selectedPodName()).toBe(null);
  });
});
