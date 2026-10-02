package com.example.logviewer.model;

import java.time.Instant;
import java.util.List;

public record SecretSummary(String name, String namespace, String type, List<String> keys, Instant createdAt) {}
