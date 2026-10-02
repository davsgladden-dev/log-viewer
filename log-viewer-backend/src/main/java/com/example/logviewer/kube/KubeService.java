package com.example.logviewer.kube;

import com.example.logviewer.config.LogViewerProperties;
import com.example.logviewer.model.ActiveKubeConfig;
import com.example.logviewer.model.ClusterStatus;
import com.example.logviewer.model.LogQuery;
import com.example.logviewer.model.LogResult;
import com.example.logviewer.model.NamespaceList;
import com.example.logviewer.model.PodSummary;
import com.example.logviewer.model.SecretDetail;
import com.example.logviewer.model.SecretEntry;
import com.example.logviewer.model.SecretSummary;
import io.fabric8.kubernetes.api.model.Container;
import io.fabric8.kubernetes.api.model.Pod;
import io.fabric8.kubernetes.api.model.PodList;
import io.fabric8.kubernetes.api.model.Secret;
import io.fabric8.kubernetes.client.KubernetesClient;
import io.fabric8.kubernetes.client.KubernetesClientException;
import io.fabric8.kubernetes.client.VersionInfo;
import io.fabric8.kubernetes.client.dsl.BytesLimitTerminateTimeTailPrettyLoggable;
import io.fabric8.kubernetes.client.dsl.PodResource;
import io.fabric8.kubernetes.client.dsl.PrettyLoggable;
import io.fabric8.kubernetes.client.dsl.TailPrettyLoggable;
import io.fabric8.kubernetes.client.dsl.TimeTailPrettyLoggable;
import io.fabric8.kubernetes.client.dsl.TimestampBytesLimitTerminateTimeTailPrettyLoggable;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.stream.Stream;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class KubeService {

  private static final Logger log = LoggerFactory.getLogger(KubeService.class);
  private static final String DEFAULT_CONTAINER_ANNOTATION = "kubectl.kubernetes.io/default-container";

  private final KubeConfigService configs;
  private final LogViewerProperties.Logs logProps;

  public KubeService(KubeConfigService configs, LogViewerProperties props) {
    this.configs = configs;
    this.logProps = props.logs();
  }

  // ---------------------------------------------------------------- status

  public ClusterStatus status() {
    ActiveKubeConfig active;
    try {
      active = configs.active();
    } catch (KubeConfigException e) {
      return new ClusterStatus(null, false, null, e.getMessage(), configs.kubeDirectory().toString());
    }
    try {
      VersionInfo v = configs.client().getKubernetesVersion();
      String version = v != null ? v.getGitVersion() : null;
      return new ClusterStatus(active, true, version, null, configs.kubeDirectory().toString());
    } catch (Exception e) {
      log.warn("Cluster not reachable via {}/{}: {}", active.file(), active.context(), rootMessage(e));
      return new ClusterStatus(active, false, null, rootMessage(e), configs.kubeDirectory().toString());
    }
  }

  // ---------------------------------------------------------------- namespaces

  public NamespaceList listNamespaces() {
    try {
      List<String> names = configs.client().namespaces().list().getItems().stream()
        .map(n -> n.getMetadata().getName())
        .sorted()
        .toList();
      return new NamespaceList(names, false);
    } catch (KubernetesClientException e) {
      if (e.getCode() == 403) {
        // [A8] RBAC often forbids listing namespaces; fall back to the context's namespace.
        return new NamespaceList(List.of(configs.activeNamespace()), true);
      }
      throw e;
    }
  }

  // ---------------------------------------------------------------- pods

  public List<PodSummary> listPods(String namespace, String labelSelector) {
    KubernetesClient client = configs.client();
    var op = client.pods().inNamespace(namespace);
    PodList list = (labelSelector == null || labelSelector.isBlank())
      ? op.list()
      : op.withLabelSelector(labelSelector.trim()).list();
    Instant now = Instant.now();
    return list.getItems().stream()
      .map(p -> PodMapper.toSummary(p, now))
      .sorted(Comparator.comparing(PodSummary::name))
      .toList();
  }

  public PodSummary getPod(String namespace, String name) {
    return PodMapper.toSummary(requirePod(namespace, name), Instant.now());
  }

  /** Equivalent of: kubectl logs -n ns pod [-c container] --tail N [-p] [--since=..] [--timestamps]. */
  public LogResult getPodLogs(String namespace, String podName, LogQuery query) {
    Pod pod = requirePod(namespace, podName);
    String container = resolveContainer(pod, query.container());

    int tail = query.tailLines() == null ? logProps.defaultTailLines() : query.tailLines();
    if (tail > logProps.maxTailLines()) {
      tail = logProps.maxTailLines();
    }
    // tail <= 0 means "all lines" (like kubectl --tail=-1)

    PodResource podResource = configs.client().pods().inNamespace(namespace).withName(podName);
    TimestampBytesLimitTerminateTimeTailPrettyLoggable base = podResource.inContainer(container);

    BytesLimitTerminateTimeTailPrettyLoggable l1 = query.timestamps() ? base.usingTimestamps() : base;
    if (query.limitBytes() != null && query.limitBytes() > 0) {
      // Interface narrows the return type; PodOperationsImpl.limitBytes() returns BytesLimitTerminateTimeTailPrettyLoggable.
      l1 = (BytesLimitTerminateTimeTailPrettyLoggable) l1.limitBytes(query.limitBytes());
    }
    TimeTailPrettyLoggable l3 = query.previous() ? l1.terminated() : l1;
    TailPrettyLoggable l4 = (query.sinceSeconds() != null && query.sinceSeconds() > 0)
      ? l3.sinceSeconds(query.sinceSeconds()) : l3;
    PrettyLoggable l5 = tail > 0 ? l4.tailingLines(tail) : l4;

    String text = l5.getLog();
    if (text == null) {
      text = "";
    }
    int lines = text.isEmpty() ? 0 : (int) text.lines().count();
    log.debug("Fetched {} log lines from {}/{} [{}] tail={} previous={}",
      lines, namespace, podName, container, tail, query.previous());
    return new LogResult(text, podName, container, tail, query.previous(), lines);
  }

  // ---------------------------------------------------------------- secrets

  public List<SecretSummary> listSecrets(String namespace) {
    return configs.client().secrets().inNamespace(namespace).list().getItems().stream()
      .map(s -> new SecretSummary(
        s.getMetadata().getName(),
        s.getMetadata().getNamespace(),
        s.getType(),
        sortedKeys(s),
        PodMapper.parseInstant(s.getMetadata().getCreationTimestamp())))
      .sorted(Comparator.comparing(SecretSummary::name))
      .toList();
  }

  public SecretDetail getSecret(String namespace, String name, boolean reveal) {
    Secret s = requireSecret(namespace, name);
    List<SecretEntry> entries = new ArrayList<>();
    for (Map.Entry<String, String> e : dataOf(s).entrySet()) {
      entries.add(toEntry(e.getKey(), e.getValue(), reveal));
    }
    return new SecretDetail(
      s.getMetadata().getName(),
      s.getMetadata().getNamespace(),
      s.getType(),
      reveal,
      entries,
      PodMapper.parseInstant(s.getMetadata().getCreationTimestamp()),
      s.getMetadata().getLabels());
  }

  public SecretEntry getSecretEntry(String namespace, String name, String key, boolean decode) {
    Secret s = requireSecret(namespace, name);
    String raw = dataOf(s).get(key);
    if (raw == null) {
      throw new ResourceNotFoundException(
        "Key '" + key + "' not found in secret " + namespace + "/" + name + " (keys: " + sortedKeys(s) + ")");
    }
    if (!decode) {
      return new SecretEntry(key, raw, false, false, raw.length());
    }
    return toEntry(key, raw, true);
  }

  // ---------------------------------------------------------------- helpers

  private Pod requirePod(String namespace, String name) {
    Pod pod = configs.client().pods().inNamespace(namespace).withName(name).get();
    if (pod == null) {
      throw new ResourceNotFoundException("Pod " + namespace + "/" + name + " not found");
    }
    return pod;
  }

  private Secret requireSecret(String namespace, String name) {
    Secret s = configs.client().secrets().inNamespace(namespace).withName(name).get();
    if (s == null) {
      throw new ResourceNotFoundException("Secret " + namespace + "/" + name + " not found");
    }
    return s;
  }

  /**
   * Mirrors kubectl: explicit -c wins; otherwise the default-container annotation;
   * otherwise the first container. [A9]
   */
  private static String resolveContainer(Pod pod, String requested) {
    List<String> names = Stream.concat(
        pod.getSpec().getContainers().stream(),
        pod.getSpec().getInitContainers() == null ? Stream.<Container>empty()
          : pod.getSpec().getInitContainers().stream())
      .map(Container::getName)
      .toList();

    if (requested != null && !requested.isBlank()) {
      if (!names.contains(requested)) {
        throw new ResourceNotFoundException("Container '" + requested + "' not found in pod "
          + pod.getMetadata().getName() + " (containers: " + names + ")");
      }
      return requested;
    }
    Map<String, String> annotations = pod.getMetadata().getAnnotations();
    if (annotations != null) {
      String def = annotations.get(DEFAULT_CONTAINER_ANNOTATION);
      if (def != null && names.contains(def)) {
        return def;
      }
    }
    return pod.getSpec().getContainers().get(0).getName();
  }

  private static Map<String, String> dataOf(Secret s) {
    Map<String, String> data = new TreeMap<>();
    if (s.getData() != null) {
      data.putAll(s.getData());
    }
    // stringData is normally only present on write, but be defensive.
    if (s.getStringData() != null) {
      s.getStringData().forEach((k, v) -> data.put(k, SecretCodec.encode(v)));
    }
    return data;
  }

  private static List<String> sortedKeys(Secret s) {
    return new ArrayList<>(dataOf(s).keySet());
  }

  private static SecretEntry toEntry(String key, String base64, boolean reveal) {
    SecretCodec.Decoded d = SecretCodec.decode(base64);
    if (!reveal) {
      return new SecretEntry(key, null, false, d.binary(), d.sizeBytes());
    }
    return new SecretEntry(key, d.value(), true, d.binary(), d.sizeBytes());
  }

  static String rootMessage(Throwable t) {
    Throwable cur = t;
    while (cur.getCause() != null && cur.getCause() != cur) {
      cur = cur.getCause();
    }
    return cur.getMessage() != null ? cur.getMessage() : cur.getClass().getSimpleName();
  }
}
