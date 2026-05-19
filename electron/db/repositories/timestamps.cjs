const SQLITE_DATETIME_PATTERN = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(?::\d{2})?$/;

function normalizeTimestampForDateParse(value) {
  const timestamp = String(value || '').trim();
  if (!timestamp) {
    return '';
  }

  if (SQLITE_DATETIME_PATTERN.test(timestamp)) {
    return `${timestamp.replace(' ', 'T')}Z`;
  }

  return timestamp;
}

function formatLocalTimestampLabel(value, options = {}) {
  const timestamp = String(value || '').trim();
  if (!timestamp) {
    return '';
  }

  const parsed = Date.parse(normalizeTimestampForDateParse(timestamp));
  if (Number.isNaN(parsed)) {
    return timestamp;
  }

  const formatter = new Intl.DateTimeFormat(options.locale || 'zh-CN', {
    ...(options.timeZone ? { timeZone: options.timeZone } : {}),
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(new Date(parsed)).map((part) => [part.type, part.value]),
  );

  return `${parts.year}年${parts.month}月${parts.day}日 ${parts.hour}:${parts.minute}`;
}

module.exports = {
  formatLocalTimestampLabel,
  normalizeTimestampForDateParse,
};
