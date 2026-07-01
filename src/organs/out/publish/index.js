// organs/out/publish — the archival OUTPUT family: a doc or a claim → a durable,
// self-verifying artifact. The mirror of the layout ingest adapters (organs/in): they
// raise a civic source onto span-addressable spine; these lower a spine (or a claim)
// back onto an artifact that carries its own provenance.
//
// Each is PURE and produces a deterministic SPEC; the heavy renderer is INJECTED by
// the caller, never bundled — the same discipline organs/out/text keeps with the model:
//
//   toMdast / applyEvaPatch  (markdown.js) — a remark/mdast tree, so a reader's EVA
//        edit is a NODE-LEVEL patch, not a fragile text diff, into the GitHub pipeline.
//   pdfPlan / applyPdfPlan   (pdf.js)      — a pdf-lib plan that EMBEDS the source WARC,
//        passage hashes and the EVA chain into the PDF's own metadata (jsPDF cannot).
//        For a human editor, target dolanmiu/docx instead — same plan, different backend.
//   receiptCard              (card.js)     — a Satori element tree for a shareable claim
//        card (text baked to path → deterministic); rasterized through resvg.
//   rasterize / assertStatic (raster.js)   — the resvg-wasm SVG→PNG seam: deterministic,
//        font-stable, static-subset-only, so an archived PNG keeps matching its hash.

export { toMdast, applyEvaPatch }   from './markdown.js';
export { pdfPlan, applyPdfPlan }    from './pdf.js';
export { receiptCard }              from './card.js';
export { rasterize, assertStatic }  from './raster.js';
