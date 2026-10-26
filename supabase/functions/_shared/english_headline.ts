export function getEnglishHeadline(item: {title:string;language?:string|null;translation_status?:string|null;translated_title_en?:string|null}): string | null {
  const translated = item.translated_title_en?.trim();
  if (translated) return translated;
  const language = (item.language || "").trim().toLowerCase().replace("_", "-");
  if (item.translation_status === "original_english" || language === "en" || language.startsWith("en-")) {
    return item.title?.trim() || null;
  }
  if (!language) {
    const title = item.title || "";
    // RSS providers often omit language metadata. Permit Latin-script headlines,
    // but fail closed for common non-Latin scripts until an English translation exists.
    if (/[\u0400-\u052F\u0590-\u08FF\u0900-\u0DFF\u0E00-\u0E7F\u0E80-\u0EFF\u1000-\u109F\u1780-\u17FF\u2E80-\u2EFF\u3000-\u30FF\u3100-\u312F\u3130-\u318F\u31A0-\u31BF\u3400-\u4DBF\u4E00-\u9FFF\uAC00-\uD7AF\uF900-\uFAFF]/u.test(title)) return null;
    return title.trim() || null;
  }
  return null;
}

