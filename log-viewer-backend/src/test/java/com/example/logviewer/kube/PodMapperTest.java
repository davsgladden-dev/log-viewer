package com.example.logviewer.kube;

import static org.assertj.core.api.Assertions.assertThat;

import com.example.logviewer.model.PodSummary;
import io.fabric8.kubernetes.api.model.Pod;
import io.fabric8.kubernetes.api.model.PodBuilder;
import java.time.Instant;
import org.junit.jupiter.api.Test;

class PodMapperTest {

  @Test
  void mapsRunningPod() {
    Pod pod = new PodBuilder()
      .withNewMetadata().withName("api-1").withNamespace("team").withCreationTimestamp("2024-01-01T00:00:00Z").endMetadata()
      .withNewSpec().withNodeName("node-a")
      .addNewContainer().withName("app").withImage("app:1").endContainer()
      .endSpec()
      .withNewStatus().withPhase("Running")
      .addNewContainerStatus().withName("app").withReady(true).withRestartCount(2)
      .withNewState().withNewRunning().endRunning().endState()
      .endContainerStatus()
      .endStatus()
      .build();

    PodSummary s = PodMapper.toSummary(pod, Instant.parse("2024-01-01T03:12:30Z"));

    assertThat(s.status()).isEqualTo("Running");
    assertThat(s.ready()).isEqualTo("1/1");
    assertThat(s.restarts()).isEqualTo(2);
    assertThat(s.age()).isEqualTo("3h12m");
    assertThat(s.containers()).singleElement().satisfies(c -> {
      assertThat(c.name()).isEqualTo("app");
      assertThat(c.state()).isEqualTo("Running");
    });
  }

  @Test
  void showsWaitingReasonLikeKubectl() {
    Pod pod = new PodBuilder()
      .withNewMetadata().withName("api-2").withNamespace("team").endMetadata()
      .withNewSpec().addNewContainer().withName("app").endContainer().endSpec()
      .withNewStatus().withPhase("Running")
      .addNewContainerStatus().withName("app").withReady(false).withRestartCount(7)
      .withNewState().withNewWaiting().withReason("CrashLoopBackOff").endWaiting().endState()
      .endContainerStatus()
      .endStatus()
      .build();

    assertThat(PodMapper.toSummary(pod, Instant.now()).status()).isEqualTo("CrashLoopBackOff");
  }

  @Test
  void formatsAge() {
    Instant now = Instant.parse("2024-01-10T00:00:00Z");
    assertThat(PodMapper.formatAge(Instant.parse("2024-01-09T23:59:20Z"), now)).isEqualTo("40s");
    assertThat(PodMapper.formatAge(Instant.parse("2024-01-09T23:15:00Z"), now)).isEqualTo("45m");
    assertThat(PodMapper.formatAge(Instant.parse("2024-01-04T20:00:00Z"), now)).isEqualTo("5d4h");
  }
}
