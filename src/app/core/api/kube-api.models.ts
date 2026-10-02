export interface KubeContext {
  name: string;
  cluster: string | null;
  server: string | null;
  namespace: string | null;
  user: string | null;
}

export interface KubeConfigFile {
  name: string;
  path: string;
  currentContext: string | null;
  contexts: KubeContext[];
  active: boolean;
  error?: string;
}

export interface ActiveKubeConfig {
  file: string;
  context: string;
  namespace: string;
  server: string | null;
  directory: string;
}

export interface ClusterStatus {
  active: ActiveKubeConfig | null;
  reachable: boolean;
  serverVersion?: string;
  error?: string;
  kubeDirectory: string;
}

export interface NamespaceList {
  namespaces: string[];
  listRestricted: boolean;
}

export interface ContainerSummary {
  name: string;
  image: string;
  ready: boolean;
  restartCount: number;
  state: string;
  initContainer: boolean;
}

export interface PodSummary {
  name: string;
  namespace: string;
  phase: string;
  status: string;
  ready: string;
  restarts: number;
  node: string | null;
  createdAt: string | null;
  age: string | null;
  containers: ContainerSummary[];
  labels?: Record<string, string>;
}

export interface LogQuery {
  container?: string;
  tailLines?: number;
  previous?: boolean;
  sinceSeconds?: number;
  timestamps?: boolean;
  limitBytes?: number;
}

export interface SecretSummary {
  name: string;
  namespace: string;
  type: string;
  keys: string[];
  createdAt: string | null;
}

export interface SecretEntry {
  key: string;
  value: string | null;
  decoded: boolean;
  binary: boolean;
  sizeBytes: number;
}

export interface SecretDetail {
  name: string;
  namespace: string;
  type: string;
  revealed: boolean;
  entries: SecretEntry[];
  createdAt: string | null;
  labels?: Record<string, string>;
}

export interface ApiError {
  status: number;
  error: string;
  message: string;
  details?: string;
  path: string;
  timestamp: string;
}
