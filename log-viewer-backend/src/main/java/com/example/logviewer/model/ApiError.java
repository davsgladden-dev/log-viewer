package com.example.logviewer.model;

import java.time.Instant;
import java.util.List;
import java.util.Map;

public record ApiError(int status, String error, String message, String details, String path, Instant timestamp) {}
