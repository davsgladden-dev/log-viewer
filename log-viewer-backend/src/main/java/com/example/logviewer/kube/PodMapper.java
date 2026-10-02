package com.example.logviewer.kube;

import com.example.logviewer.model.ContainerSummary;
import com.example.logviewer.model.PodSummary;
import io.fabric8.kubernetes.api.model.Container;
import io.fabric8.kubernetes.api.model.ContainerState;
import io.fabric8.kubernetes.api.model.ContainerStatus;
import io.fabric8.kubernetes.api.model.ObjectMeta;
import io.fabric8.kubernetes.api.model.Pod;
import io.fabric8.kubernetes.api.model.PodSpec;
import io.fabric8.kubernetes.api.model.PodStatus;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/** Converts Fabric8 Pod objects into the flat summary the UI needs (roughly `kubectl get pods`). */
final class PodMapper {

  private PodMapper() {}

  static PodSummary toSummary(Pod pod, Instant now) {
    ObjectMeta md = pod.getMetadata();
    PodSpec spec = pod.getSpec();
    PodStatus status = pod.getStatus() != null ? pod.getStatus() : new PodStatus();

    List<ContainerStatus> cs = status.getContainerStatuses() != null ? status.getContainerStatuses() : List.of();
    List<ContainerStatus> ics = status.getInitContainerStatuses() != null ? status.getInitContainerStatuses() : List.of();
    Map<String, ContainerStatus> byName = cs.stream().collect(Collectors.toMap(ContainerStatus::getName, Function.identity(), (a, b) -> a));
    Map<String, ContainerStatus> initByName = ics.stream().collect(Collectors.toMap(ContainerStatus::getName, Function.identity(), (a, b) -> a));

    int total = spec.getContainers().size();
    long readyCount = cs.stream().filter(c -> Boolean.TRUE.equals(c.getReady())).count();
    int restarts = cs.stream().mapToInt(c -> c.getRestartCount() == null ? 0 : c.getRestartCount()).sum();

    List<ContainerSummary> containers = new ArrayList<>();
    if (spec.getInitContainers() != null) {
      for (Container c : spec.getInitContainers()) {
        containers.add(toContainerSummary(c, initByName.get(c.getName()), true));
      }
    }
    for (Container c : spec.getContainers()) {
      containers.add(toContainerSummary(c, byName.get(c.getName()), false));
    }

    Instant created = parseInstant(md.getCreationTimestamp());
    return new PodSummary(
      md.getName(),
      md.getNamespace(),
      status.getPhase(),
      displayStatus(md, spec, status, cs, ics),
      readyCount + "/" + total,
      restarts,
      spec.getNodeName(),
      created,
      created != null ? formatAge(created, now) : null,
      containers,
      md.getLabels());
  }

  private static ContainerSummary toContainerSummary(Container c, ContainerStatus st, boolean init) {
    return new ContainerSummary(
      c.getName(),
      c.getImage(),
      st != null && Boolean.TRUE.equals(st.getReady()),
      st == null || st.getRestartCount() == null ? 0 : st.getRestartCount(),
      st == null ? "Unknown" : describeState(st.getState()),
      init);
  }

  private static String describeState(ContainerState state) {
    if (state == null) {
      return "Unknown";
    }
    if (state.getRunning() != null) {
      return "Running";
    }
    if (state.getWaiting() != null) {
      return "Waiting" + (state.getWaiting().getReason() != null ? ": " + state.getWaiting().getReason() : "");
    }
    if (state.getTerminated() != null) {
      var t = state.getTerminated();
      String reason = t.getReason() != null ? t.getReason() : "Terminated";
      return "Terminated: " + reason + (t.getExitCode() != null ? " (exit " + t.getExitCode() + ")" : "");
    }
    return "Unknown";
  }

  /** Simplified port of kubectl's pod status column logic. */
  static String displayStatus(ObjectMeta md, PodSpec spec, PodStatus status,
                              List<ContainerStatus> cs, List<ContainerStatus> ics) {
    if (md.getDeletionTimestamp() != null) {
      return "Terminating";
    }
    if (status.getReason() != null && !status.getReason().isBlank()) {
      return status.getReason(); // e.g. Evicted
    }
    int initCount = spec.getInitContainers() == null ? 0 : spec.getInitContainers().size();
    for (int i = 0; i < ics.size(); i++) {
      ContainerState s = ics.get(i).getState();
      if (s == null) {
        continue;
      }
      if (s.getTerminated() != null && Integer.valueOf(0).equals(s.getTerminated().getExitCode())) {
        continue; // init container finished OK
      }
      if (s.getTerminated() != null) {
        var t = s.getTerminated();
        return "Init:" + (t.getReason() != null ? t.getReason() : "ExitCode:" + t.getExitCode());
      }
      if (s.getWaiting() != null && s.getWaiting().getReason() != null
        && !"PodInitializing".equals(s.getWaiting().getReason())) {
        return "Init:" + s.getWaiting().getReason();
      }
      return "Init:" + i + "/" + initCount;
    }
    for (int i = cs.size() - 1; i >= 0; i--) {
      ContainerState s = cs.get(i).getState();
      if (s == null) {
        continue;
      }
      if (s.getWaiting() != null && s.getWaiting().getReason() != null) {
        return s.getWaiting().getReason(); // CrashLoopBackOff, ImagePullBackOff, ...
      }
      if (s.getTerminated() != null) {
        var t = s.getTerminated();
        if (t.getReason() != null) {
          return t.getReason(); // Completed, Error, OOMKilled
        }
        return t.getSignal() != null ? "Signal:" + t.getSignal() : "ExitCode:" + t.getExitCode();
      }
    }
    return status.getPhase() != null ? status.getPhase() : "Unknown";
  }

  static Instant parseInstant(String ts) {
    if (ts == null || ts.isBlank()) {
      return null;
    }
    try {
      return Instant.parse(ts);
    } catch (Exception e) {
      return null;
    }
  }

  /** kubectl-like age: 45s, 12m, 3h12m, 5d3h. */
  static String formatAge(Instant created, Instant now) {
    Duration d = Duration.between(created, now);
    long s = Math.max(0, d.getSeconds());
    if (s < 60) {
      return s + "s";
    }
    long m = s / 60;
    if (m < 60) {
      return m + "m";
    }
    long h = m / 60;
    if (h < 24) {
      return h + "h" + (m % 60 > 0 ? (m % 60) + "m" : "");
    }
    long days = h / 24;
    return days + "d" + (h % 24 > 0 ? (h % 24) + "h" : "");
  }
}
