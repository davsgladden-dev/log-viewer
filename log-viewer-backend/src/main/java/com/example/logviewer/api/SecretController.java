package com.example.logviewer.api;

import com.example.logviewer.kube.KubeService;
import com.example.logviewer.model.SecretDetail;
import com.example.logviewer.model.SecretEntry;
import com.example.logviewer.model.SecretSummary;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/namespaces/{namespace}/secrets")
public class SecretController {

  private final KubeService kube;

  public SecretController(KubeService kube) {
    this.kube = kube;
  }

  /** kubectl get secrets -n {namespace} (names, types, keys only) */
  @GetMapping
  public List<SecretSummary> list(@PathVariable("namespace") String namespace) {
    return kube.listSecrets(namespace);
  }

  /** kubectl get secret {name} -o yaml — values only included when reveal=true */
  @GetMapping("/{name}")
  public SecretDetail get(
    @PathVariable("namespace") String namespace,
    @PathVariable("name") String name,
    @RequestParam(name = "reveal", defaultValue = "false") boolean reveal) {
    return kube.getSecret(namespace, name, reveal);
  }

  /** kubectl get secret {name} -o jsonpath='{.data.{key}}' | base64 -d */
  @GetMapping("/{name}/entries/{key}")
  public SecretEntry entry(
    @PathVariable("namespace") String namespace,
    @PathVariable("name") String name,
    @PathVariable("key") String key,
    @RequestParam(name = "decode", defaultValue = "true") boolean decode) {
    return kube.getSecretEntry(namespace, name, key, decode);
  }
}
