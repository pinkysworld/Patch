#pragma once
#include <cstddef>
#include <cstdint>
#include <string>
#include <vector>

static constexpr size_t PATCH_PICTURE_MAX_BYTES_V15 = 2u * 1024u * 1024u;

struct PatchPictureDataV15 {
  std::string mediaType;
  std::vector<uint8_t> bytes;
};

static bool PatchPictureEmbeddedSourceV15(const std::string& source) {
  return source.rfind("data:image/", 0) == 0;
}

static int PatchPictureBase64ValueV15(char ch) {
  if (ch >= 'A' && ch <= 'Z') return ch - 'A';
  if (ch >= 'a' && ch <= 'z') return ch - 'a' + 26;
  if (ch >= '0' && ch <= '9') return ch - '0' + 52;
  if (ch == '+') return 62;
  if (ch == '/') return 63;
  return -1;
}

static bool PatchDecodePictureBase64V15(const std::string& input, std::vector<uint8_t>& out) {
  out.clear();
  if (input.empty() || input.size() % 4 != 0) return false;
  const size_t padding = input.back() == '=' ? (input[input.size() - 2] == '=' ? 2u : 1u) : 0u;
  const size_t decodedSize = (input.size() / 4u) * 3u - padding;
  if (!decodedSize || decodedSize > PATCH_PICTURE_MAX_BYTES_V15) return false;
  out.reserve(decodedSize);
  for (size_t offset = 0; offset < input.size(); offset += 4) {
    const bool last = offset + 4 == input.size();
    const char a = input[offset], b = input[offset + 1], c = input[offset + 2], d = input[offset + 3];
    const int va = PatchPictureBase64ValueV15(a), vb = PatchPictureBase64ValueV15(b);
    if (va < 0 || vb < 0) return false;
    if (c == '=') {
      if (!last || d != '=' || (vb & 0x0f) != 0) return false;
      out.push_back((uint8_t)((va << 2) | (vb >> 4)));
      continue;
    }
    const int vc = PatchPictureBase64ValueV15(c);
    if (vc < 0) return false;
    out.push_back((uint8_t)((va << 2) | (vb >> 4)));
    if (d == '=') {
      if (!last || (vc & 0x03) != 0) return false;
      out.push_back((uint8_t)(((vb & 0x0f) << 4) | (vc >> 2)));
      continue;
    }
    const int vd = PatchPictureBase64ValueV15(d);
    if (vd < 0) return false;
    out.push_back((uint8_t)(((vb & 0x0f) << 4) | (vc >> 2)));
    out.push_back((uint8_t)(((vc & 0x03) << 6) | vd));
  }
  return out.size() == decodedSize;
}

static bool PatchDecodePictureDataUriV15(const std::string& source, PatchPictureDataV15& out) {
  out = {};
  static const std::string png = "data:image/png;base64,";
  static const std::string jpeg = "data:image/jpeg;base64,";
  const std::string* prefix = nullptr;
  if (source.rfind(png, 0) == 0) { out.mediaType = "image/png"; prefix = &png; }
  else if (source.rfind(jpeg, 0) == 0) { out.mediaType = "image/jpeg"; prefix = &jpeg; }
  else return false;
  return PatchDecodePictureBase64V15(source.substr(prefix->size()), out.bytes);
}
