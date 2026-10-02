package com.example.logviewer.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Allows the Angular dev server to call the API directly. If the frontend uses
 * an Angular proxy (recommended, see README) this is not needed but harmless.
 */
@Configuration
public class CorsConfig implements WebMvcConfigurer {

  private final LogViewerProperties props;

  public CorsConfig(LogViewerProperties props) {
    this.props = props;
  }

  @Override
  public void addCorsMappings(CorsRegistry registry) {
    registry.addMapping("/api/**")
      .allowedOrigins(props.cors().allowedOrigins().toArray(String[]::new))
      .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
      .allowedHeaders("*")
      .exposedHeaders("X-Log-Container", "X-Log-Tail-Lines", "X-Log-Line-Count");
  }
}
