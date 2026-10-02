package com.example.logviewer.model;

public record ClusterStatus(ActiveKubeConfig active, boolean reachable, String serverVersion, String error, String kubeDirectory) {}
