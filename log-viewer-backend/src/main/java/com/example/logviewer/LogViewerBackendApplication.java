package com.example.logviewer;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class LogViewerBackendApplication {

  public static void main(String[] args) {
    SpringApplication.run(LogViewerBackendApplication.class, args);
  }
}
