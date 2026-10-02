package com.example.logviewer.kube;

import com.example.logviewer.config.LogViewerProperties;
import com.example.logviewer.model.ActiveKubeConfig;
import com.example.logviewer.model.KubeConfigFile;
import com.example.logviewer.model.KubeContext;
import io.fabric8.kubernetes.api.model.NamedCluster;
import io.fabric8.kubernetes.api.model.NamedContext;
import io.fabric8.kubernetes.client.Config;
import io.fabric8.kubernetes.client.KubernetesClient;
import io.fabric8.kubernetes.client.KubernetesClientBuilder;
import io.fabric8.kubernetes.client.utils.Serialization;
import jakarta.annotation.PreDestroy;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.regex.Pattern;
import java.util.stream.Stream;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

/**
 * Finds kubeconfig files in the .kube directory, tracks which one is active and
 * owns the {@link KubernetesClient} built from it.
 *
 * Selection is in-memory only: on restart the default file is used again. [A3]
 */
@Service
public class KubeConfigService {

  private static final Logger log = LoggerFactory.getLogger(KubeConfigService.class);

  private final LogViewerProperties.Kube kubeProps;
  private final Path kubeDir;
  private final Pattern filePattern;

  private final Object lock = new Object();
  private volatile ActiveClient active;

  private record ActiveClient(String file, String context, String namespace, String server,
                              KubernetesClient client) {}

  public KubeConfigService(LogViewerProperties props) {
    this.kubeProps = props.kube();
    this.kubeDir = kubeProps.resolvedDirectory();
    this.filePattern = Pattern.compile(kubeProps.filePattern());
    log.info("K8s config directory: {} (file pattern '{}', default file '{}')",
      kubeDir, kubeProps.filePattern(), kubeProps.defaultFile());
  }

  public Path kubeDirectory() {
    return kubeDir;
  }

  // ---------------------------------------------------------------- discovery

  /** All candidate kubeconfig files in the directory, with their contexts. */
  public List<KubeConfigFile> listConfigFiles() {
    if (!Files.isDirectory(kubeDir)) {
      throw new KubeConfigException(HttpStatus.NOT_FOUND,
        "Kubeconfig directory not found: " + kubeDir);
    }
    try (Stream<Path> files = Files.list(kubeDir)) {
      return files
        .filter(Files::isRegularFile)
        .filter(p -> filePattern.matcher(p.getFileName().toString()).matches())
        .sorted(Comparator.comparing(p -> p.getFileName().toString()))
        .map(this::describe)
        .toList();
    } catch (IOException e) {
      throw new KubeConfigException(HttpStatus.INTERNAL_SERVER_ERROR,
        "Could not read kubeconfig directory " + kubeDir, e);
    }
  }

  private KubeConfigFile describe(Path path) {
    String name = path.getFileName().toString();
    ActiveClient current = active;
    boolean isActive = current != null && current.file().equals(name);
    try {
      io.fabric8.kubernetes.api.model.Config model = parseModel(path);
      List<KubeContext> contexts = model.getContexts() == null ? List.of()
        : model.getContexts().stream().map(nc -> toKubeContext(model, nc)).toList();
      return new KubeConfigFile(name, path.toString(), model.getCurrentContext(), contexts, isActive, null);
    } catch (Exception e) {
      log.warn("Could not parse kubeconfig {}: {}", path, e.getMessage());
      return new KubeConfigFile(name, path.toString(), null, List.of(), isActive,
        "Could not parse file: " + e.getMessage());
    }
  }

  // ---------------------------------------------------------------- selection

  /**
   * Switches to the given file (and optionally context). A null/blank file means
   * the configured default file; a null/blank context means the file's current-context.
   */
  public ActiveKubeConfig select(String file, String context) {
    String fileName = (file == null || file.isBlank()) ? kubeProps.defaultFile() : file.trim();
    Path path = resolveConfigPath(fileName);

    io.fabric8.kubernetes.api.model.Config model;
    try {
      model = parseModel(path);
    } catch (Exception e) {
      throw new KubeConfigException(HttpStatus.BAD_REQUEST,
        "Kubeconfig '" + fileName + "' could not be parsed: " + e.getMessage(), e);
    }

    String effectiveContext = (context == null || context.isBlank()) ? model.getCurrentContext() : context.trim();
    if (effectiveContext == null || effectiveContext.isBlank()) {
      throw new KubeConfigException(HttpStatus.BAD_REQUEST,
        "Kubeconfig '" + fileName + "' has no current-context; choose a context explicitly");
    }
    NamedContext named = findContext(model, effectiveContext).orElseThrow(() ->
      new KubeConfigException(HttpStatus.BAD_REQUEST,
        "Context '" + effectiveContext + "' not found in kubeconfig '" + fileName + "'"));

    String namespace = named.getContext() != null && named.getContext().getNamespace() != null
      && !named.getContext().getNamespace().isBlank()
      ? named.getContext().getNamespace() : "default";
    String server = named.getContext() != null ? serverFor(model, named.getContext().getCluster()) : null;

    synchronized (lock) {
      KubernetesClient client = buildClient(path, effectiveContext);
      ActiveClient previous = active;
      active = new ActiveClient(fileName, effectiveContext, namespace, server, client);
      closeQuietly(previous);
      log.info("Active kubeconfig: file='{}' context='{}' namespace='{}' server='{}'",
        fileName, effectiveContext, namespace, server);
      return active();
    }
  }

