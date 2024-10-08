export function removePrefix(str: string, prefix: string): string {
  if (str.startsWith(prefix)) {
    return str.substring(prefix.length);
  } else {
    return str;
  }
}

export function ensurePrefix(str: string, prefix: string): string {
  if (str.startsWith(prefix)) {
    return str;
  } else {
    return prefix + str;
  }
}

export function ensureSuffix(str: string, suffix: string): string {
  if (str.endsWith(suffix)) {
    return str;
  } else {
    return str + suffix;
  }
}

export function applyTemplate(template: string, placeholders: [string, string][]) {
  return replaceStrings(
    template,
    placeholders.map(([t, v]) => [`{{${t}}}`, v]),
  );
}

export function replaceStrings(str: string, searchAndReplaceValues: [string, string][]) {
  let s = str;
  for (let i = 0; i < searchAndReplaceValues.length; ++i) {
    const search = searchAndReplaceValues[i][0];
    const replace = searchAndReplaceValues[i][1];
    s = s.replaceAll(search, replace);
  }
  return s;
}
