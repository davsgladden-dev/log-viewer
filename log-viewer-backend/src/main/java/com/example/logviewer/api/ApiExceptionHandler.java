package com.example.logviewer.api;

import com.example.logviewer.kube.KubeConfigException;
import com.example.logviewer.kube.ResourceNotFoundException;
import com.example.logviewer.model.ApiError;
import io.fabric8.kubernetes.client.KubernetesClientException;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Instant;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

@RestControllerAdvice
public class ApiExceptionHandler {

  private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

  @ExceptionHandler(KubeConfigException.class)
  public ResponseEntity<ApiError> kubeConfig(KubeConfigException e, HttpServletRequest req) {
    log.warn("Kubeconfig problem: {}", e.getMessage());
    return build(e.getStatus(), e.getMessage(), null, req);
  }

  @ExceptionHandler(ResourceNotFoundException.class)
  public ResponseEntity<ApiError> notFound(ResourceNotFoundException e, HttpServletRequest req) {
    return build(HttpStatus.NOT_FOUND, e.getMessage(), null, req);
  }

  @ExceptionHandler(KubernetesClientException.class)
  public ResponseEntity<ApiError> kubernetes(KubernetesClientException e, HttpServletRequest req) {
    HttpStatus status = HttpStatus.resolve(e.getCode());
    String message;
    String details = e.getStatus() != null ? e.getStatus().getReason() : null;
    if (status == null || !status.isError()) {
      // code 0 = transport failure (DNS, timeout, TLS, expired token exec plugin, ...)
      status = HttpStatus.BAD_GATEWAY;
      message = "Could not reach the Kubernetes API server: " + rootMessage(e);
    } else {
      message = e.getStatus() != null && e.getStatus().getMessage() != null
        ? e.getStatus().getMessage() : e.getMessage();
    }
    log.warn("Kubernetes API error {} on {}: {}", status.value(), req.getRequestURI(), message);
    return build(status, message, details, req);
  }

  @ExceptionHandler({MethodArgumentTypeMismatchException.class, MissingServletRequestParameterException.class})
  public ResponseEntity<ApiError> badRequest(Exception e, HttpServletRequest req) {
    return build(HttpStatus.BAD_REQUEST, e.getMessage(), null, req);
  }

  @ExceptionHandler(Exception.class)
  public ResponseEntity<ApiError> generic(Exception e, HttpServletRequest req) {
    log.error("Unhandled error on {}", req.getRequestURI(), e);
    return build(HttpStatus.INTERNAL_SERVER_ERROR, rootMessage(e), null, req);
  }

  private static ResponseEntity<ApiError> build(HttpStatus status, String message, String details,
                                                HttpServletRequest req) {
    return ResponseEntity.status(status).body(new ApiError(
      status.value(), status.getReasonPhrase(), message, details, req.getRequestURI(), Instant.now()));
  }

  private static String rootMessage(Throwable t) {
    Throwable cur = t;
    while (cur.getCause() != null && cur.getCause() != cur) {
      cur = cur.getCause();
    }
    return cur.getMessage() != null ? cur.getMessage() : cur.getClass().getSimpleName();
  }
}
