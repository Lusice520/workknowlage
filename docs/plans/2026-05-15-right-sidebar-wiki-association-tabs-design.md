# Right Sidebar Wiki Association Tabs Design

## Goal

Upgrade the right sidebar from a mixed document-property panel into a context panel with clear modes:

- Document properties: current document metadata, tags, and outline.
- Wiki associations: relationships between the current document and the local knowledge base.

The design should preserve wiki-style relevance as the primary experience while still exposing exact text evidence when it helps the user understand why documents may be connected.

## Problem

The current right sidebar combines tags, outline, references, and similar content in one vertical flow. This makes the panel feel like a document property panel with a small association section attached.

The existing "similar content" algorithm also treats short exact text matches and semantic topic similarity as the same kind of result. That creates two bad outcomes:

- If thresholds stay conservative, short copied phrases or key sentences are hidden even when they are useful evidence.
- If thresholds are loosened, the right sidebar risks becoming a search-result list instead of a wiki relationship surface.

The product needs a clearer model: semantic wiki relevance and original-text evidence are related but not identical.

## Recommended Direction

Use right-sidebar tabs.

### Tab 1: Properties

This tab answers: "What is this document?"

It owns the existing document-local surfaces:

- Tags.
- Document outline.
- Basic document state or metadata when needed later.

This keeps current document management separate from knowledge navigation.

### Tab 2: Wiki Associations

This tab answers: "How does this document connect to the knowledge base?"

It contains three relationship layers:

1. Explicit references.
   These are deterministic relationships from outgoing document mentions and incoming backlinks.

2. Related topics.
   These are semantic wiki associations. They should remain selective and should prefer documents that share topic, problem, concept, responsibility boundary, decision context, or workflow context. They should not be dominated by exact short phrase matches.

3. Text evidence.
   These are short original-text signals: exact key sentence hits, title-like phrase hits, and repeated wording. They should be shown as evidence, not as primary semantic similarity.

## Relationship Semantics

### Explicit References

Explicit references are facts. They come from:

- Current document mentions another document.
- Another document mentions the current document.

They rank before derived associations because they reflect user-authored structure.

### Related Topics

Related topics are wiki-style semantic results. The intent is "this document discusses the same subject area or problem space," not "this document contains the same words."

The algorithm can continue using local deterministic heuristics first:

- Compare meaningful content blocks and heading groups.
- Prefer multiple matching blocks over one isolated shared phrase.
- Prefer section-level overlap that is distributed across the candidate document.
- Keep result count small, around 3 to 5 documents.

Future embedding or AI-assisted retrieval can replace or augment this layer without changing the UI model.

### Text Evidence

Text evidence is a supporting layer. It should catch cases such as:

- "公司坚定不移践行产品化路线"
- "我们的职责边界到底是什么"
- "六大产品系列"

These hits are useful because they explain shared wording, copied source material, or repeated concepts. They do not by themselves prove that two documents are semantically similar.

Evidence cards should state the reason:

- "命中关键句：公司坚定不移践行产品化路线"
- "命中短语：职责边界"
- "命中标题式表达：六大产品系列"

Clicking an evidence result should open the target document and focus the matched block.

## UI Behavior

The right sidebar header should include a segmented tab control:

- Properties
- Wiki

When Wiki associations exist, the Wiki tab should show a compact badge. The badge tells the user that the current document has relationship signals even while they are viewing Properties. The badge shows an aggregated count from explicit references, related topics, and text evidence; counts from 1 to 9 show the exact number, and counts above 9 show `9+`.

Default tab:

- Keep Properties as the default initially, to avoid surprising users who rely on the current sidebar layout.
- Show the Wiki badge from the default Properties tab when associations exist.
- Do not remember the last selected tab in the first implementation.

Wiki tab layout:

1. Explicit references.
2. Related topics.
3. Text evidence.

The Wiki tab should avoid visually overloading the editor. Related topics should be compact. Text evidence can be collapsed or visually lighter than related topics.

If a document appears in both related topics and text evidence, show it once in Related Topics and attach a small evidence note, rather than duplicating the document card.

## Data Flow

`RightSidebar` should continue to consume prepared association state. It should not derive expensive relationships inside render.

App-level orchestration should prepare a richer association object, for example:

```ts
interface SidebarAssociationResult {
  explicitReferences: ExplicitReference[];
  relatedTopics: RelatedTopic[];
  textEvidence: TextEvidence[];
  relatedTags: SidebarRelatedTag[];
  summary: {
    wikiAssociationCount: number;
  };
}
```

Compatibility can be handled incrementally by mapping current fields:

- Current outgoing mentions and incoming backlinks become explicit references.
- Current `relatedDocuments` becomes related topics.
- New phrase/key-sentence matching becomes text evidence.
- Current `similarBlocks` can either remain as focused-section related blocks or be folded into related topics after the tab split.

## Algorithm Direction

Keep related topics conservative.

Add a separate evidence extractor instead of simply lowering similarity thresholds:

- Build short phrase and key sentence candidates from the active document.
- Include short body blocks and heading-like lines that current semantic candidates may drop.
- Match candidates against same-space documents only.
- Classify evidence strength:
  - key sentence exact hit
  - phrase exact hit
  - title-like expression hit
  - repeated phrase cluster
- Store block id, snippet, matched text, and evidence reason.

This avoids polluting semantic relevance while still making copied or repeated source wording visible.

## Testing

Add focused unit tests around `sidebarAssociations`:

- Short active phrases should appear in text evidence when found inside a long paragraph.
- Short phrase evidence should not automatically create a related topic.
- A truly semantically similar document should still appear in related topics.
- Same-space filtering should remain enforced.
- Duplicate documents should be merged when a document has both topic similarity and text evidence.

Add UI tests around `RightSidebar`:

- It renders the Properties and Wiki tabs.
- Wiki tab shows a badge when explicit references, related topics, or text evidence exist.
- Wiki tab hides the badge when there are no association signals.
- Properties tab preserves tags and outline.
- Wiki tab renders explicit references, related topics, and text evidence independently.
- Evidence clicks open the matched document/block.

## Non-Goals

This design does not introduce remote AI, embeddings, cloud indexing, or graph visualization.

It does not make exact text hits the main ranking signal for wiki associations.

It does not redesign the left-sidebar search experience.

## Open Follow-Up

After implementation, revisit whether users need a dedicated relationship-confirmation workflow that can promote text evidence into a user-authored wiki relation.
