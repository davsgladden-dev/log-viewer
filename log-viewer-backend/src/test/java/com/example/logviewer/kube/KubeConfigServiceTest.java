package com.example.logviewer.kube;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.example.logviewer.config.LogViewerProperties;
import com.example.logviewer.model.ActiveKubeConfig;
import com.example.logviewer.model.KubeConfigFile;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.http.HttpStatus;

class KubeConfigServiceTest {

  @TempDir
  Path kubeDir;

  KubeConfigService service;

  @BeforeEach
  void setUp() throws IOException {
    Files.writeString(kubeDir.resolve("config"), kubeconfig("prod", "prod-cluster", "https://prod.example.com:6443", "team-prod"));
    Files.writeString(kubeDir.resolve("config-dev"), kubeconfig("dev", "dev-cluster", "https://dev.example.com:6443", "team-dev"));
    Files.writeString(kubeDir.resolve("notes.txt"), "not a kubeconfig");
    Files.createDirectory(kubeDir.resolve("cache"));

    var props = new LogViewerProperties(
      new LogViewerProperties.Kube(kubeDir.toString(), "config", "^config([-.].*)?$", 5000),
      new LogViewerProperties.Logs(500, 50000),
      new LogViewerProperties.Cors(List.of()));
    service = new KubeConfigService(props);
  }

  @AfterEach
  void tearDown() {
    service.shutdown();
  }

  @Test
  void listsOnlyMatchingFilesWithContexts() {
    List<KubeConfigFile> files = service.listConfigFiles();

    assertThat(files).extracting(KubeConfigFile::name).containsExactly("config", "config-dev");
    KubeConfigFile dev = files.get(1);
    assertThat(dev.currentContext()).isEqualTo("dev");
    assertThat(dev.contexts()).hasSize(1);
    assertThat(dev.contexts().get(0).server()).isEqualTo("https://dev.example.com:6443");
    assertThat(dev.contexts().get(0).namespace()).isEqualTo("team-dev");
    assertThat(dev.error()).isNull();
  }

  @Test
  void defaultFileIsUsedUntilSelected() {
    ActiveKubeConfig active = service.active();
    assertThat(active.file()).isEqualTo("config");
    assertThat(active.context()).isEqualTo("prod");
    assertThat(active.namespace()).isEqualTo("team-prod");
  }

  @Test
  void selectSwitchesFileAndMarksItActive() {
    ActiveKubeConfig active = service.select("config-dev", null);

    assertThat(active.file()).isEqualTo("config-dev");
    assertThat(active.context()).isEqualTo("dev");
    assertThat(active.server()).isEqualTo("https://dev.example.com:6443");
    assertThat(service.client().getConfiguration().getMasterUrl()).startsWith("https://dev.example.com:6443");
    assertThat(service.listConfigFiles()).filteredOn(KubeConfigFile::active)
      .extracting(KubeConfigFile::name).containsExactly("config-dev");
  }

  @Test
  void rejectsUnknownContextAndBadFileNames() {
    assertThatThrownBy(() -> service.select("config-dev", "nope"))
      .isInstanceOf(KubeConfigException.class)
      .extracting(e -> ((KubeConfigException) e).getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
    assertThatThrownBy(() -> service.select("../config", null))
      .isInstanceOf(KubeConfigException.class);
    assertThatThrownBy(() -> service.select("config-missing", null))
      .isInstanceOf(KubeConfigException.class)
      .extracting(e -> ((KubeConfigException) e).getStatus()).isEqualTo(HttpStatus.NOT_FOUND);
  }

  private static String kubeconfig(String ctx, String cluster, String server, String ns) {
    return """
        apiVersion: v1
        kind: Config
        current-context: %s
        clusters:
        - name: %s
          cluster:
            server: %s
            insecure-skip-tls-verify: true
        contexts:
        - name: %s
          context:
            cluster: %s
            user: %s-user
            namespace: %s
        users:
        - name: %s-user
          user:
            token: dummy-token
        """.formatted(ctx, cluster, server, ctx, cluster, ctx, ns, ctx);
  }
}
