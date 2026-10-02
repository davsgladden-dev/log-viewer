package com.example.logviewer.model;

public record ActiveKubeConfig(String file, String context, String namespace, String server, String directory) {}
