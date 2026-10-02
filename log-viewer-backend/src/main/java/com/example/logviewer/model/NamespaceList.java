package com.example.logviewer.model;

import java.util.List;

/** listRestricted = true when the user may not list namespaces (RBAC); only the context namespace is returned. */
public record NamespaceList(List<String> namespaces, boolean listRestricted) {}
