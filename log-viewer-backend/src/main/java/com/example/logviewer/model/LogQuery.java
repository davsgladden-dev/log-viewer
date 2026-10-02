package com.example.logviewer.model;

public record LogQuery(
  String container,
  Integer tailLines,
  boolean previous,
  Integer sinceSeconds,
  boolean timestamps,
  Integer limitBytes) {}
