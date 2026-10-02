package com.example.logviewer.config;

import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

@ConfigurationProperties(prefix = "logviewer")
public record LogViewerProperties(
  @DefaultValue Kube kube,
  @DefaultValue Logs logs,
  @DefaultValue Cors cors) {

  public record Kube(
    String directory,
    @DefaultValue("config") String defaultFile,
    @DefaultValue("^config([-.].*)?$") String filePattern,
    @DefaultValue("30000") int requestTimeoutMs) {

    /** Resolves the kubeconfig directory, defaulting to {user.home}/.kube. */
    public Path resolvedDirectory() {
      String dir = (directory == null || directory.isBlank())
        ? Paths.get(System.getProperty("user.home"), ".kube").toString()
        : directory;
      return Paths.get(dir).toAbsolutePath().normalize();
    }
  }

  public record Logs(
    @DefaultValue("500") int defaultTailLines,
    @DefaultValue("50000") int maxTailLines) {
  }

  public record Cors(
    @DefaultValue({"http://localhost:4200", "http://127.0.0.1:4200"}) List<String> allowedOrigins) {
  }
}
