package com.example.logviewer.model;

/**
 * value is null unless revealed/decoded. If the decoded bytes are not valid UTF-8,
 * binary=true and value holds the original base64 string.
 */
public record SecretEntry(String key, String value, boolean decoded, boolean binary, int sizeBytes) {}
