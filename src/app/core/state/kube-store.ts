import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { KubeApi, apiErrorMessage } from '../api/kube-api';
import {
  ActiveKubeConfig, ClusterStatus, KubeConfigFile, KubeContext, PodSummary,
  SecretDetail, SecretEntry, SecretSummary,
} from '../api/kube-api.models';
import { LogStore } from './log-store';

export type KubeTab = 'pods' | 'secrets';

export interface LogRequest {
  namespace: string;
  pod: string;
  container?: string;
  previous: boolean;
  tailLines: number;
  sourceName: string;
}

export const TAIL_PRESETS = [100, 500, 1000, 5000] as const;
const DEFAULT_TAIL = 500;

@Injectable({ providedIn: 'root' })
export class KubeStore {
  private readonly api = inject(KubeApi);
  private readonly logStore = inject(LogStore);

  // ------------------------------------------------------------ connection
  readonly connecting = signal(false);
  readonly connectionError = signal<string | null>(null);
  readonly configs = signal<KubeConfigFile[]>([]);
  /** File chosen in the dropdown (may differ from `active` if the switch failed). */
  readonly selectedFile = signal('');
  readonly active = signal<ActiveKubeConfig | null>(null);
  readonly reachable = signal(false);
  readonly serverVersion = signal<string | null>(null);

  readonly contexts = computed<KubeContext[]>(
    () => this.configs().find(c => c.name === this.selectedFile())?.contexts ?? [],
  );

  // ------------------------------------------------------------ namespace / tab
  readonly namespaces = signal<string[]>([]);
  readonly namespaceListRestricted = signal(false);
  readonly namespace = signal('');
  readonly tab = signal<KubeTab>('pods');

  // ------------------------------------------------------------ pods / logs
  readonly pods = signal<PodSummary[]>([]);
  readonly podsLoading = signal(false);
  readonly podsError = signal<string | null>(null);
  readonly podFilter = signal('');
  readonly selectedPodName = signal<string | null>(null);
  /** '' = let the backend pick (default-container annotation, else first container). */
  readonly container = signal('');
  readonly tailLines = signal<number>(DEFAULT_TAIL);
  readonly previous = signal(false);
  readonly logsLoading = signal(false);
  readonly logsError = signal<string | null>(null);
  readonly lastLogRequest = signal<LogRequest | null>(null);

  readonly filteredPods = computed(() => {
    const q = this.podFilter().trim().toLowerCase();
    return q ? this.pods().filter(p => p.name.toLowerCase().includes(q)) : this.pods();
  });
  readonly selectedPod = computed(
    () => this.pods().find(p => p.name === this.selectedPodName()) ?? null,
  );
  /** True while the viewer is showing logs fetched from Kubernetes (not pasted text). */
  readonly isKubeSource = computed(() => {
    const last = this.lastLogRequest();
    return !!last && this.logStore.sourceName() === last.sourceName; // [F3]
  });

  // ------------------------------------------------------------ secrets
  readonly secrets = signal<SecretSummary[]>([]);
  readonly secretsLoading = signal(false);
  readonly secretsError = signal<string | null>(null);
  readonly selectedSecretName = signal<string | null>(null);
  readonly secretDetail = signal<SecretDetail | null>(null);
  readonly secretLoading = signal(false);
  readonly secretError = signal<string | null>(null);
  /** key -> decoded entry; only keys the user explicitly revealed. [F8] */
  readonly revealed = signal<Record<string, SecretEntry>>({});

  private initialized = false;
  private epoch = 0;                       // guards against stale connection responses
  private podsLoadedFor: string | null = null;
  private secretsLoadedFor: string | null = null;

  // ============================================================ connection

