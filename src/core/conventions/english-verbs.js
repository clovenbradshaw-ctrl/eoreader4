// Packaged English verb morphology — the irregular base→past map, the same kind of curated
// lexical convention as the seed speech/relation/preposition lists. The realizer's regular
// rules (write/morph.js) handle the productive cases (-ed, doubling, y→ied); this is the
// closed irregular set they cannot derive. Comprehensive standard list, frozen and learnable.

export const SEED_IRREGULAR_PAST = Object.freeze({
  arise: 'arose', awake: 'awoke', be: 'was', bear: 'bore', beat: 'beat', become: 'became',
  begin: 'began', bend: 'bent', bet: 'bet', bind: 'bound', bite: 'bit', bleed: 'bled',
  blow: 'blew', break: 'broke', breed: 'bred', bring: 'brought', build: 'built', burn: 'burned',
  burst: 'burst', buy: 'bought', catch: 'caught', choose: 'chose', cling: 'clung', come: 'came',
  cost: 'cost', creep: 'crept', cut: 'cut', deal: 'dealt', dig: 'dug', do: 'did', draw: 'drew',
  dream: 'dreamed', drink: 'drank', drive: 'drove', eat: 'ate', fall: 'fell', feed: 'fed',
  feel: 'felt', fight: 'fought', find: 'found', flee: 'fled', fling: 'flung', fly: 'flew',
  forbid: 'forbade', forget: 'forgot', forgive: 'forgave', freeze: 'froze', get: 'got',
  give: 'gave', go: 'went', grind: 'ground', grow: 'grew', hang: 'hung', have: 'had',
  hear: 'heard', hide: 'hid', hit: 'hit', hold: 'held', hurt: 'hurt', keep: 'kept', kneel: 'knelt',
  know: 'knew', lay: 'laid', lead: 'led', lean: 'leaned', leap: 'leaped', learn: 'learned',
  leave: 'left', lend: 'lent', let: 'let', lie: 'lay', light: 'lit', lose: 'lost', make: 'made',
  mean: 'meant', meet: 'met', mistake: 'mistook', overcome: 'overcame', pay: 'paid', put: 'put',
  quit: 'quit', read: 'read', ride: 'rode', ring: 'rang', rise: 'rose', run: 'ran', say: 'said',
  see: 'saw', seek: 'sought', sell: 'sold', send: 'sent', set: 'set', shake: 'shook', shed: 'shed',
  shine: 'shone', shoot: 'shot', show: 'showed', shrink: 'shrank', shut: 'shut', sing: 'sang',
  sink: 'sank', sit: 'sat', sleep: 'slept', slide: 'slid', sling: 'slung', speak: 'spoke',
  speed: 'sped', spend: 'spent', spin: 'spun', spit: 'spat', split: 'split', spread: 'spread',
  spring: 'sprang', stand: 'stood', steal: 'stole', stick: 'stuck', sting: 'stung', stink: 'stank',
  strike: 'struck', strive: 'strove', swear: 'swore', sweep: 'swept', swim: 'swam', swing: 'swung',
  take: 'took', teach: 'taught', tear: 'tore', tell: 'told', think: 'thought', throw: 'threw',
  thrust: 'thrust', tread: 'trod', understand: 'understood', wake: 'woke', wear: 'wore',
  weave: 'wove', weep: 'wept', win: 'won', wind: 'wound', withdraw: 'withdrew', wring: 'wrung',
  write: 'wrote',
});

// the past FORMS themselves — what a verb already in the past looks like, so the realizer
// leaves "woke / saw / brought" untouched. Derived from the map (its values) plus the few
// invariant forms (cut/put/set…) that are their own past.
export const SEED_PAST_FORMS = Object.freeze(new Set(Object.values(SEED_IRREGULAR_PAST)));
