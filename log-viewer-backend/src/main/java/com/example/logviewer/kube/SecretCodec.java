package com.example.logviewer.kube;

import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.util.Base64;

final class SecretCodec {

  private SecretCodec() {}

  /** value = decoded UTF-8 text, or the original base64 when binary=true. */
  record Decoded(String value, boolean binary, int sizeBytes) {}

  static Decoded decode(String base64) {
    byte[] bytes;
    try {
      bytes = Base64.getDecoder().decode(base64);
    } catch (IllegalArgumentException e) {
      // Not valid base64 (shouldn't happen from the API) – return as-is.
      return new Decoded(base64, false, base64.length());
    }
    try {
      String text = StandardCharsets.UTF_8.newDecoder()
        .onMalformedInput(CodingErrorAction.REPORT)
        .onUnmappableCharacter(CodingErrorAction.REPORT)
        .decode(ByteBuffer.wrap(bytes))
        .toString();
      if (text.indexOf('\0') >= 0) {
        return new Decoded(base64, true, bytes.length);
      }
      return new Decoded(text, false, bytes.length);
    } catch (CharacterCodingException e) {
      return new Decoded(base64, true, bytes.length);
    }
  }

  static String encode(String plain) {
    return Base64.getEncoder().encodeToString(plain.getBytes(StandardCharsets.UTF_8));
  }
}
