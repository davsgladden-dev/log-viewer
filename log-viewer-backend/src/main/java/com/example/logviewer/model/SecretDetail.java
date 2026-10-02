package com.example.logviewer.model;

import java.time.Instant;
import java.util.List;
import java.util.Map;

public record SecretDetail(
  String name,
  String namespace,
  String type,
  boolean revealed,
  List<SecretEntry> entries,
  Instant createdAt,
  Map<String, String> labels) {}
