package com.example.logviewer.model;

public record KubeContext(String name, String cluster, String server, String namespace, String user) {}