  /** Called when the panel first appears; later appearances reuse the state. */
  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    await this.connect();
  }

  /** (Re)reads backend status and the config list, then loads the current tab. */
  async connect(): Promise<void> {
    const epoch = ++this.epoch;
    this.connecting.set(true);
    this.connectionError.set(null);
    try {
      // status first: it makes the backend lazily activate the default file,
      // so the `active` flags in the list are correct.
      const status = await firstValueFrom(this.api.status());
      const configs = await firstValueFrom(this.api.kubeConfigs());
      if (epoch !== this.epoch) return;
      this.configs.set(configs);
      this.applyStatus(status);
    } catch (e) {
      if (epoch !== this.epoch) return;
      this.reachable.set(false);
      this.connectionError.set(apiErrorMessage(e));
    } finally {
      if (epoch === this.epoch) this.connecting.set(false);
    }
    if (epoch === this.epoch && this.reachable()) {
      await this.loadNamespaces();
      await this.loadTab(true);
    }
  }

  /** Switch kubeconfig file (and optionally context). Replaces the rename-to-`config` workflow. */
  async selectConfig(file: string, context?: string): Promise<void> {
    const epoch = ++this.epoch;
    this.selectedFile.set(file);
    this.resetResources();
    this.namespaces.set([]);
    this.connecting.set(true);
    this.connectionError.set(null);
    try {
      const active = await firstValueFrom(this.api.selectKubeConfig(file, context));
      if (epoch !== this.epoch) return;
      this.active.set(active);
      this.namespace.set(active.namespace);
      const [status, configs] = await Promise.all([
        firstValueFrom(this.api.status()),
        firstValueFrom(this.api.kubeConfigs()),
      ]);
      if (epoch !== this.epoch) return;
      this.configs.set(configs);
      this.applyStatus(status);
    } catch (e) {
      if (epoch !== this.epoch) return;
      this.reachable.set(false);
      this.connectionError.set(apiErrorMessage(e));
    } finally {
      if (epoch === this.epoch) this.connecting.set(false);
    }
    if (epoch === this.epoch && this.reachable()) {
      await this.loadNamespaces();
      await this.loadTab(true);
    }
  }

  private applyStatus(status: ClusterStatus): void {
    this.active.set(status.active);
    this.reachable.set(status.reachable);
    this.serverVersion.set(status.serverVersion ?? null);
    if (status.active) {
      this.selectedFile.set(status.active.file);
      if (!this.namespace()) this.namespace.set(status.active.namespace);
    }
    this.connectionError.set(
      status.reachable ? null : (status.error ?? 'Cluster not reachable'),
    );
  }

  // ============================================================ namespace / tab

  private async loadNamespaces(): Promise<void> {
    try {
      const res = await firstValueFrom(this.api.namespaces());
      this.namespaces.set(res.namespaces);
      this.namespaceListRestricted.set(res.listRestricted);
    } catch {
      // Not fatal: the namespace box is free-text.
      this.namespaces.set([]);
      this.namespaceListRestricted.set(true);
    }
  }

  async setNamespace(ns: string): Promise<void> {
    const value = ns.trim();
    if (!value || value === this.namespace()) return;
    this.namespace.set(value);
    this.resetResources();
    await this.loadTab(true);
  }

  async setTab(tab: KubeTab): Promise<void> {
    this.tab.set(tab);
    await this.loadTab(false);
  }

  private async loadTab(force: boolean): Promise<void> {
    const key = this.scopeKey();
    if (this.tab() === 'pods') {
      if (force || this.podsLoadedFor !== key) await this.loadPods();
    } else {
      if (force || this.secretsLoadedFor !== key) await this.loadSecrets();
    }
  }

  private scopeKey(): string {
    const a = this.active();
    return `${a?.file}|${a?.context}|${this.namespace()}`;
  }

  private resetResources(): void {
    this.pods.set([]);
    this.podsLoading.set(false);
    this.podsError.set(null);
    this.selectedPodName.set(null);
    this.container.set('');
    this.logsError.set(null);
    this.podsLoadedFor = null;

    this.secrets.set([]);
    this.secretsLoading.set(false);
    this.secretsError.set(null);
    this.secretsLoadedFor = null;
    this.clearSecretSelection();
  }

  // ============================================================ pods / logs

  async loadPods(): Promise<void> {
    const ns = this.namespace();
    if (!ns || !this.active()) return;
    const key = this.scopeKey();
    this.podsLoading.set(true);
    this.podsError.set(null);
    try {
      const pods = await firstValueFrom(this.api.pods(ns));
      if (key !== this.scopeKey()) return;
      this.pods.set(pods);
      this.podsLoadedFor = key;
      const sel = this.selectedPodName();
      if (sel && !pods.some(p => p.name === sel)) this.selectPod(null);
    } catch (e) {
      if (key !== this.scopeKey()) return;
      this.pods.set([]);
      this.podsError.set(apiErrorMessage(e));
    } finally {
      if (key === this.scopeKey()) this.podsLoading.set(false);
    }
  }

  selectPod(name: string | null): void {
    if (name === this.selectedPodName()) return;
    this.selectedPodName.set(name);
    this.container.set('');
    this.logsError.set(null);
  }

  setTailLines(value: number): void {
    this.tailLines.set(Number.isFinite(value) && value >= 0 ? Math.floor(value) : DEFAULT_TAIL);
  }

  /** Fetch logs for the selected pod with the current options. */
  async fetchLogs(): Promise<void> {
    const pod = this.selectedPod();
    const ns = this.namespace();
    if (!pod || !ns) return;
    await this.runLogRequest({
      namespace: ns,
      pod: pod.name,
      container: this.container() || undefined,
      previous: this.previous(),
    });
  }

  /** Re-run the last log request (viewer top bar) with the current tail value. */
  async refreshLogs(): Promise<void> {
    const last = this.lastLogRequest();
    if (last) await this.runLogRequest(last);
  }

  private async runLogRequest(
    req: Pick<LogRequest, 'namespace' | 'pod' | 'container' | 'previous'>,
  ): Promise<void> {
    const tail = this.tailLines();
    this.logsLoading.set(true);
    this.logsError.set(null);
    try {
      const text = await firstValueFrom(
        this.api.podLogs(req.namespace, req.pod, {
          container: req.container,
          tailLines: tail,
          previous: req.previous || undefined,
        }),
      );
      if (!text.trim()) {
        // [F4] an empty load would leave the shell on the input screen with no feedback
        this.logsError.set(`No log lines returned for ${req.pod}.`);
        return;
      }
      const sourceName =
        `${req.namespace}/${req.pod}` +
        (req.container ? ` [${req.container}]` : '') +
        (req.previous ? ' (previous)' : '') +
        ` · tail ${tail === 0 ? 'all' : tail}`;
      this.lastLogRequest.set({ ...req, tailLines: tail, sourceName });
      this.logStore.load(text, sourceName); // same path as paste / file drop
    } catch (e) {
      this.logsError.set(apiErrorMessage(e));
    } finally {
      this.logsLoading.set(false);
    }
  }

  // ============================================================ secrets

  async loadSecrets(): Promise<void> {
    const ns = this.namespace();
    if (!ns || !this.active()) return;
    const key = this.scopeKey();
    this.secretsLoading.set(true);
    this.secretsError.set(null);
    try {
      const secrets = await firstValueFrom(this.api.secrets(ns));
      if (key !== this.scopeKey()) return;
      this.secrets.set(secrets);
      this.secretsLoadedFor = key;
      const sel = this.selectedSecretName();
      if (sel && !secrets.some(s => s.name === sel)) this.clearSecretSelection();
    } catch (e) {
      if (key !== this.scopeKey()) return;
      this.secrets.set([]);
      this.secretsError.set(apiErrorMessage(e));
    } finally {
      if (key === this.scopeKey()) this.secretsLoading.set(false);
    }
  }

  /** Loads one secret's keys (values masked). */
  async openSecret(name: string): Promise<void> {
    const ns = this.namespace();
    this.selectedSecretName.set(name);
    this.secretDetail.set(null);
    this.revealed.set({});
    this.secretError.set(null);
    this.secretLoading.set(true);
    try {
      const detail = await firstValueFrom(this.api.secret(ns, name, false));
      if (this.selectedSecretName() !== name) return;
      this.secretDetail.set(detail);
    } catch (e) {
      if (this.selectedSecretName() === name) this.secretError.set(apiErrorMessage(e));
    } finally {
      if (this.selectedSecretName() === name) this.secretLoading.set(false);
    }
  }

  /** Fetches and decodes one entry. */
  async revealEntry(key: string): Promise<void> {
    const ns = this.namespace();
    const name = this.selectedSecretName();
    if (!name) return;
    this.secretError.set(null);
    try {
      const entry = await firstValueFrom(this.api.secretEntry(ns, name, key));
      if (this.selectedSecretName() !== name) return;
      this.revealed.update(r => ({ ...r, [key]: entry }));
    } catch (e) {
      this.secretError.set(apiErrorMessage(e));
    }
  }

  hideEntry(key: string): void {
    this.revealed.update(r => {
      const { [key]: _removed, ...rest } = r;
      return rest;
    });
  }

  async revealAll(): Promise<void> {
    const ns = this.namespace();
    const name = this.selectedSecretName();
    if (!name) return;
    this.secretError.set(null);
    try {
      const detail = await firstValueFrom(this.api.secret(ns, name, true));
      if (this.selectedSecretName() !== name) return;
      this.revealed.set(Object.fromEntries(detail.entries.map(e => [e.key, e])));
    } catch (e) {
      this.secretError.set(apiErrorMessage(e));
    }
  }

  hideAll(): void {
    this.revealed.set({});
  }

  private clearSecretSelection(): void {
    this.selectedSecretName.set(null);
    this.secretDetail.set(null);
    this.secretLoading.set(false);
    this.secretError.set(null);
    this.revealed.set({});
  }
}
