const EMPTY_CONTENT_JSON = '[]';
const BACKLINK_DESCRIPTION_LIMIT = 120;

function asRecord(value) {
  return typeof value === 'object' && value !== null ? value : null;
}

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function stripLegacyHeadingPrefix(title) {
  return title.replace(/^\d+\.\s*/, '').trim();
}

function parseContentArray(contentJson) {
  if (typeof contentJson !== 'string' || contentJson.trim().length === 0) {
    return [];
  }

  try {
    const parsed = JSON.parse(contentJson);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function isLegacySection(value) {
  const record = asRecord(value);
  if (!record || typeof record.type !== 'string') {
    return false;
  }

  return !Array.isArray(record.content) && !Array.isArray(record.children);
}

function flattenInlineText(value) {
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => flattenInlineText(item)).join('');
  }

  const record = asRecord(value);
  if (!record) {
    return '';
  }

  if (record.type === 'docMention') {
    const props = asRecord(record.props);
    const title = normalizeTitle(props?.title);
    return title ? `@${title}` : '';
  }

  if (typeof record.text === 'string') {
    return record.text;
  }

  return `${flattenInlineText(record.content)}${flattenInlineText(record.children)}`;
}

function getBlockPropsText(value) {
  const record = asRecord(value);
  if (!record) {
    return '';
  }

  return [
    hasText(record.name) ? record.name : '',
    hasText(record.title) ? record.title : '',
    hasText(record.caption) ? record.caption : '',
    hasText(record.label) ? record.label : '',
  ].join('');
}

function getLegacySectionText(section) {
  return [
    hasText(section.title) ? section.title : '',
    hasText(section.content) ? section.content : '',
    hasText(section.caption) ? section.caption : '',
    Array.isArray(section.items) ? section.items.join('') : '',
  ].join('');
}

function collectOutlineFromBlocks(blocks, outline = []) {
  blocks.forEach((block, index) => {
    const record = asRecord(block);
    if (!record || typeof record.type !== 'string') {
      return;
    }

    const children = Array.isArray(record.children) ? record.children : [];
    if (record.type === 'heading') {
      const props = asRecord(record.props);
      const title = flattenInlineText(record.content).trim();
      if (title.length > 0) {
        outline.push({
          id: typeof record.id === 'string' ? record.id : `outline-${outline.length + index}`,
          title,
          level: typeof props?.level === 'number' ? props.level : 1,
        });
      }
    }

    if (children.length > 0) {
      collectOutlineFromBlocks(children, outline);
    }
  });

  return outline;
}

function collectSectionsFromBlocks(blocks) {
  return blocks.flatMap((block, index) => {
    const record = asRecord(block);
    if (!record || typeof record.type !== 'string') {
      return [];
    }

    const id = typeof record.id === 'string' ? record.id : `section-${index}`;
    const text = flattenInlineText(record.content).trim();
    const props = asRecord(record.props);
    const childSections = Array.isArray(record.children)
      ? collectSectionsFromBlocks(record.children)
      : [];

    if (record.type === 'heading' && text.length > 0) {
      return [{ id, type: 'heading', title: text }, ...childSections];
    }

    if (record.type === 'paragraph' && text.length > 0) {
      return [{ id, type: 'paragraph', content: text }, ...childSections];
    }

    if (record.type === 'quote' && text.length > 0) {
      return [{ id, type: 'quote', content: text }, ...childSections];
    }

    if (record.type === 'bulletListItem' && text.length > 0) {
      return [{ id, type: 'bullet-list', items: [text] }, ...childSections];
    }

    if (
      (record.type === 'image' || record.type === 'video' || record.type === 'file' || record.type === 'kbAttachment') &&
      getBlockPropsText(props).trim().length > 0
    ) {
      return [{ id, type: 'gallery', items: [getBlockPropsText(props).trim()] }, ...childSections];
    }

    return childSections;
  });
}

