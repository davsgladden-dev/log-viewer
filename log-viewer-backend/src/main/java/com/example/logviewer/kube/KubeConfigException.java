package com.example.logviewer.kube;

import org.springframework.http.HttpStatus;

public class KubeConfigException extends RuntimeException {

  private final HttpStatus status;

  public KubeConfigException(HttpStatus status, String message) {
    this(status, message, null);
  }

  public KubeConfigException(HttpStatus status, String message, Throwable cause) {
    super(message, cause);
    this.status = status;
  }

  public HttpStatus getStatus() {
    return status;
  }
}
