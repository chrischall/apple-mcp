/**
 * Normalizes a phone number string into one or more canonical E.164-style
 * representations suitable for SQLite `IN` clause matching against chat.db.
 *
 * Only digits and `+` pass through, making it safe against SQL/shell injection
 * even before additional SQL escaping is applied.
 */
export function normalizePhoneNumber(phone: string): string[] {
  const cleaned = phone.replace(/[^0-9+]/g, '');

  if (/^\+1\d{10}$/.test(cleaned)) return [cleaned];
  if (/^1\d{10}$/.test(cleaned)) return [`+${cleaned}`];
  if (/^\d{10}$/.test(cleaned)) return [`+1${cleaned}`];

  const formats = new Set<string>();
  if (cleaned.startsWith('+1')) {
    formats.add(cleaned);
  } else if (cleaned.startsWith('1')) {
    formats.add(`+${cleaned}`);
  } else {
    formats.add(`+1${cleaned}`);
  }
  return Array.from(formats);
}

/**
 * Decodes a hex-encoded attributedBody blob from Messages chat.db into
 * human-readable text and an optional URL.
 */
export function decodeAttributedBody(hexString: string): { text: string; url?: string } {
  try {
    const buffer = Buffer.from(hexString, 'hex');
    const content = buffer.toString();

    const textPatterns = [
      /NSString">(.*?)</,
      /NSString">([^<]+)/,
      /NSNumber">\d+<.*?NSString">(.*?)</,
      /NSArray">.*?NSString">(.*?)</,
      /"string":\s*"([^"]+)"/,
      /text[^>]*>(.*?)</,
      /message>(.*?)</,
    ];

    let text = '';
    for (const pattern of textPatterns) {
      const match = content.match(pattern);
      if (match?.[1] && match[1].length > 5) {
        text = match[1];
        break;
      }
    }

    const urlPatterns = [
      /(https?:\/\/[^\s<"]+)/,
      /NSString">(https?:\/\/[^\s<"]+)/,
      /"url":\s*"(https?:\/\/[^"]+)"/,
      /link[^>]*>(https?:\/\/[^<]+)/,
    ];

    let url: string | undefined;
    for (const pattern of urlPatterns) {
      const match = content.match(pattern);
      if (match?.[1]) {
        url = match[1];
        break;
      }
    }

    if (!text && !url) {
      const readableText = content
        .replace(/streamtyped.*?NSString/g, '')
        .replace(/NSAttributedString.*?NSString/g, '')
        .replace(/NSDictionary.*?$/g, '')
        .replace(/\+[A-Za-z]+\s/g, '')
        .replace(/NSNumber.*?NSValue.*?\*/g, '')
        .replace(/[^\x20-\x7E]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (readableText.length > 5) {
        text = readableText;
      } else {
        return { text: '[Message content not readable]' };
      }
    }

    if (text) {
      text = text
        .replace(/^[+\s]+/, '')
        .replace(/\s*iI\s*[A-Z]\s*$/, '')
        .replace(/\s+/g, ' ')
        .trim();
    }

    return { text: text || url || '', url };
  } catch {
    return { text: '[Message content not readable]' };
  }
}
