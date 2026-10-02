package com.example.logviewer.api;

import com.example.logviewer.kube.KubeConfigService;
import com.example.logviewer.model.ActiveKubeConfig;
import com.example.logviewer.model.KubeConfigFile;
import com.example.logviewer.model.SelectKubeConfigRequest;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/kubeconfigs")
public class KubeConfigController {

  private final KubeConfigService configs;

  public KubeConfigController(KubeConfigService configs) {
    this.configs = configs;
  }

  /** Lists `config`, `config-dev`, ... in the .kube directory with their contexts. */
  @GetMapping
  public List<KubeConfigFile> list() {
    return configs.listConfigFiles();
  }

  @GetMapping("/active")
  public ActiveKubeConfig active() {
    return configs.active();
  }

  /** Switch file and/or context. Body: { "file": "config-dev", "context": "optional-context-name" } */
  @PutMapping("/active")
  public ActiveKubeConfig select(@RequestBody SelectKubeConfigRequest request) {
    return configs.select(request.file(), request.context());
  }

  @PostMapping("/active/reload")
  public ActiveKubeConfig reload() {
    return configs.reload();
  }
}