  /** Re-reads the active file (picks up refreshed tokens, etc.). */
  public ActiveKubeConfig reload() {
    synchronized (lock) {
      ActiveClient a = active;
      return a == null ? select(null, null) : select(a.file(), a.context());
    }
  }

  public ActiveKubeConfig active() {
    ActiveClient a = ensureActive();
    return new ActiveKubeConfig(a.file(), a.context(), a.namespace(), a.server(), kubeDir.toString());
  }

  public String activeNamespace() {
    return ensureActive().namespace();
  }

  /** The client for the active kubeconfig. Lazily initialised with the default file. */
  public KubernetesClient client() {
    return ensureActive().client();
  }

  private ActiveClient ensureActive() {
    ActiveClient a = active;
    if (a != null) {
      return a;
    }
    synchronized (lock) {
      if (active == null) {
        select(null, null);
      }
      return active;
    }
  }

  @PreDestroy
  public void shutdown() {
    synchronized (lock) {
      closeQuietly(active);
      active = null;
    }
  }

  // ---------------------------------------------------------------- helpers

  private KubernetesClient buildClient(Path path, String context) {
    try {
      String contents = Files.readString(path);
      // Passing the path lets Fabric8 resolve relative cert paths / exec plugins relative to the file.
      Config config = Config.fromKubeconfig(context, contents, path.toString());
      config.setRequestTimeout(kubeProps.requestTimeoutMs());
      return new KubernetesClientBuilder().withConfig(config).build();
    } catch (IOException e) {
      throw new KubeConfigException(HttpStatus.INTERNAL_SERVER_ERROR,
        "Could not read kubeconfig " + path, e);
    } catch (KubeConfigException e) {
      throw e;
    } catch (Exception e) {
      throw new KubeConfigException(HttpStatus.BAD_REQUEST,
        "Could not load kubeconfig '" + path.getFileName() + "': " + e.getMessage(), e);
    }
  }

  private Path resolveConfigPath(String fileName) {
    if (fileName.contains("/") || fileName.contains("\\") || fileName.contains("..")) {
      throw new KubeConfigException(HttpStatus.BAD_REQUEST, "Invalid kubeconfig file name: " + fileName);
    }
    Path path = kubeDir.resolve(fileName).normalize();
    if (!path.startsWith(kubeDir) || !Files.isRegularFile(path)) {
      throw new KubeConfigException(HttpStatus.NOT_FOUND, "Kubeconfig file not found: " + path);
    }
    return path;
  }

  private static io.fabric8.kubernetes.api.model.Config parseModel(Path path) throws IOException {
    try (InputStream in = Files.newInputStream(path)) {
      io.fabric8.kubernetes.api.model.Config model =
        Serialization.unmarshal(in, io.fabric8.kubernetes.api.model.Config.class);
      if (model == null) {
        throw new IOException("empty file");
      }
      return model;
    }
  }

  private static Optional<NamedContext> findContext(io.fabric8.kubernetes.api.model.Config model, String name) {
    if (model.getContexts() == null) {
      return Optional.empty();
    }
    return model.getContexts().stream().filter(c -> name.equals(c.getName())).findFirst();
  }

  private static String serverFor(io.fabric8.kubernetes.api.model.Config model, String clusterName) {
    if (model.getClusters() == null || clusterName == null) {
      return null;
    }
    return model.getClusters().stream()
      .filter(c -> clusterName.equals(c.getName()))
      .map(NamedCluster::getCluster)
      .filter(c -> c != null)
      .map(c -> c.getServer())
      .findFirst()
      .orElse(null);
  }

  private static KubeContext toKubeContext(io.fabric8.kubernetes.api.model.Config model, NamedContext nc) {
    var ctx = nc.getContext();
    String cluster = ctx != null ? ctx.getCluster() : null;
    return new KubeContext(
      nc.getName(),
      cluster,
      serverFor(model, cluster),
      ctx != null ? ctx.getNamespace() : null,
      ctx != null ? ctx.getUser() : null);
  }

  private static void closeQuietly(ActiveClient a) {
    if (a != null && a.client() != null) {
      try {
        a.client().close();
      } catch (Exception e) {
        log.debug("Error closing previous client", e);
      }
    }
  }
}
