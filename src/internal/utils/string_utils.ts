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

export function applyTemplate(template: string, placeholders: [string, string][]) {
  return replaceStrings(
    template,
    placeholders.map(([t, v]) => [`{{${t}}}`, v]),
  );
  // let s = template;
  // for (let i = 0; i < placeholders.length; ++i) {
  //   const t = placeholders[i][0];
  //   const v = placeholders[i][1];
  //   s = s.replaceAll(`{{${t}}}`, v);
  // }
  // return s;
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
