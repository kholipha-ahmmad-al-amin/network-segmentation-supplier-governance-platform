export class SegmentError extends Error { constructor(code, message) { super(message); this.code = code; } }
const role = (actor, required) => { if (actor.role !== required) throw new SegmentError('FORBIDDEN', 'The actor is not authorized for this supplier network segment transition.'); };
export function createSegmentRegistry() {
  const segments = new Map(); const audit = [];
  const log = (action, id, actor) => audit.push({ id: `AUD-${audit.length + 1}`, action, segmentId: id, actor });
  const get = id => { const segment = segments.get(id); if (!segment) throw new SegmentError('NOT_FOUND', 'The supplier network segment was not found.'); return segment; };
  return {
    define(actor, input) { role(actor, 'network-engineer'); if (!/^SEG-[A-Z0-9]{3,}$/.test(input.id || '') || !input.supplier || !/^10\.\d{1,3}\.\d{1,3}\.0\/24$/.test(input.cidr || '')) throw new SegmentError('VALIDATION', 'Identifier, supplier, and supported network segment are required.'); if (segments.has(input.id)) throw new SegmentError('CONFLICT', 'The supplier network segment already exists.'); const segment = { id: input.id, supplier: input.supplier, cidr: input.cidr, state: 'draft' }; segments.set(segment.id, segment); log('segment.defined', segment.id, actor.id); return { ...segment }; },
    activate(actor, id, evidence) { role(actor, 'network-governor'); const segment = get(id); if (segment.state !== 'draft') throw new SegmentError('CONFLICT', 'Only draft supplier segments can activate.'); if (!evidence || evidence.length < 25) throw new SegmentError('VALIDATION', 'Boundary review evidence is required.'); segment.state = 'active'; log('segment.activated', id, actor.id); return { ...segment }; },
    evaluate(actor, id, cidr) { role(actor, 'network-runtime'); const segment = get(id); if (segment.state !== 'active') throw new SegmentError('CONFLICT', 'Only active segments can evaluate traffic.'); const allowed = cidr === segment.cidr; log(allowed ? 'traffic.allowed' : 'traffic.denied', id, actor.id); return { allowed }; },
    retire(actor, id, reason) { role(actor, 'network-governor'); const segment = get(id); if (segment.state !== 'active') throw new SegmentError('CONFLICT', 'Only active segments can retire.'); if (!reason || reason.length < 15) throw new SegmentError('VALIDATION', 'A detailed retirement reason is required.'); segment.state = 'retired'; log('segment.retired', id, actor.id); return { ...segment }; },
    count: () => segments.size,
    audit: () => audit.map(item => ({ ...item }))
  };
}
