package com.example.logviewer.model;

import java.util.List;

/** One file inside the .kube directory. */
public record KubeConfigFile(
  String name,
  String path,
  String currentContext,
  List<KubeContext> contexts,
  boolean active,
  String error) {}
