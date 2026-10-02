package com.example.logviewer.api;

import com.example.logviewer.kube.KubeService;
import com.example.logviewer.model.LogQuery;
import com.example.logviewer.model.LogResult;
import com.example.logviewer.model.PodSummary;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/namespaces/{namespace}/pods")
public class PodController {

  private static final MediaType TEXT_PLAIN_UTF8 = new MediaType(MediaType.TEXT_PLAIN, StandardCharsets.UTF_8);

  private final KubeService kube;

  public PodController(KubeService kube) {
    this.kube = kube;
  }

  /** kubectl get pods -n {namespace} [-l labelSelector] */
  @GetMapping
  public List<PodSummary> list(
    @PathVariable("namespace") String namespace,
    @RequestParam(name = "labelSelector", required = false) String labelSelector) {
    return kube.listPods(namespace, labelSelector);
  }

  @GetMapping("/{pod}")
  public PodSummary get(
    @PathVariable("namespace") String namespace,
    @PathVariable("pod") String pod) {
    return kube.getPod(namespace, pod);
  }

  /**
   * kubectl logs -n {namespace} {pod} [-c container] --tail {tailLines} [-p] [--since {sinceSeconds}s] [--timestamps]
   * Returns text/plain so the frontend can feed it straight into LogStore.load().
   */
  @GetMapping("/{pod}/logs")
  public ResponseEntity<String> logs(
    @PathVariable("namespace") String namespace,
    @PathVariable("pod") String pod,
    @RequestParam(name = "container", required = false) String container,
    @RequestParam(name = "tailLines", required = false) Integer tailLines,
    @RequestParam(name = "previous", defaultValue = "false") boolean previous,
    @RequestParam(name = "sinceSeconds", required = false) Integer sinceSeconds,
    @RequestParam(name = "timestamps", defaultValue = "false") boolean timestamps,
    @RequestParam(name = "limitBytes", required = false) Integer limitBytes) {

    LogResult result = kube.getPodLogs(namespace, pod,
      new LogQuery(container, tailLines, previous, sinceSeconds, timestamps, limitBytes));

    return ResponseEntity.ok()
      .contentType(TEXT_PLAIN_UTF8)
      .header("X-Log-Container", result.container())
      .header("X-Log-Tail-Lines", String.valueOf(result.tailLines()))
      .header("X-Log-Line-Count", String.valueOf(result.lineCount()))
      .body(result.text());
  }
}
