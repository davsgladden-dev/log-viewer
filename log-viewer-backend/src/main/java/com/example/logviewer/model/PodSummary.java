package com.example.logviewer.model;

import java.time.Instant;
import java.util.List;
import java.util.Map;

public record PodSummary(
  String name,
  String namespace,
  String phase,
  String status,      // kubectl-style display status (Running, CrashLoopBackOff, Completed, ...)
  String ready,       // "1/1"
  int restarts,
  String node,
  Instant createdAt,
  String age,         // "3h12m"
  List<ContainerSummary> containers,
  Map<String, String> labels) {}