function countTextFromBlocks(blocks) {
  return blocks.reduce((sum, block) => {
    const record = asRecord(block);
    if (!record) {
      return sum;
    }

    return (
      sum +
      flattenInlineText(record.content).length +
      getBlockPropsText(record.props).length +
      countTextFromBlocks(Array.isArray(record.children) ? record.children : [])
    );
  }, 0);
}

function normalizeContentJson(contentJson) {
  return JSON.stringify(parseContentArray(contentJson));
}

function serializeSectionsAsContentJson(sections) {
  return JSON.stringify(Array.isArray(sections) ? sections : []);
}

function deriveSectionsFromContentJson(contentJson) {
  const blocks = parseContentArray(contentJson);
  if (blocks.every((block) => isLegacySection(block))) {
    return blocks;
  }

  return collectSectionsFromBlocks(blocks);
}

function deriveOutlineFromContentJson(contentJson) {
  const blocks = parseContentArray(contentJson);
  if (blocks.every((block) => isLegacySection(block))) {
    return blocks
      .filter((section) => section.type === 'heading' && hasText(section.title))
      .map((section, index) => ({
        id: section.id || `outline-${index}`,
        title: stripLegacyHeadingPrefix(section.title),
        level: index === 0 ? 1 : 2,
      }));
  }

  return collectOutlineFromBlocks(blocks);
}

function deriveWordCount(contentJson) {
  const blocks = parseContentArray(contentJson);
  if (blocks.every((block) => isLegacySection(block))) {
    return blocks.reduce((sum, section) => sum + getLegacySectionText(section).length, 0);
  }

  return countTextFromBlocks(blocks);
}

function normalizeTitle(value) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim();
}

function collectMentionTargets(
  value,
  mentions = [],
) {
  if (Array.isArray(value)) {
    value.forEach((item) => {
      collectMentionTargets(item, mentions);
    });
    return mentions;
  }

  const record = asRecord(value);
  if (!record) {
    return mentions;
  }

  if (record.type === 'docMention') {
    const props = asRecord(record.props);
    const documentId = normalizeTitle(props?.documentId);
    if (documentId) {
      mentions.push({
        documentId,
        title: normalizeTitle(props?.title),
      });
    }
    return mentions;
  }

  collectMentionTargets(record.content, mentions);
  collectMentionTargets(record.children, mentions);
  return mentions;
}

function trimDescription(value) {
  return value.replace(/\s+/g, ' ').trim().slice(0, BACKLINK_DESCRIPTION_LIMIT);
}

function buildBacklinkDescription(block, mentionTitle) {
  const blockText = trimDescription(flattenInlineText(block.content));
  if (blockText.length > 0) {
    return blockText;
  }

  return mentionTitle ? `提到：@${mentionTitle}` : '提到了一篇文档';
}

function collectMentionsFromBlocks(blocks, sourceDocumentId, extractedMentions = []) {
  const seenTargetIds = new Set();

  const visitBlocks = (items) => {
    items.forEach((block) => {
      const record = asRecord(block);
      if (!record) {
        return;
      }

      const blockMentions = collectMentionTargets(record.content);

      blockMentions.forEach((mention) => {
        if (!mention.documentId || mention.documentId === sourceDocumentId || seenTargetIds.has(mention.documentId)) {
          return;
        }

        seenTargetIds.add(mention.documentId);
        extractedMentions.push({
          targetDocumentId: mention.documentId,
          sourceBlockId: typeof record.id === 'string' ? record.id : null,
          description: buildBacklinkDescription(record, mention.title),
        });
      });

      const children = Array.isArray(record.children) ? record.children : [];
      if (children.length > 0) {
        visitBlocks(children);
      }
    });
  };

  visitBlocks(blocks);
  return extractedMentions;
}

function extractDocumentMentions(contentJson, sourceDocumentId) {
  return collectMentionsFromBlocks(parseContentArray(contentJson), sourceDocumentId);
}

module.exports = {
  EMPTY_CONTENT_JSON,
  normalizeContentJson,
  serializeSectionsAsContentJson,
  deriveSectionsFromContentJson,
  deriveOutlineFromContentJson,
  deriveWordCount,
  extractDocumentMentions,
};
