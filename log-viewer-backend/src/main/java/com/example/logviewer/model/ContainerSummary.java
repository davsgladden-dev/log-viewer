package com.example.logviewer.model;

public record ContainerSummary(
  String name,
  String image,
  boolean ready,
  int restartCount,
  String state,
  boolean initContainer) {}
