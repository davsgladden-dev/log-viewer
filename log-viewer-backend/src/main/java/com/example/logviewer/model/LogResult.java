package com.example.logviewer.model;

public record LogResult(String text, String pod, String container, int tailLines, boolean previous, int lineCount) {}
