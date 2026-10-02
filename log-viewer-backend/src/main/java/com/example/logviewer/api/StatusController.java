package com.example.logviewer.api;

import com.example.logviewer.kube.KubeService;
import com.example.logviewer.model.ClusterStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/status")
public class StatusController {

  private final KubeService kube;

  public StatusController(KubeService kube) {
    this.kube = kube;
  }

  @GetMapping
  public ClusterStatus status() {
    return kube.status();
  }
}
