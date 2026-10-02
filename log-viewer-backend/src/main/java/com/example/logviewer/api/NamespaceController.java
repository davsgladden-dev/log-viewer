package com.example.logviewer.api;

import com.example.logviewer.kube.KubeService;
import com.example.logviewer.model.NamespaceList;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/namespaces")
public class NamespaceController {

  private final KubeService kube;

  public NamespaceController(KubeService kube) {
    this.kube = kube;
  }

  @GetMapping
  public NamespaceList list() {
    return kube.listNamespaces();
  }
}
